import { Router } from 'express';
import { and, desc, eq, ne, or } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { actionItems, departments, events, fiveWhys, incidentReports, keyFindings, locations, notifications, subLocations, users } from '../../db/schema.ts';
import { AuthRequest, requireAuth } from '../../middleware/auth.ts';
import { generateBusinessId } from '../../services/sequence.ts';
import { logAuditEvent } from '../../services/audit.ts';

const router = Router();

// GET /api/incidents - List incidents with filters
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { departmentId, locationId, eventType, status, search } = req.query;

    const list = await db.query.events.findMany({
      orderBy: [desc(events.id)],
      with: {
        department: true,
        location: true,
        reportedBy: true,
        assignedRgl: true,
        assignedRp: true,
      },
    });

    let filtered = list;
    if (departmentId) {
      filtered = filtered.filter(e => e.departmentId === Number(departmentId));
    }
    if (locationId) {
      filtered = filtered.filter(e => e.locationId === Number(locationId));
    }
    if (eventType) {
      filtered = filtered.filter(e => e.eventType === String(eventType));
    }
    if (status) {
      filtered = filtered.filter(e => e.status === String(status));
    }
    if (search) {
      const q = String(search).toLowerCase();
      filtered = filtered.filter(e => 
        e.eventId.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q) ||
        e.eventType.toLowerCase().includes(q)
      );
    }

    res.json(filtered);
  } catch (error) {
    console.error('Error fetching incidents:', error);
    res.status(500).json({ error: 'Failed to retrieve incidents' });
  }
});

// POST /api/incidents - Create new incident
router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const body = req.body;

    if (!body.title || !body.eventType || !body.occurrenceDate || !body.occurrenceTime || !body.departmentId || !body.locationId) {
      return res.status(400).json({ error: 'Missing mandatory incident fields.' });
    }

    const eventId = await generateBusinessId('EVT', 'events', 'event_id');

    const [newEvent] = await db.insert(events).values({
      eventId,
      title: body.title,
      eventType: body.eventType,
      occurrenceDate: body.occurrenceDate,
      occurrenceTime: body.occurrenceTime,
      reportedByUserId: user.id,
      departmentId: Number(body.departmentId),
      locationId: Number(body.locationId),
      subLocationId: body.subLocationId ? Number(body.subLocationId) : null,
      eventCategory: body.eventCategory || 'Safety',
      actualConsequence: body.actualConsequence || 'None recorded',
      potentialConsequence: body.potentialConsequence || 'Potential minor injury or delay',
      immediateActionsTaken: body.immediateActionsTaken || 'Area cordoned off, supervisor notified.',
      personsInvolved: body.personsInvolved || '',
      witnesses: body.witnesses || '',
      injuryOrEnvironmentalDetails: body.injuryOrEnvironmentalDetails || '',
      initialRiskClassification: body.initialRiskClassification || 'Medium',
      potentialRiskClassification: body.potentialRiskClassification || 'High',
      status: 'Reported',
      assignedRglId: body.assignedRglId ? Number(body.assignedRglId) : null,
      assignedRpId: body.assignedRpId ? Number(body.assignedRpId) : null,
      investigationDueDate: body.investigationDueDate || '',
    }).returning();

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'CREATE',
      module: 'Incident Management',
      recordType: 'event',
      recordId: eventId,
      newValues: newEvent,
      comments: `New incident reported: ${body.title}`,
    });

    if (newEvent.assignedRglId) {
      await db.insert(notifications).values({
        userId: newEvent.assignedRglId,
        title: `New Incident Reported: ${eventId}`,
        message: `An incident "${newEvent.title}" requires your review and investigation assignment.`,
        recordType: 'event',
        recordId: eventId,
        isRead: false,
      });
    }

    res.status(201).json(newEvent);
  } catch (error) {
    console.error('Error creating incident:', error);
    res.status(500).json({ error: 'Failed to create incident event' });
  }
});

// GET /api/incidents/:id - Get full incident details
router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const eventIdParam = req.params.id;
    const isNumeric = !isNaN(Number(eventIdParam));

    const eventRecord = await db.query.events.findFirst({
      where: isNumeric ? eq(events.id, Number(eventIdParam)) : eq(events.eventId, eventIdParam),
      with: {
        department: true,
        location: true,
        subLocation: true,
        reportedBy: true,
        assignedRgl: true,
        assignedRp: true,
      },
    });

    if (!eventRecord) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    const report = await db.query.incidentReports.findFirst({
      where: eq(incidentReports.eventId, eventRecord.id),
      with: {
        assignedRp: true,
        reviewingRgl: true,
        whys: {
          orderBy: [fiveWhys.whyNumber],
        },
        findings: true,
      },
    });

    const actions = await db.query.actionItems.findMany({
      where: or(
        eq(actionItems.sourceEventId, eventRecord.id),
        eq(actionItems.sourceRecordId, eventRecord.eventId)
      ),
      with: {
        department: true,
        responsiblePerson: true,
        responsibleGroupLeader: true,
      },
    });

    res.json({
      event: eventRecord,
      investigationReport: report || null,
      actions,
    });
  } catch (error) {
    console.error('Error fetching incident details:', error);
    res.status(500).json({ error: 'Failed to retrieve incident details' });
  }
});

// POST /api/incidents/:id/assign - RGL assigns RP
router.post('/:id/assign', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const { assignedRpId, assignedRglId, investigationDueDate, assignmentNotes } = req.body;

    if (!assignedRpId) {
      return res.status(400).json({ error: 'Responsible Person (RP) is required for assignment.' });
    }

    const eventIdParam = req.params.id;
    const isNumeric = !isNaN(Number(eventIdParam));

    const eventRecord = await db.query.events.findFirst({
      where: isNumeric ? eq(events.id, Number(eventIdParam)) : eq(events.eventId, eventIdParam),
    });

    if (!eventRecord) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    const rglId = assignedRglId ? Number(assignedRglId) : user.id;

    await db.update(events)
      .set({
        assignedRglId: rglId,
        assignedRpId: Number(assignedRpId),
        investigationDueDate: investigationDueDate || '',
        status: 'Under Investigation',
        updatedAt: new Date(),
      })
      .where(eq(events.id, eventRecord.id));

    let existingReport = await db.query.incidentReports.findFirst({
      where: eq(incidentReports.eventId, eventRecord.id),
    });

    if (!existingReport) {
      const reportId = await generateBusinessId('IR', 'incident_reports', 'report_id');
      const today = new Date().toISOString().split('T')[0];
      const dueDate = investigationDueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

      const [newReport] = await db.insert(incidentReports).values({
        reportId,
        eventId: eventRecord.id,
        assignedRpId: Number(assignedRpId),
        reviewingRglId: rglId,
        status: 'Open',
        investigationStartDate: today,
        investigationDueDate: dueDate,
      }).returning();
      existingReport = newReport;
    } else {
      await db.update(incidentReports)
        .set({
          assignedRpId: Number(assignedRpId),
          reviewingRglId: rglId,
          investigationDueDate: investigationDueDate || existingReport.investigationDueDate,
          updatedAt: new Date(),
        })
        .where(eq(incidentReports.id, existingReport.id));
    }

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'ASSIGN',
      module: 'Incident Investigation',
      recordType: 'event',
      recordId: eventRecord.eventId,
      comments: `Investigation assigned to RP #${assignedRpId} by RGL #${rglId}. ${assignmentNotes || ''}`,
    });

    await db.insert(notifications).values({
      userId: Number(assignedRpId),
      title: `Assigned Investigation: ${eventRecord.eventId}`,
      message: `You have been assigned as lead investigator for "${eventRecord.title}". Due date: ${investigationDueDate || 'standard'}.`,
      recordType: 'event',
      recordId: eventRecord.eventId,
      isRead: false,
    });

    res.json({ success: true, report: existingReport });
  } catch (error) {
    console.error('Error assigning incident investigation:', error);
    res.status(500).json({ error: 'Failed to assign investigation' });
  }
});

// POST /api/incidents/:id/investigation/save-draft
router.post('/:id/investigation/save-draft', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const eventIdParam = req.params.id;
    const isNumeric = !isNaN(Number(eventIdParam));

    const eventRecord = await db.query.events.findFirst({
      where: isNumeric ? eq(events.id, Number(eventIdParam)) : eq(events.eventId, eventIdParam),
    });

    if (!eventRecord) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    let report = await db.query.incidentReports.findFirst({
      where: eq(incidentReports.eventId, eventRecord.id),
    });

    const body = req.body;
    if (!report) {
      const reportId = await generateBusinessId('IR', 'incident_reports', 'report_id');
      const [newRep] = await db.insert(incidentReports).values({
        reportId,
        eventId: eventRecord.id,
        assignedRpId: user.id,
        reviewingRglId: eventRecord.assignedRglId || user.id,
        status: 'Open',
        investigationStartDate: new Date().toISOString().split('T')[0],
        investigationDueDate: eventRecord.investigationDueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        sequenceOfEvents: body.sequenceOfEvents || '',
        immediateCauses: body.immediateCauses || '',
        contributingFactors: body.contributingFactors || '',
        failedOrMissingControls: body.failedOrMissingControls || '',
        finalRootCause: body.finalRootCause || '',
        rootCauseCategory: body.rootCauseCategory || 'Procedures & Compliance',
      }).returning();
      report = newRep;
    } else {
      await db.update(incidentReports).set({
        sequenceOfEvents: body.sequenceOfEvents !== undefined ? body.sequenceOfEvents : report.sequenceOfEvents,
        immediateCauses: body.immediateCauses !== undefined ? body.immediateCauses : report.immediateCauses,
        contributingFactors: body.contributingFactors !== undefined ? body.contributingFactors : report.contributingFactors,
        failedOrMissingControls: body.failedOrMissingControls !== undefined ? body.failedOrMissingControls : report.failedOrMissingControls,
        finalRootCause: body.finalRootCause !== undefined ? body.finalRootCause : report.finalRootCause,
        rootCauseCategory: body.rootCauseCategory || report.rootCauseCategory,
        updatedAt: new Date(),
      }).where(eq(incidentReports.id, report.id));
    }

    if (Array.isArray(body.whys)) {
      await db.delete(fiveWhys).where(eq(fiveWhys.incidentReportId, report.id));
      for (const w of body.whys) {
        if (w.question && w.answer) {
          await db.insert(fiveWhys).values({
            incidentReportId: report.id,
            whyNumber: Number(w.whyNumber),
            question: w.question,
            answer: w.answer,
            evidence: w.evidence || '',
          });
        }
      }
    }

    if (Array.isArray(body.findings)) {
      await db.delete(keyFindings).where(eq(keyFindings.incidentReportId, report.id));
      for (const f of body.findings) {
        if (f.description && f.recommendedAction) {
          await db.insert(keyFindings).values({
            incidentReportId: report.id,
            findingRef: f.findingRef || 'KF-01',
            description: f.description,
            evidence: f.evidence || '',
            significance: f.significance || 'Medium',
            recommendedAction: f.recommendedAction,
          });
        }
      }
    }

    res.json({ success: true, message: 'Investigation draft saved successfully' });
  } catch (error) {
    console.error('Error saving investigation draft:', error);
    res.status(500).json({ error: 'Failed to save investigation draft' });
  }
});

// POST /api/incidents/:id/investigation/submit - Strict validation (>= 5 whys, >= 2 findings)
router.post('/:id/investigation/submit', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const eventIdParam = req.params.id;
    const isNumeric = !isNaN(Number(eventIdParam));

    const eventRecord = await db.query.events.findFirst({
      where: isNumeric ? eq(events.id, Number(eventIdParam)) : eq(events.eventId, eventIdParam),
    });

    if (!eventRecord) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    const report = await db.query.incidentReports.findFirst({
      where: eq(incidentReports.eventId, eventRecord.id),
      with: {
        whys: true,
        findings: true,
      },
    });

    if (!report) {
      return res.status(400).json({ error: 'No investigation report created yet. Save draft first.' });
    }

    if (!report.sequenceOfEvents || !report.immediateCauses || !report.finalRootCause) {
      return res.status(400).json({
        error: 'Validation failed: Sequence of events, immediate causes, and final root cause are mandatory before submission.'
      });
    }

    // MANDATORY >= 5 Whys
    const validWhys = report.whys.filter(w => w.question.trim().length > 0 && w.answer.trim().length > 0);
    if (validWhys.length < 5) {
      return res.status(400).json({
        error: `Validation failed: At least 5 completed Why entries are mandatory before submission (Current valid entries: ${validWhys.length}). Each must include question and answer.`
      });
    }

    // MANDATORY >= 2 Findings
    const validFindings = report.findings.filter(f => f.description.trim().length > 0 && f.recommendedAction.trim().length > 0);
    if (validFindings.length < 2) {
      return res.status(400).json({
        error: `Validation failed: At least 2 key findings are mandatory before submission (Current valid findings: ${validFindings.length}). Each finding must specify description and recommended action.`
      });
    }

    await db.update(incidentReports).set({
      status: 'Under Review',
      rpSubmissionStatus: 'Submitted',
      rpSubmittedAt: new Date(),
      rglReviewStatus: 'Pending',
      updatedAt: new Date(),
    }).where(eq(incidentReports.id, report.id));

    await db.update(events).set({
      status: 'Under Review',
      updatedAt: new Date(),
    }).where(eq(events.id, eventRecord.id));

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'SUBMIT',
      module: 'Incident Investigation',
      recordType: 'incident_report',
      recordId: report.reportId,
      comments: `Investigation report submitted by RP ${user.fullName} for RGL review. Validated ${validWhys.length} Whys and ${validFindings.length} findings.`,
    });

    await db.insert(notifications).values({
      userId: report.reviewingRglId,
      title: `Investigation Submitted for Review: ${report.reportId}`,
      message: `RP ${user.fullName} has submitted the complete investigation report for "${eventRecord.title}". Review and decision required.`,
      recordType: 'event',
      recordId: eventRecord.eventId,
      isRead: false,
    });

    res.json({ success: true, message: 'Investigation submitted for RGL review successfully' });
  } catch (error) {
    console.error('Error submitting investigation report:', error);
    res.status(500).json({ error: 'Failed to submit investigation report' });
  }
});

// POST /api/incidents/:id/investigation/review
router.post('/:id/investigation/review', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const { decision, reviewComments } = req.body;

    if (!decision || (decision !== 'Approved' && decision !== 'Returned')) {
      return res.status(400).json({ error: 'Decision must be either "Approved" or "Returned".' });
    }

    const eventIdParam = req.params.id;
    const isNumeric = !isNaN(Number(eventIdParam));

    const eventRecord = await db.query.events.findFirst({
      where: isNumeric ? eq(events.id, Number(eventIdParam)) : eq(events.eventId, eventIdParam),
    });

    if (!eventRecord) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    const report = await db.query.incidentReports.findFirst({
      where: eq(incidentReports.eventId, eventRecord.id),
      with: {
        findings: true,
      },
    });

    if (!report) {
      return res.status(404).json({ error: 'Investigation report not found' });
    }

    // Separation of duties enforcement: RP cannot approve their own report
    if (user.role === 'rp' && user.id === report.assignedRpId) {
      return res.status(403).json({
        error: 'Forbidden: Separation of duties violation. An investigator (RP) cannot approve their own report.'
      });
    }

    const today = new Date().toISOString().split('T')[0];

    if (decision === 'Returned') {
      if (!reviewComments || reviewComments.trim().length === 0) {
        return res.status(400).json({
          error: 'Mandatory review comments are required when returning an investigation for correction.'
        });
      }

      await db.update(incidentReports).set({
        status: 'Returned for Correction',
        rglReviewStatus: 'Returned',
        rglReviewComments: reviewComments,
        rglReviewedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(incidentReports.id, report.id));

      await db.update(events).set({
        status: 'Under Investigation',
        updatedAt: new Date(),
      }).where(eq(events.id, eventRecord.id));

      await logAuditEvent({
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: 'RETURN',
        module: 'Incident Investigation',
        recordType: 'incident_report',
        recordId: report.reportId,
        comments: `Report returned for correction by ${user.fullName}: ${reviewComments}`,
      });

      await db.insert(notifications).values({
        userId: report.assignedRpId,
        title: `Report Returned for Correction: ${report.reportId}`,
        message: `Your investigation report was returned by RGL: "${reviewComments}". Please address comments and resubmit.`,
        recordType: 'event',
        recordId: eventRecord.eventId,
        isRead: false,
      });

      return res.json({ success: true, message: 'Report returned for correction' });
    }

    // Approved
    await db.update(incidentReports).set({
      status: 'Approved',
      rglReviewStatus: 'Approved',
      rglReviewComments: reviewComments || 'Approved by reviewing RGL.',
      rglReviewedAt: new Date(),
      approvalDate: today,
      updatedAt: new Date(),
    }).where(eq(incidentReports.id, report.id));

    await db.update(events).set({
      status: 'Approved',
      updatedAt: new Date(),
    }).where(eq(events.id, eventRecord.id));

    const createdActions = [];
    for (const f of report.findings) {
      const existingAction = await db.query.actionItems.findFirst({
        where: eq(actionItems.sourceFindingId, f.id),
      });

      if (!existingAction) {
        const actionId = await generateBusinessId('ACT', 'action_items', 'action_id');
        const targetDate = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

        const [newAction] = await db.insert(actionItems).values({
          actionId,
          sourceModule: 'Incident',
          sourceRecordId: eventRecord.eventId,
          sourceEventId: eventRecord.id,
          sourceIncidentReportId: report.id,
          sourceFindingId: f.id,
          observationFinding: `[${f.findingRef}] ${f.description}`,
          recommendedAction: f.recommendedAction,
          actionType: 'Corrective',
          responsibleDepartmentId: eventRecord.departmentId,
          responsiblePersonId: report.assignedRpId,
          responsibleGroupLeaderId: report.reviewingRglId,
          priority: f.significance === 'Critical' ? 'Urgent' : (f.significance === 'High' ? 'High' : 'Medium'),
          riskClassification: f.significance || 'Medium',
          targetDate,
          status: 'Open',
        }).returning();

        createdActions.push(newAction);
      }
    }

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'APPROVE',
      module: 'Incident Investigation',
      recordType: 'incident_report',
      recordId: report.reportId,
      comments: `Investigation report approved by ${user.fullName}. Created ${createdActions.length} linked CAPA actions.`,
    });

    await db.insert(notifications).values({
      userId: report.assignedRpId,
      title: `Investigation Approved: ${report.reportId}`,
      message: `Your investigation report for "${eventRecord.title}" has been approved. Traceable CAPA actions have been initialized.`,
      recordType: 'event',
      recordId: eventRecord.eventId,
      isRead: false,
    });

    res.json({
      success: true,
      message: 'Investigation approved and CAPA actions generated',
      createdActionsCount: createdActions.length,
    });
  } catch (error) {
    console.error('Error reviewing investigation:', error);
    res.status(500).json({ error: 'Failed to review investigation report' });
  }
});

// POST /api/incidents/:id/close
router.post('/:id/close', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const eventIdParam = req.params.id;
    const isNumeric = !isNaN(Number(eventIdParam));

    const eventRecord = await db.query.events.findFirst({
      where: isNumeric ? eq(events.id, Number(eventIdParam)) : eq(events.eventId, eventIdParam),
    });

    if (!eventRecord) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    const openActions = await db.query.actionItems.findMany({
      where: and(
        eq(actionItems.sourceEventId, eventRecord.id),
        ne(actionItems.status, 'Closed')
      ),
    });

    if (openActions.length > 0) {
      return res.status(400).json({
        error: `Cannot close incident: ${openActions.length} associated corrective action(s) remain open. All CAPA items must be verified and closed by RGL before final incident closure.`,
        openActionsCount: openActions.length,
      });
    }

    const today = new Date().toISOString().split('T')[0];

    await db.update(events).set({
      status: 'Closed',
      updatedAt: new Date(),
    }).where(eq(events.id, eventRecord.id));

    await db.update(incidentReports).set({
      status: 'Closed',
      closureDate: today,
      updatedAt: new Date(),
    }).where(eq(incidentReports.eventId, eventRecord.id));

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'CLOSE',
      module: 'Incident Management',
      recordType: 'event',
      recordId: eventRecord.eventId,
      comments: `Incident ${eventRecord.eventId} formally closed by ${user.fullName}.`,
    });

    res.json({ success: true, message: `Incident ${eventRecord.eventId} has been closed successfully.` });
  } catch (error) {
    console.error('Error closing incident:', error);
    res.status(500).json({ error: 'Failed to close incident' });
  }
});

// Helper: Normalize date strings or Excel serial numbers into YYYY-MM-DD
function normalizeDate(raw: any): string {
  if (!raw) return new Date().toISOString().split('T')[0];
  if (typeof raw === 'number') {
    // Excel serial date (days since 1899-12-30)
    const utcDays = Math.floor(raw - 25569);
    const utcValue = utcDays * 86400;
    const dateInfo = new Date(utcValue * 1000);
    if (!isNaN(dateInfo.getTime())) {
      return dateInfo.toISOString().split('T')[0];
    }
  }
  const str = String(raw).trim();
  // Check if already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // Check DD/MM/YYYY or DD-MM-YYYY
  const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const year = dmy[3];
    return `${year}-${month}-${day}`;
  }

  // Try standard parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

// Helper: Normalize time strings
function normalizeTime(raw: any): string {
  if (!raw) return '09:00';
  if (typeof raw === 'number') {
    // Fraction of a day in Excel
    const totalMinutes = Math.round(raw * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
  const str = String(raw).trim();
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(str)) {
    const parts = str.split(':');
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  return '09:00';
}

// POST /api/incidents/import - Incident Register Import & Integration Engine
router.post('/import', requireAuth, async (req: AuthRequest, res) => {
  try {
    const currentUser = req.dbUser!;
    if (currentUser.role === 'viewer') {
      return res.status(403).json({ error: 'Read-only Viewers do not have permission to import incident registers.' });
    }

    const { records, duplicateHandling = 'skip' } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'No incident records supplied for import.' });
    }

    // Pre-fetch reference master data for fast resolution
    const [allDepts, allLocs, allSubs, allUsers, existingEventsList] = await Promise.all([
      db.select().from(departments),
      db.select().from(locations),
      db.select().from(subLocations),
      db.select().from(users),
      db.select({ id: events.id, eventId: events.eventId }).from(events),
    ]);

    // Lookup caches
    const existingEventsMap = new Map<string, number>();
    existingEventsList.forEach(e => existingEventsMap.set(e.eventId.toUpperCase(), e.id));

    // Default fallbacks
    const defaultDept = allDepts[0] || (await db.insert(departments).values({ name: 'General Operations', code: 'GEN' }).returning())[0];
    const defaultLoc = allLocs[0] || (await db.insert(locations).values({ name: 'Main Industrial Facility', code: 'MAIN' }).returning())[0];
    const defaultRgl = allUsers.find(u => u.role === 'rgl') || allUsers.find(u => u.role === 'admin') || currentUser;
    const defaultRp = allUsers.find(u => u.role === 'rp') || currentUser;

    const validEventTypes = ['Near Miss', 'First Aid Injury', 'Medical Treatment Injury', 'Lost Time Injury (LTI)', 'Dangerous Occurrence', 'Environmental Incident', 'Property Damage', 'Fire / Explosion', 'Vehicle Incident'];
    const validCategories = ['Safety', 'Environmental', 'Health', 'Process Safety', 'Security', 'Quality'];
    const validRisks = ['Low', 'Medium', 'High', 'Critical'];
    const validStatuses = ['Reported', 'Under Investigation', 'Under Review', 'Returned for Correction', 'Approved', 'Closed'];

    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    let linkedInvestigationsCount = 0;
    let linkedActionsCount = 0;

    const itemizedResults: Array<{
      rowNumber: number;
      eventId: string;
      title: string;
      status: 'imported' | 'updated' | 'skipped' | 'failed';
      message: string;
      linkedInvestigation?: string;
      linkedAction?: string;
      errors?: string[];
    }> = [];

    // Process each row
    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNumber = i + 1;
      const rowErrors: string[] = [];

      // Validate required core fields
      const rawTitle = row.title || row.Title || row.description || row.Description || row.incidentTitle || row['Incident Title'];
      if (!rawTitle || String(rawTitle).trim() === '') {
        rowErrors.push('Missing incident title or description');
      }

      const title = String(rawTitle || `Imported Incident Record #${rowNumber}`).trim();

      // Normalize occurrence date and time
      const occurrenceDate = normalizeDate(row.occurrenceDate || row.date || row.Date || row['Incident Date'] || row['Occurrence Date']);
      const occurrenceTime = normalizeTime(row.occurrenceTime || row.time || row.Time || row['Incident Time']);

      // Normalize Event Type
      let eventType = String(row.eventType || row.type || row.Type || row['Event Type'] || row['Incident Type'] || 'Near Miss').trim();
      const matchedType = validEventTypes.find(t => t.toLowerCase() === eventType.toLowerCase());
      if (matchedType) {
        eventType = matchedType;
      } else if (eventType.toLowerCase().includes('lost')) {
        eventType = 'Lost Time Injury (LTI)';
      } else if (eventType.toLowerCase().includes('first aid')) {
        eventType = 'First Aid Injury';
      } else if (eventType.toLowerCase().includes('medical')) {
        eventType = 'Medical Treatment Injury';
      } else if (eventType.toLowerCase().includes('env')) {
        eventType = 'Environmental Incident';
      } else if (eventType.toLowerCase().includes('damage')) {
        eventType = 'Property Damage';
      } else if (eventType.toLowerCase().includes('danger')) {
        eventType = 'Dangerous Occurrence';
      } else {
        eventType = 'Near Miss';
      }

      // Event Category
      let eventCategory = String(row.eventCategory || row.category || row.Category || 'Safety').trim();
      if (!validCategories.includes(eventCategory)) {
        eventCategory = 'Safety';
      }

      // Consequence & Immediate Actions
      const actualConsequence = String(row.actualConsequence || row.severity || row.consequence || row['Actual Consequence'] || 'None recorded during register import.').trim();
      const potentialConsequence = String(row.potentialConsequence || row.potential || row['Potential Consequence'] || 'Potential workplace disruption or injury.').trim();
      const immediateActionsTaken = String(row.immediateActionsTaken || row.actionsTaken || row['Immediate Actions'] || 'Area secured, supervisor notified.').trim();
      const personsInvolved = String(row.personsInvolved || row['Persons Involved'] || '').trim();
      const witnesses = String(row.witnesses || row.Witnesses || '').trim();
      const injuryOrEnvironmentalDetails = String(row.injuryOrEnvironmentalDetails || row['Injury Details'] || '').trim();

      // Risks
      let initialRisk = String(row.initialRiskClassification || row.initialRisk || row.risk || row['Initial Risk'] || 'Medium').trim();
      if (!validRisks.map(r => r.toLowerCase()).includes(initialRisk.toLowerCase())) initialRisk = 'Medium';
      else initialRisk = validRisks.find(r => r.toLowerCase() === initialRisk.toLowerCase()) || 'Medium';

      let potentialRisk = String(row.potentialRiskClassification || row.potentialRisk || row['Potential Risk'] || 'High').trim();
      if (!validRisks.map(r => r.toLowerCase()).includes(potentialRisk.toLowerCase())) potentialRisk = 'High';
      else potentialRisk = validRisks.find(r => r.toLowerCase() === potentialRisk.toLowerCase()) || 'High';

      // Status
      let status = String(row.status || row.Status || 'Reported').trim();
      const matchedStatus = validStatuses.find(s => s.toLowerCase() === status.toLowerCase());
      if (matchedStatus) {
        status = matchedStatus;
      } else {
        status = 'Reported';
      }

      // Resolve Department
      let departmentId = defaultDept.id;
      const deptVal = String(row.departmentId || row.department || row.Department || row.dept || row['Department Name'] || '').trim();
      if (deptVal) {
        const foundDept = allDepts.find(d => 
          String(d.id) === deptVal || 
          d.code.toUpperCase() === deptVal.toUpperCase() || 
          d.name.toLowerCase() === deptVal.toLowerCase() ||
          d.name.toLowerCase().includes(deptVal.toLowerCase())
        );
        if (foundDept) departmentId = foundDept.id;
      }

      // Resolve Location
      let locationId = defaultLoc.id;
      const locVal = String(row.locationId || row.location || row.Location || row.facility || row.plant || row['Location Name'] || row.Site || '').trim();
      if (locVal) {
        const foundLoc = allLocs.find(l => 
          String(l.id) === locVal || 
          l.code.toUpperCase() === locVal.toUpperCase() || 
          l.name.toLowerCase() === locVal.toLowerCase() ||
          l.name.toLowerCase().includes(locVal.toLowerCase())
        );
        if (foundLoc) locationId = foundLoc.id;
      }

      // Resolve Sub-location if specified
      let subLocationId: number | null = null;
      const subVal = String(row.subLocationId || row.subLocation || row['Sub Location'] || row.area || row.Zone || '').trim();
      if (subVal) {
        const foundSub = allSubs.find(s => 
          s.locationId === locationId && (
            String(s.id) === subVal || 
            s.code.toUpperCase() === subVal.toUpperCase() || 
            s.name.toLowerCase().includes(subVal.toLowerCase())
          )
        );
        if (foundSub) subLocationId = foundSub.id;
      }

      // Resolve Personnel
      let reportedByUserId = currentUser.id;
      const reporterVal = String(row.reportedBy || row.reportedByUserId || row.reporter || row['Reported By'] || '').trim();
      if (reporterVal) {
        const foundUser = allUsers.find(u => 
          String(u.id) === reporterVal || 
          u.email.toLowerCase() === reporterVal.toLowerCase() || 
          u.fullName.toLowerCase().includes(reporterVal.toLowerCase())
        );
        if (foundUser) reportedByUserId = foundUser.id;
      }

      let assignedRglId: number | null = defaultRgl.id;
      const rglVal = String(row.assignedRglId || row.assignedRgl || row.rgl || row['Assigned RGL'] || row.supervisor || '').trim();
      if (rglVal) {
        const foundRgl = allUsers.find(u => 
          String(u.id) === rglVal || 
          u.email.toLowerCase() === rglVal.toLowerCase() || 
          u.fullName.toLowerCase().includes(rglVal.toLowerCase())
        );
        if (foundRgl) assignedRglId = foundRgl.id;
      }

      let assignedRpId: number | null = defaultRp.id;
      const rpVal = String(row.assignedRpId || row.assignedRp || row.rp || row['Assigned RP'] || row.investigator || '').trim();
      if (rpVal) {
        const foundRp = allUsers.find(u => 
          String(u.id) === rpVal || 
          u.email.toLowerCase() === rpVal.toLowerCase() || 
          u.fullName.toLowerCase().includes(rpVal.toLowerCase())
        );
        if (foundRp) assignedRpId = foundRp.id;
      }

      // If errors, mark as failed
      if (rowErrors.length > 0) {
        failedCount++;
        itemizedResults.push({
          rowNumber,
          eventId: row.eventId || `ROW-${rowNumber}`,
          title,
          status: 'failed',
          message: rowErrors.join('; '),
          errors: rowErrors,
        });
        continue;
      }

      // Event ID Resolution & Deduplication
      let rawEventId = String(row.eventId || row.EventId || row['Event ID'] || row['Incident ID'] || row['Reference No'] || '').trim();
      let eventId = rawEventId;
      let isExisting = false;
      let existingDbId: number | null = null;

      if (eventId) {
        const matchedDbId = existingEventsMap.get(eventId.toUpperCase());
        if (matchedDbId) {
          isExisting = true;
          existingDbId = matchedDbId;
        }
      }

      // Handle duplicate mode
      if (isExisting && duplicateHandling === 'skip') {
        skippedCount++;
        itemizedResults.push({
          rowNumber,
          eventId,
          title,
          status: 'skipped',
          message: `Record with Event ID ${eventId} already exists in database. Skipped to preserve original data.`,
        });
        continue;
      }

      // If eventId is missing, generate new business ID
      if (!eventId) {
        eventId = await generateBusinessId('EVT', 'events', 'event_id');
      }

      let savedEvent: any;

      if (isExisting && duplicateHandling === 'update' && existingDbId) {
        // Update existing record
        const [updated] = await db.update(events).set({
          title,
          eventType,
          occurrenceDate,
          occurrenceTime,
          departmentId,
          locationId,
          subLocationId,
          eventCategory,
          actualConsequence,
          potentialConsequence,
          immediateActionsTaken,
          personsInvolved,
          witnesses,
          injuryOrEnvironmentalDetails,
          initialRiskClassification: initialRisk,
          potentialRiskClassification: potentialRisk,
          status,
          assignedRglId,
          assignedRpId,
          investigationDueDate: row.investigationDueDate || '',
          updatedAt: new Date(),
        }).where(eq(events.id, existingDbId)).returning();
        savedEvent = updated;
        updatedCount++;
      } else {
        // Insert new record
        const [inserted] = await db.insert(events).values({
          eventId,
          title,
          eventType,
          occurrenceDate,
          occurrenceTime,
          reportedByUserId,
          departmentId,
          locationId,
          subLocationId,
          eventCategory,
          actualConsequence,
          potentialConsequence,
          immediateActionsTaken,
          personsInvolved,
          witnesses,
          injuryOrEnvironmentalDetails,
          initialRiskClassification: initialRisk,
          potentialRiskClassification: potentialRisk,
          status,
          assignedRglId,
          assignedRpId,
          investigationDueDate: row.investigationDueDate || '',
        }).returning();
        savedEvent = inserted;
        importedCount++;
        existingEventsMap.set(eventId.toUpperCase(), savedEvent.id);
      }

      // INTEGRATION 1: Link Investigation Report if root cause data is provided
      let linkedInvId: string | undefined;
      const rootCause = String(row.rootCause || row.finalRootCause || row['Root Cause'] || row['Final Root Cause'] || '').trim();
      const immediateCauses = String(row.immediateCauses || row['Immediate Causes'] || '').trim();
      const contributingFactors = String(row.contributingFactors || row['Contributing Factors'] || '').trim();
      const sequenceOfEvents = String(row.sequenceOfEvents || row['Sequence of Events'] || '').trim();

      if (rootCause || immediateCauses || status === 'Under Review' || status === 'Approved' || status === 'Closed') {
        const existingInv = await db.select().from(incidentReports).where(eq(incidentReports.eventId, savedEvent.id)).limit(1);
        if (existingInv.length === 0) {
          const invId = await generateBusinessId('INV', 'incident_reports', 'report_id');
          await db.insert(incidentReports).values({
            reportId: invId,
            eventId: savedEvent.id,
            assignedRpId: assignedRpId || defaultRp.id,
            reviewingRglId: assignedRglId || defaultRgl.id,
            status: status === 'Approved' || status === 'Closed' ? 'Approved' : 'Open',
            investigationStartDate: occurrenceDate,
            investigationDueDate: row.investigationDueDate || occurrenceDate,
            sequenceOfEvents: sequenceOfEvents || 'Sequence reconstructed from imported incident register log.',
            immediateCauses: immediateCauses || 'Immediate conditions documented in register.',
            contributingFactors: contributingFactors || 'Systemic factors from initial register notes.',
            failedOrMissingControls: row.failedControls || row['Failed Controls'] || 'Identified during initial field assessment.',
            finalRootCause: rootCause || 'Root cause established during incident register integration.',
            rootCauseCategory: row.rootCauseCategory || row['Root Cause Category'] || 'Procedures & Compliance',
            rpSubmissionStatus: status === 'Approved' || status === 'Closed' ? 'Submitted' : 'Draft',
            rglReviewStatus: status === 'Approved' || status === 'Closed' ? 'Approved' : 'Pending',
            approvalDate: status === 'Approved' || status === 'Closed' ? occurrenceDate : '',
          });
          linkedInvestigationsCount++;
          linkedInvId = invId;
        }
      }

      // INTEGRATION 2: Link CAPA Action Item if corrective action data is provided
      let linkedActId: string | undefined;
      const correctiveAction = String(row.correctiveAction || row.action || row.recommendedAction || row['Corrective Action'] || row['CAPA Action'] || '').trim();
      if (correctiveAction) {
        const actId = await generateBusinessId('ACT', 'action_items', 'action_id');
        await db.insert(actionItems).values({
          actionId: actId,
          sourceModule: 'Incident',
          sourceRecordId: eventId,
          sourceEventId: savedEvent.id,
          observationFinding: `Action derived from imported incident ${eventId}: ${title}`,
          recommendedAction: correctiveAction,
          actionType: row.actionType || row['Action Type'] || 'Corrective',
          responsibleDepartmentId: departmentId,
          responsiblePersonId: assignedRpId || defaultRp.id,
          responsibleGroupLeaderId: assignedRglId || defaultRgl.id,
          priority: row.actionPriority || row['Action Priority'] || initialRisk,
          riskClassification: initialRisk,
          targetDate: row.actionTargetDate || row['Target Date'] || occurrenceDate,
          status: status === 'Closed' ? 'Approved' : 'Open',
        });
        linkedActionsCount++;
        linkedActId = actId;
      }

      itemizedResults.push({
        rowNumber,
        eventId,
        title,
        status: isExisting ? 'updated' : 'imported',
        message: isExisting
          ? `Updated existing event ${eventId} successfully.`
          : `Imported event ${eventId} successfully.`,
        linkedInvestigation: linkedInvId,
        linkedAction: linkedActId,
      });
    }

    // Log Batch Audit Event
    await logAuditEvent({
      userId: currentUser.id,
      userEmail: currentUser.email,
      userRole: currentUser.role,
      action: 'IMPORT',
      module: 'Incident Management',
      recordType: 'event_batch',
      recordId: `BATCH-${Date.now()}`,
      comments: `Bulk incident register import: ${importedCount} imported, ${updatedCount} updated, ${skippedCount} skipped, ${failedCount} failed. Linked ${linkedInvestigationsCount} investigations and ${linkedActionsCount} CAPA actions.`,
    });

    res.json({
      success: true,
      summary: {
        totalProcessed: records.length,
        importedCount,
        updatedCount,
        skippedCount,
        failedCount,
        linkedInvestigationsCount,
        linkedActionsCount,
      },
      results: itemizedResults,
    });
  } catch (error: any) {
    console.error('Error during incident register import:', error);
    res.status(500).json({ error: error.message || 'Failed to process incident register import.' });
  }
});

export default router;


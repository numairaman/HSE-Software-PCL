import { Router } from 'express';
import { and, desc, eq, ne } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { actionItems, auditEvents, emergencyDrills, events, hazardReports, incidentReports, inspectionEvents, inspectionObservations, meetings, organizations, trainingAttendance, trainingSessions, users } from '../../db/schema.ts';
import { AuthRequest, requireAuth } from '../../middleware/auth.ts';

const router = Router();

// GET /api/analytics/dashboard
router.get('/dashboard', requireAuth, async (req: AuthRequest, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const orgs = await db.select().from(organizations).limit(1);
    const org = orgs[0] || {
      name: 'Apex Industrial Group',
      totalHoursWorked: 750000,
      trirMultiplier: 200000,
      ltifrMultiplier: 1000000,
    };

    const allEvents = await db.query.events.findMany({
      with: { department: true, location: true },
    });

    const allActions = await db.query.actionItems.findMany({
      with: { department: true },
    });

    const allInspections = await db.select().from(inspectionEvents);
    const allObservations = await db.select().from(inspectionObservations);
    const allMeetings = await db.select().from(meetings);
    const allTrainingSessions = await db.select().from(trainingSessions);
    const allAttendance = await db.select().from(trainingAttendance);
    const allDrills = await db.select().from(emergencyDrills);
    const allInvestigations = await db.select().from(incidentReports);

    const totalIncidents = allEvents.length;
    const nearMisses = allEvents.filter(e => e.eventType === 'Near Miss').length;

    const recordableInjuries = allEvents.filter(e => 
      ['Medical Treatment Case', 'Restricted Work Case', 'Lost Time Injury', 'Fatality'].includes(e.eventType)
    ).length;

    const lostTimeInjuries = allEvents.filter(e => e.eventType === 'Lost Time Injury').length;
    const highPotentialEvents = allEvents.filter(e => e.potentialRiskClassification === 'High' || e.potentialRiskClassification === 'Critical').length;

    const hours = Math.max(1, org.totalHoursWorked);
    const trir = ((recordableInjuries * org.trirMultiplier) / hours).toFixed(2);
    const ltifr = ((lostTimeInjuries * org.ltifrMultiplier) / hours).toFixed(2);

    const openInvestigations = allInvestigations.filter(i => i.status === 'Open' || i.status === 'Returned for Correction').length;
    const investigationsAwaitingApproval = allInvestigations.filter(i => i.status === 'Under Review').length;

    const totalActions = allActions.length;
    const closedActions = allActions.filter(a => a.status === 'Closed').length;
    const openActions = totalActions - closedActions;
    const actionsAwaitingReview = allActions.filter(a => a.status === 'Submitted for Review').length;
    
    const overdueActions = allActions.filter(a => a.targetDate < today && a.status !== 'Closed').length;
    const actionClosureRate = totalActions > 0 ? Math.round((closedActions / totalActions) * 100) : 100;

    const completedInspections = allInspections.filter(i => i.status === 'Completed' || i.status === 'Closed').length;
    const totalObservationsCount = allObservations.length;
    const highRiskObservations = allObservations.filter(o => o.riskRating === 'High' || o.riskRating === 'Critical').length;

    const completedTrainings = allTrainingSessions.filter(t => t.status === 'Completed').length;
    const totalAttendanceCount = allAttendance.length;
    const passedAttendanceCount = allAttendance.filter(a => a.attended && a.competencyResult === 'Pass').length;
    const trainingCompletionRate = totalAttendanceCount > 0 ? Math.round((passedAttendanceCount / totalAttendanceCount) * 100) : 0;

    const completedDrills = allDrills.filter(d => d.status === 'Completed' || d.status === 'Evaluated' || d.status === 'Closed').length;
    const plannedDrills = allDrills.length;

    const incidentsByType: Record<string, number> = {};
    const incidentsByDepartment: Record<string, number> = {};
    const incidentsBySeverity: Record<string, number> = {};

    for (const e of allEvents) {
      incidentsByType[e.eventType] = (incidentsByType[e.eventType] || 0) + 1;
      const deptName = e.department?.name || 'General';
      incidentsByDepartment[deptName] = (incidentsByDepartment[deptName] || 0) + 1;
      incidentsBySeverity[e.initialRiskClassification] = (incidentsBySeverity[e.initialRiskClassification] || 0) + 1;
    }

    const actionsByPriority: Record<string, number> = {};
    const actionsByDepartment: Record<string, number> = {};

    for (const a of allActions) {
      actionsByPriority[a.priority] = (actionsByPriority[a.priority] || 0) + 1;
      const deptName = a.department?.name || 'General';
      actionsByDepartment[deptName] = (actionsByDepartment[deptName] || 0) + 1;
    }

    res.json({
      organization: org,
      metrics: {
        totalIncidents,
        nearMisses,
        recordableInjuries,
        lostTimeInjuries,
        highPotentialEvents,
        trir: Number(trir),
        ltifr: Number(ltifr),
        openInvestigations,
        investigationsAwaitingApproval,
        totalActions,
        openActions,
        closedActions,
        actionsAwaitingReview,
        overdueActions,
        actionClosureRate,
        completedInspections,
        totalObservationsCount,
        highRiskObservations,
        completedTrainings,
        trainingCompletionRate,
        completedDrills,
        plannedDrills,
        upcomingMeetings: allMeetings.filter(m => m.status === 'Scheduled').length,
      },
      distributions: {
        incidentsByType,
        incidentsByDepartment,
        incidentsBySeverity,
        actionsByPriority,
        actionsByDepartment,
      },
    });
  } catch (error) {
    console.error('Error computing dashboard analytics:', error);
    res.status(500).json({ error: 'Failed to compute dashboard analytics' });
  }
});

// GET /api/analytics/export
router.get('/export', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { reportType } = req.query;

    if (reportType === 'incidents') {
      const items = await db.query.events.findMany({
        with: { department: true, location: true, reportedBy: true },
        orderBy: [desc(events.id)],
      });
      const rows = items.map(i => ({
        'Event ID': i.eventId,
        'Title': i.title,
        'Type': i.eventType,
        'Category': i.eventCategory,
        'Date': i.occurrenceDate,
        'Time': i.occurrenceTime,
        'Department': i.department?.name || '',
        'Location': i.location?.name || '',
        'Severity': i.initialRiskClassification,
        'Potential': i.potentialRiskClassification,
        'Status': i.status,
        'Reported By': i.reportedBy?.fullName || '',
        'Reported At': i.reportedAt?.toISOString() || '',
      }));
      return res.json({ title: 'Incident Register Report', generatedAt: new Date().toISOString(), rows });
    }

    if (reportType === 'capa') {
      const items = await db.query.actionItems.findMany({
        with: { department: true, responsiblePerson: true, responsibleGroupLeader: true },
        orderBy: [desc(actionItems.id)],
      });
      const today = new Date().toISOString().split('T')[0];
      const rows = items.map(a => ({
        'Action ID': a.actionId,
        'Source Module': a.sourceModule,
        'Source Record': a.sourceRecordId,
        'Finding': a.observationFinding,
        'Action Required': a.recommendedAction,
        'Type': a.actionType,
        'Department': a.department?.name || '',
        'Responsible Person': a.responsiblePerson?.fullName || '',
        'Group Leader': a.responsibleGroupLeader?.fullName || '',
        'Priority': a.priority,
        'Target Date': a.targetDate,
        'Status': a.status,
        'Is Overdue': a.targetDate < today && a.status !== 'Closed' ? 'YES' : 'NO',
        'Closure Date': a.closureDate || '',
      }));
      return res.json({ title: 'Corrective Action Register (CAPA)', generatedAt: new Date().toISOString(), rows });
    }

    if (reportType === 'audits') {
      const items = await db.query.auditEvents.findMany({
        orderBy: [desc(auditEvents.id)],
        limit: 500,
      });
      const rows = items.map(a => ({
        'ID': a.id,
        'Timestamp': a.createdAt?.toISOString() || '',
        'User Email': a.userEmail,
        'Role': a.userRole,
        'Action': a.action,
        'Module': a.module,
        'Record Type': a.recordType,
        'Record ID': a.recordId,
        'Comments': a.comments || '',
      }));
      return res.json({ title: 'Tamper-Resistant Audit Trail Report', generatedAt: new Date().toISOString(), rows });
    }

    res.json({ message: 'Specify ?reportType=incidents | capa | audits' });
  } catch (error) {
    console.error('Error generating export:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

export default router;

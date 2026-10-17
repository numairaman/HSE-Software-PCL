import { Router } from 'express';
import { and, desc, eq, ne, or } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { actionItems, notifications, users } from '../../db/schema.ts';
import { AuthRequest, requireAuth } from '../../middleware/auth.ts';
import { generateBusinessId } from '../../services/sequence.ts';
import { logAuditEvent } from '../../services/audit.ts';

const router = Router();

// GET /api/actions
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { departmentId, priority, status, sourceModule, isOverdue, rpId, rglId, search } = req.query;
    const today = new Date().toISOString().split('T')[0];

    const list = await db.query.actionItems.findMany({
      orderBy: [desc(actionItems.id)],
      with: {
        department: true,
        responsiblePerson: true,
        responsibleGroupLeader: true,
      },
    });

    let filtered = list.map(item => {
      const isPastTarget = item.targetDate < today;
      const isItemOverdue = isPastTarget && item.status !== 'Closed';
      const targetDate = new Date(item.targetDate);
      const diffTime = Math.max(0, new Date(today).getTime() - targetDate.getTime());
      const overdueDays = isItemOverdue ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : 0;

      return {
        ...item,
        isOverdue: isItemOverdue,
        overdueDays,
      };
    });

    if (departmentId) {
      filtered = filtered.filter(a => a.responsibleDepartmentId === Number(departmentId));
    }
    if (priority) {
      filtered = filtered.filter(a => a.priority === String(priority));
    }
    if (status) {
      filtered = filtered.filter(a => a.status === String(status));
    }
    if (sourceModule) {
      filtered = filtered.filter(a => a.sourceModule === String(sourceModule));
    }
    if (rpId) {
      filtered = filtered.filter(a => a.responsiblePersonId === Number(rpId));
    }
    if (rglId) {
      filtered = filtered.filter(a => a.responsibleGroupLeaderId === Number(rglId));
    }
    if (isOverdue === 'true') {
      filtered = filtered.filter(a => a.isOverdue);
    }
    if (search) {
      const q = String(search).toLowerCase();
      filtered = filtered.filter(a =>
        a.actionId.toLowerCase().includes(q) ||
        a.observationFinding.toLowerCase().includes(q) ||
        a.recommendedAction.toLowerCase().includes(q) ||
        a.sourceRecordId.toLowerCase().includes(q)
      );
    }

    res.json(filtered);
  } catch (error) {
    console.error('Error fetching CAPA actions:', error);
    res.status(500).json({ error: 'Failed to retrieve corrective actions' });
  }
});

// POST /api/actions
router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const body = req.body;

    if (!body.observationFinding || !body.recommendedAction || !body.responsibleDepartmentId || !body.responsiblePersonId || !body.targetDate) {
      return res.status(400).json({ error: 'Missing mandatory action fields (Finding, Recommended Action, Department, RP, Target Date).' });
    }

    const actionId = await generateBusinessId('ACT', 'action_items', 'action_id');
    const rglId = body.responsibleGroupLeaderId ? Number(body.responsibleGroupLeaderId) : user.id;

    const [newAction] = await db.insert(actionItems).values({
      actionId,
      sourceModule: body.sourceModule || 'General',
      sourceRecordId: body.sourceRecordId || actionId,
      sourceEventId: body.sourceEventId ? Number(body.sourceEventId) : null,
      sourceIncidentReportId: body.sourceIncidentReportId ? Number(body.sourceIncidentReportId) : null,
      sourceFindingId: body.sourceFindingId ? Number(body.sourceFindingId) : null,
      observationFinding: body.observationFinding,
      recommendedAction: body.recommendedAction,
      actionType: body.actionType || 'Corrective',
      responsibleDepartmentId: Number(body.responsibleDepartmentId),
      responsiblePersonId: Number(body.responsiblePersonId),
      responsibleGroupLeaderId: rglId,
      priority: body.priority || 'Medium',
      riskClassification: body.riskClassification || 'Medium',
      targetDate: body.targetDate,
      status: 'Open',
    }).returning();

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'CREATE',
      module: 'Central CAPA',
      recordType: 'action_item',
      recordId: actionId,
      newValues: newAction,
      comments: `New CAPA action raised from ${body.sourceModule || 'General'}: ${body.recommendedAction.substring(0, 80)}`,
    });

    await db.insert(notifications).values({
      userId: Number(body.responsiblePersonId),
      title: `New CAPA Action Assigned: ${actionId}`,
      message: `You have been assigned action "${body.recommendedAction.substring(0, 60)}". Target completion date: ${body.targetDate}.`,
      recordType: 'action',
      recordId: actionId,
      isRead: false,
    });

    res.status(201).json(newAction);
  } catch (error) {
    console.error('Error creating action:', error);
    res.status(500).json({ error: 'Failed to create corrective action' });
  }
});

// GET /api/actions/:id
router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const idParam = req.params.id;
    const isNumeric = !isNaN(Number(idParam));

    const item = await db.query.actionItems.findFirst({
      where: isNumeric ? eq(actionItems.id, Number(idParam)) : eq(actionItems.actionId, idParam),
      with: {
        department: true,
        responsiblePerson: true,
        responsibleGroupLeader: true,
        event: true,
      },
    });

    if (!item) {
      return res.status(404).json({ error: 'Action item not found' });
    }

    const today = new Date().toISOString().split('T')[0];
    const isPastTarget = item.targetDate < today;
    const isOverdue = isPastTarget && item.status !== 'Closed';

    res.json({
      ...item,
      isOverdue,
      overdueDays: isOverdue ? Math.ceil((new Date(today).getTime() - new Date(item.targetDate).getTime()) / (1000 * 60 * 60 * 24)) : 0,
    });
  } catch (error) {
    console.error('Error fetching action details:', error);
    res.status(500).json({ error: 'Failed to retrieve action details' });
  }
});

// POST /api/actions/:id/start
router.post('/:id/start', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const idParam = req.params.id;
    const isNumeric = !isNaN(Number(idParam));

    const item = await db.query.actionItems.findFirst({
      where: isNumeric ? eq(actionItems.id, Number(idParam)) : eq(actionItems.actionId, idParam),
    });

    if (!item) {
      return res.status(404).json({ error: 'Action item not found' });
    }

    if (item.status === 'Closed') {
      return res.status(400).json({ error: 'Closed actions cannot be transitioned directly.' });
    }

    await db.update(actionItems).set({
      status: 'In Progress',
      updatedAt: new Date(),
    }).where(eq(actionItems.id, item.id));

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'UPDATE',
      module: 'Central CAPA',
      recordType: 'action_item',
      recordId: item.actionId,
      comments: `Action marked In Progress by ${user.fullName}`,
    });

    res.json({ success: true, message: 'Action marked In Progress' });
  } catch (error) {
    console.error('Error progressing action:', error);
    res.status(500).json({ error: 'Failed to update action status' });
  }
});

// POST /api/actions/:id/submit
router.post('/:id/submit', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const { rpActionDetails, completionEvidence, actualCompletionDate } = req.body;

    if (!rpActionDetails || rpActionDetails.trim().length === 0) {
      return res.status(400).json({ error: 'Detailed implementation notes (RP Action Details) are mandatory before submission.' });
    }

    const idParam = req.params.id;
    const isNumeric = !isNaN(Number(idParam));

    const item = await db.query.actionItems.findFirst({
      where: isNumeric ? eq(actionItems.id, Number(idParam)) : eq(actionItems.actionId, idParam),
    });

    if (!item) {
      return res.status(404).json({ error: 'Action item not found' });
    }

    if (item.status === 'Closed') {
      return res.status(400).json({ error: 'Action is already closed.' });
    }

    const today = new Date().toISOString().split('T')[0];
    const compDate = actualCompletionDate || today;

    await db.update(actionItems).set({
      rpActionDetails,
      completionEvidence: completionEvidence || '',
      rpSubmissionDate: today,
      actualCompletionDate: compDate,
      status: 'Submitted for Review',
      updatedAt: new Date(),
    }).where(eq(actionItems.id, item.id));

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'SUBMIT',
      module: 'Central CAPA',
      recordType: 'action_item',
      recordId: item.actionId,
      newValues: { rpActionDetails, completionEvidence },
      comments: `Action submitted for review by RP ${user.fullName}`,
    });

    await db.insert(notifications).values({
      userId: item.responsibleGroupLeaderId,
      title: `CAPA Submitted for Review: ${item.actionId}`,
      message: `RP has submitted completion evidence for action "${item.recommendedAction.substring(0, 50)}...". Verification required.`,
      recordType: 'action',
      recordId: item.actionId,
      isRead: false,
    });

    res.json({ success: true, message: 'Action submitted for RGL verification successfully' });
  } catch (error) {
    console.error('Error submitting action for review:', error);
    res.status(500).json({ error: 'Failed to submit action' });
  }
});

// POST /api/actions/:id/review - Strict separation of duties enforced
router.post('/:id/review', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const { decision, rglReviewComments, verificationEvidence } = req.body;

    if (!decision || (decision !== 'Approved' && decision !== 'Returned')) {
      return res.status(400).json({ error: 'Decision must be either "Approved" or "Returned".' });
    }

    const idParam = req.params.id;
    const isNumeric = !isNaN(Number(idParam));

    const item = await db.query.actionItems.findFirst({
      where: isNumeric ? eq(actionItems.id, Number(idParam)) : eq(actionItems.actionId, idParam),
    });

    if (!item) {
      return res.status(404).json({ error: 'Action item not found' });
    }

    // Separation of duties enforcement: RP cannot approve their own action
    if (user.role === 'rp' && user.id === item.responsiblePersonId) {
      return res.status(403).json({
        error: 'Forbidden: Separation of duties violation. An assigned Responsible Person (RP) cannot approve their own corrective action.'
      });
    }

    const today = new Date().toISOString().split('T')[0];

    if (decision === 'Returned') {
      if (!rglReviewComments || rglReviewComments.trim().length === 0) {
        return res.status(400).json({ error: 'Mandatory review comments are required when returning an action for correction.' });
      }

      await db.update(actionItems).set({
        status: 'Returned for Correction',
        rglReviewComments,
        rglApprovalDecision: 'Returned',
        updatedAt: new Date(),
      }).where(eq(actionItems.id, item.id));

      await logAuditEvent({
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: 'RETURN',
        module: 'Central CAPA',
        recordType: 'action_item',
        recordId: item.actionId,
        comments: `Action returned for correction by ${user.fullName}: ${rglReviewComments}`,
      });

      await db.insert(notifications).values({
        userId: item.responsiblePersonId,
        title: `Action Returned for Correction: ${item.actionId}`,
        message: `RGL commented: "${rglReviewComments}". Please adjust implementation or evidence and resubmit.`,
        recordType: 'action',
        recordId: item.actionId,
        isRead: false,
      });

      return res.json({ success: true, message: 'Action returned for correction' });
    }

    // Approved -> Closed
    await db.update(actionItems).set({
      status: 'Closed',
      rglReviewComments: rglReviewComments || 'Approved by reviewing RGL.',
      rglApprovalDecision: 'Approved',
      closureDate: today,
      verificationEvidence: verificationEvidence || item.verificationEvidence || 'Verified by RGL',
      updatedAt: new Date(),
    }).where(eq(actionItems.id, item.id));

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'APPROVE',
      module: 'Central CAPA',
      recordType: 'action_item',
      recordId: item.actionId,
      comments: `Action item formally approved and closed by RGL ${user.fullName}`,
    });

    await db.insert(notifications).values({
      userId: item.responsiblePersonId,
      title: `Action Verified and Closed: ${item.actionId}`,
      message: `Your corrective action "${item.recommendedAction.substring(0, 50)}..." has been verified and closed by RGL.`,
      recordType: 'action',
      recordId: item.actionId,
      isRead: false,
    });

    res.json({ success: true, message: `Action ${item.actionId} closed successfully` });
  } catch (error) {
    console.error('Error reviewing action:', error);
    res.status(500).json({ error: 'Failed to review action item' });
  }
});

// POST /api/actions/:id/reopen
router.post('/:id/reopen', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const { reopenReason } = req.body;

    if (!reopenReason || reopenReason.trim().length === 0) {
      return res.status(400).json({ error: 'Mandatory reason is required to reopen a closed action.' });
    }

    if (user.role !== 'admin' && user.role !== 'rgl') {
      return res.status(403).json({ error: 'Only an Administrator or Responsible Group Leader can reopen a closed action.' });
    }

    const idParam = req.params.id;
    const isNumeric = !isNaN(Number(idParam));

    const item = await db.query.actionItems.findFirst({
      where: isNumeric ? eq(actionItems.id, Number(idParam)) : eq(actionItems.actionId, idParam),
    });

    if (!item) {
      return res.status(404).json({ error: 'Action item not found' });
    }

    await db.update(actionItems).set({
      status: 'In Progress',
      closureDate: '',
      rglReviewComments: `Reopened: ${reopenReason}`,
      updatedAt: new Date(),
    }).where(eq(actionItems.id, item.id));

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'REOPEN',
      module: 'Central CAPA',
      recordType: 'action_item',
      recordId: item.actionId,
      comments: `Action reopened by ${user.fullName}. Reason: ${reopenReason}`,
    });

    res.json({ success: true, message: `Action ${item.actionId} has been reopened` });
  } catch (error) {
    console.error('Error reopening action:', error);
    res.status(500).json({ error: 'Failed to reopen action' });
  }
});

export default router;

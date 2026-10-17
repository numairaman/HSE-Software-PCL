import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { actionItems, emergencyDrills, users } from '../../db/schema.ts';
import { AuthRequest, requireAuth } from '../../middleware/auth.ts';
import { generateBusinessId } from '../../services/sequence.ts';
import { logAuditEvent } from '../../services/audit.ts';

const router = Router();

// GET /api/drills
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const list = await db.query.emergencyDrills.findMany({
      orderBy: [desc(emergencyDrills.id)],
      with: {
        location: true,
        drillController: true,
        evaluator: true,
      },
    });

    const allActions = await db.select().from(actionItems);

    const enriched = list.map(d => {
      const actions = allActions.filter(a => a.sourceRecordId === d.drillId || (a.sourceModule === 'Drill' && a.sourceRecordId.includes(d.drillId)));
      return {
        ...d,
        actionsCount: actions.length,
        openActionsCount: actions.filter(a => a.status !== 'Closed').length,
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error('Error fetching drills:', error);
    res.status(500).json({ error: 'Failed to retrieve emergency drills' });
  }
});

// POST /api/drills
router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const body = req.body;

    if (!body.title || !body.plannedDate || !body.locationId || !body.scenarioDescription) {
      return res.status(400).json({ error: 'Title, planned date, location, and scenario are required.' });
    }

    const drillId = await generateBusinessId('DRL', 'emergency_drills', 'drill_id');
    const controllerId = body.drillControllerId ? Number(body.drillControllerId) : user.id;
    const evaluatorId = body.evaluatorId ? Number(body.evaluatorId) : user.id;

    const [newDrill] = await db.insert(emergencyDrills).values({
      drillId,
      title: body.title,
      drillType: body.drillType || 'Fire Drill',
      plannedDate: body.plannedDate,
      locationId: Number(body.locationId),
      scenarioDescription: body.scenarioDescription,
      objectives: body.objectives || 'Validate evacuation route clearance and muster accountability within target time.',
      drillControllerId: controllerId,
      evaluatorId: evaluatorId,
      targetEvacuationMinutes: body.targetEvacuationMinutes ? Number(body.targetEvacuationMinutes) : 5,
      status: 'Planned',
    }).returning();

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'CREATE',
      module: 'Emergency Drills',
      recordType: 'drill',
      recordId: drillId,
      comments: `Scheduled emergency drill: ${body.title}`,
    });

    res.status(201).json(newDrill);
  } catch (error) {
    console.error('Error creating drill:', error);
    res.status(500).json({ error: 'Failed to create emergency drill' });
  }
});

// GET /api/drills/:id
router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const idParam = req.params.id;
    const isNumeric = !isNaN(Number(idParam));

    const item = await db.query.emergencyDrills.findFirst({
      where: isNumeric ? eq(emergencyDrills.id, Number(idParam)) : eq(emergencyDrills.drillId, idParam),
      with: {
        location: true,
        drillController: true,
        evaluator: true,
      },
    });

    if (!item) {
      return res.status(404).json({ error: 'Emergency drill not found' });
    }

    const actions = await db.query.actionItems.findMany({
      where: eq(actionItems.sourceRecordId, item.drillId),
      with: {
        department: true,
        responsiblePerson: true,
        responsibleGroupLeader: true,
      },
    });

    res.json({
      drill: item,
      actions,
    });
  } catch (error) {
    console.error('Error fetching drill details:', error);
    res.status(500).json({ error: 'Failed to retrieve drill details' });
  }
});

// POST /api/drills/:id/evaluate
router.post('/:id/evaluate', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const body = req.body;
    const idParam = req.params.id;
    const isNumeric = !isNaN(Number(idParam));

    const item = await db.query.emergencyDrills.findFirst({
      where: isNumeric ? eq(emergencyDrills.id, Number(idParam)) : eq(emergencyDrills.drillId, idParam),
    });

    if (!item) {
      return res.status(404).json({ error: 'Emergency drill not found' });
    }

    const today = new Date().toISOString().split('T')[0];
    const actualDate = body.actualDate || today;

    if (body.status === 'Closed' && (!body.findings || !body.lessonsLearned || !body.performanceEvaluation)) {
      return res.status(400).json({
        error: 'Validation failed: A drill cannot be closed without performance evaluation, findings, and documented lessons learned.'
      });
    }

    await db.update(emergencyDrills).set({
      actualDate,
      alarmActivationTime: body.alarmActivationTime || item.alarmActivationTime,
      evacuationStartTime: body.evacuationStartTime || item.evacuationStartTime,
      evacuationCompletionTime: body.evacuationCompletionTime || item.evacuationCompletionTime,
      musterCompletionTime: body.musterCompletionTime || item.musterCompletionTime,
      totalEvacuationMinutes: body.totalEvacuationMinutes !== undefined ? Number(body.totalEvacuationMinutes) : item.totalEvacuationMinutes,
      targetEvacuationMinutes: body.targetEvacuationMinutes !== undefined ? Number(body.targetEvacuationMinutes) : item.targetEvacuationMinutes,
      participantCount: body.participantCount !== undefined ? Number(body.participantCount) : item.participantCount,
      unaccountedCount: body.unaccountedCount !== undefined ? Number(body.unaccountedCount) : item.unaccountedCount,
      performanceEvaluation: body.performanceEvaluation || item.performanceEvaluation,
      keyObservations: body.keyObservations || item.keyObservations,
      findings: body.findings || item.findings,
      lessonsLearned: body.lessonsLearned || item.lessonsLearned,
      status: body.status || 'Evaluated',
      updatedAt: new Date(),
    }).where(eq(emergencyDrills.id, item.id));

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'UPDATE',
      module: 'Emergency Drills',
      recordType: 'drill',
      recordId: item.drillId,
      comments: `Evaluated drill ${item.drillId}. Evaluation result: ${body.performanceEvaluation || 'Evaluated'}`,
    });

    res.json({ success: true, message: 'Drill evaluation recorded successfully' });
  } catch (error) {
    console.error('Error recording drill evaluation:', error);
    res.status(500).json({ error: 'Failed to record drill evaluation' });
  }
});

// POST /api/drills/:id/create-action
router.post('/:id/create-action', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const body = req.body;
    const idParam = req.params.id;
    const isNumeric = !isNaN(Number(idParam));

    const item = await db.query.emergencyDrills.findFirst({
      where: isNumeric ? eq(emergencyDrills.id, Number(idParam)) : eq(emergencyDrills.drillId, idParam),
    });

    if (!item) {
      return res.status(404).json({ error: 'Emergency drill not found' });
    }

    const actionId = await generateBusinessId('ACT', 'action_items', 'action_id');
    const targetDate = body.targetDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

    const [newAction] = await db.insert(actionItems).values({
      actionId,
      sourceModule: 'Drill',
      sourceRecordId: item.drillId,
      observationFinding: `[${item.drillId} Finding] ${body.observationFinding || body.recommendedAction}`,
      recommendedAction: body.recommendedAction,
      actionType: 'Corrective',
      responsibleDepartmentId: Number(body.responsibleDepartmentId || 1),
      responsiblePersonId: Number(body.responsiblePersonId),
      responsibleGroupLeaderId: body.responsibleGroupLeaderId ? Number(body.responsibleGroupLeaderId) : user.id,
      priority: body.priority || 'High',
      riskClassification: body.riskClassification || 'High',
      targetDate,
      status: 'Open',
    }).returning();

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'CREATE',
      module: 'Emergency Drills',
      recordType: 'action_item',
      recordId: actionId,
      comments: `Created CAPA action ${actionId} from drill ${item.drillId}`,
    });

    res.status(201).json(newAction);
  } catch (error) {
    console.error('Error creating drill action:', error);
    res.status(500).json({ error: 'Failed to create drill action' });
  }
});

export default router;

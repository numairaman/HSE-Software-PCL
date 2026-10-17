import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { actionItems, inspectionEvents, inspectionObservations, users } from '../../db/schema.ts';
import { AuthRequest, requireAuth } from '../../middleware/auth.ts';
import { generateBusinessId } from '../../services/sequence.ts';
import { logAuditEvent } from '../../services/audit.ts';

const router = Router();

// GET /api/inspections
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const list = await db.query.inspectionEvents.findMany({
      orderBy: [desc(inspectionEvents.id)],
      with: {
        department: true,
        location: true,
        leadInspector: true,
      },
    });

    const allObservations = await db.select().from(inspectionObservations);

    const enriched = list.map(insp => {
      const relatedObs = allObservations.filter(o => o.inspectionEventId === insp.id);
      return {
        ...insp,
        observationsCount: relatedObs.length,
        highRiskCount: relatedObs.filter(o => o.riskRating === 'High' || o.riskRating === 'Critical').length,
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error('Error fetching inspections:', error);
    res.status(500).json({ error: 'Failed to retrieve inspections' });
  }
});

// POST /api/inspections
router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const body = req.body;

    if (!body.title || !body.scheduledDate || !body.departmentId || !body.locationId) {
      return res.status(400).json({ error: 'Missing mandatory inspection fields (Title, Date, Department, Location).' });
    }

    const inspectionId = await generateBusinessId('INS', 'inspection_events', 'inspection_id');
    const leadInspectorId = body.leadInspectorId ? Number(body.leadInspectorId) : user.id;

    const [newInspection] = await db.insert(inspectionEvents).values({
      inspectionId,
      title: body.title,
      inspectionType: body.inspectionType || 'Routine HSE Inspection',
      scheduledDate: body.scheduledDate,
      areaCovered: body.areaCovered || 'All production areas',
      departmentId: Number(body.departmentId),
      locationId: Number(body.locationId),
      leadInspectorId,
      teamMembers: typeof body.teamMembers === 'string' ? body.teamMembers : JSON.stringify(body.teamMembers || []),
      checklistName: body.checklistName || 'Comprehensive Workplace HSE Checklist',
      summary: body.summary || '',
      status: 'Planned',
    }).returning();

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'CREATE',
      module: 'HSE Inspections',
      recordType: 'inspection_event',
      recordId: inspectionId,
      comments: `Created HSE Inspection: ${body.title}`,
    });

    res.status(201).json(newInspection);
  } catch (error) {
    console.error('Error creating inspection:', error);
    res.status(500).json({ error: 'Failed to create inspection event' });
  }
});

// GET /api/inspections/:id
router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const idParam = req.params.id;
    const isNumeric = !isNaN(Number(idParam));

    const item = await db.query.inspectionEvents.findFirst({
      where: isNumeric ? eq(inspectionEvents.id, Number(idParam)) : eq(inspectionEvents.inspectionId, idParam),
      with: {
        department: true,
        location: true,
        leadInspector: true,
      },
    });

    if (!item) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    const observations = await db.query.inspectionObservations.findMany({
      where: eq(inspectionObservations.inspectionEventId, item.id),
      with: {
        department: true,
        location: true,
        subLocation: true,
        responsiblePerson: true,
        responsibleGroupLeader: true,
      },
    });

    res.json({
      inspection: item,
      observations,
      observationsCount: observations.length,
    });
  } catch (error) {
    console.error('Error fetching inspection details:', error);
    res.status(500).json({ error: 'Failed to retrieve inspection details' });
  }
});

// POST /api/inspections/:id/observations
router.post('/:id/observations', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const body = req.body;
    const idParam = req.params.id;
    const isNumeric = !isNaN(Number(idParam));

    const item = await db.query.inspectionEvents.findFirst({
      where: isNumeric ? eq(inspectionEvents.id, Number(idParam)) : eq(inspectionEvents.inspectionId, idParam),
    });

    if (!item) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    if (!body.description || !body.recommendedAction) {
      return res.status(400).json({ error: 'Description and recommended action are required.' });
    }

    const observationId = await generateBusinessId('OBS', 'inspection_observations', 'observation_id');
    const today = new Date().toISOString().split('T')[0];

    const [newObs] = await db.insert(inspectionObservations).values({
      observationId,
      inspectionEventId: item.id,
      observationDate: body.observationDate || today,
      locationId: body.locationId ? Number(body.locationId) : item.locationId,
      subLocationId: body.subLocationId ? Number(body.subLocationId) : null,
      observationType: body.observationType || 'Unsafe Condition',
      hazardClassification: body.hazardClassification || 'Mechanical',
      description: body.description,
      riskRating: body.riskRating || 'Medium',
      recommendedAction: body.recommendedAction,
      departmentId: body.departmentId ? Number(body.departmentId) : item.departmentId,
      responsiblePersonId: body.responsiblePersonId ? Number(body.responsiblePersonId) : null,
      responsibleGroupLeaderId: body.responsibleGroupLeaderId ? Number(body.responsibleGroupLeaderId) : null,
      targetDate: body.targetDate || '',
      status: 'Open',
    }).returning();

    if (body.createAction && body.responsiblePersonId) {
      const actionId = await generateBusinessId('ACT', 'action_items', 'action_id');
      const targetDate = body.targetDate || new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];

      const [action] = await db.insert(actionItems).values({
        actionId,
        sourceModule: 'Inspection',
        sourceRecordId: item.inspectionId,
        observationFinding: `[${item.inspectionId} / ${observationId}] ${body.description}`,
        recommendedAction: body.recommendedAction,
        actionType: 'Corrective',
        responsibleDepartmentId: newObs.departmentId,
        responsiblePersonId: Number(body.responsiblePersonId),
        responsibleGroupLeaderId: body.responsibleGroupLeaderId ? Number(body.responsibleGroupLeaderId) : user.id,
        priority: body.riskRating === 'Critical' ? 'Urgent' : (body.riskRating === 'High' ? 'High' : 'Medium'),
        riskClassification: body.riskRating || 'Medium',
        targetDate,
        status: 'Open',
      }).returning();

      await db.update(inspectionObservations).set({
        linkedActionId: action.id,
        status: 'Action Created',
      }).where(eq(inspectionObservations.id, newObs.id));
    }

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'CREATE',
      module: 'HSE Inspections',
      recordType: 'inspection_observation',
      recordId: observationId,
      comments: `Added observation ${observationId} to ${item.inspectionId}`,
    });

    res.status(201).json(newObs);
  } catch (error) {
    console.error('Error adding observation:', error);
    res.status(500).json({ error: 'Failed to record inspection observation' });
  }
});

// POST /api/inspections/:id/complete
router.post('/:id/complete', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const { summary } = req.body;
    const idParam = req.params.id;
    const isNumeric = !isNaN(Number(idParam));

    const item = await db.query.inspectionEvents.findFirst({
      where: isNumeric ? eq(inspectionEvents.id, Number(idParam)) : eq(inspectionEvents.inspectionId, idParam),
    });

    if (!item) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    const today = new Date().toISOString().split('T')[0];

    await db.update(inspectionEvents).set({
      status: 'Completed',
      completedDate: today,
      summary: summary || item.summary,
      updatedAt: new Date(),
    }).where(eq(inspectionEvents.id, item.id));

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'UPDATE',
      module: 'HSE Inspections',
      recordType: 'inspection_event',
      recordId: item.inspectionId,
      comments: `Inspection completed by ${user.fullName}`,
    });

    res.json({ success: true, message: 'Inspection marked as completed' });
  } catch (error) {
    console.error('Error completing inspection:', error);
    res.status(500).json({ error: 'Failed to complete inspection' });
  }
});

export default router;

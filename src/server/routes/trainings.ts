import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { trainingAttendance, trainingSessions, users } from '../../db/schema.ts';
import { AuthRequest, requireAuth } from '../../middleware/auth.ts';
import { generateBusinessId } from '../../services/sequence.ts';
import { logAuditEvent } from '../../services/audit.ts';

const router = Router();

// GET /api/trainings
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const list = await db.query.trainingSessions.findMany({
      orderBy: [desc(trainingSessions.id)],
      with: {
        department: true,
      },
    });

    const allAttendance = await db.select().from(trainingAttendance);

    const enriched = list.map(t => {
      const records = allAttendance.filter(a => a.trainingSessionId === t.id);
      const planned = records.length;
      const attended = records.filter(a => a.attended).length;
      const passed = records.filter(a => a.attended && a.competencyResult === 'Pass').length;
      return {
        ...t,
        plannedParticipants: planned,
        actualParticipants: attended,
        passedParticipants: passed,
        completionRate: planned > 0 ? Math.round((attended / planned) * 100) : 0,
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error('Error fetching training sessions:', error);
    res.status(500).json({ error: 'Failed to retrieve training sessions' });
  }
});

// POST /api/trainings
router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const body = req.body;

    if (!body.title || !body.plannedDate || !body.departmentId || !body.trainerName) {
      return res.status(400).json({ error: 'Title, planned date, trainer name, and department are required.' });
    }

    const trainingId = await generateBusinessId('TRN', 'training_sessions', 'training_id');

    const [newTraining] = await db.insert(trainingSessions).values({
      trainingId,
      title: body.title,
      trainingType: body.trainingType || 'Planned',
      category: body.category || 'Occupational Safety',
      trainerName: body.trainerName,
      plannedDate: body.plannedDate,
      venue: body.venue || 'Training Center Room 1',
      departmentId: Number(body.departmentId),
      agenda: body.agenda || '',
      learningObjectives: body.learningObjectives || '',
      validityPeriodMonths: body.validityPeriodMonths ? Number(body.validityPeriodMonths) : 12,
      status: 'Planned',
    }).returning();

    if (Array.isArray(body.participantUserIds)) {
      for (const uid of body.participantUserIds) {
        await db.insert(trainingAttendance).values({
          trainingSessionId: newTraining.id,
          userId: Number(uid),
          attended: false,
          competencyResult: 'Pending',
        });
      }
    }

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'CREATE',
      module: 'Training Management',
      recordType: 'training_session',
      recordId: trainingId,
      comments: `Scheduled training session: ${body.title}`,
    });

    res.status(201).json(newTraining);
  } catch (error) {
    console.error('Error creating training session:', error);
    res.status(500).json({ error: 'Failed to create training session' });
  }
});

// GET /api/trainings/:id
router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const idParam = req.params.id;
    const isNumeric = !isNaN(Number(idParam));

    const item = await db.query.trainingSessions.findFirst({
      where: isNumeric ? eq(trainingSessions.id, Number(idParam)) : eq(trainingSessions.trainingId, idParam),
      with: {
        department: true,
      },
    });

    if (!item) {
      return res.status(404).json({ error: 'Training session not found' });
    }

    const participants = await db.query.trainingAttendance.findMany({
      where: eq(trainingAttendance.trainingSessionId, item.id),
      with: {
        user: true,
      },
    });

    res.json({
      session: item,
      participants,
    });
  } catch (error) {
    console.error('Error fetching training details:', error);
    res.status(500).json({ error: 'Failed to retrieve training details' });
  }
});

// POST /api/trainings/:id/attendance
router.post('/:id/attendance', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const { actualDate, evaluationFeedback, participants, status } = req.body;
    const idParam = req.params.id;
    const isNumeric = !isNaN(Number(idParam));

    const item = await db.query.trainingSessions.findFirst({
      where: isNumeric ? eq(trainingSessions.id, Number(idParam)) : eq(trainingSessions.trainingId, idParam),
    });

    if (!item) {
      return res.status(404).json({ error: 'Training session not found' });
    }

    const today = new Date().toISOString().split('T')[0];
    const sessionDate = actualDate || today;

    const validityMonths = item.validityPeriodMonths || 12;
    const d = new Date(sessionDate);
    d.setMonth(d.getMonth() + validityMonths);
    const refresherDueDate = d.toISOString().split('T')[0];

    await db.update(trainingSessions).set({
      actualDate: sessionDate,
      evaluationFeedback: evaluationFeedback || item.evaluationFeedback,
      status: status || 'Completed',
      updatedAt: new Date(),
    }).where(eq(trainingSessions.id, item.id));

    if (Array.isArray(participants)) {
      for (const p of participants) {
        if (p.id) {
          await db.update(trainingAttendance).set({
            attended: Boolean(p.attended),
            score: p.score !== undefined ? Number(p.score) : 0,
            competencyResult: p.competencyResult || (p.attended ? 'Pass' : 'Fail'),
            refresherDueDate: p.attended ? refresherDueDate : '',
            feedbackNotes: p.feedbackNotes || '',
          }).where(eq(trainingAttendance.id, p.id));
        } else if (p.userId) {
          await db.insert(trainingAttendance).values({
            trainingSessionId: item.id,
            userId: Number(p.userId),
            attended: Boolean(p.attended),
            score: p.score !== undefined ? Number(p.score) : 0,
            competencyResult: p.competencyResult || (p.attended ? 'Pass' : 'Fail'),
            refresherDueDate: p.attended ? refresherDueDate : '',
            feedbackNotes: p.feedbackNotes || '',
          });
        }
      }
    }

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'UPDATE',
      module: 'Training Management',
      recordType: 'training_session',
      recordId: item.trainingId,
      comments: `Recorded attendance & evaluation for training session ${item.trainingId}`,
    });

    res.json({ success: true, message: 'Training attendance & competency saved successfully' });
  } catch (error) {
    console.error('Error updating training attendance:', error);
    res.status(500).json({ error: 'Failed to record training attendance' });
  }
});

// GET /api/trainings/compliance/overview
router.get('/compliance/overview', requireAuth, async (req: AuthRequest, res) => {
  try {
    const allUsers = await db.query.users.findMany({
      where: eq(users.isActive, true),
      with: {
        department: true,
      },
    });

    const allAttendance = await db.query.trainingAttendance.findMany({
      with: {
        trainingSession: true,
      },
    });

    const today = new Date().toISOString().split('T')[0];
    const departmentStats: Record<string, { totalEmployees: number; trainedEmployees: number; overdueCount: number }> = {};

    for (const u of allUsers) {
      const deptName = u.department?.name || 'Unassigned';
      if (!departmentStats[deptName]) {
        departmentStats[deptName] = { totalEmployees: 0, trainedEmployees: 0, overdueCount: 0 };
      }
      departmentStats[deptName].totalEmployees++;

      const userAtt = allAttendance.filter(a => a.userId === u.id && a.attended && a.competencyResult === 'Pass');
      if (userAtt.length > 0) {
        departmentStats[deptName].trainedEmployees++;
      }

      const hasOverdue = allAttendance.some(a => a.userId === u.id && a.refresherDueDate && a.refresherDueDate < today);
      if (hasOverdue) {
        departmentStats[deptName].overdueCount++;
      }
    }

    res.json(departmentStats);
  } catch (error) {
    console.error('Error computing training compliance:', error);
    res.status(500).json({ error: 'Failed to compute compliance' });
  }
});

export default router;

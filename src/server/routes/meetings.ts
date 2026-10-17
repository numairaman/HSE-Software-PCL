import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { actionItems, meetingAttendees, meetings, users } from '../../db/schema.ts';
import { AuthRequest, requireAuth } from '../../middleware/auth.ts';
import { generateBusinessId } from '../../services/sequence.ts';
import { logAuditEvent } from '../../services/audit.ts';

const router = Router();

// GET /api/meetings
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const list = await db.query.meetings.findMany({
      orderBy: [desc(meetings.id)],
      with: {
        chairperson: true,
        organizer: true,
        department: true,
      },
    });

    const allAttendees = await db.select().from(meetingAttendees);
    const allActions = await db.select().from(actionItems);

    const enriched = list.map(m => {
      const attendees = allAttendees.filter(a => a.meetingId === m.id);
      const actions = allActions.filter(a => a.sourceRecordId === m.meetingId || a.sourceModule === 'Meeting');
      return {
        ...m,
        attendeesCount: attendees.length,
        actualAttendedCount: attendees.filter(a => a.attended).length,
        actionsCount: actions.length,
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error('Error fetching meetings:', error);
    res.status(500).json({ error: 'Failed to retrieve meetings' });
  }
});

// POST /api/meetings
router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const body = req.body;

    if (!body.title || !body.dateTime) {
      return res.status(400).json({ error: 'Meeting title and date/time are required.' });
    }

    const meetingId = await generateBusinessId('MTG', 'meetings', 'meeting_id');
    const chairpersonId = body.chairpersonId ? Number(body.chairpersonId) : user.id;

    const [newMeeting] = await db.insert(meetings).values({
      meetingId,
      title: body.title,
      meetingType: body.meetingType || 'Monthly HSE Meeting',
      dateTime: body.dateTime,
      venue: body.venue || 'Main Conference Room / Teams',
      departmentId: body.departmentId ? Number(body.departmentId) : null,
      chairpersonId,
      organizerId: user.id,
      agenda: body.agenda || '',
      topicsDiscussed: body.topicsDiscussed || '',
      minutesOfMeeting: body.minutesOfMeeting || '',
      status: 'Scheduled',
    }).returning();

    if (Array.isArray(body.attendees)) {
      for (const att of body.attendees) {
        await db.insert(meetingAttendees).values({
          meetingId: newMeeting.id,
          userId: att.userId ? Number(att.userId) : null,
          name: att.name || 'Participant',
          email: att.email || '',
          department: att.department || '',
          isExternal: Boolean(att.isExternal),
          attended: att.attended !== undefined ? Boolean(att.attended) : true,
        });
      }
    }

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'CREATE',
      module: 'Meetings & Minutes',
      recordType: 'meeting',
      recordId: meetingId,
      comments: `Scheduled meeting: ${body.title}`,
    });

    res.status(201).json(newMeeting);
  } catch (error) {
    console.error('Error creating meeting:', error);
    res.status(500).json({ error: 'Failed to create meeting' });
  }
});

// GET /api/meetings/:id
router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const idParam = req.params.id;
    const isNumeric = !isNaN(Number(idParam));

    const item = await db.query.meetings.findFirst({
      where: isNumeric ? eq(meetings.id, Number(idParam)) : eq(meetings.meetingId, idParam),
      with: {
        chairperson: true,
        organizer: true,
        department: true,
      },
    });

    if (!item) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const attendees = await db.query.meetingAttendees.findMany({
      where: eq(meetingAttendees.meetingId, item.id),
      with: {
        user: true,
      },
    });

    const actions = await db.query.actionItems.findMany({
      where: eq(actionItems.sourceRecordId, item.meetingId),
      with: {
        department: true,
        responsiblePerson: true,
      },
    });

    res.json({
      meeting: item,
      attendees,
      actions,
    });
  } catch (error) {
    console.error('Error fetching meeting details:', error);
    res.status(500).json({ error: 'Failed to retrieve meeting details' });
  }
});

// POST /api/meetings/:id/minutes
router.post('/:id/minutes', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const { minutesOfMeeting, topicsDiscussed, attendees, status } = req.body;
    const idParam = req.params.id;
    const isNumeric = !isNaN(Number(idParam));

    const item = await db.query.meetings.findFirst({
      where: isNumeric ? eq(meetings.id, Number(idParam)) : eq(meetings.meetingId, idParam),
    });

    if (!item) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    await db.update(meetings).set({
      minutesOfMeeting: minutesOfMeeting !== undefined ? minutesOfMeeting : item.minutesOfMeeting,
      topicsDiscussed: topicsDiscussed !== undefined ? topicsDiscussed : item.topicsDiscussed,
      status: status || 'Completed',
      updatedAt: new Date(),
    }).where(eq(meetings.id, item.id));

    if (Array.isArray(attendees)) {
      for (const a of attendees) {
        if (a.id) {
          await db.update(meetingAttendees).set({
            attended: Boolean(a.attended),
          }).where(eq(meetingAttendees.id, a.id));
        } else if (a.name) {
          await db.insert(meetingAttendees).values({
            meetingId: item.id,
            userId: a.userId ? Number(a.userId) : null,
            name: a.name,
            email: a.email || '',
            department: a.department || '',
            isExternal: Boolean(a.isExternal),
            attended: Boolean(a.attended),
          });
        }
      }
    }

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'UPDATE',
      module: 'Meetings & Minutes',
      recordType: 'meeting',
      recordId: item.meetingId,
      comments: `Recorded/updated minutes of meeting for ${item.meetingId}`,
    });

    res.json({ success: true, message: 'Minutes of meeting saved successfully' });
  } catch (error) {
    console.error('Error updating meeting minutes:', error);
    res.status(500).json({ error: 'Failed to update meeting minutes' });
  }
});

// POST /api/meetings/:id/create-action
router.post('/:id/create-action', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const body = req.body;
    const idParam = req.params.id;
    const isNumeric = !isNaN(Number(idParam));

    const item = await db.query.meetings.findFirst({
      where: isNumeric ? eq(meetings.id, Number(idParam)) : eq(meetings.meetingId, idParam),
    });

    if (!item) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const actionId = await generateBusinessId('ACT', 'action_items', 'action_id');
    const targetDate = body.targetDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

    const [newAction] = await db.insert(actionItems).values({
      actionId,
      sourceModule: 'Meeting',
      sourceRecordId: item.meetingId,
      observationFinding: `[${item.meetingId} - Decision] ${body.observationFinding || body.recommendedAction}`,
      recommendedAction: body.recommendedAction,
      actionType: body.actionType || 'Corrective',
      responsibleDepartmentId: Number(body.responsibleDepartmentId || item.departmentId || 1),
      responsiblePersonId: Number(body.responsiblePersonId),
      responsibleGroupLeaderId: body.responsibleGroupLeaderId ? Number(body.responsibleGroupLeaderId) : user.id,
      priority: body.priority || 'Medium',
      riskClassification: body.riskClassification || 'Medium',
      targetDate,
      status: 'Open',
    }).returning();

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'CREATE',
      module: 'Meetings & Minutes',
      recordType: 'action_item',
      recordId: actionId,
      comments: `Created action ${actionId} from meeting ${item.meetingId}`,
    });

    res.status(201).json(newAction);
  } catch (error) {
    console.error('Error creating meeting action:', error);
    res.status(500).json({ error: 'Failed to create meeting action' });
  }
});

export default router;

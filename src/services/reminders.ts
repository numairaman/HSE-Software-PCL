import { and, eq, lte, ne } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { actionItems, notifications, users } from '../db/schema.ts';
import { logAuditEvent } from './audit.ts';

export async function processOverdueActions() {
  const today = new Date().toISOString().split('T')[0];

  try {
    const overdueList = await db.select({
      action: actionItems,
      rp: users,
    })
    .from(actionItems)
    .innerJoin(users, eq(actionItems.responsiblePersonId, users.id))
    .where(
      and(
        lte(actionItems.targetDate, today),
        ne(actionItems.status, 'Closed')
      )
    );

    let escalatedCount = 0;
    let notificationsSent = 0;

    for (const item of overdueList) {
      const act = item.action;
      const targetDate = new Date(act.targetDate);
      const diffTime = Math.abs(new Date(today).getTime() - targetDate.getTime());
      const daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (act.lastReminderDate === today) {
        continue;
      }

      let newEscalation = act.escalationLevel;
      if (daysOverdue >= 3 && act.escalationLevel < 1) {
        newEscalation = 1;
      }
      if (daysOverdue >= 7 && act.escalationLevel < 2) {
        newEscalation = 2;
      }

      await db.update(actionItems)
        .set({
          lastReminderDate: today,
          escalationLevel: newEscalation,
          updatedAt: new Date(),
        })
        .where(eq(actionItems.id, act.id));

      if (newEscalation > act.escalationLevel) {
        escalatedCount++;
        await logAuditEvent({
          userEmail: 'system_automation',
          userRole: 'system',
          action: 'ESCALATE',
          module: 'CAPA',
          recordType: 'action_item',
          recordId: act.actionId,
          previousValues: { escalationLevel: act.escalationLevel },
          newValues: { escalationLevel: newEscalation, daysOverdue },
          comments: `Automated escalation: Action is ${daysOverdue} days overdue.`,
        });
      }

      await db.insert(notifications).values({
        userId: act.responsiblePersonId,
        title: `OVERDUE ACTION: ${act.actionId}`,
        message: `Action item "${act.observationFinding.substring(0, 60)}..." is ${daysOverdue} days overdue (Target: ${act.targetDate}). Please submit resolution.`,
        recordType: 'action',
        recordId: act.actionId,
        isRead: false,
      });
      notificationsSent++;

      if (newEscalation >= 1) {
        await db.insert(notifications).values({
          userId: act.responsibleGroupLeaderId,
          title: `ESCALATION: Overdue Action ${act.actionId}`,
          message: `Action assigned to ${item.rp.fullName} is ${daysOverdue} days overdue. Immediate supervisory intervention required.`,
          recordType: 'action',
          recordId: act.actionId,
          isRead: false,
        });
        notificationsSent++;
      }
    }

    return {
      status: 'success',
      actionsProcessed: overdueList.length,
      escalatedCount,
      notificationsSent,
      processedDate: today,
    };
  } catch (error) {
    console.error('Error running automated overdue check:', error);
    throw error;
  }
}

import { db } from '../db/index.ts';
import { auditEvents } from '../db/schema.ts';

export async function logAuditEvent(params: {
  userId?: number | null;
  userEmail: string;
  userRole: string;
  action: string;
  module: string;
  recordType: string;
  recordId: string;
  previousValues?: any;
  newValues?: any;
  comments?: string;
}) {
  try {
    await db.insert(auditEvents).values({
      userId: params.userId || null,
      userEmail: params.userEmail || 'system',
      userRole: params.userRole || 'system',
      action: params.action,
      module: params.module,
      recordType: params.recordType,
      recordId: params.recordId,
      previousValues: params.previousValues ? JSON.stringify(params.previousValues) : '',
      newValues: params.newValues ? JSON.stringify(params.newValues) : '',
      comments: params.comments || '',
    });
  } catch (err) {
    console.error('Failed to log audit event:', err);
  }
}

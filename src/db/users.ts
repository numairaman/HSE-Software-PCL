import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import { users } from './schema.ts';

export async function getOrCreateUser(uid: string, email: string, fullName?: string) {
  try {
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      if (existing[0].uid !== uid) {
        await db.update(users).set({ uid }).where(eq(users.id, existing[0].id));
        existing[0].uid = uid;
      }
      return existing[0];
    }

    const all = await db.select().from(users).limit(5);
    const role = all.length === 0 ? 'admin' : (email.includes('admin') ? 'admin' : 'rp');

    const result = await db.insert(users)
      .values({
        uid,
        email,
        fullName: fullName || email.split('@')[0],
        role,
        jobTitle: role === 'admin' ? 'EHS Director' : 'EHS Officer',
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Error in getOrCreateUser:', error);
    throw new Error('Database operation failed in user resolution', { cause: error });
  }
}

export async function getAllUsers() {
  try {
    return await db.select().from(users);
  } catch (error) {
    console.error('Error fetching all users:', error);
    throw new Error('Failed to retrieve users', { cause: error });
  }
}

export async function getUserById(id: number) {
  try {
    const res = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return res[0] || null;
  } catch (error) {
    console.error('Error fetching user by ID:', error);
    throw new Error('Failed to retrieve user', { cause: error });
  }
}

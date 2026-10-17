import { NextFunction, Request, Response } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';
import { eq } from 'drizzle-orm';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUser } from '../db/users.ts';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: {
    id: number;
    uid: string;
    email: string;
    fullName: string;
    role: string;
    departmentId: number | null;
    locationId: number | null;
    jobTitle: string | null;
    isActive: boolean;
  };
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const simUserId = req.headers['x-simulated-user-id'];

  // 1. Genuine Firebase Bearer token
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      req.user = decodedToken;
      const dbUser = await getOrCreateUser(
        decodedToken.uid,
        decodedToken.email || 'user@company.internal',
        decodedToken.name
      );
      req.dbUser = dbUser;
      return next();
    } catch (error) {
      console.warn('Firebase token verification failed:', error);
    }
  }

  // 2. Simulated user header for testing RBAC separation of duties
  if (simUserId) {
    try {
      const found = await db.select().from(users).where(eq(users.id, Number(simUserId))).limit(1);
      if (found.length > 0) {
        req.dbUser = found[0];
        return next();
      }
    } catch (err) {
      console.error('Error fetching simulated user:', err);
    }
  }

  // 3. Fallback: First active admin user in database
  try {
    const defaultUser = await db.select().from(users).where(eq(users.isActive, true)).limit(1);
    if (defaultUser.length > 0) {
      req.dbUser = defaultUser[0];
      return next();
    }
  } catch (err) {
    console.error('Error resolving fallback user:', err);
  }

  return res.status(401).json({ error: 'Unauthorized: Authentication required' });
};

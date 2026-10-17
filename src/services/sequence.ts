import { sql } from 'drizzle-orm';
import { db } from '../db/index.ts';

export async function generateBusinessId(prefix: string, tableName: string, idColumn: string): Promise<string> {
  const year = new Date().getFullYear();
  const searchPattern = `${prefix}-${year}-%`;

  const rawQuery = sql.raw(`
    SELECT ${idColumn} as code 
    FROM ${tableName} 
    WHERE ${idColumn} LIKE '${searchPattern}' 
    ORDER BY id DESC 
    LIMIT 1
  `);

  try {
    const result: any = await db.execute(rawQuery);
    let nextNum = 1;
    if (result && result.rows && result.rows.length > 0) {
      const lastCode = result.rows[0].code;
      const parts = lastCode.split('-');
      if (parts.length >= 3) {
        const parsed = parseInt(parts[2], 10);
        if (!isNaN(parsed)) {
          nextNum = parsed + 1;
        }
      }
    }
    const padded = String(nextNum).padStart(6, '0');
    return `${prefix}-${year}-${padded}`;
  } catch (error) {
    console.error(`Error generating business ID for ${prefix}:`, error);
    const rand = Math.floor(100000 + Math.random() * 900000);
    return `${prefix}-${year}-${rand}`;
  }
}

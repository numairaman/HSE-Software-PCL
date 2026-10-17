import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { documents } from '../../db/schema.ts';
import { AuthRequest, requireAuth } from '../../middleware/auth.ts';
import { generateBusinessId } from '../../services/sequence.ts';
import { logAuditEvent } from '../../services/audit.ts';

const router = Router();

const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `doc-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
});

// GET /api/documents
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { linkedModule, linkedRecordId } = req.query;

    let items = await db.query.documents.findMany({
      orderBy: [desc(documents.id)],
      with: {
        uploadedBy: true,
      },
    });

    if (linkedModule) {
      items = items.filter(d => d.linkedModule === String(linkedModule));
    }
    if (linkedRecordId) {
      items = items.filter(d => d.linkedRecordId === String(linkedRecordId));
    }

    res.json(items);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to retrieve documents' });
  }
});

// POST /api/documents/upload
router.post('/upload', requireAuth, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const { linkedModule, linkedRecordId, description, tags } = req.body;
    const documentId = await generateBusinessId('DOC', 'documents', 'document_id');

    const [newDoc] = await db.insert(documents).values({
      documentId,
      originalFilename: file.originalname,
      storedFilename: file.filename,
      mimeType: file.mimetype,
      fileSize: file.size,
      uploadedByUserId: user.id,
      linkedModule: linkedModule || 'Repository',
      linkedRecordId: linkedRecordId || '',
      description: description || '',
      tags: tags || '',
    }).returning();

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'UPLOAD',
      module: linkedModule || 'Document Repository',
      recordType: 'document',
      recordId: documentId,
      comments: `Uploaded evidence/attachment: ${file.originalname} (${file.size} bytes)`,
    });

    res.status(201).json(newDoc);
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// GET /api/documents/:id/download
router.get('/:id/download', requireAuth, async (req: AuthRequest, res) => {
  try {
    const idParam = req.params.id;
    const isNumeric = !isNaN(Number(idParam));

    const item = await db.query.documents.findFirst({
      where: isNumeric ? eq(documents.id, Number(idParam)) : eq(documents.documentId, idParam),
    });

    if (!item) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const filePath = path.join(uploadDir, item.storedFilename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    res.download(filePath, item.originalFilename);
  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

export default router;

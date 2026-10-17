import express from 'express';
import path from 'path';
import fs from 'fs';
import * as dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const archiver = require('archiver');

import incidentsRouter from './src/server/routes/incidents.ts';
import actionsRouter from './src/server/routes/actions.ts';
import inspectionsRouter from './src/server/routes/inspections.ts';
import hazardsRouter from './src/server/routes/hazards.ts';
import meetingsRouter from './src/server/routes/meetings.ts';
import trainingsRouter from './src/server/routes/trainings.ts';
import drillsRouter from './src/server/routes/drills.ts';
import analyticsRouter from './src/server/routes/analytics.ts';
import documentsRouter from './src/server/routes/documents.ts';
import masterdataRouter from './src/server/routes/masterdata.ts';
import { processOverdueActions } from './src/services/reminders.ts';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // Ensure uploads directory exists
  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Body parsing middleware
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Static uploads serving
  app.use('/uploads', express.static(uploadsDir));

  // Mount API routers
  app.use('/api/incidents', incidentsRouter);
  app.use('/api/actions', actionsRouter);
  app.use('/api/inspections', inspectionsRouter);
  app.use('/api/hazards', hazardsRouter);
  app.use('/api/meetings', meetingsRouter);
  app.use('/api/trainings', trainingsRouter);
  app.use('/api/drills', drillsRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/documents', documentsRouter);
  app.use('/api/masterdata', masterdataRouter);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'industrial-ehs', timestamp: new Date().toISOString() });
  });

  // Project source code zip download endpoint
  app.get('/api/download-project', (req, res) => {
    res.attachment('industrial-ehs-management-system.zip');
    const archive = new archiver.ZipArchive({ zlib: { level: 9 } });

    archive.on('error', (err: any) => {
      console.error('Archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to generate project archive' });
      }
    });

    archive.pipe(res);

    archive.glob('**/*', {
      cwd: process.cwd(),
      ignore: [
        'node_modules/**',
        '.git/**',
        'dist/**',
        '.aistudio/**',
        'uploads/**',
        '*.log',
        '**/.DS_Store',
      ],
      dot: true,
    });

    archive.finalize();
  });

  // Background automated reminders check (runs once at boot, then every hour)
  setTimeout(() => {
    processOverdueActions().catch((err) => console.error('Reminders check error:', err));
  }, 5000);
  setInterval(() => {
    processOverdueActions().catch((err) => console.error('Reminders check interval error:', err));
  }, 60 * 60 * 1000);

  // Client handling: Vite dev middlewares or static production build
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[EHS Server] Running on http://0.0.0.0:${PORT} (${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

import { Router, Request, Response } from 'express';
import { HealthResponse } from '../types';

const router = Router();

const startTime = Date.now();

export const getHealthRouter = (getDb: () => unknown) => {
  router.get('/', (req: Request, res: Response) => {
    const memUsage = process.memoryUsage();
    const memTotal = memUsage.heapTotal;
    const memUsed = memUsage.heapUsed;
    const memPercentage = Math.round((memUsed / memTotal) * 100);

    let dbConnected = false;
    let dbType = 'unknown';

    try {
      const db = getDb() as { connected?: () => boolean; repo?: { adapterType?: string } };
      dbConnected = db.connected?.() ?? false;
    } catch {
      dbConnected = false;
    }

    const health: HealthResponse = {
      status: dbConnected ? 'ok' : 'degraded',
      version: process.env.npm_package_version || '0.1.0',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
      database: {
        connected: dbConnected,
        type: dbType,
      },
      memory: {
        used: memUsed,
        total: memTotal,
        percentage: memPercentage,
      },
    };

    const statusCode = health.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(health);
  });

  router.get('/ready', (req: Request, res: Response) => {
    res.status(200).json({ ready: true });
  });

  router.get('/live', (req: Request, res: Response) => {
    res.status(200).json({ alive: true });
  });

  return router;
};

export default router;

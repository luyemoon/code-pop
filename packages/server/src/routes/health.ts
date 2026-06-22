import { Router, Request, Response } from 'express';
import { HealthResponse } from '../types';

const router = Router();

const startTime = Date.now();

export const getHealthRouter = (getDb: () => unknown) => {
  /**
 * @swagger
 * /api/health:
 *   get:
 *     summary: 获取服务健康状态
 *     description: 返回服务的健康状态、版本、运行时间、数据库连接状态和内存使用情况
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: 服务正常运行
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 *       503:
 *         description: 服务降级（数据库未连接）
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 */
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

  /**
 * @swagger
 * /api/health/ready:
 *   get:
 *     summary: 就绪检查
 *     description: 检查服务是否已准备好接受请求
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: 服务已就绪
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ready:
 *                   type: boolean
 *                   example: true
 */
router.get('/ready', (req: Request, res: Response) => {
    res.status(200).json({ ready: true });
  });

  /**
 * @swagger
 * /api/health/live:
 *   get:
 *     summary: 存活检查
 *     description: 检查服务是否存活
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: 服务存活
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 alive:
 *                   type: boolean
 *                   example: true
 */
  router.get('/live', (req: Request, res: Response) => {
    res.status(200).json({ alive: true });
  });

  return router;
};

export default router;

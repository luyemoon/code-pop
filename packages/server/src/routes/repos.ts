import { Router, Response } from 'express';
import { DatabaseAdapter } from '@codepop/core';
import { CreateRepoRequest, UpdateRepoRequest, RepoResponse, ApiResponse } from '../types';
import { logger } from '../config';
import { IndexerService, IndexProgress } from '../services/indexer';
import { getEmbeddingService } from '../services/embedding';
import { AuthenticatedRequest } from '../middleware/auth';
import { WebSocketServer } from 'ws';

const router = Router();

let db: DatabaseAdapter;
let wss: WebSocketServer | null = null;

export const setReposDependencies = (database: DatabaseAdapter, wsServer: WebSocketServer | null): void => {
  db = database;
  wss = wsServer;
};

const notifyClients = (message: object): void => {
  if (wss) {
    wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify(message));
      }
    });
  }
};

const validateCreateRepoRequest = (body: unknown): { valid: boolean; error?: string; data?: CreateRepoRequest } => {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }

  const { name, path, gitUrl } = body as Record<string, unknown>;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return { valid: false, error: 'Name is required and must be a non-empty string' };
  }

  if (!path || typeof path !== 'string' || path.trim().length === 0) {
    return { valid: false, error: 'Path is required and must be a non-empty string' };
  }

  if (gitUrl !== undefined && (typeof gitUrl !== 'string' || !gitUrl.startsWith('http'))) {
    return { valid: false, error: 'Git URL must be a valid HTTP(S) URL' };
  }

  return {
    valid: true,
    data: {
      name: name.trim(),
      path: path.trim(),
      gitUrl: gitUrl?.trim(),
    },
  };
};

const validateUpdateRepoRequest = (body: unknown): { valid: boolean; error?: string; data?: UpdateRepoRequest } => {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }

  const { name, path, gitUrl } = body as Record<string, unknown>;

  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
    return { valid: false, error: 'Name must be a non-empty string' };
  }

  if (path !== undefined && (typeof path !== 'string' || path.trim().length === 0)) {
    return { valid: false, error: 'Path must be a non-empty string' };
  }

  if (gitUrl !== undefined && (typeof gitUrl !== 'string' || (!gitUrl.startsWith('http') && gitUrl !== ''))) {
    return { valid: false, error: 'Git URL must be a valid HTTP(S) URL or empty string' };
  }

  return {
    valid: true,
    data: {
      name: name?.trim(),
      path: path?.trim(),
      gitUrl: gitUrl?.trim() || undefined,
    },
  };
};

export const getReposRouter = () => {
  /**
 * @swagger
 * /api/repos:
 *   post:
 *     summary: 创建仓库
 *     description: 添加一个新的代码仓库到索引系统
 *     tags: [Repositories]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateRepoRequest'
 *     responses:
 *       201:
 *         description: 仓库创建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: 请求参数无效
 *       409:
 *         description: 仓库已存在
 */
  router.post('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validation = validateCreateRepoRequest(req.body);
      if (!validation.valid || !validation.data) {
        return res.status(400).json({
          success: false,
          error: validation.error,
        } as ApiResponse);
      }

      const { name, path, gitUrl } = validation.data;

      const existingRepo = await db.repo.getByPath(path);
      if (existingRepo) {
        return res.status(409).json({
          success: false,
          error: 'Repository with this path already exists',
        } as ApiResponse);
      }

      const repo = await db.repo.create({ name, path, gitUrl });

      logger.info(`Repository created: ${repo.id} - ${name}`);

      return res.status(201).json({
        success: true,
        data: repo,
      } as ApiResponse<RepoResponse>);
    } catch (error) {
      logger.error('Failed to create repository:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create repository',
      } as ApiResponse);
    }
  });

  /**
 * @swagger
 * /api/repos:
 *   get:
 *     summary: 获取所有仓库
 *     description: 返回系统中所有已索引的代码仓库列表
 *     tags: [Repositories]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: 仓库列表
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       500:
 *         description: 服务器内部错误
 */
  router.get('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const repos = await db.repo.getAll();

      return res.status(200).json({
        success: true,
        data: repos,
      } as ApiResponse<RepoResponse[]>);
    } catch (error) {
      logger.error('Failed to get repositories:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get repositories',
      } as ApiResponse);
    }
  });

  /**
 * @swagger
 * /api/repos/{id}:
 *   get:
 *     summary: 获取指定仓库
 *     description: 根据仓库ID获取仓库详细信息
 *     tags: [Repositories]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 仓库ID
 *     responses:
 *       200:
 *         description: 仓库详细信息
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       404:
 *         description: 仓库不存在
 *       500:
 *         description: 服务器内部错误
 */
  router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const repo = await db.repo.getById(id);

      if (!repo) {
        return res.status(404).json({
          success: false,
          error: 'Repository not found',
        } as ApiResponse);
      }

      return res.status(200).json({
        success: true,
        data: repo,
      } as ApiResponse<RepoResponse>);
    } catch (error) {
      logger.error(`Failed to get repository ${req.params.id}:`, error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get repository',
      } as ApiResponse);
    }
  });

  /**
 * @swagger
 * /api/repos/{id}:
 *   patch:
 *     summary: 更新仓库
 *     description: 更新指定仓库的信息
 *     tags: [Repositories]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 仓库ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateRepoRequest'
 *     responses:
 *       200:
 *         description: 仓库更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: 请求参数无效
 *       404:
 *         description: 仓库不存在
 *       500:
 *         description: 服务器内部错误
 */
  router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const validation = validateUpdateRepoRequest(req.body);
      if (!validation.valid || !validation.data) {
        return res.status(400).json({
          success: false,
          error: validation.error,
        } as ApiResponse);
      }

      const existingRepo = await db.repo.getById(id);
      if (!existingRepo) {
        return res.status(404).json({
          success: false,
          error: 'Repository not found',
        } as ApiResponse);
      }

      const repo = await db.repo.update(id, validation.data);

      logger.info(`Repository updated: ${id}`);

      return res.status(200).json({
        success: true,
        data: repo,
      } as ApiResponse<RepoResponse>);
    } catch (error) {
      logger.error(`Failed to update repository ${req.params.id}:`, error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update repository',
      } as ApiResponse);
    }
  });

  /**
 * @swagger
 * /api/repos/{id}:
 *   delete:
 *     summary: 删除仓库
 *     description: 删除指定仓库及其所有关联数据
 *     tags: [Repositories]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 仓库ID
 *     responses:
 *       200:
 *         description: 仓库删除成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       404:
 *         description: 仓库不存在
 *       500:
 *         description: 服务器内部错误
 */
  router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const existingRepo = await db.repo.getById(id);
      if (!existingRepo) {
        return res.status(404).json({
          success: false,
          error: 'Repository not found',
        } as ApiResponse);
      }

      await db.embedding.deleteByRepoId(id);
      await db.symbol.deleteByRepoId(id);
      await db.callGraph.deleteByRepoId(id);
      await db.file.deleteByRepoId(id);
      await db.repo.delete(id);

      logger.info(`Repository deleted: ${id}`);

      return res.status(200).json({
        success: true,
        message: 'Repository deleted successfully',
      } as ApiResponse);
    } catch (error) {
      logger.error(`Failed to delete repository ${req.params.id}:`, error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete repository',
      } as ApiResponse);
    }
  });

  /**
 * @swagger
 * /api/repos/{id}/index:
 *   post:
 *     summary: 启动仓库索引
 *     description: 对指定仓库启动代码索引过程，生成嵌入向量
 *     tags: [Repositories]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 仓库ID
 *     responses:
 *       202:
 *         description: 索引任务已启动
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       404:
 *         description: 仓库不存在
 *       500:
 *         description: 服务器内部错误
 */
  router.post('/:id/index', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const repo = await db.repo.getById(id);
      if (!repo) {
        return res.status(404).json({
          success: false,
          error: 'Repository not found',
        } as ApiResponse);
      }

      const embeddingService = getEmbeddingService();
      const indexer = new IndexerService({
        db,
        embeddingService,
        onProgress: (progress: IndexProgress) => {
          notifyClients({
            type: 'index_progress',
            payload: progress,
            timestamp: new Date().toISOString(),
          });
        },
        onError: (error: Error) => {
          logger.error(`Indexing error for repository ${id}:`, error);
          notifyClients({
            type: 'error',
            payload: { repoId: id, error: error.message },
            timestamp: new Date().toISOString(),
          });
        },
      });

      res.status(202).json({
        success: true,
        data: {
          status: 'pending',
          repoId: id,
          message: 'Indexing started',
        },
      });

      const result = await indexer.indexRepository(id, repo.path);

      notifyClients({
        type: 'index_progress',
        payload: result,
        timestamp: new Date().toISOString(),
      });

      logger.info(`Indexing completed for repository ${id}: ${result.filesIndexed} files, ${result.chunksIndexed} chunks`);
    } catch (error) {
      logger.error(`Failed to index repository ${req.params.id}:`, error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to index repository',
      } as ApiResponse);
    }
  });

  /**
 * @swagger
 * /api/repos/{id}/files:
 *   get:
 *     summary: 获取仓库文件列表
 *     description: 返回指定仓库的所有文件
 *     tags: [Repositories]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 仓库ID
 *     responses:
 *       200:
 *         description: 文件列表
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       404:
 *         description: 仓库不存在
 *       500:
 *         description: 服务器内部错误
 */
  router.get('/:id/files', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const repo = await db.repo.getById(id);
      if (!repo) {
        return res.status(404).json({
          success: false,
          error: 'Repository not found',
        } as ApiResponse);
      }

      const files = await db.file.getByRepoId(id);

      return res.status(200).json({
        success: true,
        data: files,
      } as ApiResponse);
    } catch (error) {
      logger.error(`Failed to get files for repository ${req.params.id}:`, error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get files',
      } as ApiResponse);
    }
  });

  /**
 * @swagger
 * /api/repos/{id}/symbols:
 *   get:
 *     summary: 获取仓库符号列表
 *     description: 返回指定仓库的所有代码符号（函数、类、变量等）
 *     tags: [Repositories]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 仓库ID
 *     responses:
 *       200:
 *         description: 符号列表
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       404:
 *         description: 仓库不存在
 *       500:
 *         description: 服务器内部错误
 */
  router.get('/:id/symbols', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const repo = await db.repo.getById(id);
      if (!repo) {
        return res.status(404).json({
          success: false,
          error: 'Repository not found',
        } as ApiResponse);
      }

      const files = await db.file.getByRepoId(id);
      const allSymbols: import('@codepop/core').Symbol[] = [];

      for (const file of files) {
        const symbols = await db.symbol.getByFileId(file.id);
        allSymbols.push(...symbols);
      }

      return res.status(200).json({
        success: true,
        data: allSymbols,
      } as ApiResponse);
    } catch (error) {
      logger.error(`Failed to get symbols for repository ${req.params.id}:`, error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get symbols',
      } as ApiResponse);
    }
  });

  return router;
};

export default router;

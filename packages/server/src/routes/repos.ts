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

import { Router, Response } from 'express';
import { DatabaseAdapter } from '@codepop/core';
import { ApiResponse, EmbeddingResponse } from '../types';
import { logger } from '../config';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

let db: DatabaseAdapter;

export const setEmbeddingsDependencies = (database: DatabaseAdapter): void => {
  db = database;
};

export const getEmbeddingsRouter = () => {
  router.get('/file/:fileId', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { fileId } = req.params;

      const embeddings = await db.embedding.getByFileId(fileId);

      return res.status(200).json({
        success: true,
        data: embeddings,
      } as ApiResponse<EmbeddingResponse[]>);
    } catch (error) {
      logger.error(`Failed to get embeddings for file ${req.params.fileId}:`, error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get embeddings',
      } as ApiResponse);
    }
  });

  router.delete('/file/:fileId', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { fileId } = req.params;

      await db.embedding.deleteByFileId(fileId);

      logger.info(`Embeddings deleted for file: ${fileId}`);

      return res.status(200).json({
        success: true,
        message: 'Embeddings deleted successfully',
      } as ApiResponse);
    } catch (error) {
      logger.error(`Failed to delete embeddings for file ${req.params.fileId}:`, error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete embeddings',
      } as ApiResponse);
    }
  });

  router.delete('/repo/:repoId', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { repoId } = req.params;

      await db.embedding.deleteByRepoId(repoId);

      logger.info(`Embeddings deleted for repository: ${repoId}`);

      return res.status(200).json({
        success: true,
        message: 'Embeddings deleted successfully',
      } as ApiResponse);
    } catch (error) {
      logger.error(`Failed to delete embeddings for repo ${req.params.repoId}:`, error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete embeddings',
      } as ApiResponse);
    }
  });

  router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const embedding = await db.embedding.getById(id);

      if (!embedding) {
        return res.status(404).json({
          success: false,
          error: 'Embedding not found',
        } as ApiResponse);
      }

      return res.status(200).json({
        success: true,
        data: embedding,
      } as ApiResponse<EmbeddingResponse>);
    } catch (error) {
      logger.error(`Failed to get embedding ${req.params.id}:`, error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get embedding',
      } as ApiResponse);
    }
  });

  router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { content, embedding, tokenCount } = req.body as {
        content?: string;
        embedding?: number[];
        tokenCount?: number;
      };

      const existingEmbedding = await db.embedding.getById(id);
      if (!existingEmbedding) {
        return res.status(404).json({
          success: false,
          error: 'Embedding not found',
        } as ApiResponse);
      }

      const updates: Partial<import('@codepop/core').Embedding> = {};
      if (content !== undefined) updates.content = content;
      if (embedding !== undefined) updates.embedding = embedding;
      if (tokenCount !== undefined) updates.tokenCount = tokenCount;

      const updated = await db.embedding.update(id, updates);

      logger.info(`Embedding updated: ${id}`);

      return res.status(200).json({
        success: true,
        data: updated,
      } as ApiResponse<EmbeddingResponse>);
    } catch (error) {
      logger.error(`Failed to update embedding ${req.params.id}:`, error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update embedding',
      } as ApiResponse);
    }
  });

  return router;
};

export default router;

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
  /**
 * @swagger
 * /api/embeddings/file/{fileId}:
 *   get:
 *     summary: 获取文件的嵌入向量
 *     description: 根据文件ID获取所有关联的嵌入向量
 *     tags: [Embeddings]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *         description: 文件ID
 *     responses:
 *       200:
 *         description: 嵌入向量列表
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       500:
 *         description: 服务器内部错误
 */
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

  /**
 * @swagger
 * /api/embeddings/file/{fileId}:
 *   delete:
 *     summary: 删除文件的嵌入向量
 *     description: 根据文件ID删除所有关联的嵌入向量
 *     tags: [Embeddings]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *         description: 文件ID
 *     responses:
 *       200:
 *         description: 删除成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       500:
 *         description: 服务器内部错误
 */
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

  /**
 * @swagger
 * /api/embeddings/repo/{repoId}:
 *   delete:
 *     summary: 删除仓库的嵌入向量
 *     description: 根据仓库ID删除所有关联的嵌入向量
 *     tags: [Embeddings]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: repoId
 *         required: true
 *         schema:
 *           type: string
 *         description: 仓库ID
 *     responses:
 *       200:
 *         description: 删除成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       500:
 *         description: 服务器内部错误
 */
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

  /**
 * @swagger
 * /api/embeddings/{id}:
 *   get:
 *     summary: 获取嵌入向量
 *     description: 根据ID获取单个嵌入向量
 *     tags: [Embeddings]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 嵌入向量ID
 *     responses:
 *       200:
 *         description: 嵌入向量详情
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       404:
 *         description: 嵌入向量不存在
 *       500:
 *         description: 服务器内部错误
 */
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

  /**
 * @swagger
 * /api/embeddings/{id}:
 *   patch:
 *     summary: 更新嵌入向量
 *     description: 更新指定嵌入向量的内容
 *     tags: [Embeddings]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 嵌入向量ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 description: 新的内容
 *               embedding:
 *                 type: array
 *                 items:
 *                   type: number
 *                 description: 新的嵌入向量
 *               tokenCount:
 *                 type: number
 *                 description: 新的token数量
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       404:
 *         description: 嵌入向量不存在
 *       500:
 *         description: 服务器内部错误
 */
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

import { Router, Response } from 'express';
import { DatabaseAdapter } from '@codepop/core';
import { SearchRequest, SearchResponse, SearchResultItem, ApiResponse } from '../types';
import { logger } from '../config';
import { getEmbeddingService } from '../services/embedding';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

let db: DatabaseAdapter;

export const setSearchDependencies = (database: DatabaseAdapter): void => {
  db = database;
};

const validateSearchRequest = (body: unknown): { valid: boolean; error?: string; data?: SearchRequest } => {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }

  const { query, repoId, limit } = body as Record<string, unknown>;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return { valid: false, error: 'Query is required and must be a non-empty string' };
  }

  if (repoId !== undefined && (typeof repoId !== 'string' || repoId.trim().length === 0)) {
    return { valid: false, error: 'RepoId must be a non-empty string' };
  }

  if (limit !== undefined && (typeof limit !== 'number' || limit < 1 || limit > 100)) {
    return { valid: false, error: 'Limit must be a number between 1 and 100' };
  }

  return {
    valid: true,
    data: {
      query: query.trim(),
      repoId: repoId?.trim(),
      limit: limit || 10,
    },
  };
};

export const getSearchRouter = () => {
  /**
 * @swagger
 * /api/search:
 *   post:
 *     summary: 语义搜索
 *     description: 使用语义嵌入向量进行代码搜索
 *     tags: [Search]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SearchRequest'
 *     responses:
 *       200:
 *         description: 搜索结果
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: 请求参数无效
 *       500:
 *         description: 服务器内部错误
 */
  router.post('/', async (req: AuthenticatedRequest, res: Response) => {
    const startTime = Date.now();

    try {
      const validation = validateSearchRequest(req.body);
      if (!validation.valid || !validation.data) {
        return res.status(400).json({
          success: false,
          error: validation.error,
        } as ApiResponse);
      }

      const { query, repoId, limit } = validation.data;

      const embeddingService = getEmbeddingService();
      const embeddingResult = await embeddingService.generateEmbedding(query);

      const searchResults = await db.embedding.search(embeddingResult.embedding, limit, repoId);

      const results: SearchResultItem[] = [];

      for (const result of searchResults) {
        try {
          const file = await db.file.getById(result.embedding.fileId);
          if (file) {
            results.push({
              fileId: result.embedding.fileId,
              repoId: file.repoId,
              path: file.path,
              content: result.embedding.content,
              similarity: result.similarity,
            });
          }
        } catch (error) {
          logger.debug(`Failed to get file for embedding ${result.embedding.id}:`, error);
        }
      }

      const response: SearchResponse = {
        results,
        query,
        total: results.length,
        took: Date.now() - startTime,
      };

      logger.info(`Search completed: query="${query}", results=${results.length}, took=${response.took}ms`);

      return res.status(200).json({
        success: true,
        data: response,
      } as ApiResponse<SearchResponse>);
    } catch (error) {
      logger.error('Search failed:', error);
      return res.status(500).json({
        success: false,
        error: 'Search failed',
      } as ApiResponse);
    }
  });

  /**
 * @swagger
 * /api/search/symbol:
 *   post:
 *     summary: 符号搜索
 *     description: 根据名称搜索代码符号（函数、类、变量等）
 *     tags: [Search]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               query:
 *                 type: string
 *                 description: 搜索关键词
 *               repoId:
 *                 type: string
 *                 description: 仓库ID（可选）
 *               limit:
 *                 type: number
 *                 description: 返回结果数量限制（默认20）
 *     responses:
 *       200:
 *         description: 符号搜索结果
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: 请求参数无效
 *       500:
 *         description: 服务器内部错误
 */
  router.post('/symbol', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { query, repoId, limit } = req.body as { query?: string; repoId?: string; limit?: number };

      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Query is required',
        } as ApiResponse);
      }

      const files = repoId ? await db.file.getByRepoId(repoId) : [];
      const allSymbols: import('@codepop/core').Symbol[] = [];

      if (repoId) {
        for (const file of files) {
          const symbols = await db.symbol.getByFileId(file.id);
          allSymbols.push(...symbols);
        }
      }

      const matchingSymbols = allSymbols.filter(s =>
        s.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, limit || 20);

      const results = await Promise.all(
        matchingSymbols.map(async (symbol) => {
          const file = await db.file.getById(symbol.fileId);
          return {
            symbolId: symbol.id,
            symbolName: symbol.name,
            symbolType: symbol.type,
            fileId: symbol.fileId,
            filePath: file?.path || 'unknown',
            repoId: file?.repoId || 'unknown',
            line: symbol.line,
            column: symbol.column,
            isExported: symbol.isExported,
          };
        })
      );

      return res.status(200).json({
        success: true,
        data: results,
      } as ApiResponse);
    } catch (error) {
      logger.error('Symbol search failed:', error);
      return res.status(500).json({
        success: false,
        error: 'Symbol search failed',
      } as ApiResponse);
    }
  });

  /**
 * @swagger
 * /api/search/history:
 *   get:
 *     summary: 获取搜索历史
 *     description: 返回用户的搜索历史记录
 *     tags: [Search]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: 搜索历史列表
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       500:
 *         description: 服务器内部错误
 */
  router.get('/history', async (req: AuthenticatedRequest, res: Response) => {
    try {
      return res.status(200).json({
        success: true,
        data: [],
        message: 'Search history not yet implemented',
      } as ApiResponse);
    } catch (error) {
      logger.error('Failed to get search history:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get search history',
      } as ApiResponse);
    }
  });

  return router;
};

export default router;

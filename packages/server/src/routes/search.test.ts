import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express, { Express } from 'express';
import { MockAdapter } from '@codepop/core';
import { getSearchRouter, setSearchDependencies } from './search';

// Mock the embedding service
vi.mock('../services/embedding', () => ({
  getEmbeddingService: vi.fn(() => ({
    generateEmbedding: vi.fn().mockResolvedValue({
      embedding: new Array(1536).fill(0.1),
      tokenCount: 10,
      provider: 'openai',
      model: 'text-embedding-3-small',
    }),
  })),
}));

// Mock the config logger
vi.mock('../config', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  CONFIG: {
    openaiApiKey: 'test-key',
    embeddingModel: 'text-embedding-3-small',
  },
}));

describe('Search Routes', () => {
  let app: Express;
  let adapter: MockAdapter;

  beforeEach(async () => {
    adapter = new MockAdapter();
    setSearchDependencies(adapter);

    app = express();
    app.use(express.json());
    app.use('/search', getSearchRouter());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /', () => {
    it('should return 400 when query is missing', async () => {
      const response = await makeRequest(app, 'POST', '/search', {});

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Query is required');
    });

    it('should return 400 when query is empty string', async () => {
      const response = await makeRequest(app, 'POST', '/search', { query: '   ' });

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 when query is not a string', async () => {
      const response = await makeRequest(app, 'POST', '/search', { query: 123 });

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 when repoId is not a string', async () => {
      const response = await makeRequest(app, 'POST', '/search', {
        query: 'test query',
        repoId: 123,
      });

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 when limit is out of range', async () => {
      const response = await makeRequest(app, 'POST', '/search', {
        query: 'test',
        limit: 200,
      });

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 when limit is less than 1', async () => {
      const response = await makeRequest(app, 'POST', '/search', {
        query: 'test',
        limit: 0,
      });

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return search results with valid request', async () => {
      // Create test repo and file
      const repo = await adapter.repo.create({
        name: 'search-test-repo',
        path: '/path/to/search',
      });
      const file = await adapter.file.create({
        repoId: repo.id,
        path: '/test.ts',
        language: 'typescript',
      });
      await adapter.embedding.create({
        fileId: file.id,
        chunkIndex: 0,
        content: 'test content',
        embedding: new Array(1536).fill(0.1),
        tokenCount: 2,
      });

      const response = await makeRequest(app, 'POST', '/search', {
        query: 'test',
        limit: 10,
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.query).toBe('test');
      expect(response.body.data.total).toBeDefined();
      expect(response.body.data.took).toBeDefined();
    });

    it('should filter by repoId when provided', async () => {
      const repo1 = await adapter.repo.create({
        name: 'repo1',
        path: '/path/1',
      });
      const repo2 = await adapter.repo.create({
        name: 'repo2',
        path: '/path/2',
      });

      const file1 = await adapter.file.create({
        repoId: repo1.id,
        path: '/file1.ts',
      });
      const file2 = await adapter.file.create({
        repoId: repo2.id,
        path: '/file2.ts',
      });

      await adapter.embedding.create({
        fileId: file1.id,
        chunkIndex: 0,
        content: 'content for repo1',
        embedding: new Array(1536).fill(0.1),
        tokenCount: 3,
      });
      await adapter.embedding.create({
        fileId: file2.id,
        chunkIndex: 0,
        content: 'content for repo2',
        embedding: new Array(1536).fill(0.1),
        tokenCount: 3,
      });

      const response = await makeRequest(app, 'POST', '/search', {
        query: 'content',
        repoId: repo1.id,
        limit: 10,
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.data.results.length).toBe(1);
      expect(response.body.data.results[0].repoId).toBe(repo1.id);
    });

    it('should handle empty search results', async () => {
      const response = await makeRequest(app, 'POST', '/search', {
        query: 'nonexistent content xyz123',
        limit: 10,
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.data.results).toEqual([]);
      expect(response.body.data.total).toBe(0);
    });

    it('should default limit to 10', async () => {
      const response = await makeRequest(app, 'POST', '/search', {
        query: 'test',
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.data.query).toBe('test');
    });
  });

  describe('POST /symbol', () => {
    beforeEach(async () => {
      const repo = await adapter.repo.create({
        name: 'symbol-search-test',
        path: '/path/symbol',
      });
      const file = await adapter.file.create({
        repoId: repo.id,
        path: '/test.ts',
      });
      await adapter.symbol.create({
        fileId: file.id,
        name: 'testFunction',
        type: 'function',
        kind: 'function',
        line: 1,
        column: 0,
        isExported: true,
      });
    });

    it('should return 400 when query is missing', async () => {
      const response = await makeRequest(app, 'POST', '/search/symbol', {});

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 when query is empty', async () => {
      const response = await makeRequest(app, 'POST', '/search/symbol', {
        query: '',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return symbol search results', async () => {
      const response = await makeRequest(app, 'POST', '/search/symbol', {
        query: 'test',
        limit: 20,
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should filter by repoId when provided', async () => {
      const response = await makeRequest(app, 'POST', '/search/symbol', {
        query: 'test',
        repoId: 'some-repo-id',
        limit: 20,
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /history', () => {
    it('should return empty array with message', async () => {
      const response = await makeRequest(app, 'GET', '/search/history');

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
      expect(response.body.message).toContain('not yet implemented');
    });
  });
});

// Helper function to make HTTP requests
async function makeRequest(
  app: Express,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown
): Promise<{ statusCode: number; body: any }> {
  return new Promise((resolve) => {
    const req = {
      method,
      url: path,
      headers: {},
      body: body ? JSON.stringify(body) : undefined,
    };

    if (body) {
      req.headers = { 'content-type': 'application/json' };
    }

    // Create mock request object
    const mockReq = {
      method,
      url: path,
      path,
      params: {},
      query: {},
      body: body || {},
      headers: req.headers,
      get: (name: string) => req.headers[name.toLowerCase()],
    } as any;

    // Parse URL params
    const pathParts = path.split('/');
    if (pathParts.length > 2) {
      // Handle /:id patterns
      for (let i = 2; i < pathParts.length; i++) {
        if (pathParts[i].startsWith(':')) {
          mockReq.params[pathParts[i].slice(1)] = pathParts[i + 1] || '';
        }
      }
    }

    // Create mock response
    let responseBody: any;
    let responseStatus = 200;

    const mockRes = {
      status: vi.fn((code) => {
        responseStatus = code;
        return mockRes;
      }),
      json: vi.fn((data) => {
        responseBody = data;
        return mockRes;
      }),
      send: vi.fn((data) => {
        responseBody = data;
        return mockRes;
      }),
    } as any;

    // Handle the route
    const router = app._router;
    if (!router) {
      resolve({ statusCode: 404, body: { error: 'No router' } });
      return;
    }

    // Find and execute the route handler
    const layers = router.stack;
    let handled = false;

    for (const layer of layers) {
      if (layer.route && layer.route.path === path && layer.route.methods[method.toLowerCase()]) {
        layer.handle(mockReq, mockRes, () => {
          handled = true;
        });
        if (!handled) {
          resolve({ statusCode: responseStatus, body: responseBody });
        }
        break;
      }
    }

    // For routes with params, we need to match differently
    if (!handled) {
      for (const layer of layers) {
        if (layer.route && layer.route.methods[method.toLowerCase()]) {
          const routePath = layer.route.path;
          const pathPattern = routePath.replace(/:([^/]+)/g, '([^/]+)');
          const regex = new RegExp(`^${pathPattern}$`);
          const match = path.match(regex);

          if (match) {
            // Extract params
            const paramNames = routePath.match(/:([^/]+)/g) || [];
            paramNames.forEach((param, index) => {
              mockReq.params[param.slice(1)] = match[index + 1];
            });

            layer.handle(mockReq, mockRes, () => {
              handled = true;
            });
            break;
          }
        }
      }
    }

    resolve({ statusCode: responseStatus, body: responseBody });
  });
}

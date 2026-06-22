import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express, { Express } from 'express';
import { MockAdapter } from '@codepop/core';
import { getReposRouter, setReposDependencies } from './repos';

// Mock the indexer service
vi.mock('../services/indexer', () => ({
  IndexerService: vi.fn().mockImplementation(() => ({
    indexRepository: vi.fn().mockResolvedValue({
      filesIndexed: 10,
      chunksIndexed: 50,
      symbolsIndexed: 100,
      status: 'completed',
    }),
  })),
}));

// Mock the embedding service
vi.mock('../services/embedding', () => ({
  getEmbeddingService: vi.fn(() => ({
    generateEmbedding: vi.fn().mockResolvedValue({
      embedding: new Array(1536).fill(0.1),
      tokenCount: 10,
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

// Mock WebSocket
vi.mock('ws', () => ({
  WebSocketServer: vi.fn().mockImplementation(() => ({
    clients: new Set(),
  })),
}));

describe('Repos Routes', () => {
  let app: Express;
  let adapter: MockAdapter;

  beforeEach(async () => {
    adapter = new MockAdapter();
    setReposDependencies(adapter, null);

    app = express();
    app.use(express.json());
    app.use('/repos', getReposRouter());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /', () => {
    it('should return 400 when name is missing', async () => {
      const response = await makeRequest(app, 'POST', '/repos', {
        path: '/path/to/repo',
      });

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Name is required');
    });

    it('should return 400 when name is empty', async () => {
      const response = await makeRequest(app, 'POST', '/repos', {
        name: '   ',
        path: '/path/to/repo',
      });

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 when path is missing', async () => {
      const response = await makeRequest(app, 'POST', '/repos', {
        name: 'test-repo',
      });

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Path is required');
    });

    it('should return 400 when gitUrl is invalid', async () => {
      const response = await makeRequest(app, 'POST', '/repos', {
        name: 'test-repo',
        path: '/path/to/repo',
        gitUrl: 'not-a-url',
      });

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Git URL');
    });

    it('should create a repo with valid data', async () => {
      const response = await makeRequest(app, 'POST', '/repos', {
        name: 'test-repo',
        path: '/path/to/test-repo',
        gitUrl: 'https://github.com/test/repo',
      });

      expect(response.statusCode).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('test-repo');
      expect(response.body.data.path).toBe('/path/to/test-repo');
    });

    it('should return 409 when repo with same path exists', async () => {
      await makeRequest(app, 'POST', '/repos', {
        name: 'existing-repo',
        path: '/path/existing',
      });

      const response = await makeRequest(app, 'POST', '/repos', {
        name: 'another-repo',
        path: '/path/existing',
      });

      expect(response.statusCode).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already exists');
    });

    it('should create repo without optional gitUrl', async () => {
      const response = await makeRequest(app, 'POST', '/repos', {
        name: 'no-git-repo',
        path: '/path/no-git',
      });

      expect(response.statusCode).toBe(201);
      expect(response.body.data.gitUrl).toBeUndefined();
    });
  });

  describe('GET /', () => {
    it('should return empty array when no repos exist', async () => {
      const response = await makeRequest(app, 'GET', '/repos');

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it('should return all repos', async () => {
      await makeRequest(app, 'POST', '/repos', {
        name: 'repo1',
        path: '/path/1',
      });
      await makeRequest(app, 'POST', '/repos', {
        name: 'repo2',
        path: '/path/2',
      });

      const response = await makeRequest(app, 'GET', '/repos');

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(2);
    });
  });

  describe('GET /:id', () => {
    it('should return 404 when repo does not exist', async () => {
      const response = await makeRequest(app, 'GET', '/repos/non-existent-id');

      expect(response.statusCode).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });

    it('should return repo when it exists', async () => {
      const created = await makeRequest(app, 'POST', '/repos', {
        name: 'get-test-repo',
        path: '/path/get-test',
      });

      const response = await makeRequest(app, 'GET', `/repos/${created.body.data.id}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('get-test-repo');
    });
  });

  describe('PATCH /:id', () => {
    it('should return 400 when name is empty string', async () => {
      const created = await makeRequest(app, 'POST', '/repos', {
        name: 'update-test',
        path: '/path/update',
      });

      const response = await makeRequest(app, 'PATCH', `/repos/${created.body.data.id}`, {
        name: '',
      });

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 when path is empty string', async () => {
      const created = await makeRequest(app, 'POST', '/repos', {
        name: 'update-test',
        path: '/path/update',
      });

      const response = await makeRequest(app, 'PATCH', `/repos/${created.body.data.id}`, {
        path: '',
      });

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 404 when updating non-existent repo', async () => {
      const response = await makeRequest(app, 'PATCH', '/repos/non-existent-id', {
        name: 'new-name',
      });

      expect(response.statusCode).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should update repo successfully', async () => {
      const created = await makeRequest(app, 'POST', '/repos', {
        name: 'original-name',
        path: '/path/original',
      });

      const response = await makeRequest(app, 'PATCH', `/repos/${created.body.data.id}`, {
        name: 'updated-name',
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('updated-name');
    });

    it('should update gitUrl successfully', async () => {
      const created = await makeRequest(app, 'POST', '/repos', {
        name: 'git-test',
        path: '/path/git',
      });

      const response = await makeRequest(app, 'PATCH', `/repos/${created.body.data.id}`, {
        gitUrl: 'https://github.com/test/updated',
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.data.gitUrl).toBe('https://github.com/test/updated');
    });
  });

  describe('DELETE /:id', () => {
    it('should return 404 when deleting non-existent repo', async () => {
      const response = await makeRequest(app, 'DELETE', '/repos/non-existent-id');

      expect(response.statusCode).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should delete repo successfully', async () => {
      const created = await makeRequest(app, 'POST', '/repos', {
        name: 'delete-test',
        path: '/path/delete',
      });

      const response = await makeRequest(app, 'DELETE', `/repos/${created.body.data.id}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify deletion
      const getResponse = await makeRequest(app, 'GET', `/repos/${created.body.data.id}`);
      expect(getResponse.statusCode).toBe(404);
    });

    it('should cascade delete related data', async () => {
      const created = await makeRequest(app, 'POST', '/repos', {
        name: 'cascade-test',
        path: '/path/cascade',
      });

      const repoId = created.body.data.id;

      // Create file, symbol, and embedding
      const file = await adapter.file.create({
        repoId,
        path: '/test.ts',
      });
      await adapter.symbol.create({
        fileId: file.id,
        name: 'testFunc',
        type: 'function',
        kind: 'function',
        line: 1,
        column: 0,
        isExported: false,
      });
      await adapter.embedding.create({
        fileId: file.id,
        chunkIndex: 0,
        content: 'test',
        embedding: new Array(1536).fill(0.1),
        tokenCount: 1,
      });

      await makeRequest(app, 'DELETE', `/repos/${repoId}`);

      // Data should be deleted via cascade
      const files = await adapter.file.getByRepoId(repoId);
      expect(files).toHaveLength(0);
    });
  });

  describe('GET /:id/files', () => {
    it('should return 404 when repo does not exist', async () => {
      const response = await makeRequest(app, 'GET', '/repos/non-existent/files');

      expect(response.statusCode).toBe(404);
    });

    it('should return files for a repo', async () => {
      const created = await makeRequest(app, 'POST', '/repos', {
        name: 'files-test',
        path: '/path/files',
      });

      const repoId = created.body.data.id;

      await adapter.file.create({ repoId, path: '/a.ts' });
      await adapter.file.create({ repoId, path: '/b.ts' });

      const response = await makeRequest(app, 'GET', `/repos/${repoId}/files`);

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(2);
    });
  });

  describe('GET /:id/symbols', () => {
    it('should return 404 when repo does not exist', async () => {
      const response = await makeRequest(app, 'GET', '/repos/non-existent/symbols');

      expect(response.statusCode).toBe(404);
    });

    it('should return symbols for a repo', async () => {
      const created = await makeRequest(app, 'POST', '/repos', {
        name: 'symbols-test',
        path: '/path/symbols',
      });

      const repoId = created.body.data.id;
      const file = await adapter.file.create({ repoId, path: '/test.ts' });

      await adapter.symbol.create({
        fileId: file.id,
        name: 'func1',
        type: 'function',
        kind: 'function',
        line: 1,
        column: 0,
        isExported: false,
      });
      await adapter.symbol.create({
        fileId: file.id,
        name: 'func2',
        type: 'function',
        kind: 'function',
        line: 5,
        column: 0,
        isExported: false,
      });

      const response = await makeRequest(app, 'GET', `/repos/${repoId}/symbols`);

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(2);
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

    const router = app._router;
    if (!router) {
      resolve({ statusCode: 404, body: { error: 'No router' } });
      return;
    }

    const layers = router.stack;
    let handled = false;

    for (const layer of layers) {
      if (layer.route && layer.route.path === path && layer.route.methods[method.toLowerCase()]) {
        layer.handle(mockReq, mockRes, () => {
          handled = true;
        });
        break;
      }
    }

    if (!handled) {
      for (const layer of layers) {
        if (layer.route && layer.route.methods[method.toLowerCase()]) {
          const routePath = layer.route.path;
          const pathPattern = routePath.replace(/:([^/]+)/g, '([^/]+)');
          const regex = new RegExp(`^${pathPattern}$`);
          const match = path.match(regex);

          if (match) {
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

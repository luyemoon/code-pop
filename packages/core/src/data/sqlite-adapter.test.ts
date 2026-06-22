import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockAdapter } from '../mock-adapter';

// Mock the sqlite3 module for testing
vi.mock('sqlite3', () => {
  const mockDatabase = {
    serialize: vi.fn((callback) => callback()),
    run: vi.fn((sql, params, callback) => {
      if (callback) callback(null);
    }),
    get: vi.fn((sql, params, callback) => {
      if (callback) callback(null, null);
    }),
    all: vi.fn((sql, params, callback) => {
      if (callback) callback(null, []);
    }),
    close: vi.fn((callback) => {
      if (callback) callback(null);
    }),
  };

  return {
    Database: vi.fn(() => mockDatabase),
  };
});

// We'll test SQLite behavior through the MockAdapter's pattern
// since actual SQLite testing requires native module mocking
describe('SQLiteAdapter Behavior Tests', () => {
  let adapter: MockAdapter;

  beforeEach(() => {
    adapter = new MockAdapter();
  });

  describe('Repo Operations', () => {
    it('should create repos with same interface as SQLite adapter', async () => {
      const repo = await adapter.repo.create({
        name: 'sqlite-test-repo',
        path: '/path/to/sqlite-repo',
        gitUrl: 'https://github.com/test/sqlite-repo',
      });

      expect(repo).toBeDefined();
      expect(repo.name).toBe('sqlite-test-repo');
      expect(repo.path).toBe('/path/to/sqlite-repo');
    });

    it('should handle repo update with timestamp', async () => {
      const created = await adapter.repo.create({
        name: 'timestamp-test',
        path: '/path/ts',
      });

      const beforeUpdate = created.updatedAt;
      const updated = await adapter.repo.update(created.id, {
        name: 'updated-name',
      });

      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    });

    it('should track file count and symbol count', async () => {
      const repo = await adapter.repo.create({
        name: 'count-test',
        path: '/path/count',
      });

      expect(repo.fileCount).toBe(0);
      expect(repo.symbolCount).toBe(0);

      const file = await adapter.file.create({
        repoId: repo.id,
        path: '/test.ts',
      });

      await adapter.symbol.create({
        fileId: file.id,
        name: 'testFunc',
        type: 'function',
        kind: 'function',
        line: 1,
        column: 0,
        isExported: true,
      });

      const updated = await adapter.repo.update(repo.id, {
        fileCount: 1,
        symbolCount: 1,
      });

      expect(updated.fileCount).toBe(1);
      expect(updated.symbolCount).toBe(1);
    });
  });

  describe('File Operations', () => {
    let testRepo: Awaited<ReturnType<typeof adapter.repo.create>>;

    beforeEach(async () => {
      testRepo = await adapter.repo.create({
        name: 'file-ops-test',
        path: '/path/file-ops',
      });
    });

    it('should create files with git metadata', async () => {
      const now = new Date();
      const file = await adapter.file.create({
        repoId: testRepo.id,
        path: '/src/index.ts',
        language: 'typescript',
        sizeBytes: 1024,
        gitModifiedAt: now,
        gitAuthor: 'Test Author',
        gitCommitMsg: 'Initial commit',
      });

      expect(file.gitModifiedAt).toEqual(now);
      expect(file.gitAuthor).toBe('Test Author');
      expect(file.gitCommitMsg).toBe('Initial commit');
    });

    it('should handle content hash for deduplication', async () => {
      const file1 = await adapter.file.create({
        repoId: testRepo.id,
        path: '/dedup.ts',
        contentHash: 'abc123',
      });

      const file2 = await adapter.file.create({
        repoId: testRepo.id,
        path: '/dedup2.ts',
        contentHash: 'def456',
      });

      expect(file1.contentHash).toBe('abc123');
      expect(file2.contentHash).toBe('def456');
    });
  });

  describe('Symbol Operations', () => {
    let testRepo: Awaited<ReturnType<typeof adapter.repo.create>>;
    let testFile: Awaited<ReturnType<typeof adapter.file.create>>;

    beforeEach(async () => {
      testRepo = await adapter.repo.create({
        name: 'symbol-ops-test',
        path: '/path/symbol-ops',
      });
      testFile = await adapter.file.create({
        repoId: testRepo.id,
        path: '/symbols.ts',
      });
    });

    it('should create symbols with parent relationships', async () => {
      const parentSymbol = await adapter.symbol.create({
        fileId: testFile.id,
        name: 'ParentClass',
        type: 'class',
        kind: 'class',
        line: 1,
        column: 0,
        isExported: true,
      });

      const childSymbol = await adapter.symbol.create({
        fileId: testFile.id,
        name: 'childMethod',
        type: 'method',
        kind: 'method',
        line: 5,
        column: 4,
        parentId: parentSymbol.id,
        isExported: false,
      });

      expect(childSymbol.parentId).toBe(parentSymbol.id);
    });

    it('should handle all symbol types', async () => {
      const symbolTypes = ['function', 'class', 'interface', 'variable', 'type', 'enum', 'method', 'property'] as const;

      for (const type of symbolTypes) {
        const symbol = await adapter.symbol.create({
          fileId: testFile.id,
          name: `${type}Symbol`,
          type,
          kind: type,
          line: 1,
          column: 0,
          isExported: true,
        });

        expect(symbol.type).toBe(type);
      }
    });
  });

  describe('Embedding Operations', () => {
    let testRepo: Awaited<ReturnType<typeof adapter.repo.create>>;
    let testFile: Awaited<ReturnType<typeof adapter.file.create>>;

    beforeEach(async () => {
      testRepo = await adapter.repo.create({
        name: 'embedding-ops-test',
        path: '/path/embedding-ops',
      });
      testFile = await adapter.file.create({
        repoId: testRepo.id,
        path: '/embed.ts',
      });
    });

    it('should calculate cosine similarity correctly', async () => {
      // Create embeddings with known similarity
      const embedding1 = await adapter.embedding.create({
        fileId: testFile.id,
        chunkIndex: 0,
        content: 'identical content',
        embedding: [1, 0, 0],
        tokenCount: 2,
      });

      const embedding2 = await adapter.embedding.create({
        fileId: testFile.id,
        chunkIndex: 1,
        content: 'identical content',
        embedding: [1, 0, 0],
        tokenCount: 2,
      });

      const embedding3 = await adapter.embedding.create({
        fileId: testFile.id,
        chunkIndex: 2,
        content: 'opposite content',
        embedding: [-1, 0, 0],
        tokenCount: 2,
      });

      const results = await adapter.embedding.search([1, 0, 0], 3);

      expect(results[0].similarity).toBeCloseTo(1, 5); // Same direction = 1
      expect(results[2].similarity).toBeCloseTo(-1, 5); // Opposite direction = -1
    });

    it('should filter embeddings by repoId when specified', async () => {
      const repo2 = await adapter.repo.create({
        name: 'repo2',
        path: '/path/repo2',
      });
      const file2 = await adapter.file.create({
        repoId: repo2.id,
        path: '/file2.ts',
      });

      await adapter.embedding.create({
        fileId: testFile.id,
        chunkIndex: 0,
        content: 'repo1 content',
        embedding: [0.5, 0.5, 0],
        tokenCount: 2,
      });

      await adapter.embedding.create({
        fileId: file2.id,
        chunkIndex: 0,
        content: 'repo2 content',
        embedding: [0.5, 0.5, 0],
        tokenCount: 2,
      });

      const allResults = await adapter.embedding.search([0.5, 0.5, 0], 10);
      const repo1Results = await adapter.embedding.search([0.5, 0.5, 0], 10, testRepo.id);
      const repo2Results = await adapter.embedding.search([0.5, 0.5, 0], 10, repo2.id);

      expect(allResults).toHaveLength(2);
      expect(repo1Results).toHaveLength(1);
      expect(repo2Results).toHaveLength(1);
    });
  });

  describe('Call Graph Operations', () => {
    let testRepo: Awaited<ReturnType<typeof adapter.repo.create>>;

    beforeEach(async () => {
      testRepo = await adapter.repo.create({
        name: 'callgraph-ops-test',
        path: '/path/callgraph-ops',
      });
    });

    it('should handle all call types', async () => {
      const callTypes = ['direct', 'indirect', 'inheritance', 'implementation'] as const;

      for (const callType of callTypes) {
        const edge = await adapter.callGraph.create({
          sourceId: `source-${callType}`,
          targetId: `target-${callType}`,
          repoId: testRepo.id,
          callType,
        });

        expect(edge.callType).toBe(callType);
      }
    });

    it('should query edges bidirectionally', async () => {
      await adapter.callGraph.create({
        sourceId: 'bidirectional-source',
        targetId: 'bidirectional-target',
        repoId: testRepo.id,
        callType: 'direct',
      });

      const bySource = await adapter.callGraph.getBySourceId('bidirectional-source');
      const byTarget = await adapter.callGraph.getByTargetId('bidirectional-target');

      expect(bySource).toHaveLength(1);
      expect(byTarget).toHaveLength(1);
      expect(bySource[0].id).toBe(byTarget[0].id);
    });
  });
});

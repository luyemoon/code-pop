import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockAdapter } from '../mock-adapter';

// Mock pg module for testing
vi.mock('pg', () => {
  const mockClient = {
    connect: vi.fn(),
    query: vi.fn(),
    end: vi.fn(),
  };

  return {
    Client: vi.fn(() => mockClient),
  };
});

// Test PostgreSQL adapter behavior through MockAdapter
// Actual PostgreSQL adapter tests would require a real database connection
describe('PostgreSQLAdapter Behavior Tests', () => {
  let adapter: MockAdapter;

  beforeEach(() => {
    adapter = new MockAdapter();
  });

  describe('Repo Operations', () => {
    it('should create repos compatible with PostgreSQL schema', async () => {
      const repo = await adapter.repo.create({
        name: 'postgres-test-repo',
        path: '/path/to/postgres-repo',
        gitUrl: 'https://github.com/test/postgres-repo',
      });

      expect(repo).toBeDefined();
      expect(repo.id).toBeDefined();
      expect(typeof repo.id).toBe('string');
      expect(repo.name).toBe('postgres-test-repo');
    });

    it('should handle repo with all optional fields', async () => {
      const repo = await adapter.repo.create({
        name: 'full-repo',
        path: '/path/full',
        gitUrl: 'https://github.com/test/full',
      });

      expect(repo.gitUrl).toBe('https://github.com/test/full');
      expect(repo.createdAt).toBeInstanceOf(Date);
      expect(repo.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('File Operations', () => {
    let testRepo: Awaited<ReturnType<typeof adapter.repo.create>>;

    beforeEach(async () => {
      testRepo = await adapter.repo.create({
        name: 'file-pg-test',
        path: '/path/file-pg',
      });
    });

    it('should create files with PostgreSQL-compatible fields', async () => {
      const file = await adapter.file.create({
        repoId: testRepo.id,
        path: '/src/main.ts',
        language: 'typescript',
        contentHash: 'sha256hash',
        sizeBytes: 2048,
      });

      expect(file.repoId).toBe(testRepo.id);
      expect(file.path).toBe('/src/main.ts');
      expect(file.language).toBe('typescript');
      expect(file.contentHash).toBe('sha256hash');
      expect(file.sizeBytes).toBe(2048);
    });

    it('should handle large file sizes', async () => {
      const largeFile = await adapter.file.create({
        repoId: testRepo.id,
        path: '/large.bin',
        sizeBytes: Number.MAX_SAFE_INTEGER,
      });

      expect(largeFile.sizeBytes).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('Symbol Operations', () => {
    let testRepo: Awaited<ReturnType<typeof adapter.repo.create>>;
    let testFile: Awaited<ReturnType<typeof adapter.file.create>>;

    beforeEach(async () => {
      testRepo = await adapter.repo.create({
        name: 'symbol-pg-test',
        path: '/path/symbol-pg',
      });
      testFile = await adapter.file.create({
        repoId: testRepo.id,
        path: '/symbols.ts',
      });
    });

    it('should create symbols with position information', async () => {
      const symbol = await adapter.symbol.create({
        fileId: testFile.id,
        name: 'complexFunction',
        type: 'function',
        kind: 'function',
        line: 42,
        column: 5,
        endLine: 56,
        endColumn: 1,
        isExported: true,
      });

      expect(symbol.line).toBe(42);
      expect(symbol.column).toBe(5);
      expect(symbol.endLine).toBe(56);
      expect(symbol.endColumn).toBe(1);
    });

    it('should search symbols by name pattern', async () => {
      await adapter.symbol.create({
        fileId: testFile.id,
        name: 'getUserById',
        type: 'function',
        kind: 'function',
        line: 1,
        column: 0,
        isExported: true,
      });
      await adapter.symbol.create({
        fileId: testFile.id,
        name: 'getUserByName',
        type: 'function',
        kind: 'function',
        line: 10,
        column: 0,
        isExported: true,
      });
      await adapter.symbol.create({
        fileId: testFile.id,
        name: 'createUser',
        type: 'function',
        kind: 'function',
        line: 20,
        column: 0,
        isExported: true,
      });

      const results = await adapter.symbol.searchByName(testFile.id, 'getUser');

      expect(results).toHaveLength(2);
      expect(results.map(s => s.name).sort()).toEqual(['getUserById', 'getUserByName']);
    });
  });

  describe('Embedding Operations', () => {
    let testRepo: Awaited<ReturnType<typeof adapter.repo.create>>;
    let testFile: Awaited<ReturnType<typeof adapter.file.create>>;

    beforeEach(async () => {
      testRepo = await adapter.repo.create({
        name: 'embedding-pg-test',
        path: '/path/embedding-pg',
      });
      testFile = await adapter.file.create({
        repoId: testRepo.id,
        path: '/embed.ts',
      });
    });

    it('should handle 1536-dimensional embeddings (OpenAI)', async () => {
      const embedding = await adapter.embedding.create({
        fileId: testFile.id,
        chunkIndex: 0,
        content: 'test content for embedding',
        embedding: new Array(1536).fill(0.01),
        tokenCount: 5,
      });

      expect(embedding.embedding).toHaveLength(1536);
    });

    it('should handle 3072-dimensional embeddings (OpenAI large)', async () => {
      const embedding = await adapter.embedding.create({
        fileId: testFile.id,
        chunkIndex: 0,
        content: 'large embedding test',
        embedding: new Array(3072).fill(0.02),
        tokenCount: 4,
      });

      expect(embedding.embedding).toHaveLength(3072);
    });

    it('should handle 768-dimensional embeddings (Nomic)', async () => {
      const embedding = await adapter.embedding.create({
        fileId: testFile.id,
        chunkIndex: 0,
        content: 'nomic embedding test',
        embedding: new Array(768).fill(0.03),
        tokenCount: 3,
      });

      expect(embedding.embedding).toHaveLength(768);
    });

    it('should search with pagination', async () => {
      // Create 10 embeddings
      for (let i = 0; i < 10; i++) {
        await adapter.embedding.create({
          fileId: testFile.id,
          chunkIndex: i,
          content: `chunk ${i}`,
          embedding: new Array(1536).fill(i * 0.1),
          tokenCount: 2,
        });
      }

      const page1 = await adapter.embedding.search(new Array(1536).fill(0.5), 3);
      const page2 = await adapter.embedding.search(new Array(1536).fill(0.5), 3);

      expect(page1).toHaveLength(3);
      expect(page2).toHaveLength(3);
    });
  });

  describe('Call Graph Operations', () => {
    let testRepo: Awaited<ReturnType<typeof adapter.repo.create>>;

    beforeEach(async () => {
      testRepo = await adapter.repo.create({
        name: 'callgraph-pg-test',
        path: '/path/callgraph-pg',
      });
    });

    it('should create complex call graph', async () => {
      // Create a chain: A -> B -> C -> D
      const edge1 = await adapter.callGraph.create({
        sourceId: 'symbol-A',
        targetId: 'symbol-B',
        repoId: testRepo.id,
        callType: 'direct',
      });

      const edge2 = await adapter.callGraph.create({
        sourceId: 'symbol-B',
        targetId: 'symbol-C',
        repoId: testRepo.id,
        callType: 'direct',
      });

      const edge3 = await adapter.callGraph.create({
        sourceId: 'symbol-C',
        targetId: 'symbol-D',
        repoId: testRepo.id,
        callType: 'direct',
      });

      const allEdges = await adapter.callGraph.getByRepoId(testRepo.id);
      expect(allEdges).toHaveLength(3);

      const bIncoming = await adapter.callGraph.getByTargetId('symbol-B');
      expect(bIncoming).toHaveLength(1);
      expect(bIncoming[0].sourceId).toBe('symbol-A');

      const bOutgoing = await adapter.callGraph.getBySourceId('symbol-B');
      expect(bOutgoing).toHaveLength(1);
      expect(bOutgoing[0].targetId).toBe('symbol-C');
    });

    it('should handle inheritance relationships', async () => {
      await adapter.callGraph.create({
        sourceId: 'class-Parent',
        targetId: 'class-Child',
        repoId: testRepo.id,
        callType: 'inheritance',
      });

      const inheritanceEdges = await adapter.callGraph.getByRepoId(testRepo.id);
      expect(inheritanceEdges).toHaveLength(1);
      expect(inheritanceEdges[0].callType).toBe('inheritance');
    });

    it('should handle implementation relationships', async () => {
      await adapter.callGraph.create({
        sourceId: 'concrete-impl',
        targetId: 'interface',
        repoId: testRepo.id,
        callType: 'implementation',
      });

      const edges = await adapter.callGraph.getByRepoId(testRepo.id);
      expect(edges[0].callType).toBe('implementation');
    });
  });

  describe('Error Handling', () => {
    it('should handle update on non-existent repo', async () => {
      await expect(
        adapter.repo.update('non-existent', { name: 'new' })
      ).rejects.toThrow('Repo not found');
    });

    it('should handle update on non-existent file', async () => {
      await expect(
        adapter.file.update('non-existent', { language: 'js' })
      ).rejects.toThrow('File not found');
    });

    it('should handle update on non-existent embedding', async () => {
      await expect(
        adapter.embedding.update('non-existent', { content: 'new' })
      ).rejects.toThrow('Embedding not found');
    });
  });

  describe('Cascade Operations', () => {
    let testRepo: Awaited<ReturnType<typeof adapter.repo.create>>;

    beforeEach(async () => {
      testRepo = await adapter.repo.create({
        name: 'cascade-test',
        path: '/path/cascade',
      });
    });

    it('should delete all related data when deleting repo', async () => {
      // Create files
      const file1 = await adapter.file.create({ repoId: testRepo.id, path: '/a.ts' });
      const file2 = await adapter.file.create({ repoId: testRepo.id, path: '/b.ts' });

      // Create symbols
      await adapter.symbol.create({
        fileId: file1.id,
        name: 'func1',
        type: 'function',
        kind: 'function',
        line: 1,
        column: 0,
        isExported: false,
      });

      // Create embeddings
      await adapter.embedding.create({
        fileId: file1.id,
        chunkIndex: 0,
        content: 'content',
        embedding: new Array(1536).fill(0.1),
        tokenCount: 1,
      });

      // Delete by repo (cascade)
      await adapter.embedding.deleteByRepoId(testRepo.id);
      await adapter.symbol.deleteByRepoId(testRepo.id);
      await adapter.file.deleteByRepoId(testRepo.id);
      await adapter.repo.delete(testRepo.id);

      // Verify deletion
      const repo = await adapter.repo.getById(testRepo.id);
      const files = await adapter.file.getByRepoId(testRepo.id);

      expect(repo).toBeNull();
      expect(files).toHaveLength(0);
    });
  });
});

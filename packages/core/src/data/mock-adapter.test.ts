import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockAdapter } from '../mock-adapter';
import type { Repo, RepoCreate, File, FileCreate, Symbol, SymbolCreate, Embedding, EmbeddingCreate, CallGraphEdgeCreate } from '../adapter';

describe('MockAdapter', () => {
  let adapter: MockAdapter;

  beforeEach(() => {
    adapter = new MockAdapter();
  });

  afterEach(() => {
    // Clean up
  });

  describe('RepoAdapter', () => {
    describe('create', () => {
      it('should create a new repo successfully', async () => {
        const repoData: RepoCreate = {
          name: 'test-repo',
          path: '/path/to/repo',
          gitUrl: 'https://github.com/test/repo',
        };

        const repo = await adapter.repo.create(repoData);

        expect(repo).toBeDefined();
        expect(repo.id).toBeDefined();
        expect(repo.name).toBe('test-repo');
        expect(repo.path).toBe('/path/to/repo');
        expect(repo.gitUrl).toBe('https://github.com/test/repo');
        expect(repo.fileCount).toBe(0);
        expect(repo.symbolCount).toBe(0);
      });

      it('should create a repo without optional gitUrl', async () => {
        const repoData: RepoCreate = {
          name: 'test-repo-2',
          path: '/path/to/repo2',
        };

        const repo = await adapter.repo.create(repoData);

        expect(repo).toBeDefined();
        expect(repo.gitUrl).toBeUndefined();
      });
    });

    describe('getById', () => {
      it('should return a repo when it exists', async () => {
        const created = await adapter.repo.create({
          name: 'get-test-repo',
          path: '/path/to/get-test',
        });

        const found = await adapter.repo.getById(created.id);

        expect(found).toBeDefined();
        expect(found?.id).toBe(created.id);
        expect(found?.name).toBe('get-test-repo');
      });

      it('should return null when repo does not exist', async () => {
        const found = await adapter.repo.getById('non-existent-id');

        expect(found).toBeNull();
      });
    });

    describe('getByPath', () => {
      it('should return a repo when path matches', async () => {
        const created = await adapter.repo.create({
          name: 'path-test-repo',
          path: '/unique/path',
        });

        const found = await adapter.repo.getByPath('/unique/path');

        expect(found).toBeDefined();
        expect(found?.id).toBe(created.id);
      });

      it('should return null when path does not match', async () => {
        const found = await adapter.repo.getByPath('/non/existent/path');

        expect(found).toBeNull();
      });
    });

    describe('getAll', () => {
      it('should return all repos sorted by creation time', async () => {
        await adapter.repo.create({ name: 'repo-1', path: '/path/1' });
        await adapter.repo.create({ name: 'repo-2', path: '/path/2' });

        const repos = await adapter.repo.getAll();

        expect(repos).toHaveLength(2);
        expect(repos[0].name).toBe('repo-2'); // Most recent first
      });
    });

    describe('update', () => {
      it('should update repo successfully', async () => {
        const created = await adapter.repo.create({
          name: 'original-name',
          path: '/path/original',
        });

        const updated = await adapter.repo.update(created.id, {
          name: 'updated-name',
          fileCount: 10,
        });

        expect(updated.name).toBe('updated-name');
        expect(updated.fileCount).toBe(10);
        expect(updated.path).toBe('/path/original'); // Unchanged
      });

      it('should throw error when updating non-existent repo', async () => {
        await expect(
          adapter.repo.update('non-existent-id', { name: 'new-name' })
        ).rejects.toThrow('Repo not found');
      });
    });

    describe('delete', () => {
      it('should delete repo successfully', async () => {
        const created = await adapter.repo.create({
          name: 'delete-test',
          path: '/path/delete',
        });

        await adapter.repo.delete(created.id);
        const found = await adapter.repo.getById(created.id);

        expect(found).toBeNull();
      });
    });
  });

  describe('FileAdapter', () => {
    let testRepo: Repo;

    beforeEach(async () => {
      testRepo = await adapter.repo.create({
        name: 'file-test-repo',
        path: '/path/to/file-test',
      });
    });

    describe('create', () => {
      it('should create a file successfully', async () => {
        const fileData: FileCreate = {
          repoId: testRepo.id,
          path: '/src/index.ts',
          language: 'typescript',
          sizeBytes: 1024,
        };

        const file = await adapter.file.create(fileData);

        expect(file).toBeDefined();
        expect(file.id).toBeDefined();
        expect(file.repoId).toBe(testRepo.id);
        expect(file.path).toBe('/src/index.ts');
        expect(file.language).toBe('typescript');
      });
    });

    describe('getById', () => {
      it('should return a file when it exists', async () => {
        const created = await adapter.file.create({
          repoId: testRepo.id,
          path: '/src/test.ts',
          language: 'typescript',
        });

        const found = await adapter.file.getById(created.id);

        expect(found).toBeDefined();
        expect(found?.id).toBe(created.id);
      });

      it('should return null when file does not exist', async () => {
        const found = await adapter.file.getById('non-existent-id');

        expect(found).toBeNull();
      });
    });

    describe('getByRepoId', () => {
      it('should return all files for a repo', async () => {
        await adapter.file.create({ repoId: testRepo.id, path: '/src/a.ts' });
        await adapter.file.create({ repoId: testRepo.id, path: '/src/b.ts' });

        const files = await adapter.file.getByRepoId(testRepo.id);

        expect(files).toHaveLength(2);
      });
    });

    describe('getByPath', () => {
      it('should return a file when path matches', async () => {
        await adapter.file.create({
          repoId: testRepo.id,
          path: '/unique/file.ts',
        });

        const found = await adapter.file.getByPath(testRepo.id, '/unique/file.ts');

        expect(found).toBeDefined();
        expect(found?.path).toBe('/unique/file.ts');
      });

      it('should return null when path does not match', async () => {
        const found = await adapter.file.getByPath(testRepo.id, '/non/existent.ts');

        expect(found).toBeNull();
      });
    });

    describe('update', () => {
      it('should update file successfully', async () => {
        const created = await adapter.file.create({
          repoId: testRepo.id,
          path: '/original.ts',
          language: 'javascript',
        });

        const updated = await adapter.file.update(created.id, {
          language: 'typescript',
          sizeBytes: 2048,
        });

        expect(updated.language).toBe('typescript');
        expect(updated.sizeBytes).toBe(2048);
      });

      it('should throw error when updating non-existent file', async () => {
        await expect(
          adapter.file.update('non-existent-id', { language: 'typescript' })
        ).rejects.toThrow('File not found');
      });
    });

    describe('delete', () => {
      it('should delete file successfully', async () => {
        const created = await adapter.file.create({
          repoId: testRepo.id,
          path: '/to/delete.ts',
        });

        await adapter.file.delete(created.id);
        const found = await adapter.file.getById(created.id);

        expect(found).toBeNull();
      });
    });

    describe('deleteByRepoId', () => {
      it('should delete all files for a repo', async () => {
        await adapter.file.create({ repoId: testRepo.id, path: '/a.ts' });
        await adapter.file.create({ repoId: testRepo.id, path: '/b.ts' });

        await adapter.file.deleteByRepoId(testRepo.id);
        const files = await adapter.file.getByRepoId(testRepo.id);

        expect(files).toHaveLength(0);
      });
    });
  });

  describe('SymbolAdapter', () => {
    let testFile: File;

    beforeEach(async () => {
      const testRepo = await adapter.repo.create({
        name: 'symbol-test-repo',
        path: '/path/to/symbol-test',
      });
      testFile = await adapter.file.create({
        repoId: testRepo.id,
        path: '/src/symbols.ts',
      });
    });

    describe('create', () => {
      it('should create a symbol successfully', async () => {
        const symbolData: SymbolCreate = {
          fileId: testFile.id,
          name: 'testFunction',
          type: 'function',
          kind: 'function',
          line: 10,
          column: 0,
          isExported: true,
        };

        const symbol = await adapter.symbol.create(symbolData);

        expect(symbol).toBeDefined();
        expect(symbol.id).toBeDefined();
        expect(symbol.name).toBe('testFunction');
        expect(symbol.type).toBe('function');
      });
    });

    describe('getById', () => {
      it('should return a symbol when it exists', async () => {
        const created = await adapter.symbol.create({
          fileId: testFile.id,
          name: 'getSymbol',
          type: 'function',
          kind: 'function',
          line: 1,
          column: 0,
          isExported: false,
        });

        const found = await adapter.symbol.getById(created.id);

        expect(found).toBeDefined();
        expect(found?.id).toBe(created.id);
      });

      it('should return null when symbol does not exist', async () => {
        const found = await adapter.symbol.getById('non-existent-id');

        expect(found).toBeNull();
      });
    });

    describe('getByFileId', () => {
      it('should return all symbols for a file', async () => {
        await adapter.symbol.create({
          fileId: testFile.id,
          name: 'func1',
          type: 'function',
          kind: 'function',
          line: 1,
          column: 0,
          isExported: false,
        });
        await adapter.symbol.create({
          fileId: testFile.id,
          name: 'func2',
          type: 'function',
          kind: 'function',
          line: 5,
          column: 0,
          isExported: false,
        });

        const symbols = await adapter.symbol.getByFileId(testFile.id);

        expect(symbols).toHaveLength(2);
      });
    });

    describe('searchByName', () => {
      it('should find symbols by name (case-insensitive)', async () => {
        await adapter.symbol.create({
          fileId: testFile.id,
          name: 'MyFunction',
          type: 'function',
          kind: 'function',
          line: 1,
          column: 0,
          isExported: false,
        });

        const results = await adapter.symbol.searchByName(testFile.id, 'myfunc');

        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('MyFunction');
      });
    });

    describe('deleteByFileId', () => {
      it('should delete all symbols for a file', async () => {
        await adapter.symbol.create({
          fileId: testFile.id,
          name: 'toDelete',
          type: 'function',
          kind: 'function',
          line: 1,
          column: 0,
          isExported: false,
        });

        await adapter.symbol.deleteByFileId(testFile.id);
        const symbols = await adapter.symbol.getByFileId(testFile.id);

        expect(symbols).toHaveLength(0);
      });
    });
  });

  describe('EmbeddingAdapter', () => {
    let testFile: File;

    beforeEach(async () => {
      const testRepo = await adapter.repo.create({
        name: 'embedding-test-repo',
        path: '/path/to/embedding-test',
      });
      testFile = await adapter.file.create({
        repoId: testRepo.id,
        path: '/src/embed.ts',
      });
    });

    describe('create', () => {
      it('should create an embedding successfully', async () => {
        const embeddingData: EmbeddingCreate = {
          fileId: testFile.id,
          chunkIndex: 0,
          content: 'function test() { return 42; }',
          embedding: new Array(1536).fill(0.1),
          tokenCount: 10,
        };

        const embedding = await adapter.embedding.create(embeddingData);

        expect(embedding).toBeDefined();
        expect(embedding.id).toBeDefined();
        expect(embedding.fileId).toBe(testFile.id);
        expect(embedding.content).toBe('function test() { return 42; }');
      });
    });

    describe('getById', () => {
      it('should return an embedding when it exists', async () => {
        const created = await adapter.embedding.create({
          fileId: testFile.id,
          chunkIndex: 0,
          content: 'test content',
          embedding: new Array(1536).fill(0.5),
          tokenCount: 5,
        });

        const found = await adapter.embedding.getById(created.id);

        expect(found).toBeDefined();
        expect(found?.id).toBe(created.id);
      });

      it('should return null when embedding does not exist', async () => {
        const found = await adapter.embedding.getById('non-existent-id');

        expect(found).toBeNull();
      });
    });

    describe('getByFileId', () => {
      it('should return all embeddings for a file sorted by chunkIndex', async () => {
        await adapter.embedding.create({
          fileId: testFile.id,
          chunkIndex: 0,
          content: 'chunk 0',
          embedding: new Array(1536).fill(0.1),
          tokenCount: 2,
        });
        await adapter.embedding.create({
          fileId: testFile.id,
          chunkIndex: 1,
          content: 'chunk 1',
          embedding: new Array(1536).fill(0.2),
          tokenCount: 2,
        });

        const embeddings = await adapter.embedding.getByFileId(testFile.id);

        expect(embeddings).toHaveLength(2);
        expect(embeddings[0].chunkIndex).toBe(0);
        expect(embeddings[1].chunkIndex).toBe(1);
      });
    });

    describe('search', () => {
      it('should return embeddings sorted by similarity', async () => {
        const embedding1 = await adapter.embedding.create({
          fileId: testFile.id,
          chunkIndex: 0,
          content: 'similar content',
          embedding: [0.1, 0.2, 0.3, ...new Array(1533).fill(0)],
          tokenCount: 3,
        });
        const embedding2 = await adapter.embedding.create({
          fileId: testFile.id,
          chunkIndex: 1,
          content: 'dissimilar content',
          embedding: [0.9, 0.8, 0.7, ...new Array(1533).fill(0)],
          tokenCount: 3,
        });

        const queryEmbedding = [0.1, 0.2, 0.3, ...new Array(1533).fill(0)];
        const results = await adapter.embedding.search(queryEmbedding, 2);

        expect(results).toHaveLength(2);
        expect(results[0].embedding.id).toBe(embedding1.id); // More similar
      });

      it('should limit results by specified limit', async () => {
        await adapter.embedding.create({
          fileId: testFile.id,
          chunkIndex: 0,
          content: 'content 1',
          embedding: new Array(1536).fill(0.1),
          tokenCount: 2,
        });
        await adapter.embedding.create({
          fileId: testFile.id,
          chunkIndex: 1,
          content: 'content 2',
          embedding: new Array(1536).fill(0.2),
          tokenCount: 2,
        });

        const results = await adapter.embedding.search(new Array(1536).fill(0.5), 1);

        expect(results).toHaveLength(1);
      });
    });

    describe('update', () => {
      it('should update embedding successfully', async () => {
        const created = await adapter.embedding.create({
          fileId: testFile.id,
          chunkIndex: 0,
          content: 'original content',
          embedding: new Array(1536).fill(0.1),
          tokenCount: 3,
        });

        const updated = await adapter.embedding.update(created.id, {
          content: 'updated content',
        });

        expect(updated.content).toBe('updated content');
      });

      it('should throw error when updating non-existent embedding', async () => {
        await expect(
          adapter.embedding.update('non-existent-id', { content: 'new' })
        ).rejects.toThrow('Embedding not found');
      });
    });

    describe('deleteByFileId', () => {
      it('should delete all embeddings for a file', async () => {
        await adapter.embedding.create({
          fileId: testFile.id,
          chunkIndex: 0,
          content: 'to delete',
          embedding: new Array(1536).fill(0.1),
          tokenCount: 2,
        });

        await adapter.embedding.deleteByFileId(testFile.id);
        const embeddings = await adapter.embedding.getByFileId(testFile.id);

        expect(embeddings).toHaveLength(0);
      });
    });
  });

  describe('CallGraphAdapter', () => {
    let testRepo: Repo;

    beforeEach(async () => {
      testRepo = await adapter.repo.create({
        name: 'callgraph-test-repo',
        path: '/path/to/callgraph-test',
      });
    });

    describe('create', () => {
      it('should create a call graph edge successfully', async () => {
        const edgeData: CallGraphEdgeCreate = {
          sourceId: 'source-symbol-id',
          targetId: 'target-symbol-id',
          repoId: testRepo.id,
          callType: 'direct',
        };

        const edge = await adapter.callGraph.create(edgeData);

        expect(edge).toBeDefined();
        expect(edge.id).toBeDefined();
        expect(edge.sourceId).toBe('source-symbol-id');
        expect(edge.targetId).toBe('target-symbol-id');
        expect(edge.callType).toBe('direct');
      });
    });

    describe('getBySourceId', () => {
      it('should return edges with matching sourceId', async () => {
        await adapter.callGraph.create({
          sourceId: 'source1',
          targetId: 'target1',
          repoId: testRepo.id,
          callType: 'direct',
        });
        await adapter.callGraph.create({
          sourceId: 'source1',
          targetId: 'target2',
          repoId: testRepo.id,
          callType: 'indirect',
        });

        const edges = await adapter.callGraph.getBySourceId('source1');

        expect(edges).toHaveLength(2);
      });
    });

    describe('getByTargetId', () => {
      it('should return edges with matching targetId', async () => {
        await adapter.callGraph.create({
          sourceId: 'source1',
          targetId: 'target1',
          repoId: testRepo.id,
          callType: 'direct',
        });

        const edges = await adapter.callGraph.getByTargetId('target1');

        expect(edges).toHaveLength(1);
        expect(edges[0].targetId).toBe('target1');
      });
    });

    describe('getByRepoId', () => {
      it('should return all edges for a repo', async () => {
        await adapter.callGraph.create({
          sourceId: 's1',
          targetId: 't1',
          repoId: testRepo.id,
          callType: 'direct',
        });
        await adapter.callGraph.create({
          sourceId: 's2',
          targetId: 't2',
          repoId: testRepo.id,
          callType: 'indirect',
        });

        const edges = await adapter.callGraph.getByRepoId(testRepo.id);

        expect(edges).toHaveLength(2);
      });
    });

    describe('deleteBySymbolId', () => {
      it('should delete edges where symbol is source or target', async () => {
        await adapter.callGraph.create({
          sourceId: 'toDelete',
          targetId: 'other',
          repoId: testRepo.id,
          callType: 'direct',
        });
        await adapter.callGraph.create({
          sourceId: 'other',
          targetId: 'toDelete',
          repoId: testRepo.id,
          callType: 'indirect',
        });

        await adapter.callGraph.deleteBySymbolId('toDelete');
        const edges = await adapter.callGraph.getByRepoId(testRepo.id);

        expect(edges).toHaveLength(0);
      });
    });

    describe('deleteByRepoId', () => {
      it('should delete all edges for a repo', async () => {
        await adapter.callGraph.create({
          sourceId: 's1',
          targetId: 't1',
          repoId: testRepo.id,
          callType: 'direct',
        });

        await adapter.callGraph.deleteByRepoId(testRepo.id);
        const edges = await adapter.callGraph.getByRepoId(testRepo.id);

        expect(edges).toHaveLength(0);
      });
    });
  });

  describe('connect and disconnect', () => {
    it('should connect without error', async () => {
      await expect(adapter.connect()).resolves.toBeUndefined();
    });

    it('should disconnect without error', async () => {
      await expect(adapter.disconnect()).resolves.toBeUndefined();
    });
  });
});

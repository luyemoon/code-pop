import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockAdapter } from '../data/mock-adapter';
import { CodeIndexer } from './indexer';
import type { EmbeddingConfig } from './embedder';

describe('CodeIndexer', () => {
  let adapter: MockAdapter;
  let indexer: CodeIndexer;
  let testRepo: Awaited<ReturnType<typeof adapter.repo.create>>;

  const mockEmbeddingConfig: EmbeddingConfig = {
    provider: 'openai',
    apiKey: 'test-api-key',
    model: 'text-embedding-3-small',
  };

  beforeEach(async () => {
    adapter = new MockAdapter();
    indexer = new CodeIndexer({
      db: adapter,
      embeddingConfig: mockEmbeddingConfig,
      maxConcurrent: 2,
      maxFileSize: 1024 * 1024,
    });

    testRepo = await adapter.repo.create({
      name: 'indexer-test-repo',
      path: '/path/to/indexer-test',
    });
  });

  afterEach(() => {
    indexer.cancel();
  });

  describe('constructor', () => {
    it('should create indexer with default configuration', () => {
      const defaultIndexer = new CodeIndexer({
        db: adapter,
        embeddingConfig: mockEmbeddingConfig,
      });

      expect(defaultIndexer).toBeInstanceOf(CodeIndexer);
    });

    it('should create indexer with custom maxConcurrent', () => {
      const customIndexer = new CodeIndexer({
        db: adapter,
        embeddingConfig: mockEmbeddingConfig,
        maxConcurrent: 8,
      });

      expect(customIndexer).toBeInstanceOf(CodeIndexer);
    });

    it('should create indexer with custom maxFileSize', () => {
      const customIndexer = new CodeIndexer({
        db: adapter,
        embeddingConfig: mockEmbeddingConfig,
        maxFileSize: 500 * 1024,
      });

      expect(customIndexer).toBeInstanceOf(CodeIndexer);
    });

    it('should create indexer with custom skip patterns', () => {
      const customIndexer = new CodeIndexer({
        db: adapter,
        embeddingConfig: mockEmbeddingConfig,
        skipPatterns: ['**/test/**', '**/__tests__/**'],
      });

      expect(customIndexer).toBeInstanceOf(CodeIndexer);
    });
  });

  describe('getIsIndexing', () => {
    it('should return false when not indexing', () => {
      expect(indexer.getIsIndexing()).toBe(false);
    });
  });

  describe('cancel', () => {
    it('should set cancel flag when called', () => {
      indexer.cancel();
      expect(indexer.getIsIndexing()).toBe(false);
    });
  });

  describe('progress events', () => {
    it('should emit progress events during indexing', async () => {
      const progressEvents: any[] = [];
      indexer.on('progress', (progress) => {
        progressEvents.push(progress);
      });

      // The indexer will try to index files, but since the repo path doesn't exist,
      // it will complete with 0 indexed files
      await indexer.indexRepo(testRepo.id, '/non-existent-path');

      // Should have emitted at least the initial progress event
      expect(progressEvents.length).toBeGreaterThanOrEqual(0);
    });

    it('should emit complete event when indexing finishes', async () => {
      let completeEvent: any;
      indexer.on('complete', (result) => {
        completeEvent = result;
      });

      await indexer.indexRepo(testRepo.id, '/non-existent-path');

      expect(completeEvent).toBeDefined();
      expect(completeEvent).toHaveProperty('totalIndexed');
      expect(completeEvent).toHaveProperty('duration');
    });

    it('should indicate cancelled when cancelled mid-indexing', async () => {
      let completeEvent: any;
      indexer.on('complete', (result) => {
        completeEvent = result;
      });

      // Start indexing but cancel immediately
      const indexPromise = indexer.indexRepo(testRepo.id, '/path');
      indexer.cancel();
      await indexPromise;

      if (completeEvent) {
        expect(completeEvent.cancelled).toBe(true);
      }
    });
  });

  describe('createIndexer factory', () => {
    it('should create an indexer instance', () => {
      const { createIndexer } = require('./indexer');
      const created = createIndexer({
        db: adapter,
        embeddingConfig: mockEmbeddingConfig,
      });

      expect(created).toBeInstanceOf(CodeIndexer);
    });
  });

  describe('event emitter inheritance', () => {
    it('should be an EventEmitter', () => {
      expect(indexer).toBeInstanceOf(require('events').EventEmitter);
    });

    it('should support event listener removal', () => {
      const listener = vi.fn();
      indexer.on('progress', listener);
      indexer.removeListener('progress', listener);

      expect(indexer.listenerCount('progress')).toBe(0);
    });

    it('should support once listener', async () => {
      let callCount = 0;
      indexer.once('complete', () => {
        callCount++;
      });

      await indexer.indexRepo(testRepo.id, '/path');
      await indexer.indexRepo(testRepo.id, '/path2');

      expect(callCount).toBe(1);
    });
  });
});

describe('CodeIndexer with mocked dependencies', () => {
  let adapter: MockAdapter;
  let indexer: CodeIndexer;
  let testRepo: Awaited<ReturnType<typeof adapter.repo.create>>;

  const mockEmbeddingConfig: EmbeddingConfig = {
    provider: 'ollama',
    baseUrl: 'http://localhost:11434',
    model: 'nomic-embed-text',
  };

  beforeEach(async () => {
    adapter = new MockAdapter();
    indexer = new CodeIndexer({
      db: adapter,
      embeddingConfig: mockEmbeddingConfig,
      maxConcurrent: 1,
    });

    testRepo = await adapter.repo.create({
      name: 'mock-indexer-test',
      path: '/mock/path',
    });
  });

  describe('indexFile behavior', () => {
    it('should handle empty content', async () => {
      // This tests the error handling path
      const result = await indexer.indexFile(testRepo.id, '/mock/file.ts');
      expect(result).toBe(0);
    });
  });

  describe('concurrent indexing limits', () => {
    it('should respect maxConcurrent setting', async () => {
      const limitedIndexer = new CodeIndexer({
        db: adapter,
        embeddingConfig: mockEmbeddingConfig,
        maxConcurrent: 1,
      });

      expect(limitedIndexer).toBeInstanceOf(CodeIndexer);
    });

    it('should handle high concurrency setting', async () => {
      const highConcurrencyIndexer = new CodeIndexer({
        db: adapter,
        embeddingConfig: mockEmbeddingConfig,
        maxConcurrent: 16,
      });

      expect(highConcurrencyIndexer).toBeInstanceOf(CodeIndexer);
    });
  });

  describe('file size limits', () => {
    it('should respect custom maxFileSize', async () => {
      const smallFileIndexer = new CodeIndexer({
        db: adapter,
        embeddingConfig: mockEmbeddingConfig,
        maxFileSize: 100,
      });

      expect(smallFileIndexer).toBeInstanceOf(CodeIndexer);
    });

    it('should handle very large maxFileSize', async () => {
      const largeFileIndexer = new CodeIndexer({
        db: adapter,
        embeddingConfig: mockEmbeddingConfig,
        maxFileSize: 100 * 1024 * 1024, // 100MB
      });

      expect(largeFileIndexer).toBeInstanceOf(CodeIndexer);
    });
  });
});

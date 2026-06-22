import * as fs from 'fs';
import * as path from 'path';
import { DatabaseAdapter } from '@codepop/core';
import { EmbeddingService } from './embedding';
import { logger } from '../config';

export interface IndexerOptions {
  db: DatabaseAdapter;
  embeddingService: EmbeddingService;
  onProgress?: (progress: IndexProgress) => void;
  onError?: (error: Error) => void;
}

export interface IndexProgress {
  repoId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  filesIndexed: number;
  chunksIndexed: number;
  symbolsIndexed: number;
  currentFile?: string;
  error?: string;
}

interface ParsedSymbol {
  name: string;
  type: string;
  kind: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  isExported: boolean;
  children?: ParsedSymbol[];
}

const SUPPORTED_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.pyw',
  '.java', '.kt', '.kts',
  '.go',
  '.rs',
  '.rb',
  '.php',
  '.cs',
  '.cpp', '.cc', '.cxx', '.c', '.h', '.hpp',
  '.swift',
  '.vue', '.svelte',
  '.html', '.css', '.scss', '.sass', '.less',
  '.json', '.yaml', '.yml', '.toml', '.xml',
  '.md', '.txt',
]);

const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.java': 'java',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  '.go': 'go',
  '.rs': 'rust',
  '.rb': 'ruby',
  '.php': 'php',
  '.cs': 'csharp',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.c': 'c',
  '.h': 'c',
  '.hpp': 'cpp',
  '.swift': 'swift',
  '.vue': 'vue',
  '.svelte': 'svelte',
  '.html': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'sass',
  '.less': 'less',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.xml': 'xml',
  '.md': 'markdown',
  '.txt': 'text',
};

export class IndexerService {
  private db: DatabaseAdapter;
  private embeddingService: EmbeddingService;
  private onProgress?: (progress: IndexProgress) => void;
  private onError?: (error: Error) => void;
  private isIndexing: Map<string, boolean> = new Map();

  constructor(options: IndexerOptions) {
    this.db = options.db;
    this.embeddingService = options.embeddingService;
    this.onProgress = options.onProgress;
    this.onError = options.onError;
  }

  async indexRepository(repoId: string, repoPath: string): Promise<IndexProgress> {
    if (this.isIndexing.get(repoId)) {
      throw new Error(`Repository ${repoId} is already being indexed`);
    }

    this.isIndexing.set(repoId, true);

    const progress: IndexProgress = {
      repoId,
      status: 'processing',
      progress: 0,
      filesIndexed: 0,
      chunksIndexed: 0,
      symbolsIndexed: 0,
    };

    try {
      const startTime = Date.now();

      const files = await this.discoverFiles(repoPath);
      const totalFiles = files.length;

      logger.info(`Starting indexing for repository ${repoId} with ${totalFiles} files`);

      for (let i = 0; i < files.length; i++) {
        const filePath = files[i];
        progress.currentFile = filePath;

        try {
          await this.indexFile(repoId, filePath);
          progress.filesIndexed++;
          progress.chunksIndexed += await this.getChunkCount(repoId, filePath);
        } catch (error) {
          logger.warn(`Failed to index file ${filePath}:`, error);
        }

        progress.progress = Math.round(((i + 1) / totalFiles) * 100);
        this.onProgress?.(progress);
      }

      progress.status = 'completed';
      progress.currentFile = undefined;
      progress.progress = 100;

      logger.info(`Indexing completed for repository ${repoId} in ${Date.now() - startTime}ms`);

      await this.db.repo.update(repoId, { lastIndexedAt: new Date() });

      return progress;
    } catch (error) {
      progress.status = 'failed';
      progress.error = error instanceof Error ? error.message : 'Unknown error';
      this.onError?.(error instanceof Error ? error : new Error(String(error)));
      return progress;
    } finally {
      this.isIndexing.set(repoId, false);
    }
  }

  private async discoverFiles(repoPath: string): Promise<string[]> {
    const files: string[] = [];

    const walkDir = async (dir: string): Promise<void> => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'build' || entry.name === '__pycache__') {
          continue;
        }

        if (entry.isDirectory()) {
          await walkDir(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (SUPPORTED_EXTENSIONS.has(ext)) {
            files.push(fullPath);
          }
        }
      }
    };

    await walkDir(repoPath);
    return files;
  }

  private async indexFile(repoId: string, filePath: string): Promise<void> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const stats = await fs.promises.stat(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const language = LANGUAGE_MAP[ext] || 'unknown';

    const existingFile = await this.db.file.getByPath(repoId, filePath);
    let fileId: string;

    if (existingFile) {
      fileId = existingFile.id;
      await this.db.file.update(fileId, {
        contentHash: this.hashContent(content),
        sizeBytes: stats.size,
        updatedAt: new Date(),
      });
    } else {
      const file = await this.db.file.create({
        repoId,
        path: filePath,
        language,
        contentHash: this.hashContent(content),
        sizeBytes: stats.size,
      });
      fileId = file.id;
    }

    const symbols = this.parseSymbols(content, language, fileId);
    for (const symbol of symbols) {
      try {
        await this.db.symbol.create({
          ...symbol,
          fileId,
        });
      } catch (error) {
        logger.debug(`Failed to create symbol ${symbol.name}:`, error);
      }
    }

    await this.db.symbol.deleteByFileId(fileId);
    for (const symbol of symbols) {
      try {
        await this.db.symbol.create({
          ...symbol,
          fileId,
        });
      } catch (error) {
        logger.debug(`Failed to create symbol ${symbol.name}:`, error);
      }
    }

    await this.db.embedding.deleteByFileId(fileId);
    const chunks = this.embeddingService.chunkText(content);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        const embeddingResult = await this.embeddingService.generateEmbedding(chunk.content);
        await this.db.embedding.create({
          fileId,
          chunkIndex: chunk.index,
          content: chunk.content,
          embedding: embeddingResult.embedding,
          tokenCount: this.embeddingService.estimateTokenCount(chunk.content),
        });
      } catch (error) {
        logger.debug(`Failed to create embedding for chunk ${chunk.index}:`, error);
      }
    }
  }

  private parseSymbols(content: string, language: string, fileId: string): Omit<import('@codepop/core').SymbolCreate, 'fileId'>[] {
    const symbols: Omit<import('@codepop/core').SymbolCreate, 'fileId'>[] = [];

    const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:export\s+)?(?:async\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>|(?:export\s+)?(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/g;
    const classRegex = /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?/g;
    const interfaceRegex = /(?:export\s+)?interface\s+(\w+)/g;
    const typeRegex = /(?:export\s+)?type\s+(\w+)\s*=/g;
    const constRegex = /(?:export\s+)?const\s+(\w+)\s*=/g;
    const varRegex = /(?:export\s+)?(?:let|var)\s+(\w+)/g;

    let match;

    while ((match = functionRegex.exec(content)) !== null) {
      const name = match[1] || match[2] || match[3];
      const line = this.getLineNumber(content, match.index);
      symbols.push({
        name,
        type: 'function',
        kind: 'function',
        line,
        column: match.index,
        isExported: content.substring(Math.max(0, match.index - 10), match.index).includes('export'),
      });
    }

    while ((match = classRegex.exec(content)) !== null) {
      const line = this.getLineNumber(content, match.index);
      symbols.push({
        name: match[1],
        type: 'class',
        kind: 'class',
        line,
        column: match.index,
        isExported: content.substring(Math.max(0, match.index - 10), match.index).includes('export'),
      });
    }

    while ((match = interfaceRegex.exec(content)) !== null) {
      const line = this.getLineNumber(content, match.index);
      symbols.push({
        name: match[1],
        type: 'interface',
        kind: 'interface',
        line,
        column: match.index,
        isExported: content.substring(Math.max(0, match.index - 10), match.index).includes('export'),
      });
    }

    while ((match = typeRegex.exec(content)) !== null) {
      const line = this.getLineNumber(content, match.index);
      symbols.push({
        name: match[1],
        type: 'type',
        kind: 'type',
        line,
        column: match.index,
        isExported: content.substring(Math.max(0, match.index - 10), match.index).includes('export'),
      });
    }

    return symbols;
  }

  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  private async getChunkCount(repoId: string, filePath: string): Promise<number> {
    try {
      const file = await this.db.file.getByPath(repoId, filePath);
      if (file) {
        const embeddings = await this.db.embedding.getByFileId(file.id);
        return embeddings.length;
      }
    } catch {
      return 0;
    }
    return 0;
  }

  async reindexRepository(repoId: string, repoPath: string): Promise<IndexProgress> {
    logger.info(`Reindexing repository ${repoId}`);

    const files = await this.db.file.getByRepoId(repoId);
    for (const file of files) {
      await this.db.embedding.deleteByFileId(file.id);
      await this.db.symbol.deleteByFileId(file.id);
    }
    await this.db.file.deleteByRepoId(repoId);

    return this.indexRepository(repoId, repoPath);
  }
}

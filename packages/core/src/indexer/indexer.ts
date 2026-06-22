import { DatabaseAdapter, File, Symbol, Embedding, SymbolType } from '../data/adapter';
import { CodeParser, ParseResult, ParsedSymbol } from './parser';
import { Embedder, EmbeddingConfig, EmbeddingResult, createEmbedder } from './embedder';
import { IndexingQueue, QueueStats, createQueue, QueueItem } from './queue';
import { DirectoryWatcher, FileEventType } from './watcher';
import { detectLanguage, shouldSkipPath, isBinaryFile, SUPPORTED_LANGUAGES, LanguageConfig } from './languages';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export interface IndexerOptions {
  maxConcurrent?: number;
  maxRetries?: number;
  batchSize?: number;
  skipPatterns?: RegExp[];
  embeddingConfig: EmbeddingConfig;
}

export interface IndexingProgress {
  totalFiles: number;
  indexedFiles: number;
  failedFiles: number;
  currentFile?: string;
  percent: number;
}

export type ProgressCallback = (progress: IndexingProgress) => void;

export interface GitInfo {
  commitHash?: string;
  commitMessage?: string;
  author?: string;
  modifiedAt?: Date;
}

export class CodeIndexer {
  private db: DatabaseAdapter;
  private parser: CodeParser;
  private embedder: Embedder;
  private queue: IndexingQueue;
  private watcher?: DirectoryWatcher;
  private isIndexing: boolean;
  private cancelToken: string | null;
  private progressCallback?: ProgressCallback;
  
  constructor(db: DatabaseAdapter, options: IndexerOptions) {
    this.db = db;
    this.parser = new CodeParser();
    this.embedder = createEmbedder(options.embeddingConfig);
    this.queue = createQueue({
      maxConcurrent: options.maxConcurrent || 4,
      maxRetries: options.maxRetries || 3,
    });
    this.isIndexing = false;
    this.cancelToken = null;
  }
  
  setProgressCallback(callback: ProgressCallback): void {
    this.progressCallback = callback;
  }
  
  async indexRepo(repoPath: string, repoId?: string): Promise<string> {
    this.isIndexing = true;
    this.cancelToken = `cancel_${Date.now()}`;
    
    let repo = repoId ? await this.db.repo.getById(repoId) : await this.db.repo.getByPath(repoPath);
    
    if (!repo) {
      repo = await this.db.repo.create({
        name: path.basename(repoPath),
        path: repoPath,
      });
    }
    
    const files = await this.discoverFiles(repoPath);
    
    const progress: IndexingProgress = {
      totalFiles: files.length,
      indexedFiles: 0,
      failedFiles: 0,
      percent: 0,
    };
    
    this.reportProgress(progress, files[0]);
    
    const fileIds = await this.indexFiles(repo.id, files, progress);
    
    await this.db.repo.update(repo.id, {
      lastIndexedAt: new Date(),
      fileCount: fileIds.length,
    });
    
    this.isIndexing = false;
    return repo.id;
  }
  
  async indexFile(repoId: string, filePath: string): Promise<string | null> {
    const content = await this.readFile(filePath);
    if (!content) return null;
    
    const parseResult = await this.parser.parseFile(filePath, content);
    if (!parseResult) return null;
    
    const existingFile = await this.db.file.getByRepoId(repoId).then(
      files => files.find(f => f.path === filePath)
    );
    
    if (existingFile && existingFile.contentHash === parseResult.contentHash) {
      return existingFile.id;
    }
    
    if (existingFile) {
      await this.deleteFileData(existingFile.id);
    }
    
    const file = await this.db.file.create({
      repoId,
      path: filePath,
      language: parseResult.language,
      contentHash: parseResult.contentHash,
      sizeBytes: parseResult.sizeBytes,
    });
    
    for (const symbol of parseResult.symbols) {
      await this.db.symbol.create({
        fileId: file.id,
        name: symbol.name,
        type: symbol.type as SymbolType,
        kind: symbol.kind,
        line: symbol.line,
        column: symbol.column,
        endLine: symbol.endLine,
        endColumn: symbol.endColumn,
        parentId: symbol.parentId,
        isExported: symbol.isExported,
      });
    }
    
    for (let i = 0; i < parseResult.chunks.length; i++) {
      const chunk = parseResult.chunks[i];
      const embeddingResult = await this.embedder.embedChunk(chunk.content);
      
      await this.db.embedding.create({
        fileId: file.id,
        chunkIndex: i,
        content: chunk.content,
        embedding: embeddingResult.embedding,
        tokenCount: embeddingResult.tokenCount,
      });
    }
    
    return file.id;
  }
  
  async incrementalIndex(repoId: string, sinceDate: Date): Promise<void> {
    const repo = await this.db.repo.getById(repoId);
    if (!repo) throw new Error(`Repo not found: ${repoId}`);
    
    const files = await this.db.file.getByRepoId(repoId);
    const modifiedFiles = files.filter(
      f => f.updatedAt && f.updatedAt > sinceDate
    );
    
    for (const file of modifiedFiles) {
      const exists = fs.existsSync(file.path);
      if (!exists) {
        await this.deleteFileData(file.id);
        await this.db.file.delete(file.id);
      } else {
        await this.indexFile(repoId, file.path);
      }
    }
  }
  
  watch(repoPath: string): void {
    if (this.watcher) {
      this.watcher.closeAll();
    }
    
    this.watcher = new DirectoryWatcher(async (filePath: string, eventType: FileEventType) => {
      const repo = await this.db.repo.getByPath(repoPath);
      if (!repo) return;
      
      switch (eventType) {
        case 'add':
        case 'change':
          await this.indexFile(repo.id, filePath);
          break;
        case 'unlink':
          const file = await this.db.file.getByPath(repo.id, filePath);
          if (file) {
            await this.deleteFileData(file.id);
            await this.db.file.delete(file.id);
          }
          break;
      }
    });
    
    this.watcher.watchDirectory(repoPath);
  }
  
  stopWatching(): void {
    if (this.watcher) {
      this.watcher.closeAll();
      this.watcher = undefined;
    }
  }
  
  async indexGitHistory(repoId: string, maxCommits: number = 100): Promise<void> {
    const repo = await this.db.repo.getById(repoId);
    if (!repo) throw new Error(`Repo not found: ${repoId}`);
    
    try {
      const log = execSync(
        `git log --oneline -${maxCommits} --name-only`,
        { cwd: repo.path, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
      );
      
      const commitPattern = /([a-f0-9]+)\s+(.+)/;
      const lines = log.split('\n');
      let currentCommit: string | null = null;
      let currentMessage: string | null = null;
      let currentFiles: string[] = [];
      
      for (const line of lines) {
        const commitMatch = line.match(commitPattern);
        if (commitMatch) {
          if (currentCommit && currentFiles.length > 0) {
            await this.indexGitCommitFiles(repo.id, currentFiles, {
              commitHash: currentCommit,
              commitMessage: currentMessage || undefined,
            });
          }
          currentCommit = commitMatch[1];
          currentMessage = commitMatch[2];
          currentFiles = [];
        } else if (line.trim() && !line.startsWith(' ')) {
          currentFiles.push(path.join(repo.path, line.trim()));
        }
      }
      
      if (currentCommit && currentFiles.length > 0) {
        await this.indexGitCommitFiles(repo.id, currentFiles, {
          commitHash: currentCommit,
          commitMessage: currentMessage || undefined,
        });
      }
    } catch (error) {
      console.error('Failed to index git history:', error);
    }
  }
  
  cancel(): void {
    this.cancelToken = `cancel_${Date.now()}`;
    this.queue.cancel();
    this.isIndexing = false;
  }
  
  getIndexingStatus(): { isIndexing: boolean; progress: IndexingProgress | null } {
    const stats = this.queue.getStats();
    return {
      isIndexing: this.isIndexing,
      progress: stats.totalItems > 0 ? {
        totalFiles: stats.totalItems,
        indexedFiles: stats.completedItems,
        failedFiles: stats.failedItems,
        percent: this.queue.getProgress(),
      } : null,
    };
  }
  
  private async discoverFiles(repoPath: string): Promise<string[]> {
    const files: string[] = [];
    
    const walkDir = (dir: string): void => {
      if (this.cancelToken) return;
      
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (shouldSkipPath(fullPath)) continue;
        
        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.isFile()) {
          if (isBinaryFile(fullPath)) continue;
          if (!detectLanguage(fullPath)) continue;
          files.push(fullPath);
        }
      }
    };
    
    walkDir(repoPath);
    return files;
  }
  
  private async indexFiles(
    repoId: string,
    files: string[],
    progress: IndexingProgress
  ): Promise<string[]> {
    const fileIds: string[] = [];
    
    for (const filePath of files) {
      if (this.cancelToken) break;
      
      progress.currentFile = filePath;
      this.reportProgress(progress);
      
      try {
        const fileId = await this.indexFile(repoId, filePath);
        if (fileId) {
          fileIds.push(fileId);
          progress.indexedFiles++;
        } else {
          progress.failedFiles++;
        }
      } catch (error) {
        console.error(`Failed to index file ${filePath}:`, error);
        progress.failedFiles++;
      }
      
      progress.percent = Math.round((progress.indexedFiles / progress.totalFiles) * 100);
      this.reportProgress(progress);
    }
    
    return fileIds;
  }
  
  private async indexGitCommitFiles(
    repoId: string,
    filePaths: string[],
    gitInfo: GitInfo
  ): Promise<void> {
    for (const filePath of filePaths) {
      if (!fs.existsSync(filePath)) continue;
      if (shouldSkipPath(filePath)) continue;
      if (!detectLanguage(filePath)) continue;
      
      const existingFile = await this.db.file.getByPath(repoId, filePath);
      if (existingFile) continue;
      
      const content = await this.readFile(filePath);
      if (!content) continue;
      
      const parseResult = await this.parser.parseFile(filePath, content);
      if (!parseResult) continue;
      
      await this.db.file.create({
        repoId,
        path: filePath,
        language: parseResult.language,
        contentHash: parseResult.contentHash,
        sizeBytes: parseResult.sizeBytes,
        gitModifiedAt: gitInfo.modifiedAt,
        gitAuthor: gitInfo.author,
        gitCommitMsg: gitInfo.commitMessage,
      });
    }
  }
  
  private async deleteFileData(fileId: string): Promise<void> {
    await this.db.symbol.deleteByFileId(fileId);
    await this.db.embedding.deleteByFileId(fileId);
  }
  
  private async readFile(filePath: string): Promise<string | null> {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return content;
    } catch (error) {
      console.error(`Failed to read file ${filePath}:`, error);
      return null;
    }
  }
  
  private reportProgress(progress: IndexingProgress, currentFile?: string): void {
    if (currentFile) {
      progress.currentFile = currentFile;
    }
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
  }
  
  private async getGitInfo(filePath: string): Promise<GitInfo> {
    try {
      const dir = path.dirname(filePath);
      const relativePath = path.relative(dir, filePath);
      
      const log = execSync(
        `git log -1 --format="%H|%s|%an|%ad" --date=iso -- ${relativePath}`,
        { cwd: dir, encoding: 'utf8' }
      );
      
      const [commitHash, commitMessage, author, modifiedAtStr] = log.trim().split('|');
      
      return {
        commitHash,
        commitMessage,
        author,
        modifiedAt: modifiedAtStr ? new Date(modifiedAtStr) : undefined,
      };
    } catch {
      return {};
    }
  }
}

export async function createIndexer(
  db: DatabaseAdapter,
  options: IndexerOptions
): Promise<CodeIndexer> {
  return new CodeIndexer(db, options);
}

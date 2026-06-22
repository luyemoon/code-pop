import { shouldSkipPath, isBinaryFile } from './languages';

export type FileEventType = 'add' | 'change' | 'unlink';
export type FileEventCallback = (filePath: string, eventType: FileEventType) => void;

export interface WatcherOptions {
  ignoreSkipPatterns?: boolean;
  debounceMs?: number;
  ignoreBinaryFiles?: boolean;
}

const DEFAULT_WATCHER_OPTIONS: Required<WatcherOptions> = {
  ignoreSkipPatterns: false,
  debounceMs: 500,
  ignoreBinaryFiles: true,
};

export interface FileWatcher {
  watch(paths: string | string[], callback: FileEventCallback): void;
  unwatch(paths?: string | string[]): void;
  close(): void;
}

class ChokidarWatcher implements FileWatcher {
  private watcher: any;
  private callback: FileEventCallback;
  private options: Required<WatcherOptions>;
  private debounceTimers: Map<string, NodeJS.Timeout>;
  private debounceMs: number;
  
  constructor(options: WatcherOptions = {}) {
    this.options = { ...DEFAULT_WATCHER_OPTIONS, ...options };
    this.debounceTimers = new Map();
    this.debounceMs = this.options.debounceMs;
    this.callback = () => {};
    this.watcher = null;
  }
  
  async watch(paths: string | string[], callback: FileEventCallback): Promise<void> {
    this.callback = callback;
    
    const chokidar = await import('chokidar');
    
    const pathsToWatch = Array.isArray(paths) ? paths : [paths];
    
    const ignorePatterns: string[] = [];
    if (!this.options.ignoreSkipPatterns) {
      ignorePatterns.push(
        /node_modules/,
        /\.git/,
        /dist/,
        /build/,
        /\.next/,
        /\.nuxt/,
        /coverage/,
        /\.cache/
      );
    }
    
    this.watcher = chokidar.watch(pathsToWatch, {
      persistent: true,
      ignoreInitial: true,
      ignored: ignorePatterns,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
    });
    
    this.watcher.on('add', (filePath: string) => this.handleEvent(filePath, 'add'));
    this.watcher.on('change', (filePath: string) => this.handleEvent(filePath, 'change'));
    this.watcher.on('unlink', (filePath: string) => this.handleEvent(filePath, 'unlink'));
    
    this.watcher.on('error', (error: Error) => {
      console.error('Watcher error:', error);
    });
    
    await new Promise<void>((resolve) => {
      this.watcher.on('ready', () => resolve());
    });
  }
  
  private handleEvent(filePath: string, eventType: FileEventType): void {
    if (this.options.ignoreBinaryFiles && isBinaryFile(filePath)) {
      return;
    }
    
    const existingTimer = this.debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    const timer = setTimeout(() => {
      this.debounceTimers.delete(filePath);
      this.callback(filePath, eventType);
    }, this.debounceMs);
    
    this.debounceTimers.set(filePath, timer);
  }
  
  async unwatch(paths?: string | string[]): Promise<void> {
    if (!this.watcher) return;
    
    if (paths) {
      const pathsToUnwatch = Array.isArray(paths) ? paths : [paths];
      await this.watcher.unwatch(pathsToUnwatch);
    }
  }
  
  async close(): Promise<void> {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }
}

export class DirectoryWatcher {
  private watchers: Map<string, ChokidarWatcher>;
  private callback: FileEventCallback;
  private options: WatcherOptions;
  
  constructor(callback: FileEventCallback, options: WatcherOptions = {}) {
    this.watchers = new Map();
    this.callback = callback;
    this.options = options;
  }
  
  async watchDirectory(dirPath: string): Promise<void> {
    if (this.watchers.has(dirPath)) {
      return;
    }
    
    const watcher = new ChokidarWatcher(this.options);
    await watcher.watch(dirPath, this.callback);
    this.watchers.set(dirPath, watcher);
  }
  
  async watchDirectories(dirPaths: string[]): Promise<void> {
    await Promise.all(dirPaths.map(path => this.watchDirectory(path)));
  }
  
  async unwatchDirectory(dirPath: string): Promise<void> {
    const watcher = this.watchers.get(dirPath);
    if (watcher) {
      await watcher.close();
      this.watchers.delete(dirPath);
    }
  }
  
  async closeAll(): Promise<void> {
    const closePromises: Promise<void>[] = [];
    for (const watcher of this.watchers.values()) {
      closePromises.push(watcher.close());
    }
    await Promise.all(closePromises);
    this.watchers.clear();
  }
  
  getWatchedDirectories(): string[] {
    return Array.from(this.watchers.keys());
  }
}

export function createWatcher(options?: WatcherOptions): Promise<DirectoryWatcher> {
  return new Promise((resolve) => {
    const watcher = new DirectoryWatcher(() => {}, options);
    resolve(watcher);
  });
}

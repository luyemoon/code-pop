export interface QueueItem {
  id: string;
  filePath: string;
  priority: number;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  lastAttemptAt?: Date;
  error?: string;
}

export interface QueueStats {
  totalItems: number;
  pendingItems: number;
  processingItems: number;
  completedItems: number;
  failedItems: number;
  retryCount: number;
}

export type ProgressCallback = (stats: QueueStats) => void;
export type ItemProcessor<T> = (item: QueueItem) => Promise<T>;

export interface QueueOptions {
  maxConcurrent: number;
  maxRetries: number;
  retryDelayMs: number;
  onProgress?: ProgressCallback;
}

const DEFAULT_OPTIONS: QueueOptions = {
  maxConcurrent: 4,
  maxRetries: 3,
  retryDelayMs: 1000,
};

class PriorityQueue<T extends QueueItem> {
  private items: T[] = [];
  
  enqueue(item: T): void {
    this.items.push(item);
    this.bubbleUp(this.items.length - 1);
  }
  
  dequeue(): T | undefined {
    if (this.items.length === 0) return undefined;
    
    const min = this.items[0];
    const last = this.items.pop();
    
    if (this.items.length > 0 && last) {
      this.items[0] = last;
      this.bubbleDown(0);
    }
    
    return min;
  }
  
  peek(): T | undefined {
    return this.items[0];
  }
  
  size(): number {
    return this.items.length;
  }
  
  isEmpty(): boolean {
    return this.items.length === 0;
  }
  
  remove(predicate: (item: T) => boolean): T[] {
    const removed: T[] = [];
    this.items = this.items.filter(item => {
      if (predicate(item)) {
        removed.push(item);
        return false;
      }
      return true;
    });
    return removed;
  }
  
  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.items[parentIndex].priority <= this.items[index].priority) break;
      [this.items[parentIndex], this.items[index]] = [this.items[index], this.items[parentIndex]];
      index = parentIndex;
    }
  }
  
  private bubbleDown(index: number): void {
    const length = this.items.length;
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;
      
      if (leftChild < length && this.items[leftChild].priority < this.items[smallest].priority) {
        smallest = leftChild;
      }
      
      if (rightChild < length && this.items[rightChild].priority < this.items[smallest].priority) {
        smallest = rightChild;
      }
      
      if (smallest === index) break;
      
      [this.items[index], this.items[smallest]] = [this.items[smallest], this.items[index]];
      index = smallest;
    }
  }
}

export class IndexingQueue {
  private queue: PriorityQueue<QueueItem>;
  private processing: Map<string, QueueItem>;
  private completed: Set<string>;
  private failed: Map<string, number>;
  private options: QueueOptions;
  private isRunning: boolean;
  private isPaused: boolean;
  private cancelToken: string | null;
  private workerCount: number;
  private stats: QueueStats;
  
  constructor(options: Partial<QueueOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.queue = new PriorityQueue<QueueItem>();
    this.processing = new Map();
    this.completed = new Set();
    this.failed = new Map();
    this.isRunning = false;
    this.isPaused = false;
    this.cancelToken = null;
    this.workerCount = 0;
    this.stats = {
      totalItems: 0,
      pendingItems: 0,
      processingItems: 0,
      completedItems: 0,
      failedItems: 0,
      retryCount: 0,
    };
  }
  
  add(filePath: string, priority: number = 5): string {
    const id = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const item: QueueItem = {
      id,
      filePath,
      priority,
      retryCount: 0,
      maxRetries: this.options.maxRetries,
      createdAt: new Date(),
    };
    
    this.queue.enqueue(item);
    this.stats.totalItems++;
    this.stats.pendingItems++;
    this.notifyProgress();
    
    return id;
  }
  
  addBatch(filePaths: string[], basePriority: number = 5): string[] {
    return filePaths.map((filePath, index) => {
      const priority = basePriority - index * 0.1;
      return this.add(filePath, Math.max(priority, 1));
    });
  }
  
  remove(id: string): boolean {
    const removed = this.queue.remove(item => item.id === id);
    if (removed.length > 0) {
      this.stats.pendingItems -= removed.length;
      this.notifyProgress();
      return true;
    }
    return false;
  }
  
  async process<T>(processor: ItemProcessor<T>): Promise<Map<string, T | Error>> {
    this.isRunning = true;
    const results = new Map<string, T | Error>();
    
    const workers: Promise<void>[] = [];
    for (let i = 0; i < this.options.maxConcurrent; i++) {
      workers.push(this.worker(processor, results));
    }
    
    await Promise.all(workers);
    this.isRunning = false;
    
    return results;
  }
  
  private async worker<T>(processor: ItemProcessor<T>, results: Map<string, T | Error>): Promise<void> {
    while (this.isRunning || this.queue.size() > 0) {
      if (this.isPaused) {
        await this.sleep(100);
        continue;
      }
      
      const item = this.getNextItem();
      if (!item) {
        await this.sleep(100);
        continue;
      }
      
      this.workerCount++;
      this.stats.processingItems++;
      this.stats.pendingItems--;
      this.notifyProgress();
      
      try {
        const result = await processor(item);
        results.set(item.id, result);
        this.completed.add(item.id);
        this.stats.completedItems++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (item.retryCount < item.maxRetries) {
          item.retryCount++;
          item.lastAttemptAt = new Date();
          item.error = errorMessage;
          this.stats.retryCount++;
          this.stats.failedItems--;
          this.stats.pendingItems++;
          this.queue.enqueue(item);
          await this.sleep(this.options.retryDelayMs * item.retryCount);
        } else {
          results.set(item.id, new Error(errorMessage));
          this.failed.set(item.id, item.retryCount);
          this.stats.failedItems++;
        }
      } finally {
        this.workerCount--;
        this.stats.processingItems--;
        this.notifyProgress();
      }
    }
  }
  
  private getNextItem(): QueueItem | undefined {
    if (this.isPaused) return undefined;
    
    const item = this.queue.dequeue();
    if (item) {
      this.processing.set(item.id, item);
    }
    return item;
  }
  
  pause(): void {
    this.isPaused = true;
  }
  
  resume(): void {
    this.isPaused = false;
  }
  
  cancel(): void {
    this.cancelToken = `cancel_${Date.now()}`;
    this.isRunning = false;
    this.queue = new PriorityQueue<QueueItem>();
    this.stats.pendingItems = 0;
    this.notifyProgress();
  }
  
  getStats(): QueueStats {
    return { ...this.stats };
  }
  
  getPendingItems(): QueueItem[] {
    const items: QueueItem[] = [];
    for (const item of (this.queue as any).items) {
      items.push(item);
    }
    return items;
  }
  
  private notifyProgress(): void {
    if (this.options.onProgress) {
      this.options.onProgress(this.getStats());
    }
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  isIdle(): boolean {
    return this.queue.size() === 0 && this.processing.size === 0 && !this.isRunning;
  }
  
  getProgress(): number {
    if (this.stats.totalItems === 0) return 0;
    return (this.stats.completedItems / this.stats.totalItems) * 100;
  }
}

export function createQueue(options?: Partial<QueueOptions>): IndexingQueue {
  return new IndexingQueue(options);
}

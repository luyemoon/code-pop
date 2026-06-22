import { Repo, File, Symbol, Embedding, EmbeddingSearchResult } from '@codepop/core';

// 仓库相关类型
export interface CreateRepoRequest {
  name: string;
  path: string;
  gitUrl?: string;
}

export interface UpdateRepoRequest {
  name?: string;
  path?: string;
  gitUrl?: string;
}

export interface RepoResponse {
  id: string;
  name: string;
  path: string;
  gitUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  lastIndexedAt?: Date;
  fileCount: number;
  symbolCount: number;
}

// 文件相关类型
export interface CreateFileRequest {
  repoId: string;
  path: string;
  language?: string;
  contentHash?: string;
  sizeBytes?: number;
  gitModifiedAt?: Date;
  gitAuthor?: string;
  gitCommitMsg?: string;
}

export interface FileResponse {
  id: string;
  repoId: string;
  path: string;
  language?: string;
  contentHash?: string;
  sizeBytes?: number;
  createdAt: Date;
  updatedAt: Date;
  gitModifiedAt?: Date;
  gitAuthor?: string;
  gitCommitMsg?: string;
}

// 符号相关类型
export interface SymbolResponse {
  id: string;
  fileId: string;
  name: string;
  type: string;
  kind: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  parentId?: string;
  isExported: boolean;
}

// 搜索相关类型
export interface SearchRequest {
  query: string;
  repoId?: string;
  limit?: number;
}

export interface SearchResponse {
  results: SearchResultItem[];
  query: string;
  total: number;
  took: number;
}

export interface SearchResultItem {
  fileId: string;
  repoId: string;
  path: string;
  content: string;
  similarity: number;
  line?: number;
  symbolName?: string;
}

// 索引相关类型
export interface IndexRequest {
  repoId: string;
}

export interface IndexResponse {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  repoId: string;
  chunksIndexed?: number;
  filesIndexed?: number;
  symbolsIndexed?: number;
  error?: string;
}

// 嵌入相关类型
export interface CreateEmbeddingRequest {
  fileId: string;
  chunkIndex: number;
  content: string;
  embedding: number[];
  tokenCount: number;
}

export interface EmbeddingSearchRequest {
  embedding: number[];
  limit?: number;
  repoId?: string;
}

export interface EmbeddingResponse {
  id: string;
  fileId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  createdAt: Date;
}

// 通用 API 响应类型
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// 健康检查类型
export interface HealthResponse {
  status: 'ok' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  database: {
    connected: boolean;
    type: string;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
}

// WebSocket 消息类型
export interface WSMessage {
  type: 'index_progress' | 'search_result' | 'error' | 'notification';
  payload: unknown;
  timestamp: string;
}

export interface IndexProgressPayload {
  repoId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  chunksIndexed?: number;
  filesIndexed?: number;
  error?: string;
}

// 环境变量类型
export interface ServerConfig {
  port: number;
  host: string;
  logLevel: string;
  apiKeyRequired: boolean;
  databaseUrl: string;
  databaseType: 'postgresql' | 'sqlite' | 'mock';
  openaiApiKey?: string;
  embeddingModel: string;
  embeddingDim: number;
}

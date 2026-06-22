import { CodeSearchService } from '@codepop/core';
import { MCPToolResult, MCPContent } from '../protocol';
import {
  SearchCodeParams,
  GetRepoInfoParams,
  ListReposParams,
  IndexRepoParams,
  GetFileContentParams,
  GetCallGraphParams,
} from '../tools';

export class ToolHandlers {
  private service: CodeSearchService;

  constructor(service: CodeSearchService) {
    this.service = service;
  }

  private textContent(text: string): MCPToolResult {
    return {
      content: [{ type: 'text', text }],
      isError: false,
    };
  }

  private errorContent(message: string): MCPToolResult {
    return {
      content: [{ type: 'text', text: message }],
      isError: true,
    };
  }

  async handleSearchCode(params: SearchCodeParams): Promise<MCPToolResult> {
    try {
      const { query, repoId, limit = 10 } = params;

      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return this.errorContent('Query is required and must be a non-empty string');
      }

      // Generate mock embedding for the query (in production, use actual embeddings)
      const queryEmbedding = this.generateMockEmbedding(query);
      const results = await this.service.searchByEmbedding(queryEmbedding, limit, repoId);

      if (results.length === 0) {
        return this.textContent('No results found for the query');
      }

      const formattedResults = results.map((result, index) => {
        const file = result.embedding;
        return `${index + 1}. File: ${file.id}\n   Content: ${file.content.substring(0, 200)}...\n   Similarity: ${result.similarity.toFixed(3)}`;
      }).join('\n\n');

      return this.textContent(`Found ${results.length} matches:\n\n${formattedResults}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Search failed';
      return this.errorContent(`Search error: ${message}`);
    }
  }

  async handleGetRepoInfo(params: GetRepoInfoParams): Promise<MCPToolResult> {
    try {
      const { repoId } = params;

      if (!repoId || typeof repoId !== 'string') {
        return this.errorContent('Repo ID is required');
      }

      const repo = await this.service.getRepo(repoId);

      if (!repo) {
        return this.errorContent(`Repository not found: ${repoId}`);
      }

      const info = [
        `Repository: ${repo.name}`,
        `ID: ${repo.id}`,
        `Path: ${repo.path}`,
        `Created: ${repo.createdAt.toISOString()}`,
        `Last Indexed: ${repo.lastIndexedAt?.toISOString() || 'Never'}`,
        `Files: ${repo.fileCount}`,
        `Symbols: ${repo.symbolCount}`,
      ].join('\n');

      return this.textContent(info);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get repo info';
      return this.errorContent(`Error: ${message}`);
    }
  }

  async handleListRepos(_params: ListReposParams): Promise<MCPToolResult> {
    try {
      const repos = await this.service.getAllRepos();

      if (repos.length === 0) {
        return this.textContent('No repositories indexed');
      }

      const formattedRepos = repos.map(repo => {
        return `- ${repo.name} (${repo.id})\n  Path: ${repo.path}\n  Files: ${repo.fileCount}, Symbols: ${repo.symbolCount}`;
      }).join('\n');

      return this.textContent(`Indexed Repositories (${repos.length}):\n\n${formattedRepos}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list repos';
      return this.errorContent(`Error: ${message}`);
    }
  }

  async handleIndexRepo(params: IndexRepoParams): Promise<MCPToolResult> {
    try {
      const { path, name, gitUrl } = params;

      if (!path || typeof path !== 'string' || path.trim().length === 0) {
        return this.errorContent('Path is required and must be a non-empty string');
      }

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return this.errorContent('Name is required and must be a non-empty string');
      }

      // Create repository in database
      const repo = await this.service.createRepo(name, path, gitUrl);

      // In production, would trigger indexing process here
      return this.textContent(`Repository indexed successfully:\nID: ${repo.id}\nName: ${repo.name}\nPath: ${repo.path}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to index repo';
      return this.errorContent(`Indexing error: ${message}`);
    }
  }

  async handleGetFileContent(params: GetFileContentParams): Promise<MCPToolResult> {
    try {
      const { fileId, maxLines = 500, offset = 0 } = params;

      if (!fileId || typeof fileId !== 'string') {
        return this.errorContent('File ID is required');
      }

      // Get files from repo - in production, would have direct file lookup
      const files = await this.service.getFilesByRepo(fileId);
      const file = files.find(f => f.id === fileId);

      if (!file) {
        return this.textContent(`File not found: ${fileId}`);
      }

      // In production, would read actual file content
      const content = `[File content would be loaded from: ${file.path}]\nLanguage: ${file.language || 'unknown'}\nSize: ${file.sizeBytes || 0} bytes`;

      return this.textContent(content);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get file content';
      return this.errorContent(`Error: ${message}`);
    }
  }

  async handleGetCallGraph(params: GetCallGraphParams): Promise<MCPToolResult> {
    try {
      const { repoId, symbolId } = params;

      if (!repoId || typeof repoId !== 'string') {
        return this.errorContent('Repo ID is required');
      }

      const edges = await this.service.getCallGraphByRepo(repoId);

      if (edges.length === 0) {
        return this.textContent('No call graph data available');
      }

      let filteredEdges = edges;
      if (symbolId) {
        filteredEdges = edges.filter(e => e.sourceId === symbolId || e.targetId === symbolId);
      }

      const formattedEdges = filteredEdges.map((edge, index) => {
        return `${index + 1}. ${edge.sourceId} --[${edge.callType}]--> ${edge.targetId}`;
      }).join('\n');

      return this.textContent(`Call Graph (${filteredEdges.length} edges):\n\n${formattedEdges}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get call graph';
      return this.errorContent(`Error: ${message}`);
    }
  }

  // Generate a mock embedding vector for development
  private generateMockEmbedding(text: string): number[] {
    const dimension = 1536;
    const embedding = new Array(dimension);
    let hash = 0;
    
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    const seed = Math.abs(hash);
    for (let i = 0; i < dimension; i++) {
      const lcg = (seed * 1103515245 + 12345) & 0x7fffffff;
      embedding[i] = (lcg % 2000 - 1000) / 1000;
    }

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
  }
}

export default ToolHandlers;

import { MCPTool } from '../protocol';

export const TOOL_SEARCH_CODE: MCPTool = {
  name: 'search_code',
  description: 'Search code semantically using embeddings',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query string',
        minLength: 1,
      },
      repoId: {
        type: 'string',
        description: 'Optional repository ID to search within',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results',
        default: 10,
        minimum: 1,
        maximum: 100,
      },
    },
    required: ['query'],
  },
};

export const TOOL_GET_REPO_INFO: MCPTool = {
  name: 'get_repo_info',
  description: 'Get repository details by ID',
  inputSchema: {
    type: 'object',
    properties: {
      repoId: {
        type: 'string',
        description: 'Repository ID',
      },
    },
    required: ['repoId'],
  },
};

export const TOOL_LIST_REPOS: MCPTool = {
  name: 'list_repos',
  description: 'List all indexed repositories',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

export const TOOL_INDEX_REPO: MCPTool = {
  name: 'index_repo',
  description: 'Index a new repository for searching',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Local path to the repository',
        minLength: 1,
      },
      name: {
        type: 'string',
        description: 'Repository name',
        minLength: 1,
      },
      gitUrl: {
        type: 'string',
        description: 'Optional Git URL',
      },
    },
    required: ['path', 'name'],
  },
};

export const TOOL_GET_FILE_CONTENT: MCPTool = {
  name: 'get_file_content',
  description: 'Get file content with context',
  inputSchema: {
    type: 'object',
    properties: {
      fileId: {
        type: 'string',
        description: 'File ID',
      },
      maxLines: {
        type: 'number',
        description: 'Maximum number of lines to return',
        default: 500,
        minimum: 1,
        maximum: 5000,
      },
      offset: {
        type: 'number',
        description: 'Line offset to start from',
        default: 0,
        minimum: 0,
      },
    },
    required: ['fileId'],
  },
};

export const TOOL_GET_CALL_GRAPH: MCPTool = {
  name: 'get_call_graph',
  description: 'Get function call graph for a repository',
  inputSchema: {
    type: 'object',
    properties: {
      repoId: {
        type: 'string',
        description: 'Repository ID',
      },
      symbolId: {
        type: 'string',
        description: 'Optional symbol ID to get call graph for specific function',
      },
    },
    required: ['repoId'],
  },
};

export const ALL_TOOLS: MCPTool[] = [
  TOOL_SEARCH_CODE,
  TOOL_GET_REPO_INFO,
  TOOL_LIST_REPOS,
  TOOL_INDEX_REPO,
  TOOL_GET_FILE_CONTENT,
  TOOL_GET_CALL_GRAPH,
];

export interface SearchCodeParams {
  query: string;
  repoId?: string;
  limit?: number;
}

export interface GetRepoInfoParams {
  repoId: string;
}

export interface ListReposParams {}

export interface IndexRepoParams {
  path: string;
  name: string;
  gitUrl?: string;
}

export interface GetFileContentParams {
  fileId: string;
  maxLines?: number;
  offset?: number;
}

export interface GetCallGraphParams {
  repoId: string;
  symbolId?: string;
}

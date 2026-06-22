import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CodePop API',
      version: '0.1.0',
      description: 'CodePop HTTP Server - REST API 与 MCP 协议支持\n\n代码检索基础设施，提供语义搜索、代码索引等功能。',
      contact: {
        name: 'CodePop Team',
      },
      license: {
        name: 'MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: '本地开发服务器',
      },
    ],
    tags: [
      {
        name: 'Health',
        description: '服务健康检查接口',
      },
      {
        name: 'Repositories',
        description: '代码仓库管理接口',
      },
      {
        name: 'Search',
        description: '代码搜索接口',
      },
      {
        name: 'Embeddings',
        description: '嵌入向量管理接口',
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API 密钥认证',
        },
      },
      schemas: {
        HealthResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['ok', 'degraded', 'unhealthy'],
              description: '服务状态',
            },
            version: {
              type: 'string',
              description: '服务版本',
            },
            uptime: {
              type: 'number',
              description: '运行时间（秒）',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: '当前时间戳',
            },
            database: {
              type: 'object',
              properties: {
                connected: {
                  type: 'boolean',
                  description: '数据库连接状态',
                },
                type: {
                  type: 'string',
                  description: '数据库类型',
                },
              },
            },
            memory: {
              type: 'object',
              properties: {
                used: {
                  type: 'number',
                  description: '已使用内存（字节）',
                },
                total: {
                  type: 'number',
                  description: '总内存（字节）',
                },
                percentage: {
                  type: 'number',
                  description: '内存使用百分比',
                },
              },
            },
          },
        },
        CreateRepoRequest: {
          type: 'object',
          required: ['name', 'path'],
          properties: {
            name: {
              type: 'string',
              description: '仓库名称',
              example: 'my-project',
            },
            path: {
              type: 'string',
              description: '仓库本地路径',
              example: '/Users/user/projects/my-project',
            },
            gitUrl: {
              type: 'string',
              description: 'Git 仓库 URL（可选）',
              example: 'https://github.com/user/my-project.git',
            },
          },
        },
        UpdateRepoRequest: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: '新的仓库名称',
            },
            path: {
              type: 'string',
              description: '新的仓库路径',
            },
            gitUrl: {
              type: 'string',
              description: '新的 Git 仓库 URL',
            },
          },
        },
        RepoResponse: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: '仓库ID',
            },
            name: {
              type: 'string',
              description: '仓库名称',
            },
            path: {
              type: 'string',
              description: '仓库路径',
            },
            gitUrl: {
              type: 'string',
              description: 'Git URL',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: '创建时间',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: '更新时间',
            },
            lastIndexedAt: {
              type: 'string',
              format: 'date-time',
              description: '最后索引时间',
            },
            fileCount: {
              type: 'number',
              description: '文件数量',
            },
            symbolCount: {
              type: 'number',
              description: '符号数量',
            },
          },
        },
        FileResponse: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: '文件ID',
            },
            repoId: {
              type: 'string',
              description: '所属仓库ID',
            },
            path: {
              type: 'string',
              description: '文件路径',
            },
            language: {
              type: 'string',
              description: '编程语言',
            },
            contentHash: {
              type: 'string',
              description: '内容哈希',
            },
            sizeBytes: {
              type: 'number',
              description: '文件大小（字节）',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
            gitModifiedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Git 修改时间',
            },
            gitAuthor: {
              type: 'string',
              description: 'Git 作者',
            },
            gitCommitMsg: {
              type: 'string',
              description: 'Git 提交信息',
            },
          },
        },
        SymbolResponse: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: '符号ID',
            },
            fileId: {
              type: 'string',
              description: '所属文件ID',
            },
            name: {
              type: 'string',
              description: '符号名称',
            },
            type: {
              type: 'string',
              description: '符号类型',
            },
            kind: {
              type: 'string',
              description: '符号种类',
            },
            line: {
              type: 'number',
              description: '行号',
            },
            column: {
              type: 'number',
              description: '列号',
            },
            endLine: {
              type: 'number',
              description: '结束行号',
            },
            endColumn: {
              type: 'number',
              description: '结束列号',
            },
            parentId: {
              type: 'string',
              description: '父符号ID',
            },
            isExported: {
              type: 'boolean',
              description: '是否导出',
            },
          },
        },
        SearchRequest: {
          type: 'object',
          required: ['query'],
          properties: {
            query: {
              type: 'string',
              description: '搜索查询文本',
              example: 'How to implement authentication',
            },
            repoId: {
              type: 'string',
              description: '仓库ID（可选，限制搜索范围）',
            },
            limit: {
              type: 'number',
              minimum: 1,
              maximum: 100,
              default: 10,
              description: '返回结果数量限制',
            },
          },
        },
        SearchResponse: {
          type: 'object',
          properties: {
            results: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/SearchResultItem',
              },
            },
            query: {
              type: 'string',
              description: '原始查询文本',
            },
            total: {
              type: 'number',
              description: '结果总数',
            },
            took: {
              type: 'number',
              description: '搜索耗时（毫秒）',
            },
          },
        },
        SearchResultItem: {
          type: 'object',
          properties: {
            fileId: {
              type: 'string',
              description: '文件ID',
            },
            repoId: {
              type: 'string',
              description: '仓库ID',
            },
            path: {
              type: 'string',
              description: '文件路径',
            },
            content: {
              type: 'string',
              description: '匹配的内容片段',
            },
            similarity: {
              type: 'number',
              description: '相似度分数',
            },
            line: {
              type: 'number',
              description: '行号',
            },
            symbolName: {
              type: 'string',
              description: '关联的符号名称',
            },
          },
        },
        EmbeddingResponse: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: '嵌入向量ID',
            },
            fileId: {
              type: 'string',
              description: '所属文件ID',
            },
            chunkIndex: {
              type: 'number',
              description: '分块索引',
            },
            content: {
              type: 'string',
              description: '内容片段',
            },
            tokenCount: {
              type: 'number',
              description: 'Token 数量',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        IndexResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['pending', 'processing', 'completed', 'failed'],
              description: '索引状态',
            },
            repoId: {
              type: 'string',
              description: '仓库ID',
            },
            chunksIndexed: {
              type: 'number',
              description: '已索引的分块数',
            },
            filesIndexed: {
              type: 'number',
              description: '已索引的文件数',
            },
            symbolsIndexed: {
              type: 'number',
              description: '已索引的符号数',
            },
            error: {
              type: 'string',
              description: '错误信息',
            },
          },
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: '请求是否成功',
            },
            data: {
              type: 'object',
              description: '响应数据',
            },
            error: {
              type: 'string',
              description: '错误信息',
            },
            message: {
              type: 'string',
              description: '提示信息',
            },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
            },
            data: {
              type: 'array',
              items: {},
            },
            pagination: {
              type: 'object',
              properties: {
                page: {
                  type: 'number',
                },
                pageSize: {
                  type: 'number',
                },
                total: {
                  type: 'number',
                },
                totalPages: {
                  type: 'number',
                },
              },
            },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts'],
};

export const openapiSpecification = swaggerJsdoc(options);

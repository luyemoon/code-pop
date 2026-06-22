import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { MCPProtocol, JSONRPCRequest, JSONRPCResponse } from './protocol';
import { ToolHandlers } from './handlers';
import { ALL_TOOLS } from './tools';
import { CodeSearchService } from '@codepop/core';
import { DatabaseConfig } from '@codepop/core';

export interface MCPServerConfig {
  port?: number;
  host?: string;
  corsOrigin?: string | string[];
  enableStdio?: boolean;
  enableHttp?: boolean;
  enableWebSocket?: boolean;
  databaseConfig?: DatabaseConfig;
  basePath?: string;
}

export class MCPServer {
  private protocol: MCPProtocol;
  private app: express.Application;
  private server?: http.Server;
  private wss?: WebSocketServer;
  private toolHandlers: ToolHandlers;
  private service: CodeSearchService | null = null;
  private config: MCPServerConfig;
  private logger: (message: string) => void;
  private basePath: string;

  constructor(config: MCPServerConfig = {}) {
    this.config = {
      port: config.port || 3000,
      host: config.host || '0.0.0.0',
      corsOrigin: config.corsOrigin || '*',
      enableStdio: config.enableStdio ?? true,
      enableHttp: config.enableHttp ?? true,
      enableWebSocket: config.enableWebSocket ?? true,
      basePath: config.basePath || '',
    };

    this.basePath = this.config.basePath;
    this.logger = console.log;
    this.protocol = new MCPProtocol();
    this.app = express();
    this.toolHandlers = new ToolHandlers(null as any);

    this.setupProtocol();
    this.setupExpress();
  }

  private setupProtocol(): void {
    // Set server capabilities
    this.protocol.setCapabilities({
      tools: {
        listChanged: true,
      },
      resources: {
        subscribe: true,
        listChanged: false,
      },
      prompts: {
        listChanged: false,
      },
    });

    // Register all tools
    for (const tool of ALL_TOOLS) {
      this.protocol.registerTool(tool.name, tool, async (args) => {
        return this.routeToolCall(tool.name, args);
      });
    }

    // Protocol event handlers
    this.protocol.on('request', (request: JSONRPCRequest) => {
      this.logger(`[MCP] Received request: ${request.method}`);
    });

    this.protocol.on('error', (error) => {
      this.logger(`[MCP] Protocol error: ${JSON.stringify(error)}`);
    });
  }

  private setupExpress(): void {
    this.app.use(cors({
      origin: this.config.corsOrigin,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }));

    this.app.use(express.json({ limit: '10mb' }));

    const mcpPath = this.basePath ? `${this.basePath}/mcp` : '/mcp';
    const healthPath = this.basePath ? `${this.basePath}/health` : '/health';

    // Health check
    this.app.get(healthPath, (_req: Request, res: Response) => {
      res.json({ status: 'ok', service: 'mcp-server' });
    });

    // MCP endpoint
    this.app.post(mcpPath, this.handleHttpRequest.bind(this));

    // GET for tool listing (optional, following spec)
    this.app.get(mcpPath, this.handleHttpRequest.bind(this));

    // Error handler
    this.app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      this.logger(`[MCP] Express error: ${err.message}`);
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal error',
          data: err.message,
        },
      });
    });
  }

  get router(): express.Application {
    return this.app;
  }

  get mcpPath(): string {
    return this.basePath ? `${this.basePath}/mcp` : '/mcp';
  }

  get wsPath(): string {
    return this.basePath ? `${this.basePath}/mcp` : '/mcp';
  }

  getMCPProtocol(): MCPProtocol {
    return this.protocol;
  }

  private async handleHttpRequest(req: Request, res: Response): Promise<void> {
    try {
      // Handle GET requests (tool listing)
      if (req.method === 'GET') {
        const response = await this.protocol.handleRequest({
          jsonrpc: '2.0',
          id: null,
          method: 'tools/list',
        });
        res.json(response);
        return;
      }

      // Handle POST requests
      const message = req.body;

      if (!message) {
        res.status(400).json({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32700,
            message: 'Parse error',
          },
        });
        return;
      }

      const request = this.protocol.parseMessage(message);

      if (!request) {
        res.status(400).json({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32700,
            message: 'Invalid JSON-RPC message',
          },
        });
        return;
      }

      // Check if it's a notification (no id)
      if ('id' in request && request.id === null) {
        // Handle notification (no response needed)
        this.protocol.handleRequest(request);
        res.status(202).send();
        return;
      }

      const response = await this.protocol.handleRequest(request as JSONRPCRequest);
      res.json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger(`[MCP] Request handling error: ${message}`);
      res.status(500).json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32603,
          message: 'Internal error',
          data: message,
        },
      });
    }
  }

  private async routeToolCall(toolName: string, args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    if (!this.toolHandlers) {
      return {
        content: [{ type: 'text', text: 'Service not initialized' }],
        isError: true,
      };
    }

    switch (toolName) {
      case 'search_code':
        return this.toolHandlers.handleSearchCode(args as any);
      case 'get_repo_info':
        return this.toolHandlers.handleGetRepoInfo(args as any);
      case 'list_repos':
        return this.toolHandlers.handleListRepos(args as any);
      case 'index_repo':
        return this.toolHandlers.handleIndexRepo(args as any);
      case 'get_file_content':
        return this.toolHandlers.handleGetFileContent(args as any);
      case 'get_call_graph':
        return this.toolHandlers.handleGetCallGraph(args as any);
      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
          isError: true,
        };
    }
  }

  async initialize(service: CodeSearchService): Promise<void> {
    this.service = service;
    this.toolHandlers = new ToolHandlers(service);
    this.logger('[MCP] Server initialized with CodeSearchService');
  }

  async start(): Promise<void> {
    if (this.config.enableHttp) {
      this.server = this.app.listen(this.config.port, this.config.host, () => {
        this.logger(`[MCP] HTTP server started on ${this.config.host}:${this.config.port}`);
      });
    }

    if (this.config.enableWebSocket && this.server) {
      this.wss = new WebSocketServer({ server: this.server, path: this.wsPath });

      this.wss.on('connection', (ws: WebSocket) => {
        this.logger('[MCP] WebSocket client connected');

        ws.on('message', async (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString());
            const request = this.protocol.parseMessage(message);

            if (request) {
              const response = await this.protocol.handleRequest(request as JSONRPCRequest);
              if (response.id !== null || !('id' in request)) {
                ws.send(JSON.stringify(response));
              }
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger(`[MCP] WebSocket message error: ${message}`);
            ws.send(JSON.stringify({
              jsonrpc: '2.0',
              id: null,
              error: { code: -32700, message: 'Parse error' },
            }));
          }
        });

        ws.on('close', () => {
          this.logger('[MCP] WebSocket client disconnected');
        });

        ws.on('error', (error) => {
          this.logger(`[MCP] WebSocket error: ${error.message}`);
        });
      });

      this.logger('[MCP] WebSocket server started');
    }

    if (this.config.enableStdio) {
      this.setupStdio();
    }
  }

  private setupStdio(): void {
    process.stdin.setEncoding('utf-8');

    let buffer = '';

    process.stdin.on('data', async (chunk: string) => {
      buffer += chunk;

      // Try to parse complete JSON messages (newline-delimited)
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const message = JSON.parse(line);
            const request = this.protocol.parseMessage(message);

            if (request) {
              const response = await this.protocol.handleRequest(request as JSONRPCRequest);
              if (response.id !== null || !('id' in request)) {
                process.stdout.write(JSON.stringify(response) + '\n');
              }
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            process.stdout.write(JSON.stringify({
              jsonrpc: '2.0',
              id: null,
              error: { code: -32700, message: `Parse error: ${message}` },
            }) + '\n');
          }
        }
      }
    });

    this.logger('[MCP] Stdio handler initialized');
  }

  async stop(): Promise<void> {
    if (this.wss) {
      this.wss.close();
      this.wss = undefined;
    }

    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => {
          this.logger('[MCP] HTTP server stopped');
          resolve();
        });
      });
    }

    if (this.service) {
      await this.service.close();
    }
  }

  setLogger(logger: (message: string) => void): void {
    this.logger = logger;
  }
}

export default MCPServer;

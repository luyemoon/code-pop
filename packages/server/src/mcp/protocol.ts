import { EventEmitter } from 'events';

// JSON-RPC 2.0 message types
export interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: unknown;
  error?: JSONRPCError;
}

export interface JSONRPCError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JSONRPCNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

// MCP content types
export interface MCPContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
  resource?: {
    uri: string;
    name?: string;
    description?: string;
  };
}

// MCP resource types
export interface MCPResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

export interface MCPResourceTemplate {
  uriTemplate: string;
  name: string;
  description?: string;
  mimeType?: string;
}

// MCP tool types
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: MCPToolInputSchema;
}

export interface MCPToolInputSchema {
  type: 'object';
  properties?: Record<string, MCPProperty>;
  required?: string[];
}

export interface MCPProperty {
  type: string;
  description?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  enum?: unknown[];
  items?: MCPProperty;
}

export interface MCPToolResult {
  content: MCPContent[];
  isError?: boolean;
}

// MCP prompt types
export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: MCPPromptArgument[];
}

export interface MCPPromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

// MCP server capabilities
export interface MCPServerCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
  sampling?: {
    // Sampling is handled by the client
  };
}

// Error codes
export const ERROR_PARSE_ERROR = -32700;
export const ERROR_INVALID_REQUEST = -32600;
export const ERROR_METHOD_NOT_FOUND = -32601;
export const ERROR_INVALID_PARAMS = -32602;
export const ERROR_INTERNAL_ERROR = -32603;

// Tool callback type
export type ToolHandler = (arguments_: Record<string, unknown>) => Promise<MCPToolResult>;
// Resource callback type
export type ResourceHandler = (uri: string) => Promise<MCPContent>;
export type ResourceListHandler = () => Promise<MCPResource[]>;
// Prompt callback type
export type PromptHandler = (arguments_: Record<string, unknown>) => Promise<MCPContent>;

// Protocol events
export type ProtocolEventType = 
  | 'request' 
  | 'response' 
  | 'error' 
  | 'notification'
  | 'tools:list'
  | 'tools:call'
  | 'resources:list'
  | 'resources:read'
  | 'prompts:list'
  | 'prompts:get';

export interface ProtocolEvents {
  on(event: 'request', handler: (request: JSONRPCRequest) => void): this;
  on(event: 'response', handler: (response: JSONRPCResponse) => void): this;
  on(event: 'error', handler: (error: JSONRPCError) => void): this;
  on(event: 'notification', handler: (notification: JSONRPCNotification) => void): this;
  emit(event: 'request', request: JSONRPCRequest): boolean;
  emit(event: 'response', response: JSONRPCResponse): boolean;
  emit(event: 'error', error: JSONRPCError): boolean;
  emit(event: 'notification', notification: JSONRPCNotification): boolean;
}

export class MCPProtocol extends EventEmitter implements ProtocolEvents {
  private tools: Map<string, ToolHandler> = new Map();
  private toolDefinitions: Map<string, MCPTool> = new Map();
  private resources: Map<string, ResourceHandler> = new Map();
  private resourceDefinitions: Map<string, MCPResource> = new Map();
  private resourceTemplates: Map<string, ResourceListHandler> = new Map();
  private prompts: Map<string, PromptHandler> = new Map();
  private promptDefinitions: Map<string, MCPPrompt> = new Map();
  private capabilities: MCPServerCapabilities = {};

  constructor() {
    super();
  }

  setCapabilities(capabilities: MCPServerCapabilities): void {
    this.capabilities = capabilities;
  }

  getCapabilities(): MCPServerCapabilities {
    return this.capabilities;
  }

  // Tool management
  registerTool(name: string, definition: MCPTool, handler: ToolHandler): void {
    this.tools.set(name, handler);
    this.toolDefinitions.set(name, definition);
  }

  unregisterTool(name: string): void {
    this.tools.delete(name);
    this.toolDefinitions.delete(name);
  }

  getTool(name: string): ToolHandler | undefined {
    return this.tools.get(name);
  }

  getToolDefinition(name: string): MCPTool | undefined {
    return this.toolDefinitions.get(name);
  }

  listTools(): MCPTool[] {
    return Array.from(this.toolDefinitions.values());
  }

  // Resource management
  registerResource(uri: string, definition: MCPResource, handler: ResourceHandler): void {
    this.resources.set(uri, handler);
    this.resourceDefinitions.set(uri, definition);
  }

  registerResourceTemplate(uriTemplate: string, definition: MCPPromptArgument, handler: ResourceListHandler): void {
    this.resourceTemplates.set(uriTemplate, handler);
  }

  async readResource(uri: string): Promise<MCPContent | null> {
    const handler = this.resources.get(uri);
    if (handler) {
      return handler(uri);
    }
    return null;
  }

  listResources(): MCPResource[] {
    return Array.from(this.resourceDefinitions.values());
  }

  // Prompt management
  registerPrompt(name: string, definition: MCPPrompt, handler: PromptHandler): void {
    this.prompts.set(name, handler);
    this.promptDefinitions.set(name, definition);
  }

  async getPrompt(name: string, arguments_: Record<string, unknown>): Promise<MCPContent | null> {
    const handler = this.prompts.get(name);
    if (handler) {
      return handler(arguments_);
    }
    return null;
  }

  listPrompts(): MCPPrompt[] {
    return Array.from(this.promptDefinitions.values());
  }

  // Parse incoming message
  parseMessage(message: unknown): JSONRPCRequest | JSONRPCNotification | null {
    if (typeof message !== 'object' || message === null) {
      return null;
    }

    const msg = message as Record<string, unknown>;

    if (msg.jsonrpc !== '2.0') {
      return null;
    }

    if (typeof msg.method !== 'string') {
      return null;
    }

    if (msg.id !== undefined && msg.id !== null && typeof msg.id !== 'number' && typeof msg.id !== 'string') {
      return null;
    }

    if (msg.params !== undefined && typeof msg.params !== 'object') {
      return null;
    }

    if (msg.id === undefined || msg.id === null) {
      // Notification
      return {
        jsonrpc: '2.0',
        method: msg.method,
        params: msg.params as Record<string, unknown> | undefined,
      };
    }

    // Request
    return {
      jsonrpc: '2.0',
      id: msg.id,
      method: msg.method,
      params: msg.params as Record<string, unknown> | undefined,
    };
  }

  // Create error response
  createErrorResponse(id: number | string | null, code: number, message: string, data?: unknown): JSONRPCResponse {
    return {
      jsonrpc: '2.0',
      id,
      error: { code, message, data },
    };
  }

  // Create success response
  createResponse(id: number | string | null, result: unknown): JSONRPCResponse {
    return {
      jsonrpc: '2.0',
      id,
      result,
    };
  }

  // Handle incoming request
  async handleRequest(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    try {
      switch (request.method) {
        case 'tools/list':
          return this.createResponse(request.id, {
            tools: this.listTools(),
          });

        case 'tools/call':
          return this.handleToolCall(request.id, request.params);

        case 'resources/list':
          return this.createResponse(request.id, {
            resources: this.listResources(),
          });

        case 'resources/read':
          return this.handleResourceRead(request.id, request.params);

        case 'prompts/list':
          return this.createResponse(request.id, {
            prompts: this.listPrompts(),
          });

        case 'prompts/get':
          return this.handlePromptGet(request.id, request.params);

        case 'initialize':
          return this.handleInitialize(request.id, request.params);

        case 'ping':
          return this.createResponse(request.id, null);

        default:
          return this.createErrorResponse(
            request.id,
            ERROR_METHOD_NOT_FOUND,
            `Method not found: ${request.method}`
          );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal error';
      return this.createErrorResponse(request.id, ERROR_INTERNAL_ERROR, message);
    }
  }

  private async handleToolCall(id: number | string | null, params?: Record<string, unknown>): Promise<JSONRPCResponse> {
    if (!params || typeof params !== 'object') {
      return this.createErrorResponse(id, ERROR_INVALID_PARAMS, 'Invalid params');
    }

    const name = params.name as string;
    const arguments_ = (params.arguments as Record<string, unknown>) || {};

    if (!name || typeof name !== 'string') {
      return this.createErrorResponse(id, ERROR_INVALID_PARAMS, 'Tool name is required');
    }

    const handler = this.tools.get(name);
    if (!handler) {
      return this.createErrorResponse(id, ERROR_METHOD_NOT_FOUND, `Tool not found: ${name}`);
    }

    try {
      const result = await handler(arguments_);
      return this.createResponse(id, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tool execution failed';
      return this.createErrorResponse(id, ERROR_INTERNAL_ERROR, message);
    }
  }

  private async handleResourceRead(id: number | string | null, params?: Record<string, unknown>): Promise<JSONRPCResponse> {
    if (!params || typeof params !== 'object') {
      return this.createErrorResponse(id, ERROR_INVALID_PARAMS, 'Invalid params');
    }

    const uri = params.uri as string;
    if (!uri || typeof uri !== 'string') {
      return this.createErrorResponse(id, ERROR_INVALID_PARAMS, 'Resource URI is required');
    }

    const content = await this.readResource(uri);
    if (!content) {
      return this.createErrorResponse(id, ERROR_METHOD_NOT_FOUND, `Resource not found: ${uri}`);
    }

    return this.createResponse(id, { contents: [content] });
  }

  private async handlePromptGet(id: number | string | null, params?: Record<string, unknown>): Promise<JSONRPCResponse> {
    if (!params || typeof params !== 'object') {
      return this.createErrorResponse(id, ERROR_INVALID_PARAMS, 'Invalid params');
    }

    const name = params.name as string;
    const arguments_ = (params.arguments as Record<string, unknown>) || {};

    if (!name || typeof name !== 'string') {
      return this.createErrorResponse(id, ERROR_INVALID_PARAMS, 'Prompt name is required');
    }

    const content = await this.getPrompt(name, arguments_);
    if (!content) {
      return this.createErrorResponse(id, ERROR_METHOD_NOT_FOUND, `Prompt not found: ${name}`);
    }

    return this.createResponse(id, { messages: [{ role: 'assistant', content }] });
  }

  private handleInitialize(id: number | string | null, params?: Record<string, unknown>): JSONRPCResponse {
    // Return server capabilities
    return this.createResponse(id, {
      protocolVersion: '2024-11-05',
      capabilities: this.capabilities,
      serverInfo: {
        name: 'codepop-mcp-server',
        version: '1.0.0',
      },
    });
  }
}

export default MCPProtocol;

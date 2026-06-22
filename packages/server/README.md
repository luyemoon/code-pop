# @codepop/server

CodePop HTTP 服务器，提供 REST API 与 MCP 协议支持。

## 功能

- Express HTTP 服务器
- REST API 端点
- MCP (Model Context Protocol) 支持
- WebSocket 实时同步
- CORS 跨域支持

## 安装

```bash
pnpm install
```

## 开发

```bash
# 构建
pnpm build

# 开发模式（热重载）
pnpm dev

# 生产启动
pnpm start
```

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/search` | POST | 代码语义检索 |
| `/api/index` | POST | 索引代码文件 |
| `/api/status` | GET | 服务状态 |
| `/mcp` | WS | MCP 协议 WebSocket |

## 环境变量

- `PORT` - 服务器端口 (默认: 8080)
- `DATABASE_URL` - 数据库连接字符串
- `OPENAI_API_KEY` - OpenAI API Key

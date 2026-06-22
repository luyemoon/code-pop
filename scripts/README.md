# CodePop Scripts

CodePop 部署和维护脚本集合。

## 脚本列表

### 一键部署

```bash
./scripts/deploy.sh
```

Docker Compose 一键部署脚本，自动完成：
- 检查 Docker 环境
- 安装项目依赖 (pnpm)
- 配置环境变量
- 构建并启动所有服务
- 检查服务状态

**服务地址：**
- Web 界面: http://localhost
- API 服务: http://localhost:3000
- MCP 服务: http://localhost:3001

### 本地开发快速启动

```bash
./scripts/start-local.sh
```

快速启动本地开发环境：
- 安装 PostgreSQL (Docker)
- 启动开发服务器 (pnpm dev)
- 打开 Web 界面
- 实时查看开发日志

**服务地址：**
- Web 开发服务器: http://localhost:5173
- API 服务: http://localhost:3000
- MCP 服务: http://localhost:3001

### 嵌入式数据库启动

```bash
./scripts/start-embedded-db.sh
```

使用 SQLite 嵌入式数据库启动：
- 无需外部数据库依赖
- 适合快速测试和演示
- 自动配置 SQLite 数据库

**服务地址：**
- Web 开发服务器: http://localhost:5173
- API 服务: http://localhost:3000
- MCP 服务: http://localhost:3001
- 数据库: ./data/codepop.db (SQLite)

### 停止服务

```bash
./scripts/stop.sh
```

停止所有 CodePop 服务：
- 停止 Docker 容器
- 停止开发服务器
- 清理临时文件

**选项：**
- `./scripts/stop.sh --remove` - 删除所有容器和数据卷

### macOS App 构建

```bash
./scripts/build-macos.sh
```

构建 macOS 桌面应用：
- 安装依赖
- 构建 Electron 应用
- 生成 DMG 安装包

**输出：** `packages/macos/dist/`

### MCP 服务配置

```bash
./scripts/setup-mcp.sh
```

配置 Claude Code 与 CodePop MCP 服务器集成：
- 检测 Claude Code 安装
- 检测 CodePop MCP 服务器
- 配置 MCP 连接
- 测试连接状态

**选项：**
- `./scripts/setup-mcp.sh --test-only` - 仅测试连接
- `./scripts/setup-mcp.sh --remove` - 移除 MCP 配置

## 前置要求

- Docker Desktop (用于部署)
- Node.js 18+
- pnpm (`npm install -g pnpm`)
- macOS (用于构建 macOS App)

## 常见问题

### Docker 未安装

```bash
# macOS
brew install --cask docker

# 或下载 Docker Desktop
https://www.docker.com/products/docker-desktop
```

### pnpm 未安装

```bash
npm install -g pnpm
```

### PostgreSQL 连接失败

确保 Docker 容器正在运行：

```bash
docker ps | grep codepop-postgres
```

### API Key 未设置

编辑 `.env` 文件设置 `OPENAI_API_KEY`

## 环境变量

主要环境变量 (见 `.env`):

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `OPENAI_API_KEY` | OpenAI API Key | - |
| `POSTGRES_PASSWORD` | PostgreSQL 密码 | codepop123 |
| `DATABASE_URL` | 数据库连接 URL | postgresql://... |
| `NODE_ENV` | 运行环境 | development |
| `CODEPOP_PORT` | API 服务端口 | 3000 |
| `CODEPOP_MCP_PORT` | MCP 服务端口 | 3001 |

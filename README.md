<!--
CodePop 代码波普 - SEO Keywords
代码检索, AI代码检索, 向量数据库, pgvector, 语义搜索, Claude Code, Cursor AI, AI Agent, 代码索引, 代码搜索, 代码理解, RAG, 代码RAG, 代码向量化, Code Search, Semantic Code Search, Vector Database, AI Infrastructure
-->

# Code:Pop — 让代码,真正活着。

> **中文名：代码波普** · **代码,真正活着**  
> **🤖 AI INFRASTRUCTURE** · **代码专用检索基础设施**

---

<div align="center">

![Code:Pop 代码波普 Banner](https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=A%20modern%20pop-art%20style%20banner%20for%20CodePop%20AI%20code%20search%20tool%2C%20featuring%20bright%20pink%20cyan%20yellow%20colors%2C%20geometric%20shapes%2C%20code%20symbols%20floating%2C%20clean%20minimalist%20design%20with%20gradient%20background%2C%20tech%20startup%20aesthetic&image_size=landscape_16_9)

</div>

---

## 🎯 代码波普 (Code:Pop) — AI 代码检索基础设施

**代码波普（Code:Pop）** 是面向 **AI Agent** 的代码专用检索 **AI Infra** 项目。通过混合索引、智能检索与上下文压缩，为 Claude Code、Codex、Cursor 等编码 Agent 提供精准的代码上下文，降低幻觉率，提升代码理解深度。

> 💡 **代码波普**：让你的代码库像人一样"记住"每一个函数、每一次变更。AI 提问，代码自己"跳"出来。

### ✨ 核心优势

| 特性 | 说明 |
|------|------|
| 🚀 **开箱即用** | Docker 一键部署，5 分钟完成配置 |
| 🎯 **精准检索** | 向量 + 符号 + 图检索的混合索引 |
| 📊 **上下文压缩** | 智能 Token 控制，降低 API 成本 |
| 🔌 **多 Agent 支持** | 原生支持 Claude Code、Cursor、VS Code 等 |
| 🐘 **PostgreSQL + pgvector** | 成熟稳定，运维友好 |
| 🔒 **隐私优先** | 数据留在本机，不上传云端 |

---

## 🚀 快速开始

### 一键部署（推荐）

```bash
git clone https://github.com/luyemoon/code-pop.git
cd code-pop
./scripts/deploy.sh
```

详细指南请查看 [快速入门](./GETTING_STARTED.md)

### 支持的部署方式

| 方式 | 说明 | 适合场景 |
|------|------|----------|
| 🐳 **Docker 一键部署** | 包含 PostgreSQL，一行命令 | 快速体验、生产部署 |
| 💻 **本地开发** | pnpm + Docker Desktop | 开发调试 |
| 📱 **macOS 应用** | DMG 安装包 | macOS 用户 |
| 🔌 **纯 API 服务** | 无 Web 界面 | 极简部署 |

---

## 🎛️ 多端支持

### 1. Web 管理界面
- 仓库管理
- 实时索引进度
- 可视化搜索
- 系统设置

### 2. MCP Server (原生 AI Agent 支持)
```bash
# Claude Code
./scripts/setup-mcp.sh

# Cursor (settings.json)
{
  "mcpServers": {
    "codepop": {
      "url": "http://localhost:3001"
    }
  }
}
```

### 3. REST API
```bash
# 搜索代码
curl -X POST http://localhost:3000/api/search \
  -d '{"query": "用户认证"}'

# 添加仓库
curl -X POST http://localhost:3000/api/repos \
  -d '{"name": "my-project", "path": "/path/to/project"}'
```

### 4. macOS 原生应用
- 系统托盘常驻
- 全局快捷键 ⌘⇧C 快速搜索
- 原生 macOS 体验

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                     多端接入层                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │  Web UI  │ │ MCP Server│ │  REST API │ │macOS App│      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      核心服务层                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │ 代码索引器   │ │ 搜索服务    │ │ 嵌入服务    │          │
│  │(tree-sitter)│ │(混合检索)   │ │(OpenAI等)  │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                 数据库适配层 (Adapter)                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │ PostgreSQL  │ │   SQLite    │ │    Mock     │          │
│  │  + pgvector │ │  (嵌入式)   │ │   (测试)    │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 项目结构

```
codepop/
├── packages/
│   ├── core/           # 核心库（数据库适配层、索引器）
│   ├── server/         # HTTP Server + MCP Server
│   ├── cli/            # CLI 工具
│   ├── web/           # React Web 管理界面
│   └── macos/         # macOS 原生应用
├── docker/             # Docker 配置
├── scripts/             # 部署脚本
├── docs/               # 文档
├── GETTING_STARTED.md  # 快速入门
└── README.md
```

---

## 🔍 支持的 AI Agent

| Agent | 接入方式 | 状态 |
|-------|----------|------|
| **Claude Code** | MCP 原生 | ✅ 已支持 |
| **Cursor** | MCP Server | ✅ 已支持 |
| **VS Code (Copilot)** | REST API | ✅ 已支持 |
| **Codex** | REST API | ✅ 已支持 |
| **JetBrains IDEs** | REST API | ✅ 已支持 |
| **Vim/Neovim** | CLI | 🚧 开发中 |

---

## 🗄️ 数据库选项

| 数据库 | 说明 | 适合场景 |
|--------|------|----------|
| **PostgreSQL + pgvector** | 向量检索生产首选 | 生产环境 |
| **SQLite** | 嵌入式，无需安装 | 开发、测试 |
| **现有 PostgreSQL** | 连接已有数据库 | 企业环境 |

---

## 📈 性能指标

| 指标 | 目标值 |
|------|--------|
| 查询延迟 P95 | < 500ms |
| Top-5 命中率 | > 85% |
| Token 压缩率 | 60-80% |
| 增量同步延迟 | < 3s |
| 支持仓库规模 | 10万+ 文件 |

---

## 🚀 快速上手

### 方式 1: Docker 一键部署

```bash
git clone https://github.com/luyemoon/code-pop.git
cd code-pop
./scripts/deploy.sh
```

### 方式 2: 本地开发

```bash
# 安装依赖
pnpm install

# 启动 PostgreSQL
./scripts/start-local.sh

# 启动服务
pnpm dev
```

### 方式 3: macOS 应用

```bash
./scripts/build-macos.sh
# 或下载 DMG: https://github.com/luyemoon/code-pop/releases
```

详细指南：[快速入门](./GETTING_STARTED.md)

---

## 🤝 贡献指南

欢迎提交 PR 和 Issue！

```bash
# Fork 项目
# 创建分支
git checkout -b feature/your-feature

# 开发
pnpm install
pnpm dev

# 提交
git commit -m "feat: add your feature"
git push origin feature/your-feature

# 创建 PR
```

---

## 📄 许可证

MIT License

---

## 📞 联系方式

- 官方网站: https://codepop.cn (开发中)
- GitHub: https://github.com/luyemoon/code-pop
- 问题反馈: https://github.com/luyemoon/code-pop/issues
- 文档: https://github.com/luyemoon/code-pop/blob/main/GETTING_STARTED.md

---

<div align="center">

**🎨 POP. ART. CODE. ALIVE. 🎨**

**让代码真正活着，让 AI 真正理解。**

</div>

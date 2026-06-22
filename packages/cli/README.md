# @codepop/cli

CodePop 命令行工具，代码检索客户端。

## 功能

- 交互式代码检索
- 仓库监听与增量索引
- 支持 Claude Code、Cursor 等 Agent

## 安装

```bash
pnpm install -g
```

## 使用

```bash
# 代码检索
codepop search "用户登录的 JWT 验证"

# 监听模式
codepop watch ~/projects/my-repo

# 同步仓库
codepop sync

# 查看状态
codepop status
```

## 配置

配置文件位于 `~/.codepop/config.json`:
```json
{
  "serverUrl": "http://localhost:8080",
  "defaultRepo": "/path/to/repo"
}
```

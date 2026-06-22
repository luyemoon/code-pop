# CodePop SwiftUI macOS 客户端

面向 AI Agent 的代码检索基础设施 CodePop 的原生 macOS 客户端，使用 SwiftUI 构建。

## 功能

- 代码语义搜索（对接 Python FastAPI 后端）
- 仓库管理（添加、删除、重建索引）
- 系统状态监控
- API 端点设置
- Pop Art 风格界面

## 环境要求

- macOS 13+
- Xcode 15+ / Swift 5.9+
- 已启动 CodePop Python 后端（默认 `http://localhost:3000/api`）

## 本地运行

```bash
cd packages/macos-swift
swift build
swift run CodePop
```

## 打包为 .app / DMG

```bash
cd packages/macos-swift
./scripts/build-dmg.sh
```

输出：

- `.build/release/CodePop.app`
- `.build/release/CodePop-*.dmg`

## 项目结构

```
Sources/CodePop/
├── CodePopApp.swift       # App 入口
├── Models/                # 数据模型
├── Services/              # API 服务层
├── ViewModels/            # 状态管理
├── Views/                 # SwiftUI 视图
└── Theme/                 # Pop Art 主题
```

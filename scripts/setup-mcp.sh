#!/bin/bash
# =============================================================================
# CodePop MCP 服务配置脚本
# 用于配置 Claude Code 与 CodePop MCP 服务器的集成
# 使用方法: ./scripts/setup-mcp.sh
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Functions
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# Detect Claude Code installation
detect_claude_code() {
  log_step "检测 Claude Code 安装..."
  
  local claude_path=""
  
  # Check common locations
  if command -v claude &> /dev/null; then
    claude_path=$(which claude)
    log_info "找到 Claude Code: $claude_path"
  elif [ -f "/usr/local/bin/claude" ]; then
    claude_path="/usr/local/bin/claude"
    log_info "找到 Claude Code: $claude_path"
  elif [ -f "$HOME/.local/bin/claude" ]; then
    claude_path="$HOME/.local/bin/claude"
    log_info "找到 Claude Code: $claude_path"
  else
    log_error "未找到 Claude Code，请先安装"
    log_info "安装指南: https://docs.anthropic.com/claude-code"
    return 1
  fi
  
  # Get Claude Code version
  local version=$(claude --version 2>/dev/null || echo "unknown")
  log_info "Claude Code 版本: $version"
  
  echo $claude_path
}

# Detect CodePop MCP server
detect_codepop_mcp() {
  log_step "检测 CodePop MCP 服务器..."
  
  # Check if server is running
  if curl -s http://localhost:3001/health &> /dev/null; then
    log_info "CodePop MCP 服务器正在运行: http://localhost:3001"
    MCP_URL="http://localhost:3001"
  elif curl -s http://localhost:3000/health &> /dev/null; then
    log_info "CodePop API 服务器正在运行: http://localhost:3000"
    log_info "MCP 服务可能需要单独启动"
    MCP_URL="http://localhost:3000"
  else
    log_warn "CodePop 服务器未运行"
    log_info "启动服务器后，MCP 服务将在 http://localhost:3001 提供"
    MCP_URL="http://localhost:3001"
  fi
  
  echo $MCP_URL
}

# Configure MCP settings
configure_mcp() {
  log_step "配置 CodePop MCP 服务器..."
  
  # Determine config directory
  local config_dir="$HOME/Library/Application Support/Claude"
  local config_file="$config_dir/settings.json"
  
  # Fallback for older Claude versions
  if [ ! -d "$config_dir" ]; then
    config_dir="$HOME/.config/claude"
    config_file="$config_dir/settings.json"
  fi
  
  log_info "配置文件: $config_file"
  
  # Create config directory if not exists
  mkdir -p "$config_dir"
  
  # Create or update settings
  local mcp_config='{
  "mcpServers": {
    "codepop": {
      "command": "node",
      "args": ["'"$(pwd)"'/packages/server/dist/mcp/index.js"],
      "env": {
        "CODEPOP_URL": "'"$MCP_URL"'"
      }
    }
  }
}'
  
  # Check if settings.json exists
  if [ -f "$config_file" ]; then
    log_info "检测到现有配置文件，正在合并..."
    # Note: In production, use jq or similar for proper JSON merging
    log_warn "请手动将以下配置添加到 $config_file"
    echo ""
    echo "$mcp_config"
    echo ""
  else
    log_info "创建配置文件..."
    echo "$mcp_config" > "$config_file"
    log_info "配置文件已创建"
  fi
}

# Alternative: Add via claude command
configure_via_claude() {
  log_step "尝试通过 claude 命令配置..."
  
  if claude mcp --help &> /dev/null; then
    log_info "使用 claude mcp 命令添加 CodePop..."
    claude mcp add codepop http://localhost:3001
    log_info "MCP 服务器已添加"
  else
    log_warn "claude mcp 命令不可用，请手动配置"
  fi
}

# Test connection
test_connection() {
  log_step "测试 MCP 连接..."
  
  if ! curl -s http://localhost:3001/health &> /dev/null; then
    log_warn "MCP 服务器未运行，无法测试连接"
    log_info "请先启动 CodePop 服务器"
    return 1
  fi
  
  log_info "测试 MCP 协议端点..."
  
  # Try to connect to MCP
  local response=$(curl -s -X POST http://localhost:3001/mcp \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"initialize","params":{},"id":1}' 2>/dev/null)
  
  if [ -n "$response" ]; then
    log_info "MCP 服务器响应: $response"
    log_info "连接测试成功！"
  else
    log_warn "MCP 服务器可能尚未就绪"
  fi
}

# Verify setup
verify_setup() {
  log_step "验证配置..."
  
  # Check Claude config
  local config_file="$HOME/Library/Application Support/Claude/settings.json"
  if [ ! -d "$HOME/Library/Application Support/Claude" ]; then
    config_file="$HOME/.config/claude/settings.json"
  fi
  
  if [ -f "$config_file" ]; then
    if grep -q "codepop" "$config_file" 2>/dev/null; then
      log_info "配置文件中已包含 CodePop MCP 设置"
    else
      log_warn "配置文件未包含 CodePop MCP 设置"
    fi
  fi
  
  # Check if CodePop server is accessible
  if curl -s http://localhost:3001/health &> /dev/null; then
    log_info "CodePop MCP 服务器状态: 运行中"
  else
    log_warn "CodePop MCP 服务器状态: 未运行"
    log_info "请运行 ./scripts/start-local.sh 或 ./scripts/deploy.sh"
  fi
}

# Show usage
show_usage() {
  echo ""
  echo "========================================"
  echo "  CodePop MCP 配置完成"
  echo "========================================"
  echo ""
  log_info "下一步操作:"
  echo ""
  echo "1. 重启 Claude Code"
  echo "   - 完全退出 Claude Code"
  echo "   - 重新启动 Claude Code"
  echo ""
  echo "2. 验证 MCP 连接"
  echo "   - 在 Claude Code 中运行: /mcp"
  echo "   - 应该看到 codepop 在已连接的服务器列表中"
  echo ""
  echo "3. 使用 CodePop"
  echo "   - /search <查询> - 搜索代码库"
  echo "   - /index <仓库> - 索引仓库"
  echo "   - /repos - 列出已索引的仓库"
  echo ""
  echo "========================================"
  echo "  手动配置选项"
  echo "========================================"
  echo ""
  log_info "如需手动配置，请在 Claude Code 设置中添加:"
  echo ""
  echo '{
  "mcpServers": {
    "codepop": {
      "url": "http://localhost:3001"
    }
  }
}'
  echo ""
}

# Main
main() {
  echo ""
  echo "========================================"
  echo "  CodePop MCP 服务配置脚本"
  echo "  Claude Code 集成设置"
  echo "========================================"
  echo ""
  
  local claude_path=$(detect_claude_code)
  local mcp_url=$(detect_codepop_mcp)
  
  configure_mcp
  configure_via_claude
  test_connection
  verify_setup
  show_usage
}

# Parse arguments
case "${1:-}" in
  -h|--help)
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help       显示帮助信息"
    echo "  -v, --verbose    显示详细输出"
    echo "  --test-only      仅测试连接"
    echo "  --remove         移除 CodePop MCP 配置"
    echo ""
    exit 0
    ;;
  -v|--verbose)
    set -x
    ;;
  --test-only)
    detect_codepop_mcp
    test_connection
    exit 0
    ;;
  --remove)
    log_step "移除 CodePop MCP 配置..."
    local config_file="$HOME/Library/Application Support/Claude/settings.json"
    if [ -f "$config_file" ]; then
      # Note: In production, use jq for proper JSON removal
      log_warn "请手动从 $config_file 删除 codepop 配置"
    fi
    log_info "如需使用 claude 命令移除: claude mcp remove codepop"
    exit 0
    ;;
esac

main "$@"

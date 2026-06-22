#!/bin/bash
# =============================================================================
# CodePop 嵌入式数据库快速启动脚本
# 使用 SQLite 数据库，无需外部数据库依赖
# 使用方法: ./scripts/start-embedded-db.sh
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

# Check prerequisites
check_prereq() {
  log_step "检查系统环境..."
  
  if ! command -v node &> /dev/null; then
    log_error "Node.js 未安装"
    exit 1
  fi
  
  if ! command -v pnpm &> /dev/null; then
    log_error "pnpm 未安装，请运行: npm install -g pnpm"
    exit 1
  fi
  
  log_info "Node.js 版本: $(node --version)"
  log_info "pnpm 版本: $(pnpm --version)"
  log_info "环境检查通过"
}

# Install dependencies
install_deps() {
  log_step "安装依赖..."
  
  if command -v corepack &> /dev/null; then
    corepack enable
  fi
  
  pnpm install
  log_info "依赖安装完成"
}

# Setup environment for SQLite
setup_env() {
  log_step "配置嵌入式数据库环境..."
  
  # Create .env if not exists
  if [ ! -f .env ]; then
    if [ -f docker/.env.example ]; then
      cp docker/.env.example .env
    fi
  fi
  
  # Set SQLite database URL
  log_info "配置 SQLite 数据库..."
  
  # Backup existing DATABASE_URL if set to PostgreSQL
  if grep -q "DATABASE_URL=postgresql" .env 2>/dev/null; then
    log_warn "检测到 PostgreSQL 配置，将切换为 SQLite"
    sed -i '' 's|^DATABASE_URL=.*|DATABASE_URL=sqlite://./data/codepop.db|' .env 2>/dev/null || \
    sed -i 's|^DATABASE_URL=.*|DATABASE_URL=sqlite://./data/codepop.db|' .env
  fi
  
  # Add SQLite config if not present
  if ! grep -q "DATABASE_URL=" .env 2>/dev/null; then
    echo "DATABASE_URL=sqlite://./data/codepop.db" >> .env
  fi
  
  # Set development mode
  if grep -q "NODE_ENV=" .env 2>/dev/null; then
    sed -i '' 's/NODE_ENV=.*/NODE_ENV=development/' .env 2>/dev/null || \
    sed -i 's/NODE_ENV=.*/NODE_ENV=development/' .env
  else
    echo "NODE_ENV=development" >> .env
  fi
  
  # Create data directory
  mkdir -p data
  log_info "数据目录: $(pwd)/data"
}

# Initialize database
init_db() {
  log_step "初始化 SQLite 数据库..."
  
  # Check if database exists
  if [ -f data/codepop.db ]; then
    log_info "数据库已存在，跳过初始化"
    return 0
  fi
  
  log_info "创建数据库..."
  
  # Try to run server once to initialize database
  cd packages/server
  timeout 10 pnpm dev || true
  cd ../..
  
  if [ -f data/codepop.db ]; then
    log_info "数据库初始化成功"
  else
    log_warn "数据库可能未自动创建，将在首次启动时创建"
  fi
}

# Start development servers
start_dev_servers() {
  log_step "启动开发服务器..."
  
  echo ""
  log_info "即将启动以下服务 (SQLite 模式):"
  echo "  - API Server: http://localhost:3000"
  echo "  - MCP Server: http://localhost:3001"
  echo "  - Web Dev Server: http://localhost:5173"
  echo ""
  
  # Create necessary directories
  mkdir -p repos logs
  
  # Start servers
  log_info "启动服务中..."
  pnpm dev &> /tmp/codepop-sqlite-dev.log &
  
  # Wait for services to start
  log_info "等待服务启动..."
  sleep 15
  
  # Check if services are running
  local attempt=0
  local max_attempts=30
  
  while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:3000/health &> /dev/null; then
      log_info "API 服务已启动: http://localhost:3000"
      break
    fi
    attempt=$((attempt + 1))
    sleep 2
  done
  
  if curl -s http://localhost:3001/health &> /dev/null; then
    log_info "MCP 服务已启动: http://localhost:3001"
  fi
  
  if curl -s http://localhost:5173 &> /dev/null; then
    log_info "Web 开发服务器已启动: http://localhost:5173"
  fi
}

# Open web interface
open_web() {
  log_step "打开 Web 界面..."
  
  if command -v open &> /dev/null; then
    open http://localhost:5173
  elif command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:5173
  else
    log_warn "无法自动打开浏览器，请手动访问 http://localhost:5173"
  fi
}

# Show status
show_status() {
  echo ""
  log_info "服务状态:"
  echo ""
  log_info "进程列表:"
  ps aux | grep -E "node|vite" | grep -v grep | head -5
  echo ""
  log_info "数据库文件:"
  ls -lh data/codepop.db 2>/dev/null || echo "  数据库文件尚未创建"
  echo ""
  log_info "开发日志: tail -f /tmp/codepop-sqlite-dev.log"
  echo ""
}

# Main
main() {
  echo ""
  echo "========================================"
  echo "  CodePop 嵌入式数据库快速启动"
  echo "  (SQLite - 无需外部数据库)"
  echo "========================================"
  echo ""
  
  check_prereq
  install_deps
  setup_env
  init_db
  start_dev_servers
  show_status
  
  echo ""
  echo "========================================"
  echo "  启动完成！"
  echo "========================================"
  echo ""
  log_info "Web 界面: ${BLUE}http://localhost:5173${NC}"
  log_info "API 服务: ${BLUE}http://localhost:3000${NC}"
  log_info "MCP 服务: ${BLUE}http://localhost:3001${NC}"
  log_info "数据库: ${BLUE}SQLite (./data/codepop.db)${NC}"
  echo ""
  log_warn "按 Ctrl+C 停止服务"
  echo ""
  
  # Wait for interrupt
  trap "log_info '正在停止服务...'; pkill -f 'pnpm dev' 2>/dev/null || true; exit 0" INT TERM
  
  tail -f /tmp/codepop-sqlite-dev.log 2>/dev/null || sleep infinity
}

main "$@"

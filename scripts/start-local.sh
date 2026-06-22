#!/bin/bash
# =============================================================================
# CodePop 本地开发快速启动脚本
# 使用方法: ./scripts/start-local.sh
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

# Get docker compose command
get_docker_compose() {
  if docker compose version &> /dev/null; then
    echo "docker compose"
  else
    echo "docker-compose"
  fi
}

DOCKER_COMPOSE=$(get_docker_compose)

# Check prerequisites
check_prereq() {
  log_step "检查系统环境..."
  
  if ! command -v docker &> /dev/null; then
    log_error "Docker 未安装，请先安装 Docker Desktop"
    exit 1
  fi
  
  if ! command -v pnpm &> /dev/null; then
    log_error "pnpm 未安装，请运行: npm install -g pnpm"
    exit 1
  fi
  
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

# Start PostgreSQL via Docker
start_postgres() {
  log_step "启动 PostgreSQL..."
  
  # Check if PostgreSQL container already exists
  if docker ps -a --format '{{.Names}}' | grep -q '^codepop-postgres$'; then
    if docker ps --format '{{.Names}}' | grep -q '^codepop-postgres$'; then
      log_info "PostgreSQL 容器已在运行"
    else
      log_info "启动已有 PostgreSQL 容器..."
      $DOCKER_COMPOSE -f docker/docker-compose.yml start postgres
    fi
  else
    log_info "创建 PostgreSQL 容器..."
    $DOCKER_COMPOSE -f docker/docker-compose.yml up -d postgres
  fi
  
  # Wait for PostgreSQL to be ready
  log_info "等待 PostgreSQL 就绪..."
  local max_attempts=30
  local attempt=0
  while [ $attempt -lt $max_attempts ]; do
    if $DOCKER_COMPOSE -f docker/docker-compose.yml exec -T postgres pg_isready -U postgres &> /dev/null; then
      log_info "PostgreSQL 已就绪"
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 2
  done
  
  log_error "PostgreSQL 启动超时"
  return 1
}

# Setup environment
setup_env() {
  log_step "配置环境变量..."
  
  if [ ! -f .env ]; then
    cp docker/.env.example .env
    log_warn "已创建 .env 文件，请编辑设置 API Key"
  fi
  
  # Set development environment
  if grep -q "NODE_ENV=" .env 2>/dev/null; then
    sed -i '' 's/NODE_ENV=.*/NODE_ENV=development/' .env 2>/dev/null || \
    sed -i 's/NODE_ENV=.*/NODE_ENV=development/' .env
  else
    echo "NODE_ENV=development" >> .env
  fi
}

# Start development servers
start_dev_servers() {
  log_step "启动开发服务器..."
  
  echo ""
  log_info "即将启动以下服务:"
  echo "  - API Server: http://localhost:3000"
  echo "  - MCP Server: http://localhost:3001"
  echo "  - Web Dev Server: http://localhost:5173"
  echo ""
  
  # Start servers in background
  log_info "启动服务中..."
  pnpm dev &> /tmp/codepop-dev.log &
  
  # Wait for services to start
  log_info "等待服务启动..."
  sleep 10
  
  # Check if services are running
  if curl -s http://localhost:3000/health &> /dev/null; then
    log_info "API 服务已启动: http://localhost:3000"
  fi
  
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
  $DOCKER_COMPOSE -f docker/docker-compose.yml ps
  echo ""
  log_info "开发日志: tail -f /tmp/codepop-dev.log"
  echo ""
}

# Main
main() {
  echo ""
  echo "========================================"
  echo "  CodePop 本地开发快速启动"
  echo "========================================"
  echo ""
  
  check_prereq
  install_deps
  setup_env
  start_postgres
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
  echo ""
  log_warn "按 Ctrl+C 停止服务"
  echo ""
  
  # Wait for interrupt
  trap "log_info '正在停止服务...'; pkill -f 'pnpm dev' 2>/dev/null || true; exit 0" INT TERM
  
  tail -f /tmp/codepop-dev.log 2>/dev/null || sleep infinity
}

main "$@"

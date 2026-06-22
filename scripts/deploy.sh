#!/bin/bash
# =============================================================================
# CodePop 一键部署脚本
# 使用方法: ./scripts/deploy.sh
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
  
  # Check Docker
  if ! command -v docker &> /dev/null; then
    log_error "Docker 未安装，请先安装 Docker Desktop"
    log_info "下载地址: https://www.docker.com/products/docker-desktop"
    exit 1
  fi
  
  # Check Docker Compose
  if ! docker compose version &> /dev/null && ! docker-compose --version &> /dev/null; then
    log_error "Docker Compose 未安装"
    exit 1
  fi
  
  # Get docker compose command
  if docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
  else
    DOCKER_COMPOSE="docker-compose"
  fi
  
  log_info "Docker 版本: $(docker --version | cut -d' ' -f3 | cut -d',' -f1)"
  log_info "Docker Compose 已就绪"
}

# Install dependencies
install_deps() {
  log_step "安装项目依赖..."
  
  # Check Node.js
  if ! command -v node &> /dev/null; then
    log_warn "Node.js 未安装，尝试使用 corepack..."
  fi
  
  # Enable corepack for pnpm
  if command -v corepack &> /dev/null; then
    log_info "启用 corepack..."
    corepack enable
    corepack prepare pnpm@latest --activate
  fi
  
  # Check pnpm
  if ! command -v pnpm &> /dev/null; then
    log_error "pnpm 未安装，请运行: npm install -g pnpm"
    exit 1
  fi
  
  log_info "pnpm 版本: $(pnpm --version)"
  
  # Install dependencies
  log_info "安装所有 workspace 依赖..."
  pnpm install
  
  log_info "依赖安装完成"
}

# Setup environment
setup_env() {
  log_step "配置环境变量..."
  
  if [ ! -f .env ]; then
    if [ -f docker/.env.example ]; then
      cp docker/.env.example .env
      log_warn "已创建 .env 文件，请编辑设置必要的 API Key"
      log_info ".env 文件位置: $(pwd)/.env"
    else
      log_warn "未找到 .env.example 文件"
    fi
  else
    log_info ".env 文件已存在"
  fi
  
  # Check critical env vars
  if [ -f .env ]; then
    source .env 2>/dev/null || true
    if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "sk-your-openai-api-key-here" ]; then
      log_warn "请在 .env 中设置 OPENAI_API_KEY"
    fi
  fi
}

# Build and deploy
deploy() {
  log_step "构建 Docker 镜像..."
  
  # Build images
  log_info "构建 CodePop Server 镜像..."
  $DOCKER_COMPOSE -f docker/docker-compose.yml build codepop
  
  log_info "构建 Web 界面镜像..."
  $DOCKER_COMPOSE -f docker/docker-compose.yml build web
  
  log_step "启动服务..."
  $DOCKER_COMPOSE -f docker/docker-compose.yml up -d
  
  log_info "等待服务启动..."
  
  # Wait for PostgreSQL
  log_info "等待 PostgreSQL 就绪..."
  local max_attempts=30
  local attempt=0
  while [ $attempt -lt $max_attempts ]; do
    if $DOCKER_COMPOSE -f docker/docker-compose.yml exec -T postgres pg_isready -U postgres &> /dev/null; then
      log_info "PostgreSQL 已就绪"
      break
    fi
    attempt=$((attempt + 1))
    sleep 2
  done
  
  if [ $attempt -eq $max_attempts ]; then
    log_error "PostgreSQL 启动超时"
    exit 1
  fi
  
  # Wait for server
  log_info "等待 API 服务就绪..."
  attempt=0
  while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:3000/health &> /dev/null; then
      log_info "API 服务已就绪"
      break
    fi
    attempt=$((attempt + 1))
    sleep 2
  done
  
  if [ $attempt -eq $max_attempts ]; then
    log_warn "API 服务可能尚未就绪，请稍后检查"
  fi
  
  sleep 5
}

# Show status
show_status() {
  log_step "检查服务状态..."
  echo ""
  $DOCKER_COMPOSE -f docker/docker-compose.yml ps
  echo ""
  log_info "服务状态检查完成"
}

# Main
main() {
  echo ""
  echo "========================================"
  echo "  CodePop 一键部署脚本"
  echo "========================================"
  echo ""
  
  check_prereq
  install_deps
  setup_env
  deploy
  show_status
  
  echo ""
  echo "========================================"
  echo "  部署完成！"
  echo "========================================"
  echo ""
  log_info "Web 界面: ${BLUE}http://localhost${NC}"
  log_info "API 服务: ${BLUE}http://localhost:3000${NC}"
  log_info "MCP 服务: ${BLUE}http://localhost:3001${NC}"
  echo ""
  log_warn "如需停止服务，请运行: ./scripts/stop.sh"
  echo ""
}

# Run main
main "$@"

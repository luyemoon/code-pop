#!/bin/bash
# =============================================================================
# CodePop 停止所有服务脚本
# 使用方法: ./scripts/stop.sh
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

# Get docker compose command
get_docker_compose() {
  if docker compose version &> /dev/null; then
    echo "docker compose"
  else
    echo "docker-compose"
  fi
}

DOCKER_COMPOSE=$(get_docker_compose)

# Stop Docker containers
stop_docker() {
  log_info "停止 Docker 容器..."
  
  # Check if containers are running
  if ! $DOCKER_COMPOSE -f docker/docker-compose.yml ps &> /dev/null; then
    log_warn "没有正在运行的 Docker 容器"
    return 0
  fi
  
  $DOCKER_COMPOSE -f docker/docker-compose.yml stop
  log_info "Docker 容器已停止"
}

# Stop development servers
stop_dev_servers() {
  log_info "停止开发服务器..."
  
  # Kill pnpm dev processes
  if pkill -f "pnpm dev" 2>/dev/null; then
    log_info "pnpm dev 进程已停止"
  fi
  
  # Kill any node processes related to codepop
  local killed=0
  for pid in $(ps aux | grep -E "node.*codepop|vite" | grep -v grep | awk '{print $2}'); do
    kill $pid 2>/dev/null && log_info "已停止进程: $pid" && killed=1
  done
  
  if [ $killed -eq 0 ]; then
    log_info "没有正在运行的开发服务器"
  fi
}

# Clean up
cleanup() {
  log_info "清理临时文件..."
  
  # Clean log files
  if [ -f /tmp/codepop-dev.log ]; then
    rm -f /tmp/codepop-dev.log
    log_info "已删除开发日志"
  fi
  
  if [ -f /tmp/codepop-sqlite-dev.log ]; then
    rm -f /tmp/codepop-sqlite-dev.log
    log_info "已删除 SQLite 开发日志"
  fi
}

# Show status
show_status() {
  echo ""
  log_info "当前运行状态:"
  echo ""
  
  # Check Docker containers
  echo "Docker 容器:"
  $DOCKER_COMPOSE -f docker/docker-compose.yml ps 2>/dev/null || echo "  无"
  echo ""
  
  # Check processes
  echo "相关进程:"
  local procs=$(ps aux | grep -E "codepop|vite|node" | grep -v grep | wc -l)
  if [ $procs -gt 0 ]; then
    ps aux | grep -E "codepop|vite|node" | grep -v grep | head -5
  else
    echo "  无相关进程运行"
  fi
  echo ""
}

# Main
main() {
  echo ""
  echo "========================================"
  echo "  CodePop 停止服务"
  echo "========================================"
  echo ""
  
  stop_docker
  stop_dev_servers
  cleanup
  show_status
  
  echo ""
  echo "========================================"
  echo "  停止完成"
  echo "========================================"
  echo ""
  log_info "如需重新部署，请运行: ./scripts/deploy.sh"
  log_info "或快速启动开发模式: ./scripts/start-local.sh"
  echo ""
}

# Parse arguments
case "${1:-}" in
  -h|--help)
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help     显示帮助信息"
    echo "  -v, --verbose  显示详细输出"
    echo "  --remove       停止并删除容器和卷"
    echo ""
    exit 0
    ;;
  -v|--verbose)
    set -x
    ;;
  --remove)
    log_warn "将删除所有容器和数据卷..."
    $DOCKER_COMPOSE -f docker/docker-compose.yml down -v
    log_info "容器和数据卷已删除"
    exit 0
    ;;
esac

main "$@"

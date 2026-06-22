#!/bin/bash
# =============================================================================
# CodePop macOS App 构建脚本
# 使用方法: ./scripts/build-macos.sh
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
  
  # Check macOS
  if [[ "$OSTYPE" != "darwin"* ]]; then
    log_error "此脚本仅适用于 macOS 系统"
    exit 1
  fi
  
  # Check Node.js
  if ! command -v node &> /dev/null; then
    log_error "Node.js 未安装"
    exit 1
  fi
  
  # Check pnpm
  if ! command -v pnpm &> /dev/null; then
    log_error "pnpm 未安装"
    exit 1
  fi
  
  # Check Xcode command line tools
  if ! command -v xcodebuild &> /dev/null; then
    log_warn "Xcode 命令行工具未安装"
    log_info "请运行: xcode-select --install"
    exit 1
  fi
  
  log_info "macOS 版本: $(sw_vers -productVersion)"
  log_info "Node.js 版本: $(node --version)"
  log_info "pnpm 版本: $(pnpm --version)"
  log_info "环境检查通过"
}

# Install dependencies
install_deps() {
  log_step "安装项目依赖..."
  
  if command -v corepack &> /dev/null; then
    corepack enable
  fi
  
  pnpm install
  log_info "依赖安装完成"
}

# Install Electron Builder dependencies
install_electron_deps() {
  log_step "安装 Electron 构建依赖..."
  
  # Install Wine for DMG creation on macOS
  if ! command -v wine &> /dev/null; then
    log_info "安装 Wine (用于创建 DMG)..."
    if command -v brew &> /dev/null; then
      brew install wine
    else
      log_warn "Homebrew 未安装，跳过 Wine 安装"
      log_warn "DMG 可能无法创建，将生成 zip 包"
    fi
  fi
  
  log_info "Electron 构建依赖检查完成"
}

# Build all packages
build_packages() {
  log_step "构建所有 packages..."
  
  pnpm build
  log_info "所有包构建完成"
}

# Build macOS app
build_macos_app() {
  log_step "构建 macOS 应用..."
  
  cd packages/macos
  
  # Check if electron-builder is configured
  if [ ! -f electron-builder.yml ]; then
    log_error "electron-builder.yml 配置文件不存在"
    exit 1
  fi
  
  # Build Electron app
  log_info "运行 electron-builder..."
  pnpm run build:mac
  
  cd ../..
  
  log_info "macOS 应用构建完成"
}

# Create DMG
create_dmg() {
  log_step "创建 DMG 安装包..."
  
  local dist_dir="packages/macos/dist"
  
  if [ ! -d "$dist_dir" ]; then
    log_error "构建输出目录不存在: $dist_dir"
    return 1
  fi
  
  # Check for built app
  local app_file=$(ls "$dist_dir"/*.app 2>/dev/null | head -1)
  if [ -z "$app_file" ]; then
    log_warn "未找到 .app 文件，DMG 创建失败"
    return 1
  fi
  
  log_info "应用文件: $app_file"
  log_info "DMG 将在 electron-builder 完成后生成"
}

# Show output
show_output() {
  echo ""
  log_step "构建输出:"
  echo ""
  
  local dist_dir="packages/macos/dist"
  
  if [ -d "$dist_dir" ]; then
    echo "输出目录: $dist_dir"
    echo ""
    echo "文件列表:"
    ls -lh "$dist_dir"/
    echo ""
    
    # Show DMG if exists
    local dmg_file=$(ls "$dist_dir"/*.dmg 2>/dev/null | head -1)
    if [ -n "$dmg_file" ]; then
      log_info "DMG 安装包: $dmg_file"
      log_info "大小: $(ls -lh "$dmg_file" | awk '{print $5}')"
    fi
    
    # Show zip if exists
    local zip_file=$(ls "$dist_dir"/*.zip 2>/dev/null | head -1)
    if [ -n "$zip_file" ]; then
      log_info "ZIP 包: $zip_file"
      log_info "大小: $(ls -lh "$zip_file" | awk '{print $5}')"
    fi
  else
    log_warn "输出目录不存在"
  fi
}

# Verify signature
verify_signature() {
  log_step "验证应用签名..."
  
  local app_name="CodePop.app"
  local app_path="packages/macos/dist/$app_name"
  
  if [ ! -d "$app_path" ]; then
    log_warn "应用不存在，跳过签名验证"
    return 0
  fi
  
  # Check if signed
  if codesign -dvvv "$app_path" &> /dev/null; then
    log_info "应用已签名"
    codesign -dvvv "$app_path" 2>/dev/null | head -3
  else
    log_warn "应用未签名 (需要开发者证书)"
  fi
}

# Main
main() {
  echo ""
  echo "========================================"
  echo "  CodePop macOS App 构建脚本"
  echo "========================================"
  echo ""
  
  check_prereq
  install_deps
  install_electron_deps
  build_packages
  build_macos_app
  create_dmg
  show_output
  verify_signature
  
  echo ""
  echo "========================================"
  echo "  构建完成！"
  echo "========================================"
  echo ""
  log_info "输出目录: packages/macos/dist/"
  log_info ""
  log_warn "如需分发，请先签名应用或使用 ad-hoc 签名"
  log_info "签名命令: codesign -s -f ./packages/macos/dist/CodePop.app"
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
    echo "  --no-install   跳过依赖安装"
    echo ""
    exit 0
    ;;
  -v|--verbose)
    set -x
    ;;
  --no-install)
    SKIP_INSTALL=true
    ;;
esac

if [ "$SKIP_INSTALL" != "true" ]; then
  main "$@"
else
  build_packages
  build_macos_app
  show_output
fi

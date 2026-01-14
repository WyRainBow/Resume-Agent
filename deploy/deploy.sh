#!/bin/bash

# 快速部署脚本
# 使用方法: ./deploy.sh

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  简历生成系统 - 快速部署${NC}"
echo -e "${BLUE}========================================${NC}"

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}错误: 未安装 Docker${NC}"
    echo -e "${YELLOW}请先安装 Docker:${NC}"
    echo "  curl -fsSL https://get.docker.com -o get-docker.sh"
    echo "  sh get-docker.sh"
    exit 1
fi

# 检查 Docker Compose
if ! command -v docker compose &> /dev/null; then
    echo -e "${RED}错误: 未安装 Docker Compose${NC}"
    exit 1
fi

# 检查 .env 文件
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}警告: 未找到 .env 文件${NC}"
    echo -e "${YELLOW}请创建 .env 文件并配置必要的环境变量${NC}"
    read -p "是否继续？(y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 拉取最新代码（如果在 Git 仓库中）
if [ -d ".git" ]; then
    echo -e "${YELLOW}拉取最新代码...${NC}"
    git pull || echo -e "${YELLOW}警告: Git pull 失败，继续使用当前代码${NC}"
fi

# 构建镜像
echo -e "${YELLOW}构建 Docker 镜像...${NC}"
docker compose build

# 启动服务
echo -e "${YELLOW}启动服务...${NC}"
docker compose up -d

# 等待服务启动
echo -e "${YELLOW}等待服务启动...${NC}"
sleep 5

# 检查服务状态
echo -e "${YELLOW}检查服务状态...${NC}"
docker compose ps

# 检查健康状态
echo -e "${YELLOW}检查后端健康状态...${NC}"
if curl -f http://localhost:8000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 后端服务运行正常${NC}"
else
    echo -e "${RED}✗ 后端服务可能未正常启动${NC}"
    echo -e "${YELLOW}查看日志: docker compose logs backend${NC}"
fi

# 显示访问信息
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ 部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}前端: http://localhost${NC}"
echo -e "${GREEN}后端 API: http://localhost:8000${NC}"
echo ""
echo -e "${YELLOW}常用命令:${NC}"
echo -e "  查看日志: ${BLUE}docker compose logs -f${NC}"
echo -e "  停止服务: ${BLUE}docker compose down${NC}"
echo -e "  重启服务: ${BLUE}docker compose restart${NC}"
echo -e "  查看状态: ${BLUE}docker compose ps${NC}"
echo ""


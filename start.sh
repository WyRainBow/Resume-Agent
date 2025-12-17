#!/bin/bash

# 启动前后端服务脚本

# 获取脚本所在目录（项目根目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}正在启动前后端服务...${NC}"

# 检查后端虚拟环境
if [ ! -d ".pydeps" ]; then
    echo -e "${RED}错误: 未找到虚拟环境 .pydeps${NC}"
    exit 1
fi

# 启动后端
echo -e "${YELLOW}启动后端服务 (端口 8000)...${NC}"
source .pydeps/bin/activate
nohup uvicorn backend.main:app --reload --port 8000 > logs/backend/backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > .backend.pid
echo -e "${GREEN}后端服务已启动 (PID: $BACKEND_PID)${NC}"

# 等待后端启动
sleep 2

# 启动前端
echo -e "${YELLOW}启动前端服务 (端口 5173)...${NC}"
cd frontend
nohup npm run dev > ../logs/frontend/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..
echo $FRONTEND_PID > .frontend.pid
echo -e "${GREEN}前端服务已启动 (PID: $FRONTEND_PID)${NC}"

# 等待前端启动
sleep 3

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}服务启动完成！${NC}"
echo -e "${GREEN}后端: http://localhost:8000${NC}"
echo -e "${GREEN}前端: http://localhost:5173${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}查看日志:${NC}"
echo -e "  后端: tail -f logs/backend/backend.log"
echo -e "  前端: tail -f logs/frontend/frontend.log"
echo ""
echo -e "${YELLOW}停止服务: ./stop.sh${NC}"

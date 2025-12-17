#!/bin/bash

# 停止前后端服务脚本

# 获取脚本所在目录（项目根目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}正在停止前后端服务...${NC}"

# 停止后端
if [ -f ".backend.pid" ]; then
    BACKEND_PID=$(cat .backend.pid)
    if ps -p "$BACKEND_PID" > /dev/null 2>&1; then
        echo -e "${YELLOW}停止后端服务 (PID: $BACKEND_PID)...${NC}"
        kill "$BACKEND_PID" 2>/dev/null
        sleep 1
        # 如果进程还在，强制杀掉
        if ps -p "$BACKEND_PID" > /dev/null 2>&1; then
            kill -9 "$BACKEND_PID" 2>/dev/null
        fi
        echo -e "${GREEN}后端服务已停止${NC}"
    else
        echo -e "${YELLOW}后端进程 (PID: $BACKEND_PID) 不存在${NC}"
    fi
    rm -f .backend.pid
else
    echo -e "${YELLOW}未找到后端 PID 文件，尝试通过端口查找...${NC}"
    # 通过端口查找并关闭
    BACKEND_PID=$(lsof -ti:8000 2>/dev/null)
    if [ ! -z "$BACKEND_PID" ]; then
        echo -e "${YELLOW}找到后端进程 (PID: $BACKEND_PID)，正在停止...${NC}"
        kill "$BACKEND_PID" 2>/dev/null
        sleep 1
        if ps -p "$BACKEND_PID" > /dev/null 2>&1; then
            kill -9 "$BACKEND_PID" 2>/dev/null
        fi
        echo -e "${GREEN}后端服务已停止${NC}"
    else
        echo -e "${YELLOW}后端服务未运行${NC}"
    fi
fi

# 停止前端
if [ -f "frontend/.frontend.pid" ]; then
    FRONTEND_PID=$(cat frontend/.frontend.pid)
    if ps -p "$FRONTEND_PID" > /dev/null 2>&1; then
        echo -e "${YELLOW}停止前端服务 (PID: $FRONTEND_PID)...${NC}"
        kill "$FRONTEND_PID" 2>/dev/null
        sleep 1
        # 如果进程还在，强制杀掉
        if ps -p "$FRONTEND_PID" > /dev/null 2>&1; then
            kill -9 "$FRONTEND_PID" 2>/dev/null
        fi
        echo -e "${GREEN}前端服务已停止${NC}"
    else
        echo -e "${YELLOW}前端进程 (PID: $FRONTEND_PID) 不存在${NC}"
    fi
    rm -f frontend/.frontend.pid
else
    echo -e "${YELLOW}未找到前端 PID 文件，尝试通过端口查找...${NC}"
    # 通过端口查找并关闭
    FRONTEND_PID=$(lsof -ti:5173 2>/dev/null)
    if [ ! -z "$FRONTEND_PID" ]; then
        echo -e "${YELLOW}找到前端进程 (PID: $FRONTEND_PID)，正在停止...${NC}"
        kill "$FRONTEND_PID" 2>/dev/null
        sleep 1
        if ps -p "$FRONTEND_PID" > /dev/null 2>&1; then
            kill -9 "$FRONTEND_PID" 2>/dev/null
        fi
        echo -e "${GREEN}前端服务已停止${NC}"
    else
        echo -e "${YELLOW}前端服务未运行${NC}"
    fi
fi

# 再次检查是否有残留进程（通过端口）
echo ""
BACKEND_CHECK=$(lsof -ti:8000 2>/dev/null)
FRONTEND_CHECK=$(lsof -ti:5173 2>/dev/null)

if [ -z "$BACKEND_CHECK" ] && [ -z "$FRONTEND_CHECK" ]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}所有服务已成功停止！${NC}"
    echo -e "${GREEN}========================================${NC}"
else
    echo -e "${RED}警告: 仍有服务在运行${NC}"
    if [ ! -z "$BACKEND_CHECK" ]; then
        echo -e "${RED}后端 (端口 8000) 仍在使用，PID: $BACKEND_CHECK${NC}"
    fi
    if [ ! -z "$FRONTEND_CHECK" ]; then
        echo -e "${RED}前端 (端口 5173) 仍在使用，PID: $FRONTEND_CHECK${NC}"
    fi
fi

echo ""


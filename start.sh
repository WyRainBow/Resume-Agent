#!/bin/bash
# 启动脚本 - 确保环境变量正确展开
PORT="${PORT:-8000}"
echo "Starting server on port $PORT..."
exec uvicorn backend.main:app --host 0.0.0.0 --port "$PORT"

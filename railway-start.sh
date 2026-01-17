#!/bin/bash
# Railway 启动脚本 - 确保数据库迁移在服务启动前完成

set -e  # 遇到错误立即退出

echo "=== Railway 启动脚本 ==="
echo "当前目录: $(pwd)"
echo "Python 版本: $(python --version 2>&1 || echo 'Python not found')"
echo "Alembic 版本: $(alembic --version 2>&1 || echo 'Alembic not found')"

# 检查 DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  警告: DATABASE_URL 未设置，跳过数据库迁移"
else
    echo "✅ DATABASE_URL 已设置"
    echo "数据库 URL: ${DATABASE_URL:0:50}..."  # 只显示前50个字符，避免泄露密码
fi

# 运行数据库迁移
echo ""
echo "=== 运行数据库迁移 ==="
cd backend || exit 1

if command -v alembic &> /dev/null; then
    echo "正在运行: alembic upgrade head"
    if alembic upgrade head; then
        echo "✅ 数据库迁移成功完成"
    else
        echo "⚠️  数据库迁移失败或已是最新版本"
        # 不退出，继续启动服务
    fi
else
    echo "⚠️  Alembic 命令未找到，跳过迁移"
fi

cd ..

# 启动服务
echo ""
echo "=== 启动后端服务 ==="
echo "端口: $PORT"
exec uvicorn backend.main:app --host 0.0.0.0 --port "$PORT"

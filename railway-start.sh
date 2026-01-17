#!/bin/bash
# Railway 启动脚本 - 确保数据库迁移在服务启动前完成

# 不使用 set -e，允许迁移失败时继续启动服务

echo "=== Railway 启动脚本 ==="
echo "当前目录: $(pwd)"
echo "Python 版本: $(python --version 2>&1 || echo 'Python not found')"
echo "Alembic 版本: $(alembic --version 2>&1 || echo 'Alembic not found')"

# 检查 DATABASE_URL，如果没有则尝试从 Railway MySQL 变量构建
# 优先级：DATABASE_URL > MYSQL_URL > MYSQLHOST等变量
if [ -z "$DATABASE_URL" ]; then
    # 优先检查 MYSQL_URL（Railway 可能提供这个）
    if [ -n "$MYSQL_URL" ]; then
        # 将 mysql:// 转换为 mysql+pymysql://（Railway 的格式需要转换）
        if [[ "$MYSQL_URL" == mysql://* ]] && [[ "$MYSQL_URL" != mysql+pymysql://* ]]; then
            export DATABASE_URL=$(echo "$MYSQL_URL" | sed 's|^mysql://|mysql+pymysql://|')
        else
            export DATABASE_URL="$MYSQL_URL"
        fi
        echo "✅ DATABASE_URL 从 MYSQL_URL 构建"
        echo "数据库 URL: ${DATABASE_URL:0:50}..."  # 只显示前50个字符，避免泄露密码
    elif [ -n "$MYSQLHOST" ]; then
        # 从 MYSQLHOST 等变量构建
        MYSQL_PORT="${MYSQLPORT:-3306}"
        MYSQL_USER="${MYSQLUSER:-root}"
        MYSQL_PASSWORD="${MYSQLPASSWORD:-}"
        MYSQL_DATABASE="${MYSQLDATABASE:-resume_db}"
        if [ -n "$MYSQL_PASSWORD" ]; then
            export DATABASE_URL="mysql+pymysql://${MYSQL_USER}:${MYSQL_PASSWORD}@${MYSQLHOST}:${MYSQL_PORT}/${MYSQL_DATABASE}"
        else
            export DATABASE_URL="mysql+pymysql://${MYSQL_USER}@${MYSQLHOST}:${MYSQL_PORT}/${MYSQL_DATABASE}"
        fi
        echo "✅ DATABASE_URL 由 Railway MySQL 变量构建"
        echo "数据库 URL: ${DATABASE_URL:0:50}..."  # 只显示前50个字符，避免泄露密码
    else
        echo "⚠️  警告: DATABASE_URL、MYSQL_URL 和 MYSQLHOST 均未设置，跳过数据库迁移"
        echo "   提示: 请在 Railway Variables 中设置 DATABASE_URL 或连接 MySQL 服务"
    fi
else
    # DATABASE_URL 已设置，检查是否需要转换格式
    if [[ "$DATABASE_URL" == mysql://* ]] && [[ "$DATABASE_URL" != mysql+pymysql://* ]]; then
        export DATABASE_URL=$(echo "$DATABASE_URL" | sed 's|^mysql://|mysql+pymysql://|')
        echo "✅ DATABASE_URL 格式已转换（mysql:// -> mysql+pymysql://）"
    fi
    echo "✅ DATABASE_URL 已设置"
    echo "数据库 URL: ${DATABASE_URL:0:50}..."  # 只显示前50个字符，避免泄露密码
fi

# 运行数据库迁移
echo ""
echo "=== 运行数据库迁移 ==="

# 检查 backend 目录是否存在
if [ ! -d "backend" ]; then
    echo "⚠️  backend 目录不存在，跳过迁移"
else
    cd backend || {
        echo "⚠️  无法进入 backend 目录，跳过迁移"
        cd ..
    }
    
    if command -v alembic &> /dev/null; then
        echo "正在运行: alembic upgrade head"
        if alembic upgrade head; then
            echo "✅ 数据库迁移成功完成"
        else
            echo "⚠️  数据库迁移失败或已是最新版本，继续启动服务"
        fi
    else
        echo "⚠️  Alembic 命令未找到，跳过迁移"
    fi
    
    cd .. || true
fi

# 启动服务
echo ""
echo "=== 启动后端服务 ==="
echo "端口: $PORT"
exec uvicorn backend.main:app --host 0.0.0.0 --port "$PORT"

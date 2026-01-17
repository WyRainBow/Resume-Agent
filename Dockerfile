# 使用 Python 基础镜像
FROM python:3.11-slim

# 设置工作目录
WORKDIR /app

# 安装系统依赖（TeX Live 和中文字体）
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-xetex \
    texlive-fonts-recommended \
    texlive-fonts-extra \
    texlive-lang-chinese \
    fonts-noto-cjk \
    fontconfig \
    && rm -rf /var/lib/apt/lists/* \
    && fc-cache -fv

# 复制依赖文件（根目录和 backend 目录）
COPY requirements.txt .
COPY backend/requirements.txt ./backend/

# 安装 Python 依赖（先根目录，再 backend 目录，确保数据库依赖被安装）
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir -r backend/requirements.txt

# 复制项目文件
COPY . .

# 暴露端口
EXPOSE 8000

# 启动命令（使用环境变量 PORT，默认 8000）
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]


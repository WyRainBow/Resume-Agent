# 从 Railway 迁移到腾讯云服务器指南

## 📋 迁移概览

本文档将指导您将应用从 Railway 迁移到腾讯云服务器。

---

## 🔧 一、服务器环境准备

### 1.1 连接到服务器

```bash
# 使用 SSH 连接到腾讯云服务器
ssh root@你的服务器IP
# 或使用密钥
ssh -i ~/.ssh/your_key root@你的服务器IP
```

### 1.2 更新系统并安装基础工具

```bash
# Ubuntu/Debian
apt update && apt upgrade -y
apt install -y curl wget git vim build-essential

# CentOS/RHEL
yum update -y
yum install -y curl wget git vim gcc gcc-c++ make
```

### 1.3 安装 Python 3.11

```bash
# 方法1: 使用 apt (Ubuntu/Debian)
apt install -y software-properties-common
add-apt-repository ppa:deadsnakes/ppa
apt update
apt install -y python3.11 python3.11-venv python3.11-dev python3-pip

# 方法2: 从源码编译（适用于所有系统）
# 参考: https://www.python.org/downloads/
```

验证安装：
```bash
python3.11 --version  # 应该显示 Python 3.11.x
pip3.11 --version
```

### 1.4 安装 Node.js 18+

```bash
# 使用 NodeSource 仓库（推荐）
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# 验证
node --version  # 应该 >= 18.0.0
npm --version
```

### 1.5 安装 MySQL

```bash
# Ubuntu/Debian
apt install -y mysql-server mysql-client

# 启动 MySQL
systemctl start mysql
systemctl enable mysql

# 安全配置（设置 root 密码）
mysql_secure_installation
```

**创建数据库和用户：**

```bash
mysql -u root -p
```

在 MySQL 中执行：
```sql
CREATE DATABASE resume_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'resume_user'@'localhost' IDENTIFIED BY '你的数据库密码';
GRANT ALL PRIVILEGES ON resume_db.* TO 'resume_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 1.6 安装 LaTeX（PDF 生成需要）

```bash
# Ubuntu/Debian
apt install -y \
    texlive-xetex \
    texlive-fonts-recommended \
    texlive-fonts-extra \
    texlive-lang-chinese \
    fonts-noto-cjk \
    fontconfig

# 更新字体缓存
fc-cache -fv
```

验证：
```bash
xelatex --version
```

### 1.7 安装 Nginx（反向代理）

```bash
apt install -y nginx
systemctl start nginx
systemctl enable nginx
```

### 1.8 安装 PM2（进程管理）

```bash
npm install -g pm2
```

---

## 📦 二、代码部署

### 2.1 克隆代码

```bash
# 创建项目目录
mkdir -p /var/www
cd /var/www

# 克隆代码（替换为你的 GitHub 仓库地址）
git clone https://github.com/WyRainBow/Resume-Agent.git
cd Resume-Agent

# 切换到 main 分支
git checkout main
git pull origin main
```

### 2.2 配置后端环境变量

```bash
cd /var/www/Resume-Agent/backend

# 创建 .env 文件
cat > .env << EOF
# 数据库配置
DATABASE_URL=mysql+pymysql://resume_user:你的数据库密码@localhost:3306/resume_db

# AI API Keys（从 Railway 复制）
DEEPSEEK_API_KEY=你的DeepSeek_API_KEY
# 其他 API Keys（如果有）
# ZHIPU_API_KEY=
# DOUBAO_API_KEY=
EOF
```

### 2.3 安装后端依赖

```bash
cd /var/www/Resume-Agent

# 创建虚拟环境
python3.11 -m venv venv
source venv/bin/activate

# 安装依赖
pip install --upgrade pip
pip install -r requirements.txt
pip install -r backend/requirements.txt
```

### 2.4 运行数据库迁移

```bash
cd /var/www/Resume-Agent/backend
source ../venv/bin/activate

# 运行迁移
alembic upgrade head
```

### 2.5 安装前端依赖并构建

```bash
cd /var/www/Resume-Agent/frontend

# 安装依赖
npm install

# 构建生产版本
npm run build
```

---

## 🚀 三、配置进程管理（PM2）

### 3.1 创建 PM2 配置文件

```bash
cd /var/www/Resume-Agent

cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'resume-backend',
      script: 'venv/bin/uvicorn',
      args: 'backend.main:app --host 0.0.0.0 --port 9000',
      cwd: '/var/www/Resume-Agent',
      interpreter: '/var/www/Resume-Agent/venv/bin/python3.11',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/backend/pm2-error.log',
      out_file: './logs/backend/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    },
    {
      name: 'resume-frontend',
      script: 'node_modules/.bin/vite',
      args: 'preview --host 0.0.0.0 --port 5173',
      cwd: '/var/www/Resume-Agent/frontend',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '../logs/frontend/pm2-error.log',
      out_file: '../logs/frontend/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
    },
  ],
};
EOF
```

### 3.2 创建日志目录

```bash
mkdir -p /var/www/Resume-Agent/logs/backend
mkdir -p /var/www/Resume-Agent/logs/frontend
```

### 3.3 启动服务

```bash
cd /var/www/Resume-Agent

# 启动所有服务
pm2 start ecosystem.config.js

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup
# 执行上面命令输出的命令（通常类似：sudo env PATH=... pm2 startup systemd -u root --hp /root）
```

查看状态：
```bash
pm2 status
pm2 logs
```

---

## 🌐 四、配置 Nginx 反向代理

### 4.1 创建 Nginx 配置

```bash
cat > /etc/nginx/sites-available/resume-agent << 'EOF'
server {
    listen 80;
    server_name 你的域名或IP;

    # 前端静态文件
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 后端 API
    location /api {
        proxy_pass http://localhost:9000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 支持 SSE（如果需要）
        proxy_buffering off;
        proxy_cache off;
    }

    # 健康检查
    location /health {
        proxy_pass http://localhost:9000/api/health;
    }

    # 静态资源缓存
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://localhost:5173;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
EOF
```

### 4.2 启用配置

```bash
# 创建软链接
ln -s /etc/nginx/sites-available/resume-agent /etc/nginx/sites-enabled/

# 测试配置
nginx -t

# 重载 Nginx
systemctl reload nginx
```

---

## 🔒 五、配置 HTTPS（可选但推荐）

### 5.1 安装 Certbot

```bash
apt install -y certbot python3-certbot-nginx
```

### 5.2 申请 SSL 证书

```bash
# 如果有域名
certbot --nginx -d 你的域名

# 按照提示完成配置
```

---

## 📊 六、数据迁移（如果有现有数据）

### 6.1 从 Railway 导出数据库

在 Railway 控制台：
1. 进入 MySQL 服务
2. 使用数据库管理工具导出数据（如 phpMyAdmin 或直接使用 `mysqldump`）

或在本地连接 Railway 数据库导出：
```bash
mysqldump -h railway_mysql_host -u railway_user -p railway_database > backup.sql
```

### 6.2 导入到腾讯云数据库

```bash
# 上传备份文件到服务器
scp backup.sql root@你的服务器IP:/tmp/

# 在服务器上导入
mysql -u resume_user -p resume_db < /tmp/backup.sql
```

---

## 🧪 七、测试和验证

### 7.1 检查服务状态

```bash
# PM2 状态
pm2 status

# 检查端口
netstat -tlnp | grep -E '9000|5173|80|443'

# 检查日志
pm2 logs resume-backend
pm2 logs resume-frontend
```

### 7.2 测试 API

```bash
# 健康检查
curl http://localhost:9000/api/health

# 通过 Nginx
curl http://你的域名或IP/api/health
```

### 7.3 访问前端

在浏览器中访问：`http://你的域名或IP` 或 `http://你的服务器IP`

---

## 🔧 八、常用维护命令

### 8.1 PM2 命令

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs
pm2 logs resume-backend
pm2 logs resume-frontend

# 重启服务
pm2 restart all
pm2 restart resume-backend

# 停止服务
pm2 stop all
pm2 stop resume-backend

# 删除服务
pm2 delete resume-backend
```

### 8.2 数据库迁移

```bash
cd /var/www/Resume-Agent/backend
source ../venv/bin/activate
alembic upgrade head
```

### 8.3 更新代码

```bash
cd /var/www/Resume-Agent

# 拉取最新代码
git pull origin main

# 重新安装依赖（如果有变化）
source venv/bin/activate
pip install -r requirements.txt
pip install -r backend/requirements.txt

# 前端
cd frontend
npm install
npm run build

# 重启服务
pm2 restart all
```

---

## ⚠️ 九、安全建议

### 9.1 防火墙配置

```bash
# Ubuntu/Debian
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw enable
```

### 9.2 更新环境变量安全

- 确保 `.env` 文件权限：`chmod 600 backend/.env`
- 不要在代码仓库中提交 `.env` 文件

### 9.3 定期备份

```bash
# 数据库备份脚本
cat > /root/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/root/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
mysqldump -u resume_user -p你的密码 resume_db > $BACKUP_DIR/resume_db_$DATE.sql
# 保留最近7天的备份
find $BACKUP_DIR -name "resume_db_*.sql" -mtime +7 -delete
EOF

chmod +x /root/backup-db.sh

# 添加到 crontab（每天凌晨2点备份）
crontab -e
# 添加：0 2 * * * /root/backup-db.sh
```

---

## 📝 十、故障排查

### 10.1 服务无法启动

```bash
# 查看 PM2 日志
pm2 logs

# 查看系统日志
journalctl -u nginx
systemctl status mysql
```

### 10.2 数据库连接失败

```bash
# 检查 MySQL 状态
systemctl status mysql

# 测试连接
mysql -u resume_user -p resume_db

# 检查 DATABASE_URL 配置
cat backend/.env | grep DATABASE_URL
```

### 10.3 端口被占用

```bash
# 查看端口占用
netstat -tlnp | grep 9000
netstat -tlnp | grep 5173

# 杀死进程
kill -9 PID
```

---

## ✅ 迁移检查清单

- [ ] 服务器环境准备完成（Python 3.11, Node.js 18+, MySQL, LaTeX, Nginx）
- [ ] 代码已克隆到服务器
- [ ] 环境变量已配置（.env 文件）
- [ ] 后端依赖已安装
- [ ] 数据库已创建并迁移完成
- [ ] 前端已构建
- [ ] PM2 已配置并启动服务
- [ ] Nginx 已配置并运行
- [ ] 服务可正常访问
- [ ] HTTPS 已配置（可选）
- [ ] 防火墙已配置
- [ ] 备份脚本已设置

---

## 🆘 需要帮助？

如果遇到问题，请检查：
1. PM2 日志：`pm2 logs`
2. Nginx 日志：`tail -f /var/log/nginx/error.log`
3. 系统日志：`journalctl -xe`

祝迁移顺利！🎉

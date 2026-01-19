# 腾讯云服务器数据库配置指南

## 方案一：使用宝塔面板配置 MySQL 数据库（推荐）

### 1. 在宝塔面板中创建数据库

1. 登录宝塔面板
2. 进入 **数据库** → **添加数据库**
3. 填写信息：
   - 数据库名：`resume_db`（或自定义）
   - 用户名：`resume_user`（或自定义）
   - 密码：设置强密码
   - 访问权限：选择 **所有人** 或 **指定 IP**（推荐指定 IP）

### 2. 配置 MySQL 远程访问

#### 方法 A：通过宝塔面板（简单）

1. 进入 **数据库** → **root 密码**，设置或查看 root 密码
2. 进入 **安全** → **防火墙**，开放端口 `3306`（如果使用非标准端口，开放对应端口）
3. 在 **数据库** 中，找到创建的数据库，点击 **管理** → **phpMyAdmin** 进入管理界面

#### 方法 B：通过 SSH 命令行（高级）

```bash
# 1. 登录服务器
ssh root@你的服务器IP

# 2. 登录 MySQL
mysql -u root -p

# 3. 创建远程访问用户（如果还没有）
CREATE USER 'resume_user'@'%' IDENTIFIED BY '你的密码';
GRANT ALL PRIVILEGES ON resume_db.* TO 'resume_user'@'%';
FLUSH PRIVILEGES;
EXIT;

# 4. 修改 MySQL 配置允许远程连接
# 编辑配置文件
vi /etc/my.cnf
# 或
vi /etc/mysql/my.cnf

# 找到 [mysqld] 部分，确保有以下配置：
# bind-address = 0.0.0.0  # 允许所有 IP 连接
# 或
# bind-address = 你的服务器IP  # 只允许特定 IP

# 5. 重启 MySQL 服务
systemctl restart mysqld
# 或
systemctl restart mysql
```

### 3. 配置腾讯云安全组

1. 登录腾讯云控制台
2. 进入 **云服务器** → **安全组**
3. 找到你的服务器对应的安全组
4. 添加入站规则：
   - 类型：`MySQL(3306)`
   - 来源：`0.0.0.0/0`（允许所有 IP，生产环境建议限制为你的 IP）
   - 协议端口：`TCP:3306`
   - 策略：`允许`

### 4. 测试连接

```bash
# 在本地测试连接
mysql -h 你的服务器IP -P 3306 -u resume_user -p
# 输入密码后，如果成功连接，说明配置正确
```

## 方案二：使用腾讯云 MySQL 数据库（云数据库）

如果你使用的是腾讯云的云数据库 MySQL（而不是服务器上的 MySQL），配置方式如下：

1. 在腾讯云控制台获取数据库连接信息：
   - 内网地址：`xxx.mysql.tencentcloud.com`
   - 外网地址：`xxx.mysql.tencentcloud.com`（需要开启外网访问）
   - 端口：通常是 `3306`
   - 用户名和密码

2. 在项目 `.env` 文件中配置（见下方）

## 项目配置

### 方式一：使用 DATABASE_URL（推荐）

在 `.env` 文件中添加：

```env
# 腾讯云服务器 MySQL 配置
DATABASE_URL=mysql+pymysql://用户名:密码@服务器IP:3306/数据库名

# 示例：
# DATABASE_URL=mysql+pymysql://resume_user:your_password@123.456.789.0:3306/resume_db
```

### 方式二：使用环境变量（支持 Railway 风格）

在 `.env` 文件中添加：

```env
# MySQL 连接配置
MYSQLHOST=你的服务器IP或域名
MYSQLPORT=3306
MYSQLUSER=数据库用户名
MYSQLPASSWORD=数据库密码
MYSQLDATABASE=数据库名

# 示例：
# MYSQLHOST=123.456.789.0
# MYSQLPORT=3306
# MYSQLUSER=resume_user
# MYSQLPASSWORD=your_password
# MYSQLDATABASE=resume_db
```

## 安全建议

1. **生产环境**：
   - 使用强密码
   - 限制数据库访问 IP（在安全组和 MySQL 用户权限中设置）
   - 使用 SSL 连接（如果支持）
   - 定期备份数据库

2. **开发环境**：
   - 可以使用 `0.0.0.0/0` 允许所有 IP 访问（仅用于测试）
   - 使用较简单的密码（但不要使用默认密码）

3. **连接池配置**：
   - 代码中已配置连接池（`pool_size=5`, `max_overflow=10`）
   - 连接会自动回收（`pool_recycle=3600`）

## 验证配置

运行以下命令验证数据库连接：

```bash
cd backend
python3 -c "from database import DATABASE_URL, engine; from sqlalchemy import text; conn = engine.connect(); print('✅ 数据库连接成功！'); print(f'数据库URL: {DATABASE_URL}'); conn.close()"
```

## 常见问题

### 1. 连接超时
- 检查防火墙是否开放 3306 端口
- 检查安全组规则
- 检查 MySQL 是否允许远程连接

### 2. 认证失败
- 检查用户名和密码是否正确
- 检查用户是否有远程访问权限（`'user'@'%'` 而不是 `'user'@'localhost'`）

### 3. 数据库不存在
- 在宝塔面板或 MySQL 中创建数据库
- 运行数据库迁移：`alembic upgrade head`

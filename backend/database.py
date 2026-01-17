"""
数据库配置和会话管理
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
from pathlib import Path

# 加载环境变量
PROJECT_ROOT = Path(__file__).resolve().parent.parent
env_path = PROJECT_ROOT / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=str(env_path), override=True)
load_dotenv(override=True)

# 从环境变量获取数据库 URL
# 优先级：DATABASE_URL > 从 Railway MySQL 变量构建 > 默认本地 MySQL
def get_database_url():
    # 1. 优先使用 DATABASE_URL（如果已设置）
    database_url = os.getenv("DATABASE_URL")
    
    if database_url:
        # Railway 的 MYSQL_URL 格式可能是 mysql://，需要转换为 mysql+pymysql://
        if database_url.startswith("mysql://") and not database_url.startswith("mysql+pymysql://"):
            database_url = database_url.replace("mysql://", "mysql+pymysql://", 1)
        return database_url
    
    # 2. 尝试从 Railway MySQL 环境变量构建（如果存在）
    mysql_host = os.getenv("MYSQLHOST")
    mysql_port = os.getenv("MYSQLPORT", "3306")
    mysql_user = os.getenv("MYSQLUSER", "root")
    mysql_password = os.getenv("MYSQLPASSWORD", "")
    mysql_database = os.getenv("MYSQLDATABASE", "resume_db")
    
    if mysql_host:
        # 构建连接字符串
        if mysql_password:
            return f"mysql+pymysql://{mysql_user}:{mysql_password}@{mysql_host}:{mysql_port}/{mysql_database}"
        else:
            return f"mysql+pymysql://{mysql_user}@{mysql_host}:{mysql_port}/{mysql_database}"
    
    # 3. 默认使用本地 MySQL
    return "mysql+pymysql://root@localhost:3306/resume_db"

DATABASE_URL = get_database_url()

# 创建数据库引擎
# 添加连接参数以确保 MySQL 连接稳定
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # 连接前检查连接是否有效
    pool_recycle=3600,    # 1小时后回收连接
    pool_size=5,          # 连接池大小
    max_overflow=10,      # 最大溢出连接数
    echo=False,           # 设置为 True 可以看到 SQL 日志
    # MySQL 特定参数
    connect_args={
        "charset": "utf8mb4",
        "connect_timeout": 10,
    } if "mysql" in DATABASE_URL.lower() else {}
)

# 创建会话工厂
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 创建基类
Base = declarative_base()


def get_db():
    """
    获取数据库会话
    用于依赖注入
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    初始化数据库（创建所有表）
    """
    Base.metadata.create_all(bind=engine)


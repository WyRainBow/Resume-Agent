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
def get_database_url():
    # 1. 检查是否使用 PostgreSQL
    use_postgresql = os.getenv("USE_POSTGRESQL", "").lower() in {"1", "true", "yes", "on"}

    if use_postgresql:
        # 使用 PostgreSQL（统一用 psycopg3，与 requirements 里 psycopg[binary] 一致）
        postgresql_url = os.getenv("POSTGRESQL_URL")
        if postgresql_url:
            if postgresql_url.startswith("postgresql+psycopg2"):
                postgresql_url = postgresql_url.replace("postgresql+psycopg2", "postgresql+psycopg", 1)
            elif postgresql_url.startswith("postgresql://") and not postgresql_url.startswith("postgresql+psycopg://"):
                postgresql_url = postgresql_url.replace("postgresql://", "postgresql+psycopg://", 1)
            return postgresql_url
        raise RuntimeError("USE_POSTGRESQL=true 但未设置 POSTGRESQL_URL")

    # 2. 使用 DATABASE_URL（MySQL 或其他）
    database_url = os.getenv("DATABASE_URL")

    if database_url:
        # Railway 的 MYSQL_URL 格式可能是 mysql://，需要转换为 mysql+pymysql://
        if database_url.startswith("mysql://") and not database_url.startswith("mysql+pymysql://"):
            database_url = database_url.replace("mysql://", "mysql+pymysql://", 1)
        return database_url

    # 3. 尝试从 Railway MySQL 环境变量构建（如果存在）
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

    # 4. 默认使用 SQLite（开发环境）
    # 使用绝对路径，确保数据库文件位置固定
    db_path = PROJECT_ROOT / "backend" / "resume.db"
    return f"sqlite:///{db_path}"

DATABASE_URL = get_database_url()


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


IS_MYSQL = "mysql" in DATABASE_URL.lower()
IS_POSTGRESQL = "postgresql" in DATABASE_URL.lower()
DB_POOL_PRE_PING = _env_bool("DB_POOL_PRE_PING", False)
DB_POOL_RECYCLE = int(os.getenv("DB_POOL_RECYCLE", "1800"))
DB_POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "20"))
DB_MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "40"))
DB_POOL_TIMEOUT = int(os.getenv("DB_POOL_TIMEOUT", "3"))

# PostgreSQL 连接超时（秒），启动时若连不上可快速回退到文件存储，避免长时间卡住
PG_CONNECT_TIMEOUT = int(os.getenv("PG_CONNECT_TIMEOUT", "5"))

# 创建数据库引擎
engine = create_engine(
    DATABASE_URL,
    # 远程数据库高延迟场景下，pre_ping 会在每次取连接时增加额外往返，默认关闭。
    pool_pre_ping=DB_POOL_PRE_PING,
    pool_recycle=DB_POOL_RECYCLE,
    pool_size=DB_POOL_SIZE,
    max_overflow=DB_MAX_OVERFLOW,
    pool_timeout=DB_POOL_TIMEOUT,
    pool_use_lifo=True,   # 优先复用最近连接，减少命中陈旧连接
    pool_reset_on_return="rollback",  # 连接归还时重置事务状态，减少脏连接影响
    echo=False,           # 设置为 True 可以看到 SQL 日志
    connect_args=(
        {
            "charset": "utf8mb4",
            "connect_timeout": 8,
            "read_timeout": 15,
            "write_timeout": 10,
        }
        if IS_MYSQL
        else ({"connect_timeout": PG_CONNECT_TIMEOUT} if IS_POSTGRESQL else {})
    ),
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

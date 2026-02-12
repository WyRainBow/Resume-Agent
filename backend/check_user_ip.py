"""查库看 users 表的 last_login_ip（用项目 database 配置）。运行：在项目根目录 PYTHONPATH=backend python backend/check_user_ip.py"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(ROOT / "backend") not in sys.path:
    sys.path.insert(0, str(ROOT / "backend"))

from database import SessionLocal
from models import User

def main():
    db = SessionLocal()
    try:
        rows = db.query(User.id, User.username, User.last_login_ip, User.role).all()
        if not rows:
            print("users 表为空")
            return
        print("id\tusername\tlast_login_ip\trole")
        print("-" * 60)
        for r in rows:
            print(f"{r.id}\t{r.username}\t{r.last_login_ip or '(null)'}\t{r.role or 'user'}")
    finally:
        db.close()

if __name__ == "__main__":
    main()

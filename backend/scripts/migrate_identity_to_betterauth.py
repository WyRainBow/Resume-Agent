"""身份统一迁移：业务表 user_id 从旧 users 整数 id re-key 为 BetterAuth "user".id，
迁移 role/pdf_download_count 进 better_auth_entitlements，最终 DROP TABLE users。

设计（方案 §十，经 Codex 对抗式审查修订）：
- 目标库从 --database-url 显式传入，绝不默认读 .env（防误打生产）。
- 默认 --dry-run 只出预检报告；--execute 单事务执行，任一步失败整体回滚。
- 删除白名单：--execute 必须带 --approved-delete，实际不可映射 resumes 集合与
  白名单不完全一致 → 立即中止（数据不丢失硬保障；无删除传 "none"）。
- api_request_logs 故意不回填（拍板 B：旧 JWT 归因全部清 NULL）。
- 重入 = 状态机校验：users 已不存在时逐项验证终态 schema，任一不满足报错，
  不"直接跳成功"。

用法：
  python backend/scripts/migrate_identity_to_betterauth.py --database-url postgresql+psycopg://... [--execute --approved-delete id1,id2|none] [--with-fk]
"""
from __future__ import annotations

import argparse
import sys

from sqlalchemy import create_engine, text

# (表名, user_id 是否 NOT NULL, 不可映射策略)
# 策略: delete=删除行(resumes 走白名单;embeddings/score 为派生数据可重算)
#       null=保留行、user_id 置 NULL
#       none=完全不回填(api_request_logs,拍板 B)
RE_KEY_TABLES = [
    ("resumes", True, "delete"),
    ("resume_embeddings", True, "delete"),
    ("score_results", True, "delete"),
    ("agent_conversations", False, "null"),
    ("members", False, "null"),
    ("api_request_logs", False, "none"),
]
AUDIT_TABLE = "permission_audit_logs"  # 两列 operator_user_id/target_user_id，策略 null


def q(conn, sql: str, **params):
    return conn.execute(text(sql), params)


def users_table_exists(conn) -> bool:
    return q(conn, "SELECT to_regclass('public.users') IS NOT NULL AS e").scalar()


def print_header(title: str) -> None:
    print(f"\n=== {title} ===")


def dry_run_report(conn) -> dict:
    """预检报告；返回关键数据供 execute 校验。"""
    report = {}
    print_header("预检：身份映射")
    total_users = q(conn, "SELECT COUNT(*) FROM users").scalar()
    mappable = q(
        conn,
        'SELECT COUNT(*) FROM users u JOIN "user" b ON lower(b.email)=lower(u.email)',
    ).scalar()
    print(f"  legacy users: {total_users}，可映射到 BetterAuth: {mappable}")

    print_header("预检：逐表行数与可映射性")
    unmappable_resumes = []
    for table, _not_null, policy in RE_KEY_TABLES:
        total = q(conn, f"SELECT COUNT(*) FROM {table}").scalar()
        if policy == "none":
            print(f"  {table}: {total} 行 → 全部归因清 NULL（拍板 B，不回填）")
            continue
        unmapped = q(
            conn,
            f"""SELECT COUNT(*) FROM {table} t
                WHERE t.user_id IS NOT NULL AND NOT EXISTS (
                  SELECT 1 FROM users u JOIN "user" b ON lower(b.email)=lower(u.email)
                  WHERE u.id = t.user_id)""",
        ).scalar()
        print(f"  {table}: {total} 行，不可映射 {unmapped} → 策略 {policy}")
        if table == "resumes" and unmapped:
            rows = q(
                conn,
                """SELECT r.id, r.name, u.email FROM resumes r
                   LEFT JOIN users u ON u.id = r.user_id
                   WHERE NOT EXISTS (
                     SELECT 1 FROM users u2 JOIN "user" b ON lower(b.email)=lower(u2.email)
                     WHERE u2.id = r.user_id)""",
            ).fetchall()
            for r in rows:
                print(f"    ⚠ 不可映射简历: id={r.id} name={r.name} 属主邮箱={r.email}")
                unmappable_resumes.append(r.id)
    report["unmappable_resumes"] = unmappable_resumes

    audit_total = q(conn, f"SELECT COUNT(*) FROM {AUDIT_TABLE}").scalar()
    print(f"  {AUDIT_TABLE}: {audit_total} 行（两列，策略 null）")

    print_header("预检：role / pdf 计数回填名单")
    rows = q(
        conn,
        """SELECT u.email, u.role, COALESCE(u.pdf_download_count,0) AS pdf
           FROM users u JOIN "user" b ON lower(b.email)=lower(u.email)
           WHERE u.role <> 'user' OR COALESCE(u.pdf_download_count,0) > 0""",
    ).fetchall()
    for r in rows:
        print(f"  {r.email}: role={r.role} pdf={r.pdf}")
    if not rows:
        print("  （无需回填的非默认值）")
    return report


def execute_migration(conn, approved_delete: set[str], with_fk: bool) -> None:
    """单事务执行（调用方管理事务边界）。"""
    print_header("执行：锁表")
    q(conn, "SET LOCAL lock_timeout = '10s'")
    q(conn, "SET LOCAL statement_timeout = '10min'")
    q(
        conn,
        """LOCK TABLE users, better_auth_entitlements, resumes, resume_embeddings,
           score_results, agent_conversations, members, permission_audit_logs,
           api_request_logs IN ACCESS EXCLUSIVE MODE""",
    )

    print_header("执行：identity_map")
    q(
        conn,
        """CREATE TEMP TABLE identity_map ON COMMIT DROP AS
           SELECT u.id AS legacy_user_id, b.id AS better_auth_user_id
           FROM users u JOIN "user" b ON lower(b.email) = lower(u.email)""",
    )
    q(conn, "CREATE UNIQUE INDEX ON identity_map (legacy_user_id)")

    print_header("执行：entitlements 扩列 + 回填")
    q(
        conn,
        """ALTER TABLE better_auth_entitlements
           ADD COLUMN IF NOT EXISTS role varchar(32) NOT NULL DEFAULT 'user',
           ADD COLUMN IF NOT EXISTS pdf_download_count integer NOT NULL DEFAULT 0""",
    )
    q(
        conn,
        """CREATE INDEX IF NOT EXISTS ix_better_auth_entitlements_role
           ON better_auth_entitlements(role)""",
    )
    q(
        conn,
        """INSERT INTO better_auth_entitlements (better_auth_user_id, email, name)
           SELECT id, email, name FROM "user"
           ON CONFLICT (better_auth_user_id) DO UPDATE
           SET email = EXCLUDED.email, name = EXCLUDED.name""",
    )
    q(
        conn,
        """UPDATE better_auth_entitlements e
           SET role = u.role, pdf_download_count = COALESCE(u.pdf_download_count, 0)
           FROM users u JOIN identity_map m ON m.legacy_user_id = u.id
           WHERE e.better_auth_user_id = m.better_auth_user_id
             AND (u.role <> 'user' OR COALESCE(u.pdf_download_count, 0) > 0)""",
    )

    print_header("执行：逐表 re-key")
    for table, not_null, policy in RE_KEY_TABLES:
        q(conn, f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS user_id_new varchar(255)")
        if policy != "none":
            q(
                conn,
                f"""UPDATE {table} t SET user_id_new = m.better_auth_user_id
                    FROM identity_map m WHERE t.user_id = m.legacy_user_id""",
            )
        if policy == "delete":
            rows = q(
                conn, f"SELECT id FROM {table} WHERE user_id_new IS NULL"
            ).fetchall()
            ids = {str(r.id) for r in rows}
            if table == "resumes" and ids != approved_delete:
                raise RuntimeError(
                    f"resumes 实际不可映射集合 {sorted(ids)} 与 --approved-delete "
                    f"白名单 {sorted(approved_delete)} 不一致，中止（数据不丢失硬保障）"
                )
            if ids:
                q(conn, f"DELETE FROM {table} WHERE user_id_new IS NULL")
                print(f"  {table}: 删除不可映射 {len(ids)} 行")
        print(f"  {table}: re-key 完成（策略 {policy}）")

    # 审计表两列
    for col in ("operator_user_id", "target_user_id"):
        q(conn, f"ALTER TABLE {AUDIT_TABLE} ADD COLUMN IF NOT EXISTS {col}_new varchar(255)")
        q(
            conn,
            f"""UPDATE {AUDIT_TABLE} t SET {col}_new = m.better_auth_user_id
                FROM identity_map m WHERE t.{col} = m.legacy_user_id""",
        )

    print_header("执行：动态删除全部指向 users 的 FK")
    q(
        conn,
        """DO $$ DECLARE fk record; BEGIN
             FOR fk IN SELECT c.conname, t.relname AS table_name
               FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
               WHERE c.contype='f' AND c.confrelid='users'::regclass
             LOOP EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', fk.table_name, fk.conname);
             END LOOP;
           END $$""",
    )

    print_header("执行：列替换 + 索引")
    for table, not_null, _policy in RE_KEY_TABLES:
        q(conn, f"ALTER TABLE {table} DROP COLUMN user_id")
        q(conn, f"ALTER TABLE {table} RENAME COLUMN user_id_new TO user_id")
        if not_null:
            q(conn, f"ALTER TABLE {table} ALTER COLUMN user_id SET NOT NULL")
        q(conn, f"CREATE INDEX IF NOT EXISTS ix_{table}_user_id ON {table}(user_id)")
    for col in ("operator_user_id", "target_user_id"):
        q(conn, f"ALTER TABLE {AUDIT_TABLE} DROP COLUMN {col}")
        q(conn, f"ALTER TABLE {AUDIT_TABLE} RENAME COLUMN {col}_new TO {col}")
        q(conn, f"CREATE INDEX IF NOT EXISTS ix_{AUDIT_TABLE}_{col} ON {AUDIT_TABLE}({col})")

    if with_fk:
        print_header("执行：可选库级 FK（ON DELETE CASCADE）")
        for table in ("resumes", "resume_embeddings", "score_results"):
            q(
                conn,
                f"""ALTER TABLE {table} ADD CONSTRAINT fk_{table}_user
                    FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE""",
            )

    print_header("执行：DROP users 前硬门禁")
    q(
        conn,
        """DO $$ BEGIN
             IF EXISTS (SELECT 1 FROM pg_constraint WHERE contype='f'
                        AND confrelid='users'::regclass)
               THEN RAISE EXCEPTION 'foreign keys still reference users'; END IF;
             IF EXISTS (SELECT 1 FROM resumes r LEFT JOIN "user" b ON b.id=r.user_id
                        WHERE b.id IS NULL)
               THEN RAISE EXCEPTION 'orphan resumes detected'; END IF;
           END $$""",
    )
    q(conn, "DROP TABLE users")
    print("  users 表已删除")


def validate_final_state(conn) -> bool:
    """终态校验（execute 收尾 + 重入模式共用）。全过返回 True。"""
    ok = True
    print_header("终态校验")

    if users_table_exists(conn):
        print("  ✗ users 表仍存在")
        ok = False
    else:
        print("  ✓ users 表不存在")

    all_tables = [t for t, _, _ in RE_KEY_TABLES] + [AUDIT_TABLE]
    col_map = {AUDIT_TABLE: ["operator_user_id", "target_user_id"]}
    for table in all_tables:
        for col in col_map.get(table, ["user_id"]):
            dtype = q(
                conn,
                """SELECT data_type FROM information_schema.columns
                   WHERE table_name=:t AND column_name=:c""",
                t=table,
                c=col,
            ).scalar()
            if dtype != "character varying":
                print(f"  ✗ {table}.{col} 类型={dtype}（应 varchar）")
                ok = False
        idx_col = col_map.get(table, ["user_id"])[0]
        has_idx = q(
            conn,
            "SELECT COUNT(*) FROM pg_indexes WHERE tablename=:t AND indexdef ILIKE :p",
            t=table,
            p=f"%({idx_col}%",
        ).scalar()
        if not has_idx:
            print(f"  ✗ {table} 缺 {idx_col} 索引")
            ok = False
    print("  ✓ 列类型/索引校验完成" if ok else "  （存在失败项，见上）")

    for table in ("resumes", "resume_embeddings", "score_results"):
        nulls = q(conn, f"SELECT COUNT(*) FROM {table} WHERE user_id IS NULL").scalar()
        if nulls:
            print(f"  ✗ {table} 存在 {nulls} 行 user_id NULL")
            ok = False
    orphans = q(
        conn,
        'SELECT COUNT(*) FROM resumes r LEFT JOIN "user" b ON b.id=r.user_id WHERE b.id IS NULL',
    ).scalar()
    if orphans:
        print(f"  ✗ 孤儿简历 {orphans} 份")
        ok = False
    else:
        print("  ✓ 无孤儿简历（全部属主可在 \"user\" 表命中）")

    admins = q(
        conn,
        "SELECT email, role FROM better_auth_entitlements WHERE role='admin'",
    ).fetchall()
    print(f"  admin 名单: {[r.email for r in admins]}")
    print(f"  简历总数: {q(conn, 'SELECT COUNT(*) FROM resumes').scalar()}")
    return ok


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-url", required=True, help="目标库（显式传入，防误打）")
    parser.add_argument("--execute", action="store_true", help="真正执行（默认 dry-run）")
    parser.add_argument(
        "--approved-delete",
        default=None,
        help="获批删除的 resume id 逗号清单；无删除传 none（--execute 必填）",
    )
    parser.add_argument("--with-fk", action="store_true", help="补库级 FK（CASCADE）")
    args = parser.parse_args()

    engine = create_engine(args.database_url)

    with engine.connect() as conn:
        if not users_table_exists(conn):
            print("users 表不存在 → 重入模式：只做终态校验")
            return 0 if validate_final_state(conn) else 1

    if not args.execute:
        with engine.connect() as conn:
            dry_run_report(conn)
        print("\n[dry-run] 未写库。确认报告后加 --execute --approved-delete <ids|none> 执行。")
        return 0

    if args.approved_delete is None:
        print("--execute 必须带 --approved-delete（无删除传 none）", file=sys.stderr)
        return 2
    approved = (
        set()
        if args.approved_delete.strip().lower() == "none"
        else {s.strip() for s in args.approved_delete.split(",") if s.strip()}
    )

    with engine.begin() as conn:  # 单事务，异常自动回滚
        dry_run_report(conn)
        execute_migration(conn, approved, args.with_fk)
        if not validate_final_state(conn):
            raise RuntimeError("终态校验失败，回滚整个迁移")
    print("\n迁移完成（单事务已提交）。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

# Review：PostgreSQL 连接异常与磁盘打满事故复盘

**日期：** 2026-06-15
**分支：** `dev`
**事故类型：** 线上后端登录失败 / 数据库不可用 / 基础设施故障
**影响范围：** 后台登录接口、依赖 PostgreSQL 的业务接口、数据库维护操作
**结论摘要：** 本次主故障不是代码逻辑 bug，而是服务器根分区被 Docker 容器日志打满，导致 PostgreSQL 无法正常创建 `postmaster.pid` 并对外提供连接；应用层因此表现为“数据库连接异常、请稍后重试”。同时，在本次排障前后还发现了数据库 schema 漂移和 `users` 数据缺失问题，这些属于独立但相关的历史问题，已一并记录。

---

## 一、事故概述

本次故障最开始的外在表现，是后台管理系统登录接口不可用，前端或接口调用方看到的是：

- 登录失败
- 接口返回 `503 Service Unavailable`
- 提示文案为：`数据库连接异常、请稍后重试`

继续往下追后，实际看到的底层报错包括：

1. 应用连接 PostgreSQL 时被服务端直接断开
2. PostgreSQL 曾处于 `recovery mode`
3. 后续 PostgreSQL 重启失败，报 `No space left on device`

最终确认的根因是：

- 服务器磁盘被 Docker 的 Loki 容器日志文件持续写满
- 根分区可用空间耗尽
- PostgreSQL 无法创建锁文件 `postmaster.pid`
- 本地 `127.0.0.1:5432` 无法响应
- 业务应用再去访问数据库时，就统一表现成数据库连接异常

---

## 二、直接报错现象

### 1. 业务侧报错

登录时应用层返回：

```text
503 Service Unavailable
数据库连接异常、请稍后重试
```

这部分对应后端鉴权中间件的兜底逻辑，代码位置在：

- [backend/middleware/auth.py](/Users/wy770/Resume-Agent/backend/middleware/auth.py)

当数据库连接类异常出现时，这里会把底层异常包装成业务可见的 `503`。

### 2. 数据库驱动层报错

之前从日志里看到过两类关键信息：

```text
psycopg.OperationalError: connection failed:
connection to server at "106.53.113.137", port 5432 failed:
server closed the connection unexpectedly
```

以及：

```text
FATAL: the database system is in recovery mode
```

这说明问题已经不在前端、也不在普通 SQL 写错，而是在 PostgreSQL 服务本身状态不正常。

### 3. PostgreSQL 服务启动失败报错

后面在服务器上直接重启 PostgreSQL 时，出现了最关键的一条：

```text
FATAL:  could not create lock file "postmaster.pid": No space left on device
```

这条错误基本直接把根因指向了磁盘空间耗尽。

---

## 三、背景问题：本次事故前已经存在的数据库历史问题

这次故障排查过程中，还顺带暴露了两个历史问题。它们不是这次 PostgreSQL 宕掉的直接原因，但确实会让“登录失败”“数据库异常”这类现象更复杂。

### 1. `users` 表结构和代码预期不一致

此前登录报错里出现过：

```text
psycopg.errors.UndefinedColumn: column users.last_login_ip does not exist
```

这表示代码已经在读写 `users.last_login_ip`，但线上库里这个字段没有。

进一步核对后发现：

- 当前仓库 `dev` 分支的 Alembic 最新迁移版本是 `014`
- 线上库里一度记录过不存在于代码库中的 `016`
- 说明数据库迁移链存在漂移，线上状态与仓库不一致

相关迁移目录：

- [backend/alembic/versions](/Users/wy770/Resume-Agent/backend/alembic/versions)

### 2. `users` 表里缺少大量历史用户记录

后续检查发现：

- `resumes` 表中有很多 `user_id`
- 但 `users` 表里并没有对应用户

也就是出现了“简历还在，但用户主表记录没了”的情况。这会导致：

- 登录后用户态异常
- 业务数据孤儿化
- 后台统计或查询行为不稳定

---

## 四、排查思路

这次我们实际走的是一个比较标准的排障链路：

1. 先确认应用是不是连不上数据库
2. 再确认数据库地址、端口、环境变量有没有配错
3. 再判断是网络不通、数据库拒绝连接，还是数据库自身挂了
4. 最后下沉到主机层看服务状态、日志、磁盘、进程

这个顺序很重要，因为“数据库连接异常”只是表象，真正的根因可能在应用、连接串、数据库实例、系统资源四个不同层面。

---

## 五、排查过程与使用的命令

下面按实际排查顺序整理。

### 1. 先确认应用进程是否还活着

使用命令：

```bash
ps -ef | grep -E "uvicorn|backend.main|python" | grep -v grep
```

查到结果：

```text
root 701979 ... /www/wwwroot/Resume-Agent/venv/bin/python3 /www/wwwroot/Resume-Agent/venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 9000
```

结论：

- 后端进程还在
- 不是“应用进程根本没启动”
- 问题更像是应用启动着，但依赖的数据库不可用

### 2. 确认应用工作目录与日志出口

使用命令：

```bash
readlink -f /proc/701979/cwd
ls -l /proc/701979/fd/1 /proc/701979/fd/2
```

查到结果：

```text
/www/wwwroot/Resume-Agent
/proc/701979/fd/1 -> socket:[...]
/proc/701979/fd/2 -> socket:[...]
```

结论：

- 当前运行代码目录是 `/www/wwwroot/Resume-Agent`
- 标准输出和错误输出被接到了 socket，不是直接落在当前 shell
- 所以后续需要从项目日志目录和 systemd / PostgreSQL 日志两边同时查

### 3. 检查项目日志目录

使用命令：

```bash
cd /www/wwwroot/Resume-Agent
find logs -type f -printf '%TY-%Tm-%Td %TH:%TM %p\n' | sort | tail -30
```

关键结果：

- `logs/backend/backend/2026-05-22.log` 在 `2026-06-12 13:20` 还有更新
- 大量历史日志已经被打包成 `.zip`
- 但日志文件名日期长期停留在 `2026-05-22`

结论：

- 日志轮转策略存在异常或命名策略有问题
- 但这还不能直接说明数据库故障原因
- 只能说明日志线索不够直观，需要继续往系统层排

### 4. 确认当前数据库连接配置到底指向哪里

使用命令：

```bash
grep -nE "USE_POSTGRESQL|POSTGRESQL_URL|DATABASE_URL|MYSQL" .env
```

查到结果：

```text
8:# DATABASE_URL=mysql+pymysql://resume_user:0000@106.53.113.137:3306/resume_db
12:POSTGRESQL_URL=postgresql+psycopg://resume_user:0000@106.53.113.137:5432/resume_db
15:USE_POSTGRESQL=true
```

结论：

- 当前业务明确在用 PostgreSQL
- MySQL 配置只是注释掉的旧配置
- 所以 `users` 表、登录问题、运行时所有连接，查的都应该是 PostgreSQL，不是 MySQL

对应代码在：

- [backend/database.py](/Users/wy770/Resume-Agent/backend/database.py)

该文件里会根据环境变量优先选择 PostgreSQL 连接串。

### 5. 直接验证当前连接到的是不是 PostgreSQL

使用命令：

```bash
venv/bin/python3 - <<'PY'
from sqlalchemy import text
from backend.database import engine

with engine.connect() as conn:
    print("current_database:", conn.execute(text("select current_database()")).scalar())
    print("current_schema:", conn.execute(text("select current_schema()")).scalar())
    print("version:", conn.execute(text("select version()")).scalar())
PY
```

查到结果：

```text
current_database: resume_db
current_schema: public
version: PostgreSQL 15.15 ...
```

结论：

- 线上现在访问的是 PostgreSQL 15
- 数据库名是 `resume_db`
- `users` 表确实在 PostgreSQL 的 `public` schema 下

### 6. 检查 `users` 表结构，确认 schema 是否异常

使用命令：

```bash
venv/bin/python3 - <<'PY'
from sqlalchemy import text
from backend.database import engine

with engine.connect() as conn:
    for row in conn.execute(text("""
        select column_name, data_type, column_default, is_nullable
        from information_schema.columns
        where table_schema='public' and table_name='users'
        order by ordinal_position
    """)):
        print(row)
PY
```

查到结果里关键的一版是：

```text
('id', 'integer', "nextval('users_id_seq'::regclass)", 'NO')
('last_login_ip', 'character varying', None, 'YES')
('api_quota', 'integer', None, 'YES')
('role', 'character varying', "'user'::character varying", 'NO')
('pdf_download_count', 'integer', '0', 'NO')
```

这一步的价值是：

- 确认 `users` 表后来已经修到了 PostgreSQL 上
- 自增序列也恢复了
- 说明登录接口最早期的 `UndefinedColumn` 问题已经不再是当前主故障

### 7. 检查 Alembic 迁移状态

一开始在项目根目录执行：

```bash
venv/bin/alembic -c backend/alembic.ini current
venv/bin/alembic -c backend/alembic.ini heads
```

报错：

```text
FAILED: Path doesn't exist: '/www/wwwroot/Resume-Agent/alembic'
```

原因是 Alembic 脚本目录相对路径是基于 `backend/` 目录的，不是在仓库根执行。

改到 `backend/` 目录再执行：

```bash
cd /www/wwwroot/Resume-Agent/backend
../venv/bin/alembic -c alembic.ini current
../venv/bin/alembic -c alembic.ini heads
../venv/bin/alembic -c alembic.ini upgrade head
```

结果：

```text
ERROR ... Can't locate revision identified by '016'
014 (head)
```

结论：

- 代码库最新迁移版本只有 `014`
- 线上数据库曾记录到不存在的 `016`
- 这是一条非常明确的 schema 漂移证据

### 8. 检查业务数据是否异常

使用命令：

```bash
venv/bin/python3 - <<'PY'
from sqlalchemy import text
from backend.database import engine

tables = ["users", "resumes", "agent_conversations", "agent_messages"]
with engine.connect() as conn:
    for table in tables:
        try:
            count = conn.execute(text(f"select count(*) from {table}")).scalar()
            print(table, count)
        except Exception as e:
            print(table, "ERR", e)
PY
```

结果一度是：

```text
users 2
resumes 88
agent_conversations 3
agent_messages 14
```

继续查：

```bash
venv/bin/python3 - <<'PY'
from sqlalchemy import text
from backend.database import engine

with engine.connect() as conn:
    print("resumes by user_id:")
    for row in conn.execute(text("select user_id, count(*) from resumes group by user_id order by user_id")):
        print(row)
PY
```

发现很多 `resumes.user_id` 对应不到 `users.id`。

再用更直接的孤儿数据检查：

```bash
venv/bin/python3 - <<'PY'
from sqlalchemy import text
from backend.database import engine

with engine.connect() as conn:
    orphan_ids = [r[0] for r in conn.execute(text("""
        select distinct r.user_id
        from resumes r
        left join users u on u.id = r.user_id
        where u.id is null
        order by r.user_id
    """))]
    print(orphan_ids)
PY
```

查到孤儿用户 ID：

```text
[9, 16, 17, 18, 19, 20, 21, 22, 23, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 40, 41, 42, 53]
```

结论：

- 不是“数据库全没了”
- 而是“用户主表缺失了一批记录，但业务简历数据还在”

### 9. 检查 PostgreSQL 服务状态

真正逼近主故障的关键步骤，是直接去看数据库服务：

```bash
systemctl status postgresql --no-pager
systemctl status postgresql-15 --no-pager
pg_isready -h 127.0.0.1 -p 5432
```

当时查到：

```text
postgresql.service Active: active (running)
pg_isready -> 127.0.0.1:5432 - no response
postgresql-15.service could not be found
```

这个现象很关键。

它说明：

- systemd 认为服务“在运行”
- 但 PostgreSQL 实际已经不能接受本机连接

这时就不能只看 `systemctl active`，必须继续看重启和日志。

### 10. 尝试重启 PostgreSQL，逼出最直接错误

使用命令：

```bash
systemctl restart postgresql
sleep 3
systemctl status postgresql --no-pager
pg_isready -h 127.0.0.1 -p 5432
ps -ef | grep postgres | grep -v grep
```

得到最关键结果：

```text
FATAL: could not create lock file "postmaster.pid": No space left on device
127.0.0.1:5432 - no response
```

到这里，根因已经非常清楚了：

- 不是账号密码错
- 不是端口不通
- 不是应用代码把数据库打挂了
- 是服务器磁盘空间用尽，导致 PostgreSQL 连启动锁文件都创建不了

### 11. 检查磁盘空间

使用命令：

```bash
df -h
```

当时结果是：

```text
/dev/vda1 40G 40G 28K 100% /
```

结论：

- 根分区已经 100% 用满
- PostgreSQL 报 `No space left on device` 完全吻合

### 12. 看系统级报错

辅助使用命令：

```bash
dmesg | tail -100
journalctl -u postgresql -n 200 --no-pager
journalctl -xeu postgresql.service
```

其中还看到过类似：

```text
systemd-journald: Failed to open system journal: No space left on device
```

这进一步说明不是 PostgreSQL 自己单点出问题，而是整个系统磁盘层面都已经吃满。

### 13. 查是谁把磁盘打满了

先做目录级扫描：

```bash
du -xh / --max-depth=1 2>/dev/null | sort -h
du -xh /var --max-depth=2 2>/dev/null | sort -h | tail -50
du -xh /www --max-depth=3 2>/dev/null | sort -h | tail -50
du -xh /var/lib/docker --max-depth=3 2>/dev/null | sort -h | tail -50
```

查到的大头包括：

- `/var` 约 15G
- `/www` 约 13G
- `/root` 约 6.8G
- `/var/lib/docker` 约 12G
- `/www/wwwroot/Resume-Agent` 约 8.7G

其中最异常的是 Docker 目录继续深挖后出现一个单目录约 `5.6G`。

### 14. 定位到具体容器日志文件

使用命令：

```bash
docker ps -a --no-trunc | grep f2bf3e893482
ls -lh /var/lib/docker/containers/f2bf3e89348281d65ed829f298a290a88b5b448a7f49ca6bf7f8d85d01ef72cd
```

查到结果：

```text
f2bf3e893482...   grafana/loki:2.9.8   ...   observability-loki-1
...
5.6G f2bf3e893482...-json.log
```

结论：

- 元凶是 `observability-loki-1`
- 不是业务后端容器
- 是 Loki 这个观测组件的 Docker JSON 日志文件失控增长到 `5.6G`

这一步把主故障真正闭环了。

---

## 六、根因分析

### 直接根因

Docker 默认 `json-file` 日志没有设置轮转，导致 Loki 容器日志持续增长，最终占满根分区。

### 触发链路

1. Loki 容器持续写日志
2. `/var/lib/docker/containers/...-json.log` 增长到 `5.6G`
3. 根分区空间被吃满
4. PostgreSQL 无法创建 `postmaster.pid`
5. PostgreSQL 不再对 `127.0.0.1:5432` 响应
6. 应用连接数据库时报 `OperationalError`
7. 登录接口被包装成 `503 数据库连接异常`

### 为什么会让人一开始误判

因为最表层看到的是：

- 登录接口失败
- 业务代码提示数据库异常
- 之前还夹杂过 schema 漂移、缺字段、用户数据不完整等历史问题

如果只看应用层日志，很容易误以为是：

- 数据库账号密码问题
- SQLAlchemy / psycopg 驱动问题
- 登录接口代码 bug
- 某次迁移没跑成功

但这次主故障真正的“第一推动力”是主机磁盘满了。

---

## 七、这次实际做了哪些修复

### 1. 先释放磁盘空间

最直接执行的是把超大日志截断：

```bash
truncate -s 0 /var/lib/docker/containers/f2bf3e89348281d65ed829f298a290a88b5b448a7f49ca6bf7f8d85d01ef72cd/f2bf3e89348281d65ed829f298a290a88b5b448a7f49ca6bf7f8d85d01ef72cd-json.log
```

执行后再看磁盘：

```bash
df -h
```

结果变成：

```text
/dev/vda1 40G 35G 5.6G 87% /
```

说明空间已经释放出来了。

### 2. 重启 PostgreSQL

使用命令：

```bash
systemctl restart postgresql
sleep 3
pg_isready -h 127.0.0.1 -p 5432
systemctl status postgresql --no-pager
ps -ef | grep postgres | grep -v grep
```

结果：

```text
127.0.0.1:5432 - accepting connections
```

并且进程恢复为完整的 PostgreSQL 子进程组：

- `logger`
- `checkpointer`
- `background writer`
- `walwriter`
- `autovacuum launcher`
- `logical replication launcher`

结论：

- PostgreSQL 服务恢复正常
- 数据库主故障解除

### 3. 给 Docker 增加日志轮转配置

查看当时 Docker 配置：

```bash
cat /etc/docker/daemon.json
docker inspect f2bf3e893482 --format '{{json .HostConfig.LogConfig}}'
```

最开始容器日志配置是：

```json
{"Type":"json-file","Config":{}}
```

也就是没有 `max-size` / `max-file`。

后续把 `/etc/docker/daemon.json` 调整为：

```json
{
  "registry-mirrors": [
    "https://mirror.ccs.tencentyun.com"
  ],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m",
    "max-file": "3"
  }
}
```

并用下面命令校验 JSON 格式：

```bash
python3 -m json.tool /etc/docker/daemon.json
```

### 4. 重启 Docker 还不够，还需要重建旧容器

Docker daemon 改配置后，存量容器不会自动继承新的日志策略。

这一点是后面通过命令验证出来的：

```bash
docker inspect f2bf3e89348281d65ed829f298a290a88b5b448a7f49ca6bf7f8d85d01ef72cd --format '{{json .HostConfig.LogConfig}}'
```

结果仍然是：

```json
{"Type":"json-file","Config":{}}
```

说明老容器没吃到新配置。

于是继续定位容器来源：

```bash
docker inspect f2bf3e893482 --format '{{json .Config.Labels}}'
```

查到 Compose 信息：

- 项目目录：`/opt/observability`
- Compose 文件：`/opt/observability/docker-compose.yml`
- 服务名：`loki`

因此对 Loki 单独重建：

```bash
cd /opt/observability
docker compose up -d --force-recreate loki
```

重建后再次校验：

```bash
docker ps | grep loki
docker inspect $(docker ps -qf name=observability-loki-1) --format '{{json .HostConfig.LogConfig}}'
```

结果变成：

```json
{"Type":"json-file","Config":{"max-file":"3","max-size":"100m"}}
```

这说明：

- 新日志轮转策略已经真正生效
- 未来 Loki 单容器日志不会再无限长大

---

## 八、与本次事故一起处理的数据库修复事项

虽然这些不是“磁盘打满”的直接根因，但因为都发生在同一轮排障中，还是需要记录。

### 1. 修复 `users` 表结构

之前曾补齐或确认以下字段存在：

- `last_login_ip`
- `api_quota`
- `role`
- `pdf_download_count`

同时修复了：

- `users.id` 自增序列
- `users_id_seq`
- 非空与默认值行为

### 2. 核对迁移版本漂移

确认结论：

- 仓库最新迁移版本是 `014`
- 线上库曾记录 `016`
- 线上 schema 状态不能再盲目信任 `alembic_version`

后续如果要彻底治理，需要补一份正式迁移对账方案。

### 3. 补回缺失用户占位记录

因为 `resumes` 里还有 88 条数据，但很多 `user_id` 没有对应 `users` 记录，所以临时恢复了一批占位用户，命名为：

- `restored_user_9`
- `restored_user_16`
- `restored_user_17`
- ...

邮箱格式统一是：

- `restored_user_<id>@restored.local`

初始密码统一按用户要求设置为：

- `000000`

这一步的目的不是“准确恢复真实用户名”，而是：

1. 先把外键关系补齐
2. 保住现有简历数据可关联
3. 给后续从备份中恢复真实用户资料留出空间

因此这些名字本质上是“占位恢复账号名”，不是原始真实用户名。

### 4. 调整管理员账号

后续按实际需要做了两件事：

1. 删除 `(1, 'admin', 'admin@lawmind.com', 'user')`
2. 将 `(3, 'cocoyu', 'cocoyu', 'user')` 提升为 `admin`

---

## 九、对象存储（COS）相关补充结论

这轮排查里还检查了用户照片上传与 COS 存储规则，结论如下。

### 1. 照片上传代码位置

相关代码在：

- [backend/routes/photos.py](/Users/wy770/Resume-Agent/backend/routes/photos.py)

### 2. 照片的 COS 路径规则

照片不是按“简历 ID”存的，而是按“当前用户账号”存的，大致结构是：

```text
users/<account>/photos/<uuid>.<ext>
```

这意味着：

- 照片归属逻辑是“用户级”
- 不是“每份简历单独一套图片目录”

### 3. COS 现存数据还在

之前核查结果显示：

- Bucket：`resumecos-1327706280`
- Region：`ap-guangzhou`
- 总对象数：`90`
- `users/` 前缀下对象数：`43`

所以对象存储本身没有随这次数据库事故一起丢失。

但要注意：

- 如果数据库里恢复出来的是 `restored_user_*`
- 而 COS 里原来目录是旧账号名或手机号/邮箱名

那么数据库用户记录和 COS 目录名之间，后续仍可能需要做映射修复。

---

## 十、最终结论

### 本次主故障结论

本次“数据库连接异常、请稍后重试”的核心原因，不是代码 bug，不是数据库账号密码错，也不是 PostgreSQL 版本问题，而是：

> `observability-loki-1` 容器日志无限增长，打满了根分区，导致 PostgreSQL 无法创建 `postmaster.pid`，最终数据库无法响应连接。

### 已完成处置

1. 截断 Loki 超大日志文件，释放磁盘空间
2. 重启 PostgreSQL，恢复数据库服务
3. 给 Docker 增加全局日志轮转配置
4. 单独重建 Loki 容器，使新日志策略真正生效
5. 记录并修复了部分历史数据库 schema 与用户数据问题

### 当前状态

从本轮排查结果看：

- PostgreSQL 已恢复可连接
- `pg_isready` 返回 `accepting connections`
- Docker 日志轮转已对新建 Loki 容器生效
- `resumes` 记录仍在
- `users` 与 `resumes` 的孤儿关联已被补齐

---

## 十一、后续建议

### 1. 给服务器加基础巡检

至少应该长期监控：

- 根分区使用率
- `/var/lib/docker` 增长速度
- PostgreSQL 可用性
- Docker 容器日志大小

建议阈值：

- 磁盘使用率超过 `80%` 告警
- 超过 `90%` 触发人工处理

### 2. 给观测组件单独控量

像 Loki、Promtail、Prometheus 这类组件本身就是高日志/高时序写入源，应该：

- 单独设置日志轮转
- 单独关注数据目录增长
- 避免“观测系统把业务系统磁盘吃死”

### 3. 做一次数据库 schema 对账

建议后续补一轮正式核查：

1. 以仓库 `backend/alembic/versions` 为准梳理当前应该有哪些结构
2. 导出线上实际表结构
3. 列出差异清单
4. 用正式迁移脚本而不是临时手工 SQL 收口

### 4. 找备份恢复真实用户信息

当前恢复的很多用户是占位账号。更完整的修复方案仍然是：

- 从数据库备份、宝塔备份、SQL dump、历史导出文件中找回真实 `users` 数据
- 再把占位用户逐步替换为真实用户资料

### 5. 做一次“数据层”和“对象存储层”的账号映射核对

因为数据库里的用户标识和 COS 目录可能已经不一致，后续建议专门核对：

- 用户表账号字段
- 现有 COS 目录名
- 简历归属用户 ID
- 上传照片时的账号映射关系

---

## 十二、这次排障里最关键的几个经验

### 经验 1：不要被业务报错文字带偏

“数据库连接异常”并不等于数据库配置错，也不等于 SQL 写错。它只是应用层对底层失败的一个统一包装。

### 经验 2：`systemctl active` 不等于服务真的可用

这次最典型的现象就是：

- `postgresql.service` 看起来是 `active`
- 但 `pg_isready` 明确返回 `no response`

真正判断数据库是否可用，要看：

- 本机连接是否通
- 端口是否响应
- 实际 SQL 是否能执行

### 经验 3：磁盘满会伪装成很多种问题

磁盘打满之后，表面可能看起来像：

- 数据库恢复模式
- 服务无响应
- 日志缺失
- 应用连接断开
- 系统日志都写不进去

所以系统资源层永远要尽早检查。

### 经验 4：观测组件也可能是事故源头

Loki 是拿来收日志的，结果它自己的 Docker 日志没轮转，反过来把数据库搞挂了。这类问题很典型，也很值得长期防范。

---

## 十三、附录：本次高频使用命令清单

### 进程与服务

```bash
ps -ef | grep -E "uvicorn|backend.main|python" | grep -v grep
readlink -f /proc/<pid>/cwd
ls -l /proc/<pid>/fd/1 /proc/<pid>/fd/2
systemctl status postgresql --no-pager
systemctl restart postgresql
pg_isready -h 127.0.0.1 -p 5432
ps -ef | grep postgres | grep -v grep
```

### 日志与系统排查

```bash
find logs -type f -printf '%TY-%Tm-%Td %TH:%TM %p\n' | sort | tail -30
journalctl -u postgresql -n 200 --no-pager
journalctl -xeu postgresql.service
dmesg | tail -100
df -h
du -xh / --max-depth=1 2>/dev/null | sort -h
du -xh /var/lib/docker --max-depth=3 2>/dev/null | sort -h | tail -50
```

### 数据库确认

```bash
grep -nE "USE_POSTGRESQL|POSTGRESQL_URL|DATABASE_URL|MYSQL" .env
venv/bin/python3 - <<'PY'
from sqlalchemy import text
from backend.database import engine
with engine.connect() as conn:
    print(conn.execute(text("select version()")).scalar())
PY
```

### 迁移检查

```bash
cd backend
../venv/bin/alembic -c alembic.ini current
../venv/bin/alembic -c alembic.ini heads
../venv/bin/alembic -c alembic.ini upgrade head
```

### Docker 日志定位与修复

```bash
docker ps -a --no-trunc | grep <container_id>
ls -lh /var/lib/docker/containers/<container_id>
truncate -s 0 /var/lib/docker/containers/<container_id>/<container_id>-json.log
docker inspect <container_id> --format '{{json .HostConfig.LogConfig}}'
cat /etc/docker/daemon.json
python3 -m json.tool /etc/docker/daemon.json
docker inspect <container_id> --format '{{json .Config.Labels}}'
cd /opt/observability
docker compose up -d --force-recreate loki
docker inspect $(docker ps -qf name=observability-loki-1) --format '{{json .HostConfig.LogConfig}}'
```

---

## 十四、复盘一句话版

这次不是应用把数据库写坏了，而是 Loki 容器日志把服务器磁盘写满了，PostgreSQL 因为没有可用空间而起不来，业务层才统一报成“数据库连接异常”；处理方式是先释放磁盘、恢复 PostgreSQL，再补上 Docker 日志轮转，防止同类事故再次发生。

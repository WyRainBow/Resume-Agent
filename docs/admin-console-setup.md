# Admin Console Setup

## 1. Run backend migrations

```bash
cd /Users/wy770/Resume-Agent/backend
alembic upgrade head
```

## 2. Start backend

```bash
cd /Users/wy770/Resume-Agent
uvicorn backend.main:app --reload --port 9000
```

## 3. Start admin console

```bash
cd /Users/wy770/Resume-Agent/admin-console
npm install
npm run dev
```

Default dev URL: `http://localhost:5175`

## Notes

- Backend admin routes are mounted under `/api/admin/*`.
- Access requires JWT with role `admin` or `member`.
- `member` cannot operate `admin` accounts when updating role/quota.
- Request/error/trace logs are persisted by middleware automatically.

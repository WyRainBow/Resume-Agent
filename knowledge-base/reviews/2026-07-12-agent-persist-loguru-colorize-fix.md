# Agent 整份优化断连 + loguru 崩溃修复记录

- 日期：2026-07-12
- 关联文件：`backend/agent/tool/resume_data_store.py`、`backend/agent/web/routes/stream.py`、`backend/core/logger.py`
- 状态：**✅ 已修复并推送，待部署**

---

## 一、问题现象

1. 用户在 agent 对话里说"优化我的简历"，agent 从教育经历开始优化，优化到一半前端报 Network Error 断开
2. 优化过程中 agent 输出很久，前端一直显示"正在整理..."loading 不结束
3. pm2 重启 81 次（线上）

---

## 二、根因：三个独立 bug

### Bug 1：persist_data 查不到 resume_id → 修改只在内存生效

**文件**：`backend/agent/tool/resume_data_store.py:148-153`

用户当前的 `resume_latex_xxx` 在 `resumes` 表里不存在（LaTeX 简历前端创建后未入库）。`persist_data` 查不到记录直接返回 False，agent 的修改只在内存里生效，没有落盘。

```python
# 改前
if not resume:
    return False  # ← 修改只在内存，断连后丢失

# 改后
if not resume:
    resume = Resume(id=resume_id, user_id=user_id, name=name, data=resume_data)
    db.add(resume)  # ← 自动创建 DB 记录
```

### Bug 2：session switch 中断 SSE 流时内存修改丢失

**文件**：`backend/agent/web/routes/stream.py:502-506`

用户在 agent 还在优化时，前端因超时重连/网络抖动发起新 SSE 请求。后端检测到同一 conversation 有 active stream，停掉旧的——内存里未持久化的修改丢失。

```python
# 改前：直接停旧流
await stream_processor.stop_stream(conversation_id, reason="session_switch")

# 改后：先落盘再停
ResumeDataStore.persist_data(conversation_id)
await stream_processor.stop_stream(conversation_id, reason="session_switch")
```

### Bug 3：loguru colorizer 遇 HTML 标签崩溃（pm2 重启 81 次根因）

**文件**：`backend/core/logger.py:155, 162`

agent 输出含 HTML 标签（`<li>`、`<p>`、`<strong>`）的日志消息时，loguru 的 colorizer 把 HTML 标签当成颜色指令解析，抛 `ValueError: Tag "<li>" does not correspond to any known color directive`。

这个崩溃会导致：
- 日志 handler 异常，SSE 的 `complete` 事件可能发不出去 → 前端一直 loading
- 严重时进程崩溃 → pm2 重启

```python
# 改前
logger.add(sys.stdout, colorize=True, ...)
logger.add(sys.stderr, colorize=True, ...)

# 改后
logger.add(sys.stdout, colorize=False, ...)
logger.add(sys.stderr, colorize=False, ...)
```

---

## 三、三个 bug 的因果关系

```
Bug 3 (loguru colorizer 崩溃)
  → SSE complete 事件发不出去
  → 前端一直"正在整理..."loading
  → 用户以为卡了，刷新/重发
  → 触发 Bug 2 (session switch)
  → 旧流被停，内存修改丢失
  → Bug 1 (persist 失败) 让修改本来就没落盘
  → 用户看到 Network Error + 修改全丢
```

Bug 3 是触发链的起点，Bug 1 是数据丢失的根因，Bug 2 是放大器。

---

## 四、改动清单

| 文件 | 改动 | 修复的 Bug |
|---|---|---|
| `backend/agent/tool/resume_data_store.py:148` | resume_id 查不到时自动创建 DB 记录 | Bug 1 |
| `backend/agent/web/routes/stream.py:505` | session switch 前先 persist_data 落盘 | Bug 2 |
| `backend/core/logger.py:155,162` | colorize=True → False | Bug 3 |

---

## 五、已知遗留问题（review 要点）

1. **resume_latex 创建时未入库**：前端 `CocoChat.tsx` 创建 `resume_latex_xxx` ID 后没有同步创建 DB 记录，导致 persist 时查不到。本次用"自动创建"兜底，但根因是前端创建流程缺失入库步骤。建议后续在前端创建简历时调后端 API 确保 DB 记录存在。

2. **qwen-max 偶发 Completion=0**：长 prompt（20000+ tokens）时 qwen-max 偶发返回空响应（Completion=0），触发 tenacity 重试。当前 `max_retries=3` 能兜住，但会浪费 10-15s。可能需要调整 prompt 长度或换模型。

3. **session switch 的触发条件**：当前 session switch 的触发包括前端超时重连、用户重发、多 tab。建议给前端 SSE 客户端加去重逻辑，避免 agent 还在跑时就发新请求。

---

## 六、验证

- 本地测试：agent 优化简历完整跑完，`Successfully persisted resume` 日志出现，不再有"持久化失败"
- loguru 不再抛 `ValueError: Tag "<li>"`
- 前端 loading 正常结束（agent 完成后收到 complete 事件）

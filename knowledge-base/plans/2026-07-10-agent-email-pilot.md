# Agent 邮件试点实施计划(v1 收敛版)

> 设计:`knowledge-base/specs/2026-07-10-agent灵魂感改造总体方案.md` §8(主笔修订版)
> 分支:`feature/agent-email-pilot` · 基线 commit `799dcb4e`(确认卡片雏形)
> 场景:admin 帮别人优化简历 → 把优化后简历 PDF 发给对方,正文=「改了什么 + 进一步建议」

**目标**:①事件透传去白名单(新工具/新事件零注册);②发送确认从 prompt 约定升级为**运行时挂起协议**,确认卡三字段可编辑,发出的是用户改后的版本;③LLM 基于会话真实优化记录起草建议正文,缺信息主动问。

**纪律(冻结令)**:`Manus.think()` 不新增任何 if 分支;邮件链路完全走 ReAct loop(现状已如此——邮件意图落 UNKNOWN 由 LLM 选工具,保持)。

## Task 1 后端:structured 通用透传(Phase 0 瘦身版)

- Modify `backend/agent/agent/toolcall.py:86-243`:`_store_structured_tool_result` 开头删工具名 gate;新增通用路径——任意 ToolResult 的 `system` 字段可 json 解析为含 `type` 的 dict 即存入 `_tool_structured_results`(解析失败 logger.warning,不静默);web_search/show_resume 两段无 system 的特例分支保留;cv_editor/cv_reader/generate_resume 的 setdefault 元数据注入保留(在通用存入后按名补充)
- Modify `backend/agent/web/streaming/agent_stream.py:1069-1075`:删工具名白名单,一律 `get_structured_tool_result(tool_call_id)`
- Test `backend/tests/test_structured_passthrough.py`:虚构工具名 + system JSON → 能存入并被 get 取到;system 非 JSON → 不炸、有日志;现有 send/editor 用例回归

## Task 2 前端:type→组件注册表通用管线

- Create `frontend/src/components/agent-chat/StructuredCardRegistry.tsx`:`Record<type, FC<{data, ...ctx}>>` + `renderStructuredCards(items)`;未知 type 渲染极简折叠 JSON 兜底卡
- Modify `frontend/src/hooks/agent-chat/useToolEventRouter.ts`:特例分支之后加通用分支——`structured.type` 存在且未被特例消费 → `upsertStructuredEvent("current", structured)`(dedupe 同现有模式)
- Modify `frontend/src/pages/AgentChat/CocoChat.tsx`:一组 `structuredEvents` state + upsert + finalize rebind + 三处清理(与现有 email 组同位置);props 传给 MessageTimeline/StreamingLane
- Modify `MessageTimeline.tsx` / `StreamingLane.tsx`:各加一个通用渲染块(按 messageId 过滤 → registry 渲染);旧 6 组不迁移
- 验证:`npm run build`;造一个假 type 事件出兜底卡

## Task 3 后端:requires_approval 运行时挂起

- Modify `backend/agent/tool/base.py`:`BaseTool.requires_approval: bool = False`
- Create `backend/agent/approval.py`:进程内 pending 表 `{approval_id: {session_id, user_id, tool_name, args, created_at}}`;TTL 10 分钟;同 session 新 pending 顶替旧的;`create/get_valid/pop/cancel`
- Modify `backend/agent/agent/toolcall.py execute_tool`:工具 `requires_approval` 且未带内部 `_approved` 标记 → 不执行;先跑工具的 `validate_before_approval()`(如有)让注定失败的调用提前报错;创建 pending;返回 ToolResult(output="已生成待确认的发送请求…", system=json `{type:"approval_request", payload:{approval_id, tool_name, args, editable_fields, attachment_label}}`);act() 检测到 approval_request 结果 → `self.state = FINISHED`(确定性终止,不靠模型自觉)
- Modify `backend/agent/tool/send_resume_email_tool.py`:
  - 删 `confirm` 参数与 description 里的两段式约定;`requires_approval = True`
  - 参数:`to_email`(必填)、`subject`、`body`(必填;description 明确:基于本会话的优化/诊断记录,写「本次改了什么 + 进一步建议」,对收件人称呼友好;不知道收件人邮箱/称呼时先向用户提问,不要编造)
  - 新增 `validate_before_approval`:邮箱格式、会话有简历、admin/凭证存在——确认前即报错
  - `_approved` 路径 = 现 `_do_send`(admin 查库、限频、渲染 PDF、SMTP 全保留)
- Create `backend/agent/web/routes/approval.py`(挂到 `/api/agent`):`POST /approval` `{approval_id, action: approve|cancel, params?}`;鉴权 `get_current_user` + pending 归属校验;approve → 用 pending.args 合并用户改后 params(仅 editable_fields)→ 直接 `tool.execute(**merged, _approved=True)` 同步执行 → 返回 `{ok, message}`;cancel → 丢弃 pending
- 注册路由:`backend/agent/web/routes/__init__.py`(或 main.py agent 挂载处,查现状对齐)

## Task 4 前端:可编辑 ApprovalCard + 端点接线

- Create `frontend/src/components/agent-chat/ApprovalCard.tsx`:to_email/subject 输入框 + body textarea(默认值=payload.args),附件行(attachment_label),「取消 / 确认发送」;确认 → `POST /api/agent/approval`(走 getApiBaseUrl + buildAuthHeaders 模式);成功 → 卡片态"✅ 已发送"+ 禁用;取消同理;失败显示错误文案可重试
- 注册进 StructuredCardRegistry(type=approval_request)
- 删旧链路:useToolEventRouter 的 send_resume_email_confirm 分支、CocoChat 的 emailConfirmEvents 组 state/upsert/rebind/清理/handler、MessageTimeline/StreamingLane 的 SendEmailConfirmCard 接线、`SendEmailConfirmCard.tsx` 文件(被 ApprovalCard 取代)
- 验证:`npm run build` + tsc 过滤本次文件零错误

## Task 5 测试与全链路验证

- pytest:未批准任何路径不发送(mock SMTP 断言零调用)/ approve 带改后 body 发送参数=改后值 / cancel 后 pending 失效 / TTL 过期 / 非本人 approval 403 / 限频与 admin 校验保留 / validate 提前失败不产生 pending
- 回归:`test_send_resume_email_tool.py` 改造适配新协议
- 浏览器实测(9100/5173/3000):加载简历 → 让 Coco 优化一处 → "把简历发给 xxx@qq.com,告诉他改了什么" → 确认卡出现且正文含真实优化内容 → 改正文两句 → 确认 → 收件箱验证正文=改后版、附件可开
- 完成后:`verification-before-completion`,commit(不合并不推送,等验收)

## 明确不做(v1)

三工具拆分、SessionWorkspace、模型分层、旧 6 组事件迁移、think() 既有分支改动、EntityMemory 删除(另开小 commit 单独做)。

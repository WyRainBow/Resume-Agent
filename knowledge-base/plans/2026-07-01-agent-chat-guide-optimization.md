# AgentChat 引导优化方案

- **日期**：2026-07-01
- **状态**：已调查透彻，待实现（尚未写代码）
- **分支**：feature/07-01/02
- **背景**：当前"对话创建"点下去会立即生成一份"张三占位简历"，再让用户逐条改（姓名/实习/技能），体验鸡肋。目标：改成"你说经历 → AI 直接生成**你的**简历"，并把空态引导改成清晰的 3 条路径。

---

## 一、根因（比"改文案"深一层）

1. `generate_resume` 工具已注册进 Manus（`backend/agent/agent/manus.py:149`），能从 `user_background`（用户自述经历）生成简历 JSON。
2. **但 manus 系统提示词里完全没引导 Agent 去调它** —— 用户说了经历，Agent 也不会触发生成。
3. **前端 `resume_generated` 事件是残废的**：`SophiaChat.tsx:1463` 收到事件后只 `setGeneratedResume(...)` 弹了一张 `ResumeGeneratedCard` 卡片，**从没把简历 `applyResumeToChat` 落地到右侧预览**。
   - 对比：张三链路 `createDefaultResumeInChat → applyResumeToChat` 是落地预览的。
4. `ResumeGeneratedCard` 有「导入到编辑器」/「放弃」两个按钮（走 `ResumeContext.setResume`）。

> **结论**：真正的活不是改文案，是**把"真实生成 → 落地预览"这条一直断着的主链路接通**，然后才能安全废掉张三。

---

## 二、当前触发"张三占位"的 3 个入口（都要改）

- `handleFillCreateResumePrompt`（3909）= 发送咒语 `CREATE_DEFAULT_RESUME_PROMPT="帮我创建一份模板默认简历"` → 空态卡片(4190) + 问候胶囊(4288) + ResumeSelector(4336) 都走它
- `sendUserTextMessage` 里 `isCreateResumeIntentText` 分支（3529-3589）→ `createDefaultResumeInChat` 造张三 + "示例简历/怎么改"文案
- `handleCreateResume`（3425）→ 造张三 + 同文案，用于 ResumeSelector 的 `onCreateResume`(4334)
- ⚠️ `DEFAULT_RESUME_TEMPLATE`（张三模板常量）还被 `api.ts:643`、`templates.ts:55`、`Workspace/v2/constants.ts:284` 用 → **常量不能删**，只是 AgentChat 不再拿它造张三

---

## 三、改动清单

### 后端
1. **manus 系统提示词补 `generate_resume` 引导**【命门】：用户想创建 / 没有现成简历时，先引导他一句话说清"姓名 + 求职意向 + 教育 + 经历"，拿到后调 `generate_resume(job_description=求职意向, user_background=自述)`。
2. `greeting.py`：删掉"强推『帮我创建一份模板默认简历』+ 不要引导加载简历"（line 30/32/40/42），改成介绍 3 条路径 + 引导说经历。
3. `manus.py` 1835/1998、`load_resume.py` 35：同步改话术，不再念咒语。

### 前端
4. **`SophiaChat.tsx` `resume_generated`（1463）补落地**【核心】：`setGeneratedResume` 之外，把 `data.resume` 走 `saveResume + setCurrentResumeId + applyResumeToChat` 落地右侧预览（复用现成函数）。
5. `ChatEmptyState.tsx`：2 张卡片 → 3 张，新增"选择已有简历"，加 prop `onSelectExisting`。
6. `SophiaChat.tsx` 空态渲染（4189）：传 `onSelectExisting` = 打开 ResumeSelector。
7. `handleFillCreateResumePrompt`（3909）：不再发咒语造张三，改成追加一条引导消息「把你的情况告诉我：姓名 / 求职意向 / 教育 / 实习项目经历，怎么方便怎么说，我帮你生成；有现成的粘进来也行」+ 聚焦输入框。
8. `sendUserTextMessage` 的 `isCreateResumeIntentText` 分支（3529）：不造张三，改追加同款引导消息。
9. `handleCreateResume`（3425）：不造张三，改引导消息。
10. 清理孤儿：`createDefaultResumeInChat`、`CREATE_DEFAULT_RESUME_PROMPT`（若全部改完没人用）。

---

## 四、已定的设计决策（自己拍板，不再问）

- **空态**：3 条路径卡片（对话创建 / 导入已有 / 选择已有），废掉"先塞张三"。
- **"对话创建"交互 = 混合式**：默认自述（用户一段话说完 → 一次生成），说得少 / 漏了关键项（如没说求职意向）时生成后再追问补 —— 心里有数的人快，没头绪的人也照顾到。
- **生成后落地 = 自动进右侧预览**（走 applyResumeToChat），同时保留 `ResumeGeneratedCard` 卡片作为"这份生成结果"的确认/放弃入口。
- **张三模板常量保留**（工作台仍在用），仅 AgentChat 不再拿它造占位。

---

## 五、验证

- `cd frontend && npm run build`
- 实测走一遍：空态 3 卡片 / 点"对话创建"出引导语（不再蹦张三）/ 说一段经历 → 生成 → **右侧预览真的更新** / 打"你好" → 3 路径话术
- Agent/SSE：确认 `generate_resume` → `resume_generated` 事件 → 前端落地预览闭环

# AI 功能质量打磨（无 DB / 体验向）实施计划

> 日期：2026-06-19 ｜ 分支：feature/06-19/01 ｜ 模式：全自动执行（/goal）

收敛前两批新功能的已知瑕疵，不碰数据库。

## 子任务 1 · 划词改写 / 翻译 加粗保留
- 问题：改写整段加粗选区时模型可能返回纯文本，写回丢失 `<strong>`。
- 方案：前端写回链路兜底——
  - 新增 `normalizeApplyHtml(newContent, originalHtml)`：`**md**`→`<strong>`；若结果无标签且原选区整体被 `<strong>` 包裹，则重新包裹保留加粗。
  - 划词改写 apply 用它；翻译 prompt 再强化"保留 HTML 强调标签"。
- 完成标准：整段加粗选区改写/翻译后仍加粗；普通文本不受影响。
- 验证：curl（翻译保 strong）+ 浏览器（改写加粗段→应用后仍加粗）。

## 子任务 2 · 批量应用 setState 合并
- 问题：翻译/体检/JD「一键全部应用」循环调用 applyTextReplacement，多次 setState、触发 React dev warning。
- 方案：useResumeData 新增 `applyTextReplacements(items[])`，一次 setResumeData 应用所有替换；三个弹窗的 applyAll 改用单次批量回调（index.tsx 传入）。
- 完成标准：一键全部应用仅触发一次渲染；无 React warning。
- 验证：浏览器（一键全部应用后控制台无 setState-in-render 警告）。

## 子任务 3 · 整篇翻译并行化
- 问题：后端逐字段串行 call_llm（~50s）。
- 方案：`asyncio.gather` + `Semaphore` 限并发（如 5）并行翻译各字段，保持返回顺序；`call_llm` 同步调用用 `asyncio.to_thread` 包裹。
- 完成标准：输出顺序一致、无漏译、明显提速。
- 验证：curl 计时对比（多字段）。

## 子任务 4 · 收尾
- npm run build + 浏览器走查 + curl；knowledge-base 记录；执行总结。

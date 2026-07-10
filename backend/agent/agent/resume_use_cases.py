"""简历用例服务（Wave 2a-S3 自 Manus 迁入；2026-07-11 LLM-first 了断后清空）。

原诊断 payload 构造 / qwq 流式诊断报告 / OPTIMIZE_SECTION 6 步路由 / 整份优化
（含 LLM JSON 容错解析四函数）等方法，只被 AGENT_LLM_FIRST_ROUTING=false 的
规则分派路径调用；该回退能力已按 2026-07-11 计划物理删除——所有业务意图统一
交给 LLM ReAct loop（cv_analyzer_agent / cv_editor_agent 等工具由 LLM 自主
编排），本类随之清空，Manus 也不再实例化它。

文件本身是否删除或与其它模块合并，属于文件级决策，待用户确认后另行处理。
"""


class ResumeUseCases:
    """已无剩余用例；保留空类占位，等待文件级去留决策。"""

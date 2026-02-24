"""Prompts for the CVAnalyzer Agent."""

from backend.agent.prompt.base import PromptTemplate
from backend.agent.prompt.resume import ResumePromptTemplate

# ============================================================================
# 核心提示词（使用新模板系统）
# ============================================================================

SYSTEM_PROMPT = PromptTemplate.from_template("""你是简历分析协调者，负责调用模块分析工具并聚合结果。

可用工具：
- read_cv_context: 读取简历详细内容
- terminate: 结束任务

工作流程：
1. 调用 read_cv_context 了解简历结构
2. 根据简历内容输出分析报告并建议下一步

输出格式：
```
━━━━━━━━━━━━━━━━━━━━━
📊 正在分析...
━━━━━━━━━━━━━━━━━━━━━

【识别到】分析简历
【调用工具】read_cv_context

━━━━━━━━━━━━━━━━━━━━━
📋 分析结果
━━━━━━━━━━━━━━━━━━━━━

...
```

{star_framework}

{quality_metrics}
""").partial(
    star_framework="""## STAR 分析框架
请按以下维度分析每段工作/项目经历：
- Situation（情境）：工作背景和环境
- Task（任务）：具体职责和目标
- Action（行动）：采取的具体措施
- Result（结果）：量化的成果数据""",
    quality_metrics="""## 质量评估标准
- 完整性 (30%)：必填字段是否完整
- 清晰度 (25%)：表达是否清晰易懂
- 量化度 (25%)：成果是否有数据支撑
- 相关性 (20%)：与目标岗位的匹配度"""
)

NEXT_STEP_PROMPT = PromptTemplate.from_template("""协调模块分析工具，输出完整报告。

判断用户意图：
- 整体分析：分析我的简历、看看怎么样、评估简历
  → 调用 read_cv_context 了解结构后输出分析报告

【引导性对话风格】

输出要求：
- 必须输出"【识别到】XXX"和"【调用工具】XXX"状态信息
- 用户输入信息时，先确认理解再行动
- **询问用户**：需要用户提供具体信息时（如课程、奖项），先询问用户擅长的内容
- **补充建议**：在用户输入基础上，AI 可以补充相关建议
- cv_editor_agent 执行成功后，必须输出完整的确认信息
- 编辑成功后，展示更新后的内容
- 提醒用户查看右侧简历预览
- 给出2-3个具体的后续选项

## 对话示例（Few-shot）

【示例1：用户提供 GPA 信息 - 直接添加】
User: "我的 GPA 是 3.8/4，专业排名 15"
Assistant: "好的，您的 GPA 是 3.8/4，专业排名前15%。我将把这个信息添加到您的教育经历中。"
[调用 cv_editor_agent，工具返回：编辑成功]
Assistant: "好的，您的教育经历中已经添加了 GPA: 3.8/4，专业排名前15%。

请查看右侧简历预览，确认效果是否符合预期。如果右侧没有更新，请刷新页面（F5）或稍等几秒。

现在您的教育经历是：
- 学校：北京大学
- 学历：本科
- 专业：计算机科学与技术
- 时间：2022.09 - 2026.06
- GPA：3.8/4，专业排名前15%

接下来，您还希望继续优化教育经历，比如添加相关课程或项目成果吗？或者我们转向其他模块，例如工作经历或项目经历的优化？"

【示例2：用户说"添加课程" - 询问用户擅长的并举例】
User: "添加课程"
Assistant: "好的，我们来添加课程。

请您列举 2-3 门您认为与后端开发岗位高度相关，并且您表现优秀的课程。这些课程可以是专业核心课、选修课，甚至是您自学并掌握的课程。

例如（供参考）：
- 数据结构与算法
- 操作系统
- 计算机网络
- 数据库原理
- Java程序设计
- Web开发技术"

User: "数据结构与算法、数据库原理"
Assistant: "好的！我建议将您擅长的课程加入，并补充几门后端开发的核心课程：

您擅长的课程：数据结构与算法、数据库原理
我建议补充：操作系统、计算机网络、Java程序设计

这样能更全面地展示您的专业基础。我将把这些课程添加到您的教育经历中，您看可以吗？"

User: "可以"
Assistant: "好的，我将把这些课程添加到您的教育经历中。"
[调用 cv_editor_agent，工具返回：编辑成功]
Assistant: "好的，已经为您添加了相关课程。

请查看右侧简历预览，确认效果是否符合预期。

现在您的教育经历包含：
- 学校：北京大学
- 学历：本科
- 专业：计算机科学与技术
- 时间：2022.09 - 2026.06
- GPA：3.8/4
- 相关课程：数据结构与算法、数据库原理、操作系统、计算机网络、Java程序设计

接下来，您还希望添加荣誉奖项，还是继续优化其他模块？"

【重要】cv_editor_agent 返回成功后，必须输出类似以上的完整回复，不能只说"执行成功"。
""")

# ============================================================================
# 场景化 prompt
# ============================================================================

SIMPLE_ANALYSIS_PROMPT = PromptTemplate.from_template("""【分析数据】
基本信息: {basic_info}
亮点: [{highlight1}, {highlight2}, {highlight3}]
可优化点: [{issue1}, {issue2}, {issue3}]
最推荐: 【{recommendation}]
""")

DEEP_ANALYSIS_PROMPT = PromptTemplate.from_template("""## 📋 简历分析报告

【整体评价】
{overall_assessment}

【质量评分】
总分：{total_score}分（等级：{grade}）
- 完整性：{completeness}/30
- 清晰度：{clarity}/25
- 量化度：{quantification}/25
- 相关性：{relevance}/20

【主要亮点】
• {highlight1}
• {highlight2}
• {highlight3}

【可优化点】
• {issue1} - {suggestion1}
• {issue2} - {suggestion2}

【STAR 分析】
{star_analysis}

━━━━━━━━━━━━━━━━━━━━━
💡 我最推荐下一步：【{top_recommendation}】！

回复"开始优化"，我们马上开始！
""")

ERROR_PROMPT = PromptTemplate.from_template("""工具调用遇到错误，请检查参数后重试。

错误类型：{error_type}

常见问题：
- 简历数据未加载
- section 参数不正确
- 工具调用失败
""")

# ============================================================================
# 优化模式专用提示词
# ============================================================================

OPTIMIZE_MODE_PROMPT = PromptTemplate.from_template("""## 简历优化分析

【目标模块】
{target_section}

【当前问题分析】
{current_issues}

【优化建议】
{optimization_suggestions}

━━━━━━━━━━━━━━━━━━━━━
💡 您同意这样优化吗？回复"可以"、"同意"或"好的"开始优化。
""")

SECTION_OPTIMIZE_PROMPT = PromptTemplate.from_template("""## {section_name} 优化分析

【当前内容】
{current_content}

【STAR 评估】
- Situation: {situation_eval}
- Task: {task_eval}
- Action: {action_eval}
- Result: {result_eval}

【优化建议】
{suggestions}

【示例改写】
{example}

━━━━━━━━━━━━━━━━━━━━━
💡 您同意这样改写吗？
""")

# ============================================================================
# 向后兼容的字符串版本已移除，统一使用 PromptTemplate

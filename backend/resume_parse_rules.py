"""Shared LLM parsing rules for resume text extraction."""

RESUME_PARSE_EXTRA_RULES = """
3. 实习经历（极其重要，必须严格遵守）：
   - 每家公司/组织只有一条 internships 记录，绝不要把每条职责拆成独立 internship
   - 「公司-职位 时间」如「智谱-后端开发实习生 2025.08-至今」→ title=智谱, subtitle=后端开发实习生, date=2025.08-至今
   - 同一实习下的 bullet（- 架构设计：...、- 存储设计：... 等）全部放入该条的 highlights 数组
   - highlights 每项保留「标签：描述」格式，不要开头的 "- "
4. 项目经历补充（粘贴文本常见，无 markdown 标题时）：
   - 「项目经历：」后的第一行（如「多阶段异步处理框架 (实验室合作项目)」）是项目 title
   - 「项目背景：」「主要工作成果：」「性能优化成果：」等段落分别放入 description 或 highlights
   - 「- 架构设计：」「- 数据库设计：」等 bullet 放入该项目的 highlights，不要作为独立项目或 skills
5. 专业技能：只放编程语言、框架、工具等技能列表；不要把项目/实习的技术细节放进 skills
"""

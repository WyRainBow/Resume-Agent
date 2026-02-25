"""
PDF 简历解析 Prompts（从 agent 子模块迁移）
"""

SYSTEM_PROMPT = (
    "你是专业的简历结构化解析助手，擅长将多个数据源的简历信息精确融合为标准 JSON。\n\n"
    "核心能力：\n"
    "- 精确识别简历模块边界（教育/实习/项目/开源/技能/奖项）\n"
    "- 保留原始文档的格式特征（列表样式、嵌套层级）\n"
    "- 跨数据源的内容去重与补全\n"
    "- 严格遵守输出 schema，不遗漏不串条\n\n"
    "输出要求：只输出 JSON，不要任何解释、代码块标记或其他文字。"
)

OUTPUT_SCHEMA = (
    '{{"name":"姓名","contact":{{"phone":"电话","email":"邮箱","location":"地区"}},'
    '"objective":"求职意向",'
    '"format":{{"experience":{{"list_style":"bullet|numbered|none"}},"skills":{{"list_style":"bullet","has_category":true}}}},'
    '"education":[{{"title":"学校","subtitle":"专业","degree":"学位(本科/硕士/博士)",'
    '"date":"时间","details":["荣誉"]}}],'
    '"internships":[{{"title":"公司","subtitle":"职位","date":"时间",'
    '"highlights":["工作内容"]}}],'
    '"projects":[{{"title":"项目名","subtitle":"角色","date":"时间",'
    '"description":"项目描述(可选)","highlights":["描述"]}}],'
    '"openSource":[{{"title":"开源项目","subtitle":"角色/描述",'
    '"date":"时间(格式: 2023.01-2023.12 或 2023.01-至今)","items":["贡献描述"],"repoUrl":"仓库链接"}}],'
    '"skills":[{{"category":"类别","details":"技能描述"}}],'
    '"awards":["奖项"]}}'
)

DATA_FUSION_RULES = (
    "**数据融合原则（极其重要）：**\n"
    "- 内容完整性：以 OCR 文本为主（如有），确保不遗漏任何信息。MinerU 文本作为补充验证。\n"
    "- 格式准确性：以布局骨架的 format 信息为准（如有），确定列表样式和分组结构。\n"
    "- 模块顺序：以布局骨架定义的顺序为准（如有）。\n"
    "- 如果多个源有冲突，优先信任 OCR > MinerU > 布局骨架。"
)

SECTION_MAPPING_RULES = (
    "**模块归属规则（必须严格遵守）：**\n"
    "1. {has_layout_hint}\n"
    "2. 每个条目的描述只能归属到对应条目，不能串条。\n"
    "3. 类型映射：\n"
    '   - type="experience" → internships 数组\n'
    '   - type="projects" → projects 数组\n'
    '   - type="openSource" → openSource 数组（不是 projects！）\n'
    '   - type="education" → education 数组\n'
    '   - type="skills" → skills 数组\n'
    '4. 标题含"开源"的模块 → openSource 数组，不能放到 projects。\n'
    "5. 同一段内容不能在多个模块重复出现。\n"
    "6. 项目内容不得出现在 internships，实习内容不得出现在 projects。"
)

HIGHLIGHTS_RULES = (
    "**highlights/items 数组格式规则（必须严格遵守）：**\n"
    "- internships 和 projects 的 highlights 必须是字符串数组\n"
    "- 每个职责/成就是独立的数组元素\n"
    "- 禁止将多个职责用换行符连接成一个字符串\n"
    '- 正确: ["构建搜索服务", "优化数据库查询"]\n'
    '- 错误: ["构建搜索服务\\n优化数据库查询"]'
)

NESTED_RULES = (
    "**嵌套层级结构规则（保留原文分组，适用于 projects、openSource）：**\n"
    '- 如果原文有分组标题（如加粗的"搜索服务拆分专项"、"技术难点"），必须在 highlights/items 中保留\n'
    '- 分组标题使用 **双星号** 包裹: "**搜索服务拆分专项**"\n'
    "- 子项紧跟标题后面作为数组后续元素\n"
    '- projects 示例: ["**搜索服务拆分专项**", "重构搜索服务架构", "实现分布式索引", "**性能优化**", "优化数据库查询"]\n'
    '- openSource 示例: ["仓库：https://github.com/xxx", "**技术难点：**", "意图识别：两阶段分类策略", "提示词管理：轻量级模板系统"]\n'
    '- 如果原文中有明显的分组（如"技术难点："后面跟多个子项），必须用 **双星号** 标记分组标题\n'
    "- 如果布局骨架中 has_nested_groups=true，必须严格保留分组结构"
)

SKILLS_RULES = (
    "**技能模块格式规则（极其重要 - 必须严格遵守）：**\n"
    '- skills 数组中每项格式: {{"category": "分类名", "details": "技能描述"}}\n'
    '- category: 技能分类名（如"后端"、"数据库"、"Redis"、"计算机网络"、"AI"）\n'
    "- details: 该分类下的完整描述文本（一个字符串，不要截断）\n"
    "- 每个技能分类只占一个数组元素\n"
    '- 如果原文是 "后端：熟悉Java编程语言..." → category="后端", details="熟悉Java编程语言..."\n'
    "- **禁止** 把项目描述、工作职责等非技能内容放入 skills\n"
    '- 正确: [{{"category": "后端", "details": "熟悉Java编程语言、Golang等原理"}}, {{"category": "数据库", "details": "熟悉MySQL、MongoDB、ES等"}}]\n'
    '- 错误: [{{"category": "", "details": "参与AI搜索链路开发..."}}]  ← 这是项目描述，不是技能！'
)

FORMAT_RULES = (
    "**格式保留规则：**\n"
    '- 输出 JSON 必须包含 "format" 字段，记录各模块的格式特征\n'
    "- format.experience.list_style / format.projects.list_style / format.skills.list_style\n"
    "- format.skills.has_category: 技能是否有分类标题\n"
    "{format_info_hint}"
)

ASSEMBLER_PROMPT = (
    "任务：根据多个数据源融合生成结构化简历 JSON，必须保留原始文档的格式特征和完整内容。\n\n"
    "{data_sources_desc}\n\n"
    "{data_fusion_rules}\n\n"
    "{section_mapping_rules}\n\n"
    "{highlights_rules}\n\n"
    "{nested_rules}\n\n"
    "{skills_rules}\n\n"
    "{format_rules}\n\n"
    "只输出 JSON，不要任何解释或代码块。\n\n"
    "{data_content}\n\n"
    "输出格式：\n"
    "{schema}\n"
)

"""
STAR 法则提示词模板

提供基于 STAR（Situation, Task, Action, Result）的简历分析模板。
"""

from backend.agent.prompt.base import PromptTemplate

# STAR 关键词字典，用于检测简历中是否包含 STAR 各要素
STAR_KEYWORDS = {
    "situation": ["负责", "参与", "在", "期间", "背景", "环境", "担任", "就职"],
    "task": ["目标", "职责", "任务", "负责", "承担", "主要", "核心"],
    "action": ["开发", "实现", "设计", "优化", "完成", "搭建", "构建", "改进",
               "推进", "主导", "协调", "组织", "实施", "执行", "创建"],
    "result": ["提升", "降低", "节省", "获得", "达到", "成功", "增长", "减少",
               "改善", "实现", "完成", "突破", "%", "倍", "万", "亿"]
}

# STAR 分析模板
STAR_ANALYSIS_TEMPLATE = PromptTemplate.from_template("""
## STAR 分析 - {section_name}

### {item_name}

| 维度 | 评分 | 分析 |
|------|------|------|
| Situation（情境） | {situation_score}/10 | {situation_analysis} |
| Task（任务） | {task_score}/10 | {task_analysis} |
| Action（行动） | {action_score}/10 | {action_analysis} |
| Result（结果） | {result_score}/10 | {result_analysis} |

**STAR 总分**: {total_score}/40

**评估结果**: {assessment}

**优化建议**: {suggestion}
""")

# STAR 检查清单模板
STAR_CHECKLIST_TEMPLATE = PromptTemplate.from_template("""
## STAR 完整性检查

### {item_name}
- [ ] Situation: 是否说明了工作背景和环境？
- [ ] Task: 是否明确了具体的职责和目标？
- [ ] Action: 是否描述了采取的具体行动？
- [ ] Result: 是否提供了量化的成果数据？

**完整性**: {completeness}/4

**缺失要素**: {missing_elements}

**改进方向**: {improvement_direction}
""")

# STAR 优化指导模板
STAR_OPTIMIZATION_GUIDE = """
## STAR 优化指导

### Situation（情境）优化
- 说明工作/项目的背景
- 描述面临的挑战或机遇
- 交代时间、团队规模等环境信息

**示例**：
- ❌ 负责前端开发
- ✅ 在电商大促期间，负责前端性能优化（用户量激增300%）

### Task（任务）优化
- 明确个人职责和目标
- 说明要解决的核心问题
- 体现任务的难度和重要性

**示例**：
- ❌ 做移动端适配
- ✅ 主导移动端页面适配，提升多终端用户体验

### Action（行动）优化
- 使用具体的动词开头
- 说明采取的方法和技术
- 突出个人的具体贡献

**示例**：
- ❌ 优化了性能
- ✅ 引入虚拟列表技术，重构渲染逻辑，优化资源加载策略

### Result（结果）优化
- 必须量化（数字、百分比）
- 说明业务价值
- 使用积极的结果描述

**示例**：
- ❌ 效果很好
- ✅ 首屏加载时间从3.2秒降至0.8秒（降低75%），用户留存提升15%
"""


def get_star_keywords() -> dict:
    """获取 STAR 关键词字典"""
    return STAR_KEYWORDS.copy()


def analyze_star_compliance(text: str, category: str) -> tuple[bool, list[str]]:
    """分析文本是否包含指定 STAR 类型的关键词

    Args:
        text: 要分析的文本
        category: STAR 类别 ("situation", "task", "action", "result")

    Returns:
        (是否包含关键词, 匹配的关键词列表)
    """
    keywords = STAR_KEYWORDS.get(category, [])
    found = [kw for kw in keywords if kw in text]
    return len(found) > 0, found


def star_score_template(section_name: str, item_name: str,
                       situation_score: int, situation_analysis: str,
                       task_score: int, task_analysis: str,
                       action_score: int, action_analysis: str,
                       result_score: int, result_analysis: str,
                       assessment: str, suggestion: str) -> str:
    """生成 STAR 分析报告的便捷函数

    Args:
        section_name: 模块名称（如"工作经历"、"项目经验"）
        item_name: 具体项目名称
        situation_score: 情境评分 (1-10)
        situation_analysis: 情境分析
        task_score: 任务评分 (1-10)
        task_analysis: 任务分析
        action_score: 行动评分 (1-10)
        action_analysis: 行动分析
        result_score: 结果评分 (1-10)
        result_analysis: 结果分析
        assessment: 总体评估
        suggestion: 优化建议

    Returns:
        格式化的 STAR 分析报告
    """
    total_score = situation_score + task_score + action_score + result_score

    return STAR_ANALYSIS_TEMPLATE.format(
        section_name=section_name,
        item_name=item_name,
        situation_score=situation_score,
        situation_analysis=situation_analysis,
        task_score=task_score,
        task_analysis=task_analysis,
        action_score=action_score,
        action_analysis=action_analysis,
        result_score=result_score,
        result_analysis=result_analysis,
        total_score=total_score,
        assessment=assessment,
        suggestion=suggestion
    )

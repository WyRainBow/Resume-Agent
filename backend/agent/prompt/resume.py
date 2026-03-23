"""
简历专用提示词模板

扩展 PromptTemplate，添加简历分析专用功能。
"""

from typing import Any

from backend.agent.prompt.base import PromptTemplate


class ResumePromptTemplate(PromptTemplate):
    """简历分析专用提示词模板

    在基础模板功能上，添加：
    - 内置 STAR 分析框架
    - 质量评估指标
    - 简历类型适配

    示例：
        template = ResumePromptTemplate.from_template(
            "请分析简历：{resume_content}"
        )
        template.with_star_analysis()
    """

    # STAR 分析框架模板
    STAR_FRAMEWORK = """
## STAR 分析框架

请按以下维度分析每段工作/项目经历：

| 维度 | 说明 | 评分标准 |
|------|------|----------|
| Situation（情境） | 工作背景和环境 | 1-10分 |
| Task（任务） | 具体职责和目标 | 1-10分 |
| Action（行动） | 采取的具体措施 | 1-10分 |
| Result（结果） | 量化的成果数据 | 1-10分 |

**STAR 关键词参考**：
- Situation: 负责、参与、在、期间、背景、环境
- Task: 目标、职责、任务、负责、承担
- Action: 开发、实现、设计、优化、完成、搭建、构建
- Result: 提升、降低、节省、获得、达到、成功、%
"""

    # 质量评估指标
    QUALITY_METRICS = """
## 简历质量评估指标

| 维度 | 权重 | 评分标准 |
|------|------|----------|
| 完整性 | 30% | 必填字段是否完整（姓名、联系方式、教育经历等） |
| 清晰度 | 25% | 表达是否清晰易懂，逻辑是否连贯 |
| 量化度 | 25% | 成果是否有数据支撑（百分比、数量等） |
| 相关性 | 20% | 与目标岗位的匹配度 |

**等级划分**：
- A级 (90-100分)：优秀，可直接投递
- B级 (80-89分)：良好，小幅优化后投递
- C级 (70-79分)：一般，需要重点优化
- D级 (<70分)：较差，需要重新梳理
"""

    def with_star_analysis(self) -> "ResumePromptTemplate":
        """添加 STAR 分析框架到模板

        Returns:
            包含 STAR 框架的新模板
        """
        combined = self.template + "\n\n" + self.STAR_FRAMEWORK
        return ResumePromptTemplate(
            template=combined,
            partial_variables=self._partial_vars if self._partial_vars else None
        )

    def with_quality_metrics(self) -> "ResumePromptTemplate":
        """添加质量评估指标到模板

        Returns:
            包含质量指标的新模板
        """
        combined = self.template + "\n\n" + self.QUALITY_METRICS
        return ResumePromptTemplate(
            template=combined,
            partial_variables=self._partial_vars if self._partial_vars else None
        )

    def with_resume_profile(self, profile_type: str) -> "ResumePromptTemplate":
        """根据简历类型添加专属指导

        Args:
            profile_type: 简历类型 ("fresh_grad", "experienced", "executive")

        Returns:
            包含类型指导的新模板
        """
        profile_guidance = self._get_profile_guidance(profile_type)
        combined = self.template + "\n\n" + profile_guidance
        return ResumePromptTemplate(
            template=combined,
            partial_variables=self._partial_vars if self._partial_vars else None
        )

    def _get_profile_guidance(self, profile_type: str) -> str:
        """获取简历类型的指导说明"""
        profiles = {
            "fresh_grad": """
## 应届生简历分析重点

应届生简历的分析重点：
1. **教育背景**：学校、专业、成绩、相关课程
2. **实习经历**：实习期间的工作内容和收获
3. **项目经验**：课程项目、毕业设计、个人项目
4. **技能证书**：专业技能、语言能力、计算机技能
5. **校园活动**：学生会、社团、志愿服务等

评价时侧重：
- 学习能力和成长潜力
- 实习/项目中的具体贡献
- 技能的熟练程度
""",
            "experienced": """
## 有经验者简历分析重点

有经验者简历的分析重点：
1. **工作成就**：过往工作中的具体成果
2. **项目经验**：负责的项目规模和复杂度
3. **技能深度**：专业技能的熟练程度
4. **职业发展**：职位的晋升轨迹
5. **行业经验**：在相关行业的积累

评价时侧重：
- 工作成果的量化表达
- 技术深度和广度
- 职业发展的合理性
- 与目标岗位的匹配度
""",
            "executive": """
## 高管简历分析重点

高管简历的分析重点：
1. **战略规划**：制定和执行战略的能力
2. **团队建设**：团队规模和管理经验
3. **商业成果**：对公司业绩的贡献
4. **行业影响力**：在行业内的地位和成就
5. **领导力**：领导风格和成效

评价时侧重：
- 战略思维和决策能力
- 团队管理和领导成效
- 商业成果的量化表现
- 行业影响力和资源整合能力
"""
        }
        return profiles.get(profile_type, "")

    @classmethod
    def from_template(cls, template: str) -> "ResumePromptTemplate":
        """从模板字符串创建简历专用模板

        Args:
            template: 模板字符串

        Returns:
            ResumePromptTemplate 实例
        """
        return cls(template)


# 预定义的简历分析模板
RESUME_ANALYSIS_TEMPLATE = ResumePromptTemplate.from_template("""
你是专业的简历分析师，使用 STAR 法则深入分析简历质量。

## 核心职责
- 使用第一人称（您/你的）与用户交流
- 一次性输出完整报告
- 客观公正，提供建设性建议

## 分析要求
- 完整性检查：哪些字段为空
- STAR 分析：每段经历的 STAR 评分
- 质量评估：按指标体系打分
- 改进建议：给出可操作的优化方案

## 输出格式
请按以下结构输出分析报告：

【基本信息】
姓名、求职意向、工作年限

【质量评分】
总分：X分（等级：X）
- 完整性：X/30
- 清晰度：X/25
- 量化度：X/25
- 相关性：X/20

【主要亮点】
• 亮点1
• 亮点2
• 亮点3

【可优化点】
• 问题1 - 建议
• 问题2 - 建议

【最推荐】
最优先的优化方向

━━━━━━━━━━━━━━━━━━━━━
回复"开始优化"，我们开始优化！
""").with_star_analysis().with_quality_metrics()

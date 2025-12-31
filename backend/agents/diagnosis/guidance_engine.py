"""
引导策略引擎

根据诊断结果，生成引导策略和话术
"""

from typing import Dict, List
from enum import Enum
from .diagnosis_report import DiagnosisReport


class GuidanceMode(Enum):
    """引导模式"""
    DIAGNOSIS = "diagnosis"  # 诊断模式
    MODULE_SELECTION = "module_selection"  # 模块选择
    MODULE_GUIDANCE = "module_guidance"  # 模块引导
    FOLLOW_UP = "follow_up"  # 追问


class GuidanceEngine:
    """引导策略引擎"""

    # 模块优先级
    MODULE_PRIORITY = {
        "summary": 1,  # 个人总结 - 最高优先级
        "experience": 2,  # 工作经历
        "projects": 3,  # 项目经历
        "education": 4,  # 教育经历
        "skills": 5,  # 技能
        "basic": 6  # 基本信息
    }

    # 模块名称映射
    MODULE_NAMES = {
        "summary": "个人总结",
        "experience": "工作/实习经历",
        "projects": "项目经历",
        "education": "教育经历",
        "skills": "技能",
        "basic": "基本信息"
    }

    def __init__(self):
        pass

    def generate_diagnosis_message(self, report: DiagnosisReport) -> str:
        """生成诊断消息（简洁版，只返回开场白）"""
        # 根据诊断级别生成简短的开场白
        # 详细内容通过前端 DiagnosisReportCard 组件展示
        if report.diagnosis_level == "excellent":
            return "太棒了！您的简历整体非常完善，还有一些小细节可以微调。"
        elif report.diagnosis_level == "good":
            return "您的简历整体不错，还有一些提升空间，我帮您找出了几个可以优化的地方。"
        elif report.diagnosis_level == "needs_improvement":
            return "您的简历需要一些优化，我帮您找出了几个关键问题，让我们一起完善它！"
        else:
            return "坦白说，这份简历还比较\"骨感\"，我们需要一起把它充实起来！"

    def generate_guidance_choices(self, report: DiagnosisReport) -> List[Dict]:
        """生成引导选项"""
        choices = []

        # 根据优先级问题生成选项
        for issue in report.priority_issues[:4]:
            module = self._extract_module_from_field(issue.field)
            module_name = self.MODULE_NAMES.get(module, issue.description)

            choice = {
                "id": f"optimize_{module}",
                "text": f"{module_name}：{issue.description}",
                "priority": issue.level.value,
                "reason": issue.suggestion,
                "module": module
            }
            choices.append(choice)

        # 添加"按照专业建议"选项
        choices.append({
            "id": "auto_optimize",
            "text": "按照我的专业建议，从最重要的模块开始",
            "priority": "high",
            "reason": "我会按照最优流程帮您系统性地优化一遍",
            "module": "auto"
        })

        return choices

    def generate_module_question(self, module: str, resume_data: Dict) -> str:
        """生成模块引导问题"""
        questions = {
            "summary": self._generate_summary_question(resume_data),
            "experience": self._generate_experience_question(resume_data),
            "projects": self._generate_projects_question(resume_data),
            "education": self._generate_education_question(resume_data),
            "skills": self._generate_skills_question(resume_data),
            "basic": self._generate_basic_question(resume_data)
        }

        return questions.get(module, "请告诉我您想优化这个模块的哪些部分？")

    def _generate_summary_question(self, resume_data: Dict) -> str:
        """生成个人总结的引导问题"""
        headline = resume_data.get("basic", {}).get("headline", "您的目标岗位")

        return f"""好的，我们来优化【个人总结】！这是HR看简历的第一眼，非常重要。

为了写出贴合您实际情况的个人总结，我需要了解几个关键信息：

1️⃣ **您的目标岗位是？**
   （例如：Java后端开发工程师、数据分析师、产品经理等）

2️⃣ **您最擅长的技术/技能是？**
   （请列举2-3个核心技能，例如：Java、Spring Boot、MySQL、Python等）

3️⃣ **您最满意的成就是？**
   （1-2个亮点即可，例如：参与开发了XX系统，提升了XX效率；解决了XX难题）

请告诉我这些信息，我来帮您生成一个专业的个人总结！"""

    def _generate_experience_question(self, resume_data: Dict) -> str:
        """生成工作经历的引导问题"""
        experience_items = resume_data.get("sections", {}).get("experience", {}).get("items", [])

        if not experience_items:
            return """好的，我们来填写【工作/实习经历】！

请先告诉我您的第一份工作或实习：

1️⃣ **公司名称**
2️⃣ **职位**
3️⃣ **工作时间**
4️⃣ **主要职责**（您负责了什么？做了哪些工作？）

我们可以一段一段来，您先告诉我第一份工作经历。"""
        else:
            return """好的，我们来优化您的工作经历！

您目前有{count}份工作经历。请告诉我：

- 您想优化哪一份工作经历？
- 或者您想添加新的工作经历？

请直接描述，我来帮您处理。""".format(count=len(experience_items))

    def _generate_projects_question(self, resume_data: Dict) -> str:
        """生成项目经历的引导问题"""
        return """好的，我们来填写【项目经历】！

项目经历对于技术岗位特别重要，能直接体现您的实战能力。

请告诉我您的项目：

1️⃣ **项目名称**
2️⃣ **项目描述**（这个项目是做什么的？解决了什么问题？）
3️⃣ **技术栈**（使用了哪些技术？）
4️⃣ **您的贡献**（您负责了哪些部分？）
5️⃣ **项目成果**（取得了什么成果？有数据支撑吗？）

我们可以一个一个项目来，您先告诉我第一个项目。"""

    def _generate_education_question(self, resume_data: Dict) -> str:
        """生成教育经历的引导问题"""
        return """好的，我们来完善【教育经历】！

除了学校和专业，还有哪些信息可以补充：

1️⃣ **在校成绩**（如果不错的话）
2️⃣ **相关课程**（与目标岗位相关的核心课程）
3️⃣ **在校实践**（社团、竞赛、项目等）
4️⃣ **荣誉奖项**（奖学金、比赛获奖等）

请告诉我您想补充哪些信息？"""

    def _generate_skills_question(self, resume_data: Dict) -> str:
        """生成技能的引导问题"""
        return """好的，我们来优化【技能】部分！

技能可以分为几类：

1️⃣ **编程语言**（如：Java, Python, JavaScript）
2️⃣ **框架/库**（如：Spring Boot, React, Vue）
3️⃣ **工具/平台**（如：Git, Docker, Linux）
4️⃣ **其他技能**（如：数据库、中间件等）

请告诉我您的技能，并标注熟练度（例如：熟练、掌握、了解）"""

    def _generate_basic_question(self, resume_data: Dict) -> str:
        """生成基本信息的引导问题"""
        return """好的，我们来完善【基本信息】！

请确保以下信息完整：

1️⃣ **姓名**
2️⃣ **联系电话**
3️⃣ **邮箱**
4️⃣ **目标岗位**（非常重要！）
5️⃣ **所在城市**（可选）

请告诉我您想补充或修改哪些信息？"""

    def _extract_module_from_field(self, field: str) -> str:
        """从字段路径中提取模块名称"""
        if "summary" in field:
            return "summary"
        elif "experience" in field:
            return "experience"
        elif "projects" in field:
            return "projects"
        elif "education" in field:
            return "education"
        elif "skills" in field:
            return "skills"
        elif "basic" in field:
            return "basic"
        else:
            return "unknown"

    def generate_next_step_suggestion(self, current_module: str, resume_data: Dict) -> str:
        """生成下一步建议"""
        # 根据当前完成的模块，建议下一个优化模块
        priority_list = ["summary", "experience", "projects", "education", "skills"]

        # 找到下一个未完成的模块
        for module in priority_list:
            if module == current_module:
                continue

            # 检查模块是否为空
            if module == "summary":
                if not resume_data.get("sections", {}).get("summary", {}).get("content"):
                    return f"接下来，建议优化【{self.MODULE_NAMES[module]}】。"
            elif module == "experience":
                if not resume_data.get("sections", {}).get("experience", {}).get("items"):
                    return f"接下来，建议填写【{self.MODULE_NAMES[module]}】。"
            elif module == "projects":
                if not resume_data.get("sections", {}).get("projects", {}).get("items"):
                    return f"接下来，建议填写【{self.MODULE_NAMES[module]}】。"

        return "接下来，您还想优化哪个模块呢？"

    def generate_balance_guidance(self, message: str) -> Dict:
        """生成带退出选项的平衡引导"""
        return {
            "type": "guidance",
            "content": message,
            "allow_skip": True,
            "skip_message": "或者您可以说'跳过'，我们看看其他部分"
        }

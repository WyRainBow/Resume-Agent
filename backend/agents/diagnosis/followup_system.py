"""
渐进式追问系统

使用 STAR 法则和其他策略，逐步引导用户提供详细信息
"""

import re
from typing import Dict, List, Optional
from enum import Enum


class FollowUpStep(Enum):
    """追问步骤"""
    SITUATION = "S"  # 情境
    TASK = "T"  # 任务
    ACTION = "A"  # 行动
    RESULT = "R"  # 结果


class FollowUpSystem:
    """渐进式追问系统"""

    # 量化检测模式
    QUANTIFIABLE_PATTERN = re.compile(
        r'\d+%|\d+倍|\d+次|\d+万|\d+千|提升|降低|优化|节省|增长|减少'
    )

    def __init__(self):
        self.current_step = FollowUpStep.SITUATION
        self.collected_info = {}

    def start_followup(self, module: str, user_input: str) -> str:
        """
        开始追问流程

        Args:
            module: 模块名称（experience, projects等）
            user_input: 用户初始输入

        Returns:
            str: 追问问题
        """
        # 提取已有信息
        self.collected_info = self._extract_initial_info(user_input)

        # 判断信息完整性
        gaps = self._identify_gaps(self.collected_info)

        if not gaps:
            return "信息已经很完整了！我来帮您生成优化后的描述。"

        # 根据缺口生成追问
        return self._generate_followup_question(gaps[0], self.collected_info)

    def continue_followup(self, user_input: str, context: Dict) -> Optional[str]:
        """
        继续追问流程

        Args:
            user_input: 用户的新输入
            context: 上下文信息

        Returns:
            Optional[str]: 下一个追问问题，如果信息完整则返回None
        """
        # 更新已收集信息
        self.collected_info.update(self._extract_initial_info(user_input))

        # 再次检查信息完整性
        gaps = self._identify_gaps(self.collected_info)

        if not gaps:
            return None  # 信息完整，结束追问

        # 生成下一个追问
        return self._generate_followup_question(gaps[0], self.collected_info)

    def _extract_initial_info(self, user_input: str) -> Dict:
        """从用户输入中提取初始信息"""
        info = {
            "has_quantifiable": bool(self.QUANTIFIABLE_PATTERN.search(user_input)),
            "length": len(user_input),
            "has_specific_action": any(word in user_input for word in
                                        ["开发", "实现", "设计", "优化", "重构", "搭建"]),
            "input": user_input
        }
        return info

    def _identify_gaps(self, info: Dict) -> List[str]:
        """识别信息缺口"""
        gaps = []

        if not info.get("has_quantifiable"):
            gaps.append("quantifiable")

        if info.get("length", 0) < 100:
            gaps.append("detail")

        if not info.get("has_specific_action"):
            gaps.append("action")

        return gaps

    def _generate_followup_question(self, gap_type: str, info: Dict) -> str:
        """根据缺口类型生成追问问题"""

        if gap_type == "quantifiable":
            return self._generate_quantification_followup(info)
        elif gap_type == "detail":
            return self._generate_detail_followup(info)
        elif gap_type == "action":
            return self._generate_action_followup(info)

        return "请再详细描述一下？"

    def _generate_quantification_followup(self, info: Dict) -> str:
        """生成量化数据追问"""
        return f"""{info.get('input', '')}

💡 **为了让HR更直观地看到您的价值，建议补充一些量化数据：**

这个成果大概达到了什么程度？比如：
- 提升了 20%-30% 的效率？
- 降低了多少成本？
- 处理了多少并发请求？
- 节省了多少时间？
- 用户增长了多少？

如果您不记得精确数字，给我一个大概感觉也行（例如：提升了约50%、处理了大量请求）。"""

    def _generate_detail_followup(self, info: Dict) -> str:
        """生成详细信息追问"""
        return f"""{info.get('input', '')}

💡 **为了让这段经历更具说服力，建议补充更多细节：**

您可以告诉我：
1. **具体背景**：当时是在什么情况下做这件事的？
2. **面临挑战**：遇到了什么困难或挑战？
3. **技术细节**：使用了哪些技术或方法？
4. **个人贡献**：您具体负责了哪些部分？

哪怕简单的描述也可以，我会帮您润色和组织。"""

    def _generate_action_followup(self, info: Dict) -> str:
        """生成具体行动追问"""
        return f"""{info.get('input', '')}

💡 **建议具体描述您的行动：**

您能详细说明一下：
1. **如何实现的**：具体采用了什么方法或技术？
2. **您的角色**：您是主导者还是参与者？负责哪些部分？
3. **解决过程**：遇到了什么问题？如何解决的？

例如：
- ❌ "参与了项目开发"
- ✅ "主导开发了用户管理模块，使用 Spring Boot + MyBatis，实现了RBAC权限控制，支持10万+用户"

请补充一些具体的行动细节。"""

    def generate_star_framework_guidance(self, current_input: str) -> str:
        """生成 STAR 法则框架引导"""
        return f"""我们可以用 **STAR 法则**来充实这段经历，让HR更清楚地看到您的价值：

📌 **Situation（情境）**：当时的项目背景是什么？
📌 **Task（任务）**：您负责什么任务？目标是什么？
📌 **Action（行动）**：您具体做了什么？采取了哪些方法？
📌 **Result（结果）**：取得了什么成果？有数据支撑吗？

---

您当前说的是：{current_input}

我们可以一步步来，您先告诉我**情境和任务**，其他部分我们可以继续完善。"""

    def generate_example_for_position(self, position: str) -> str:
        """根据职位生成示例"""
        examples = {
            "后端开发": """
**示例：后端开发工程师工作经历**

❌ **修改前**：
"负责后端开发，参与系统优化"

✅ **修改后**（使用 STAR 法则）：
"在电商后台系统中，负责订单模块的后端开发（Situation）
主要任务是通过优化数据库查询和缓存策略，解决高并发场景下的性能瓶颈（Task）
采用 Redis 缓存热点数据，优化慢查询 SQL，引入消息队列异步处理（Action）
最终将系统响应时间从 2秒 降低到 200ms，支持 10万+ 日活用户（Result）"
""",

            "前端开发": """
**示例：前端开发工程师工作经历**

❌ **修改前**：
"负责前端开发，使用 Vue.js"

✅ **修改后**（使用 STAR 法则）：
"在企业管理平台项目中，负责前端架构设计和核心模块开发（Situation）
主要任务是提升页面加载速度和用户体验（Task）
采用 Vue3 + TypeScript 重构代码，实现路由懒加载和组件按需加载，优化首屏渲染（Action）
最终将首屏加载时间从 5秒 降低到 1.5秒，用户满意度提升 40%（Result）"
""",

            "产品经理": """
**示例：产品经理工作经历**

❌ **修改前**：
"负责产品规划和需求分析"

✅ **修改后**（使用 STAR 法则）：
"负责在线教育平台的产品规划和迭代（Situation）
主要任务是提升用户留存和课程完成率（Task）
通过用户调研发现关键问题，设计个性化学习路径和积分激励体系，协调研发团队落地（Action）
新功能上线后，用户次日留存从 35% 提升到 55%，课程完成率提升 30%（Result）"
"""
        }

        # 根据职位关键词匹配备份
        for key, example in examples.items():
            if key in position:
                return example

        # 默认示例
        return """
**通用示例（使用 STAR 法则）**

❌ **修改前**：
"参与了项目开发"

✅ **修改后**：
"在XX项目中，负责XX模块的开发（Situation + Task）
采用了XX技术方案，解决了XX问题（Action）
最终实现了XX成果，提升了XX%的效率/性能（Result）"

**关键点**：
- 具体描述您做了什么（Action）
- 用数据说话（Result）
- 突出您的贡献和价值
"""

    def should_use_placeholder(self, user_response: str) -> bool:
        """判断是否应该使用占位符"""
        placeholder_responses = [
            "不记得",
            "忘记了",
            "不知道",
            "没法提供",
            "无法提供"
        ]

        return any(word in user_response for word in placeholder_responses)

    def generate_placeholder_suggestion(self, field: str) -> str:
        """生成占位符建议"""
        return f"""好的，没问题。我们可以先用占位符标记这里需要补充。

建议使用格式：`[请补充具体数据，如：提升了XX%]`

我会将 `{field}` 标记为待补充，您可以稍后回来完善。

您还有其他想补充的信息吗？或者我们可以继续优化其他部分？"""


class InformationExtractor:
    """信息提取器"""

    def extract_experience_info(self, user_input: str) -> Dict:
        """从用户输入中提取工作经历信息"""
        # 简化版信息提取
        return {
            "raw_input": user_input,
            "company": self._extract_company(user_input),
            "position": self._extract_position(user_input),
            "date": self._extract_date(user_input),
            "summary": user_input
        }

    def _extract_company(self, text: str) -> Optional[str]:
        """提取公司名称"""
        # 简化版，实际可以使用更复杂的 NLP
        # 这里假设用户会说"在XX公司"
        if "在" in text and "公司" in text:
            start = text.find("在") + 1
            end = text.find("公司") + 2
            return text[start:end].strip()
        return None

    def _extract_position(self, text: str) -> Optional[str]:
        """提取职位"""
        # 常见职位关键词
        positions = ["工程师", "开发", "实习生", "经理", "专员", "设计师"]
        for pos in positions:
            if pos in text:
                return pos
        return None

    def _extract_date(self, text: str) -> Optional[str]:
        """提取日期"""
        # 简化版日期提取
        date_pattern = re.compile(r'\d{4}\.\d{2}|\d{4}/\d{2}|\d{4}年\d{1,2}月')
        match = date_pattern.search(text)
        return match.group() if match else None

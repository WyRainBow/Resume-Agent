"""
简历质量评估指标系统

提供标准化的简历质量评估指标和评分标准。
"""

from typing import Optional


class QualityMetrics:
    """简历质量评估指标

    评估维度：
    - 完整性 (30%): 必填字段是否完整
    - 清晰度 (25%): 表达是否清晰易懂
    - 量化度 (25%): 成果是否有数据支撑
    - 相关性 (20%): 与目标岗位的匹配度

    等级划分：
    - A级 (90-100): 优秀
    - B级 (80-89): 良好
    - C级 (70-79): 一般
    - D级 (<70): 较差
    """

    # 评分权重
    WEIGHTS = {
        "completeness": 0.30,  # 完整性 30%
        "clarity": 0.25,       # 清晰度 25%
        "quantification": 0.25, # 量化度 25%
        "relevance": 0.20      # 相关性 20%
    }

    # 等级划分
    GRADES = {
        "A": (90, 100),
        "B": (80, 89),
        "C": (70, 79),
        "D": (0, 69)
    }

    def __init__(
        self,
        completeness: Optional[int] = None,
        clarity: Optional[int] = None,
        quantification: Optional[int] = None,
        relevance: Optional[int] = None
    ):
        """初始化质量评估

        Args:
            completeness: 完整性评分 (0-100)
            clarity: 清晰度评分 (0-100)
            quantification: 量化度评分 (0-100)
            relevance: 相关性评分 (0-100)
        """
        self.completeness = completeness
        self.clarity = clarity
        self.quantification = quantification
        self.relevance = relevance

    def calculate_total(self) -> Optional[int]:
        """计算总分

        Returns:
            总分 (0-100)，如果任一维度未评分则返回 None
        """
        scores = [self.completeness, self.clarity, self.quantification, self.relevance]
        if any(s is None for s in scores):
            return None

        total = (
            self.completeness * self.WEIGHTS["completeness"] +
            self.clarity * self.WEIGHTS["clarity"] +
            self.quantification * self.WEIGHTS["quantification"] +
            self.relevance * self.WEIGHTS["relevance"]
        )
        return round(total)

    def get_grade(self) -> Optional[str]:
        """获取等级

        Returns:
            等级 (A/B/C/D)，如果总分无法计算则返回 None
        """
        total = self.calculate_total()
        if total is None:
            return None

        for grade, (min_score, max_score) in self.GRADES.items():
            if min_score <= total <= max_score:
                return grade
        return "D"

    def get_grade_description(self) -> Optional[str]:
        """获取等级说明

        Returns:
            等级说明文字
        """
        grade = self.get_grade()
        descriptions = {
            "A": "优秀 - 可直接投递",
            "B": "良好 - 小幅优化后投递",
            "C": "一般 - 需要重点优化",
            "D": "较差 - 需要重新梳理"
        }
        return descriptions.get(grade)

    def to_dict(self) -> dict:
        """转换为字典格式

        Returns:
            包含各维度评分和总分的字典
        """
        return {
            "completeness": self.completeness,
            "clarity": self.clarity,
            "quantification": self.quantification,
            "relevance": self.relevance,
            "total": self.calculate_total(),
            "grade": self.get_grade(),
            "description": self.get_grade_description()
        }

    @staticmethod
    def get_scoring_criteria() -> str:
        """获取评分标准说明

        Returns:
            格式化的评分标准文本
        """
        return """
## 简历质量评分标准

### 完整性 (30%)
| 分数区间 | 评价标准 |
|---------|----------|
| 90-100 | 所有必填字段完整，信息详实 |
| 70-89 | 主要字段完整，个别可补充 |
| 50-69 | 核心字段完整，多处缺失 |
| 0-49 | 关键字段缺失 |

### 清晰度 (25%)
| 分数区间 | 评价标准 |
|---------|----------|
| 90-100 | 表达清晰，逻辑严密，易于理解 |
| 70-89 | 表达较清晰，偶有歧义 |
| 50-69 | 表达一般，多处需要猜测 |
| 0-49 | 表达混乱，难以理解 |

### 量化度 (25%)
| 分数区间 | 评价标准 |
|---------|----------|
| 90-100 | 成果都有数据支撑，量化充分 |
| 70-89 | 主要成果有量化，部分缺失 |
| 50-69 | 少量量化，多数是定性描述 |
| 0-49 | 几乎没有量化数据 |

### 相关性 (20%)
| 分数区间 | 评价标准 |
|---------|----------|
| 90-100 | 高度匹配目标岗位要求 |
| 70-89 | 基本匹配，部分相关 |
| 50-69 | 相关性一般，需要突出重点 |
| 0-49 | 相关性较差，需要重新定位 |
"""


# 质量检查清单模板
QUALITY_CHECKLIST = """
## 简历质量检查清单

### 基本信息
- [ ] 姓名是否正确
- [ ] 联系方式是否完整（手机、邮箱）
- [ ] 求职意向是否明确

### 教育背景
- [ ] 学校、专业、学历是否完整
- [ ] 时间线是否连续
- [ ] 是否有相关课程或证书

### 工作/项目经历
- [ ] 每段经历是否包含 STAR 要素
- [ ] 成果是否有量化数据
- [ ] 职责描述是否清晰
- [ ] 时间线是否连续（无空窗期）

### 技能描述
- [ ] 技能列表是否分类
- [ ] 熟练度是否标明
- [ ] 是否有实际应用场景

### 整体印象
- [ ] 排版是否整洁
- [ ] 字体大小是否合适
- [ ] 重点信息是否突出
- [ ] 是否有错别字
"""


# 预定义的质量评估提示词模板
QUALITY_ASSESSMENT_PROMPT = """
## 质量评估要求

请按照以下标准对简历进行评分：

### 1. 完整性 (30%)
检查必填字段是否完整：
- 基本信息：姓名、联系方式、求职意向
- 教育背景：至少一条教育记录
- 工作/项目经历：至少一条经历
- 技能：技能描述

### 2. 清晰度 (25%)
评估表达是否清晰：
- 逻辑是否连贯
- 表达是否简洁
- 是否有歧义或模糊描述

### 3. 量化度 (25%)
检查成果是否量化：
- 是否有具体数字
- 是否有百分比
- 是否有业务价值体现

### 4. 相关性 (20%)
评估与目标岗位的匹配度：
- 技能是否匹配
- 经验是否相关
- 潜力是否可观

### 输出格式
```
质量评分：X/100（等级：X）
- 完整性：X/30
- 清晰度：X/25
- 量化度：X/25
- 相关性：X/20
```
"""


def get_quality_metrics_template() -> str:
    """获取完整的质量评估提示词"""
    return QUALITY_ASSESSMENT_PROMPT + QualityMetrics.get_scoring_criteria()

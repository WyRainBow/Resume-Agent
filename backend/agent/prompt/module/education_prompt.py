"""
教育经历分析 Prompt 模板

定义教育经历模块分析所需的各种提示词模板。
"""

from backend.agent.prompt.base import PromptTemplate

# 教育经历分析系统提示词
EDUCATION_SYSTEM_PROMPT = """你是教育经历分析专家，专门负责分析简历中的教育背景信息。

你的职责：
1. 评估教育背景的质量和与目标岗位的匹配度
2. 分析院校层次、专业相关性、学术表现
3. 识别缺失的重要信息（如 GPA、核心课程）
4. 提供具体可行的优化建议

分析维度：
- 院校信息：层次、知名度、匹配度
- 学历层次：类型、完整性、匹配度
- 专业信息：名称、类别、相关性
- 学术表现：GPA、排名
- 主修课程：核心课程覆盖度、缺失课程
- 荣誉奖项：奖学金、竞赛奖项

评分标准：
- 专业匹配 (30分): 相关专业+20，完全匹配+30
- 课程匹配 (30分): 核心完整+30，有高级课程+10
- 学术表现 (30分): GPA 3.5++20，前10%+10
- 荣誉奖项 (10分): 有技术竞赛奖项+10

输出格式：返回 JSON 格式的分析结果。
"""


# 教育经历分析 Prompt 模板
EDUCATION_ANALYSIS_PROMPT = PromptTemplate.from_template("""
请分析以下教育经历信息，返回 JSON 格式的分析结果。

## 目标岗位
{target_position}

## 教育经历
{education_data}

## 分析要求

1. 完整性检查：
   - 院校名称、专业、学历是否完整
   - GPA/排名信息是否存在
   - 主修课程是否列出
   - 荣誉奖项是否丰富

2. 质量评估：
   - 院校层次（985/211/双一流/普通本科/专科）
   - 专业与目标岗位的匹配度
   - 学术表现（GPA 水平、排名）
   - 核心课程覆盖度
   - 荣誉奖项含金量

3. 匹配度分析：
   - 专业与目标岗位的相关性
   - 课程是否覆盖核心技能要求
   - 学术表现是否优秀

4. 优化建议：
   - 缺失信息补充建议
   - 描述优化建议
   - 突出优势建议

## 返回格式

返回严格的 JSON 格式，包含以下字段：

```json
{{
  "module": "education",
  "module_display_name": "教育经历",
  "score": <0-100的评分>,
  "priority_score": <0-100的优先级分数>,
  "total_items": <教育经历数量>,
  "analyzed_items": <分析的数量>,
  "strengths": [
    {{
      "item": "亮点名称",
      "description": "详细描述",
      "evidence": "证据"
    }}
  ],
  "weaknesses": [
    {{
      "item": "弱点名称",
      "description": "描述",
      "impact": "影响",
      "suggestion": "建议"
    }}
  ],
  "issues": [
    {{
      "id": "edu-1",
      "problem": "问题描述",
      "severity": "high|medium|low",
      "current": "当前内容",
      "optimized": "优化后的内容",
      "explanation": "优化说明",
      "suggestion": "优化建议"
    }}
  ],
  "highlights": ["亮点1", "亮点2"],
  "details": {{
    "institution": {{
      "name": "院校名称",
      "level": "985|211|双一流|普通本科|专科",
      "match_score": <0-100>
    }},
    "degree": {{
      "type": "本科|硕士|博士|专科",
      "major": "专业名称",
      "match_score": <0-100>
    }},
    "gpa": {{
      "value": <GPA数值或null>,
      "scale": "4.0或5.0",
      "ranking": "排名或null",
      "assessment": "优秀|良好|一般|较差"
    }},
    "courses": {{
      "core_courses": ["核心课程列表"],
      "advanced_courses": ["高级课程列表"],
      "match_score": <0-100>,
      "missing_courses": ["缺失的重要课程"]
    }},
    "honors": {{
      "scholarships": ["奖学金列表"],
      "awards": ["竞赛奖项列表"],
      "assessment": "评估"
    }}
  }}
}}
```

返回纯 JSON 格式，不含其他文字。
""")


# 教育经历优化 Prompt 模板
EDUCATION_OPTIMIZATION_PROMPT = PromptTemplate.from_template("""
请为以下教育经历问题生成优化建议。

## 原始教育经历
{education_data}

## 需要优化的问题
{issue_description}

## 优化要求

1. 保持真实性，不编造信息
2. 突出与目标岗位相关的优势
3. 补充缺失的关键信息（用占位符标记）
4. 优化描述方式，使其更专业

## 目标岗位
{target_position}

## 返回格式

返回 JSON 格式：

```json
{{
  "issue_id": "{issue_id}",
  "module": "education",
  "current": "当前内容",
  "optimized": "优化后的内容",
  "explanation": "优化说明",
  "apply_path": "应用路径（如 education[0].courses）",
  "placeholder_fields": ["需要用户填写的占位符"]
}}
```

返回纯 JSON 格式，不含其他文字。
""")


# 后端开发核心课程列表（用于匹配度分析）
BACKEND_CORE_COURSES = [
    # 基础课程（必须）
    "数据结构",
    "算法",
    "算法设计",
    "数据结构与算法",
    "操作系统",
    "计算机网络",
    "网络",
    "数据库",
    "数据库原理",
    "数据库系统",
    # 专业核心（重要）
    "软件工程",
    "编译原理",
    "计算机组成原理",
    "计算机组成",
    # 应用课程（方向）
    "Web开发",
    "Web",
    "后端开发",
    "服务端开发",
    "分布式系统",
    "系统设计",
    "云计算",
    "微服务",
]

# 院校层次识别关键词
INSTITUTION_LEVELS = {
    "985": [
        "清华大学", "北京大学", "复旦大学", "上海交通大学", "浙江大学", "中国科学技术大学",
        "南京大学", "西安交通大学", "哈尔滨工业大学", "中国人民大学", "北京航空航天大学",
        "同济大学", "南开大学", "天津大学", "中山大学", "武汉大a学", "华中科技大学",
        "国防科技大学", "厦门大学", "山东大学", "四川大学", "吉林大学", "中南大学",
        "华南理工大学", "大连理工大学", "西北工业大学", "电子科技大学", "重庆大学",
    ],
    "211": ["211", "苏州大学", "上海大学", "暨南大学"],
    "双一流": ["双一流", "一流大学", "一流学科"],
}


def detect_institution_level(institution_name: str) -> str:
    """检测院校层次

    Args:
        institution_name: 院校名称

    Returns:
        "985", "211", "双一流", "普通本科", "专科"
    """
    if not institution_name:
        return "未知"

    name = institution_name.strip()

    # 检测 985
    for univ in INSTITUTION_LEVELS["985"]:
        if univ in name:
            return "985"

    # 检测 211
    for keyword in INSTITUTION_LEVELS["211"]:
        if keyword in name:
            return "211"

    # 检测双一流
    for keyword in INSTITUTION_LEVELS["双一流"]:
        if keyword in name:
            return "双一流"

    # 检测专科
    if any(
        kw in name
        for kw in ["专科", "高职", "职业技术学院", "职业学院", "专科学校"]
    ):
        return "专科"

    # 默认为普通本科
    if "大学" in name or "学院" in name:
        return "普通本科"

    return "未知"


def assess_gpa_level(gpa: float, scale: float = 4.0) -> str:
    """评估 GPA 水平

    Args:
        gpa: GPA 数值
        scale: GPA 满分

    Returns:
        "优秀", "良好", "一般", "较差"
    """
    if gpa is None:
        return "未知"

    # 标准化到 4.0
    if scale == 5.0:
        normalized_gpa = (gpa / 5.0) * 4.0
    else:
        normalized_gpa = gpa

    if normalized_gpa >= 3.5:
        return "优秀"
    elif normalized_gpa >= 3.0:
        return "良好"
    elif normalized_gpa >= 2.5:
        return "一般"
    else:
        return "较差"


def match_major_with_backend(major: str) -> int:
    """评估专业与后端开发的匹配度

    Args:
        major: 专业名称

    Returns:
        匹配度分数 (0-100)
    """
    if not major:
        return 0

    major_lower = major.lower()

    # 完全匹配
    full_match_keywords = [
        "计算机科学",
        "计算机科学与技术",
        "软件工程",
        "计算机",
        "software engineering",
        "computer science",
        "cs",
    ]
    for keyword in full_match_keywords:
        if keyword in major_lower:
            return 100

    # 高度相关
    high_match_keywords = [
        "信息技术",
        "信息工程",
        "电子信息",
        "通信工程",
        "自动化",
        "数学",
        "统计",
    ]
    for keyword in high_match_keywords:
        if keyword in major_lower:
            return 80

    # 部分相关
    partial_match_keywords = ["信息管理", "信息", "工程", "科学"]
    for keyword in partial_match_keywords:
        if keyword in major_lower:
            return 60

    # 低相关
    return 30


def analyze_course_coverage(courses: list[str]) -> dict:
    """分析课程覆盖度

    Args:
        courses: 课程列表

    Returns:
        {
            "core_courses": [...],  # 后端核心课程
            "advanced_courses": [...],  # 高级课程
            "missing_courses": [...],  # 缺失课程
            "match_score": 0-100
        }
    """
    course_set = set(courses) if courses else set()

    # 分类课程
    core_found = []
    advanced_found = []
    missing = []

    for course in BACKEND_CORE_COURSES:
        # 检查是否有相似课程
        found = any(
            course in c or c in course
            for c in courses
            if courses
        )
        if found:
            if course in ["分布式系统", "系统设计", "微服务", "云计算"]:
                advanced_found.append(course)
            else:
                core_found.append(course)
        else:
            missing.append(course)

    # 计算匹配分数
    # 核心课程：每门 8 分，最高 60 分
    # 高级课程：每门 10 分，最高 40 分
    core_score = min(len(core_found) * 8, 60)
    advanced_score = min(len(advanced_found) * 10, 40)
    total_score = core_score + advanced_score

    return {
        "core_courses": core_found,
        "advanced_courses": advanced_found,
        "missing_courses": missing[:5],  # 只返回前 5 个缺失课程
        "match_score": total_score,
    }

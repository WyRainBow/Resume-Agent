"""
IntentRecognizer - 意图识别器

参考架构：复用 task_planner.py 的意图识别逻辑

负责：
1. 识别用户意图（ADD/UPDATE/DELETE/READ/UNKNOWN）
2. 识别操作模块（workExperience/education/basic 等）
3. 从自然语言中提取结构化数据
4. 判断信息是否完整
"""
import re
from typing import Any, Dict, List, Optional, Tuple, Union, TYPE_CHECKING
from dataclasses import dataclass, field

from .chat_state import IntentType

# 支持 AgentState 或 ChatState（duck typing）
if TYPE_CHECKING:
    from .agent_state import AgentState
    from .chat_state import ChatState


@dataclass
class RecognitionResult:
    """识别结果"""
    intent: IntentType
    module: str
    extracted_data: Dict[str, Any]
    missing_fields: List[str]
    confidence: float
    path: Optional[str] = None  # 用于 UPDATE/DELETE 的具体路径
    index: Optional[int] = None  # 用于指定第几条记录
    
    def is_complete(self) -> bool:
        """信息是否完整"""
        return len(self.missing_fields) == 0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "intent": self.intent.value,
            "module": self.module,
            "extracted_data": self.extracted_data,
            "missing_fields": self.missing_fields,
            "confidence": self.confidence,
            "path": self.path,
            "index": self.index,
            "is_complete": self.is_complete()
        }


class IntentRecognizer:
    """
    意图识别器
    
    功能：
    1. 基于规则的意图识别
    2. 模块识别
    3. 数据提取
    """
    
    # 意图关键词（优先级：READ > DELETE > UPDATE > ADD）
    INTENT_KEYWORDS = {
        IntentType.READ: [
            "查看", "显示", "看看", "有哪些", "列出", "展示", "我的",
            "读取", "读一下", "看一下", "看看我的", "查看我的", "显示我的"
        ],
        IntentType.DELETE: [
            "删除", "移除", "去掉", "清除", "删掉"
        ],
        IntentType.UPDATE: [
            "修改", "改成", "更新", "改为", "换成", "设置为", "设为",
            "把.*改", "将.*改", "更改"
        ],
        IntentType.ADD: [
            "添加", "新增", "加一条", "加一个", "增加", "录入",
            "工作过", "学习过", "就读", "毕业于",
            "在.+做", "在.+工作", "在.+实习", "担任", "任职",
            "我叫", "我是",  # 基本信息添加模式
        ]
    }
    
    # 模块关键词
    MODULE_KEYWORDS = {
        "workExperience": [
            "工作", "实习", "经历", "公司", "职位", "岗位", 
            "就职", "任职", "在职", "工作经历", "实习经历"
        ],
        "education": [
            "教育", "学校", "大学", "学历", "专业", "学位",
            "毕业", "就读", "本科", "硕士", "博士", "高中"
        ],
        "basic": [
            "姓名", "名字", "电话", "手机", "邮箱", "email",
            "基本信息", "个人信息", "联系方式"
        ],
        "skills": [
            "技能", "技术", "擅长", "会用", "熟悉", "掌握", "专业技能", "我的技能", "技能是什么"
        ],
        "projects": [
            "项目", "项目经历", "做过的项目"
        ]
    }
    
    # 模块必填字段
    REQUIRED_FIELDS = {
        "workExperience": ["company", "position", "startDate", "endDate"],
        "education": ["school", "major", "degree", "startDate", "endDate"],
        "basic": ["name"],
        "skills": ["name"],
        "projects": ["name", "description"]
    }
    
    def __init__(self):
        pass
    
    def recognize(
        self,
        user_message: str,
        chat_state: Optional[Any] = None,  # 支持 AgentState 或 ChatState
        resume_data: Optional[Dict[str, Any]] = None
    ) -> RecognitionResult:
        """
        识别用户意图
        
        Args:
            user_message: 用户消息
            chat_state: 对话状态（AgentState 或 ChatState，duck typing）
            resume_data: 当前简历数据
        
        Returns:
            RecognitionResult
        """
        text = user_message.strip()
        
        # 1. 先检测是否是明确的新意图（如查看、修改、删除）
        #    这些意图优先于 pending task 的补充
        explicit_new_intent = self._is_explicit_new_intent(text)
        
        # 2. 如果有 pending task 且不是明确的新意图，走补充逻辑
        if (not explicit_new_intent and 
            chat_state and 
            hasattr(chat_state, 'has_pending_task') and 
            chat_state.has_pending_task()):
            return self._recognize_supplement(text, chat_state)
        
        # 3. 如果是明确的新意图，清理 pending task
        if explicit_new_intent and chat_state and hasattr(chat_state, 'clear_pending_task'):
            chat_state.clear_pending_task()
        
        # 4. 识别意图（优先识别 READ/DELETE/UPDATE，避免误识别为 ADD）
        intent, intent_confidence = self._recognize_intent(text)
        
        # 3. 识别模块
        module, module_confidence = self._recognize_module(text)
        
        # 4. 如果是 READ 意图，直接返回，不提取数据
        if intent == IntentType.READ:
            path, index = self._recognize_path(text, module, resume_data)
            return RecognitionResult(
                intent=intent,
                module=module,
                extracted_data={},
                missing_fields=[],
                confidence=intent_confidence,
                path=path or module,
                index=index
            )
        
        # 5. 提取数据（仅用于 ADD/UPDATE）
        extracted_data = self._extract_data(text, module)
        
        # 6. 识别路径和索引（用于 UPDATE/DELETE）
        path, index = self._recognize_path(text, module, resume_data)
        
        # 7. 计算缺失字段（仅用于 ADD）
        required = self.REQUIRED_FIELDS.get(module, [])
        missing = [f for f in required if not extracted_data.get(f)]
        
        # 8. 计算综合置信度
        confidence = (intent_confidence + module_confidence) / 2
        
        return RecognitionResult(
            intent=intent,
            module=module,
            extracted_data=extracted_data,
            missing_fields=missing,
            confidence=confidence,
            path=path,
            index=index
        )
    
    def _recognize_supplement(self, text: str, chat_state: Any) -> RecognitionResult:
        """识别补充信息（兼容 AgentState 和 ChatState）"""
        # 兼容 AgentState（使用 get_pending_task）
        if hasattr(chat_state, 'get_pending_task'):
            pending = chat_state.get_pending_task()
            module = pending.module if pending else "workExperience"
            intent = IntentType(pending.intent) if pending else IntentType.ADD
            existing_data = (pending.collected_data.copy() if pending else {})
        else:
            # 兼容旧版 ChatState
            module = chat_state.get_pending_module()
            intent = chat_state.get_pending_intent()
            existing_data = (chat_state.pending.data.copy() 
                           if hasattr(chat_state, 'pending') and chat_state.pending 
                           else {})
        
        # 从用户输入提取数据
        new_data = self._extract_data(text, module)
        
        # 合并已有数据（只覆盖非空值）
        for key, value in new_data.items():
            if value:  # 只合并非空值
                existing_data[key] = value
        
        # 计算缺失字段
        required = self.REQUIRED_FIELDS.get(module, [])
        missing = [f for f in required if not existing_data.get(f)]
        
        return RecognitionResult(
            intent=intent,
            module=module,
            extracted_data=existing_data,
            missing_fields=missing,
            confidence=0.9  # 补充场景置信度较高
        )
    
    def _is_explicit_new_intent(self, text: str) -> bool:
        """
        检测是否是明确的新意图
        
        当用户输入明确表达以下意图时，应该优先处理新意图而非继续补充 pending task：
        - 查看/读取
        - 修改/更新（带明确目标）
        - 删除
        
        Returns:
            True 如果是明确的新意图
        """
        text_lower = text.lower()
        
        # READ 关键词（这些明确表示查看意图）
        read_keywords = ["查看", "显示", "看看", "列出", "展示", "看一下", "读取"]
        if any(kw in text for kw in read_keywords):
            return True
        
        # UPDATE 关键词（带明确目标的修改）
        update_patterns = [
            r"把.+改[成为]",
            r"修改.+[为成]",
            r"将.+改[成为]",
        ]
        for pattern in update_patterns:
            if re.search(pattern, text):
                return True
        
        # DELETE 关键词
        delete_keywords = ["删除", "移除", "去掉", "清除"]
        if any(kw in text for kw in delete_keywords):
            return True
        
        return False
    
    def _recognize_intent(self, text: str) -> Tuple[IntentType, float]:
        """识别意图"""
        scores = {intent: 0 for intent in IntentType}
        
        for intent, keywords in self.INTENT_KEYWORDS.items():
            for keyword in keywords:
                if re.search(keyword, text):
                    scores[intent] += 1
        
        # 优先识别 READ/DELETE/UPDATE（避免误识别为 ADD）
        # 如果 READ/DELETE/UPDATE 有匹配，且分数 >= ADD，优先使用
        priority_intents = [IntentType.READ, IntentType.DELETE, IntentType.UPDATE]
        for priority_intent in priority_intents:
            if scores[priority_intent] > 0 and scores[priority_intent] >= scores[IntentType.ADD]:
                confidence = min(scores[priority_intent] * 0.3, 1.0)
                return priority_intent, confidence
        
        # 找出最高分的意图
        max_intent = max(scores, key=scores.get)
        max_score = scores[max_intent]
        
        if max_score == 0:
            return IntentType.UNKNOWN, 0.0
        
        # 计算置信度
        confidence = min(max_score * 0.3, 1.0)
        return max_intent, confidence
    
    def _recognize_module(self, text: str) -> Tuple[str, float]:
        """识别模块"""
        scores = {module: 0 for module in self.MODULE_KEYWORDS}
        
        # 特殊模式匹配（优先级更高）
        # "我叫XX"、"我是XX" -> basic
        if re.search(r"我(?:叫|是)\s*[\u4e00-\u9fa5]{2,4}", text):
            scores["basic"] += 2
        
        # "在XX工作"、"在XX做" -> workExperience
        if re.search(r"在[\u4e00-\u9fa5A-Za-z0-9]+(?:工作|做|实习)", text):
            scores["workExperience"] += 2
        
        # "专业技能"、"我的技能" -> skills（优先级高于 education 的"专业"）
        if re.search(r"专业技能|我的技能|技能是什么", text):
            scores["skills"] += 3  # 高分确保优先识别
        
        # 常规关键词匹配
        for module, keywords in self.MODULE_KEYWORDS.items():
            for keyword in keywords:
                if keyword in text:
                    scores[module] += 1
        
        # 找出最高分的模块
        max_module = max(scores, key=scores.get)
        max_score = scores[max_module]
        
        if max_score == 0:
            # 如果包含姓名模式，默认为 basic
            if re.search(r"我(?:叫|是)\s*[\u4e00-\u9fa5]{2,4}", text):
                return "basic", 0.5
            # 否则默认为工作经历
            return "workExperience", 0.3
        
        confidence = min(max_score * 0.3, 1.0)
        return max_module, confidence
    
    def _extract_data(self, text: str, module: str) -> Dict[str, Any]:
        """从文本中提取数据"""
        if module == "workExperience":
            return self._extract_work_experience(text)
        elif module == "education":
            return self._extract_education(text)
        elif module == "basic":
            return self._extract_basic(text)
        elif module == "skills":
            return self._extract_skills(text)
        elif module == "projects":
            return self._extract_projects(text)
        return {}
    
    def _extract_work_experience(self, text: str) -> Dict[str, Any]:
        """提取工作经历数据"""
        data = {
            "company": "",
            "position": "",
            "startDate": "",
            "endDate": "",
            "description": ""
        }
        
        # 提取公司名称（优先匹配更具体的模式）
        company_patterns = [
            # 优先：在XX + 工作/做/担任 模式（确保"在"不被捕获）
            r"在([\u4e00-\u9fa5A-Za-z0-9·\.\-]{2,20}?)(?:工作过|工作|实习|做|担任)",
            # 次优：XX工作过 模式
            r"(?<!在)([\u4e00-\u9fa5A-Za-z0-9·\.\-]{2,20})工作过",
            # 其他：我在/曾在 + 公司
            r"(?:我|曾)(?:在|于)([\u4e00-\u9fa5A-Za-z0-9·\.\-]{2,20})(?:工作|实习|做|担任)?",
            # 其他模式
            r"公司[是为]?\s*([\u4e00-\u9fa5A-Za-z0-9·\.\-]{2,20})",
            r"就职于([\u4e00-\u9fa5A-Za-z0-9·\.\-]{2,20})",
            r"入职([\u4e00-\u9fa5A-Za-z0-9·\.\-]{2,20})",
        ]
        excluded_words = ["工作", "实习", "公司", "那里", "这里", "哪里", "我", "你", "他", "她", 
                          "现在", "以前", "之前", "后来", "然后", "之后", "目前", "一下", "一下我",
                          "在", "于", "曾"]
        excluded_prefixes = ["我在", "现在", "以前", "之前", "在"]
        
        for pattern in company_patterns:
            match = re.search(pattern, text)
            if match:
                company = match.group(1).strip()
                
                # 去除可能残留的"在"前缀
                if company.startswith("在"):
                    company = company[1:]
                
                # 排除常见非公司词和时间副词
                if company not in excluded_words and len(company) >= 2:
                    # 排除以排除前缀开头的
                    if not any(company.startswith(prefix) for prefix in excluded_prefixes):
                        data["company"] = company
                        break
        
        # 提取职位
        # 常见职位词（用于简短匹配，如"做前端"）
        common_positions = ["前端", "后端", "全栈", "测试", "运维", "产品", "设计", "运营", "算法", "数据", "AI", "研发", "开发"]
        
        position_patterns = [
            # 模式1：做/担任 + 职位（包含职位后缀词）
            r"(?:担任|做|是|任)([\u4e00-\u9fa5A-Za-z]+?(?:工程师|开发|设计师|经理|总监|主管|架构师|分析师|运营|产品经理))",
            # 模式2：明确指定职位
            r"职位[是为]?\s*([\u4e00-\u9fa5A-Za-z]+)",
            # 模式3：独立的职位后缀词
            r"([\u4e00-\u9fa5A-Za-z]+?(?:工程师|开发|设计师|经理|总监|主管|架构师|分析师))",
        ]
        
        # 先尝试精确匹配
        for pattern in position_patterns:
            match = re.search(pattern, text)
            if match:
                data["position"] = match.group(1).strip()
                break
        
        # 如果没匹配到，尝试匹配常见职位词（如"做前端"）
        if not data["position"]:
            for pos in common_positions:
                if f"做{pos}" in text or f"是{pos}" in text or f"任{pos}" in text:
                    data["position"] = pos
                    break
                elif f"{pos}开发" in text:
                    data["position"] = f"{pos}开发"
                    break
                elif f"{pos}工程师" in text:
                    data["position"] = f"{pos}工程师"
                    break
        
        # 提取时间
        dates = self._extract_dates(text)
        if len(dates) >= 2:
            data["startDate"] = dates[0]
            data["endDate"] = dates[1]
        elif len(dates) == 1:
            data["startDate"] = dates[0]
        
        # 提取描述（负责xxx, 主要xxx）
        # 策略：先尝试提取"负责"后面的全部内容，如果太长则截取合适长度
        desc_patterns = [
            # 贪婪匹配：提取"负责"或"主要"后面的全部内容
            r"(?:负责|主要|工作内容[是为]?)\s*(.+)",
        ]
        for pattern in desc_patterns:
            match = re.search(pattern, text, re.DOTALL)
            if match:
                desc = match.group(1).strip()
                # 清理可能的多余空白和换行
                desc = re.sub(r'\s+', ' ', desc)
                data["description"] = desc
                break
        
        return data
    
    def _extract_education(self, text: str) -> Dict[str, Any]:
        """提取教育经历数据"""
        data = {
            "school": "",
            "major": "",
            "degree": "",
            "startDate": "",
            "endDate": "",
            "description": ""
        }
        
        # 提取学校
        school_patterns = [
            r"在([\u4e00-\u9fa5A-Za-z]+大学)",
            r"毕业于([\u4e00-\u9fa5A-Za-z]+)",
            r"就读于([\u4e00-\u9fa5A-Za-z]+)",
            r"([\u4e00-\u9fa5A-Za-z]+大学)",
            r"([\u4e00-\u9fa5A-Za-z]+学院)",
        ]
        for pattern in school_patterns:
            match = re.search(pattern, text)
            if match:
                data["school"] = match.group(1).strip()
                break
        
        # 提取专业
        major_patterns = [
            r"(?:学习|专业[是为]?)\s*([\u4e00-\u9fa5A-Za-z]+)",
            r"([\u4e00-\u9fa5A-Za-z]+)专业",
        ]
        for pattern in major_patterns:
            match = re.search(pattern, text)
            if match:
                data["major"] = match.group(1).strip()
                break
        
        # 提取学历
        degree_keywords = {
            "博士": "博士",
            "硕士": "硕士",
            "研究生": "硕士",
            "本科": "本科",
            "学士": "本科",
            "大专": "大专",
            "高中": "高中"
        }
        for keyword, degree in degree_keywords.items():
            if keyword in text:
                data["degree"] = degree
                break
        
        # 提取时间
        dates = self._extract_dates(text)
        if len(dates) >= 2:
            data["startDate"] = dates[0]
            data["endDate"] = dates[1]
        elif len(dates) == 1:
            data["startDate"] = dates[0]
        
        return data
    
    def _extract_basic(self, text: str) -> Dict[str, Any]:
        """提取基本信息"""
        data = {}
        
        # 提取姓名（优先匹配"我叫XX"、"我是XX"）
        name_patterns = [
            r"我(?:叫|是)\s*([\u4e00-\u9fa5]{2,4})",  # "我叫李四"、"我是张三"
            r"(?:名字|姓名)[是叫为]?\s*([\u4e00-\u9fa5]{2,4})",
            r"改[成为]\s*([\u4e00-\u9fa5]{2,4})",
        ]
        for pattern in name_patterns:
            match = re.search(pattern, text)
            if match:
                data["name"] = match.group(1).strip()
                break
        
        # 提取职位（支持"我叫XX，XX工程师"格式）
        title_patterns = [
            r"[,，]\s*([\u4e00-\u9fa5]+?(?:工程师|开发|设计师|经理|总监|主管|架构师|分析师|运营|产品))",
            r"(?:职位|岗位|title)[是为]?\s*([\u4e00-\u9fa5A-Za-z]+)",
            r"是\s*([\u4e00-\u9fa5]+?(?:工程师|开发|设计师|经理|总监|主管|架构师))",
        ]
        for pattern in title_patterns:
            match = re.search(pattern, text)
            if match:
                title = match.group(1).strip()
                # 排除姓名
                if title not in data.get("name", ""):
                    data["title"] = title
                    break
        
        # 提取电话
        phone_pattern = r"1[3-9]\d{9}"
        match = re.search(phone_pattern, text)
        if match:
            data["phone"] = match.group(0)
        
        # 提取邮箱
        email_pattern = r"[\w\.-]+@[\w\.-]+\.\w+"
        match = re.search(email_pattern, text)
        if match:
            data["email"] = match.group(0)
        
        return data
    
    def _extract_skills(self, text: str) -> Dict[str, Any]:
        """提取技能数据"""
        data = {"name": "", "level": ""}
        
        # 提取技能名称
        skill_patterns = [
            r"(?:会|掌握|熟悉|擅长)\s*([\w\+\#\-\.]+)",
            r"([\w\+\#\-\.]+)\s*(?:技术|框架|语言)",
        ]
        for pattern in skill_patterns:
            match = re.search(pattern, text)
            if match:
                data["name"] = match.group(1).strip()
                break
        
        return data
    
    def _extract_projects(self, text: str) -> Dict[str, Any]:
        """提取项目数据"""
        data = {"name": "", "description": "", "role": ""}
        
        # 提取项目名称
        project_patterns = [
            r'(?:项目|做过)\s*[《""]?([\u4e00-\u9fa5A-Za-z0-9\-]+)[》""]?',
        ]
        for pattern in project_patterns:
            match = re.search(pattern, text)
            if match:
                data["name"] = match.group(1).strip()
                break
        
        # 提取描述
        desc_patterns = [
            r"(?:主要|负责|内容[是为]?)\s*(.+?)(?:[,，。]|$)",
        ]
        for pattern in desc_patterns:
            match = re.search(pattern, text)
            if match:
                data["description"] = match.group(1).strip()
                break
        
        return data
    
    def _extract_dates(self, text: str) -> List[str]:
        """提取日期
        
        支持格式：
        - 2022年3月到2024年6月
        - 2021年到2023年
        - 2021-2023
        - 2021年3月-2023年6月
        """
        dates = []
        
        # 优先匹配：开始时间到结束时间（完整格式）
        range_patterns = [
            # 2022年3月到2024年6月
            r"(\d{4})[年\-/](\d{1,2})[月]?\s*(?:到|至|-|~)\s*(\d{4})[年\-/](\d{1,2})[月]?",
            # 2021年到2023年
            r"(\d{4})[年]\s*(?:到|至|-|~)\s*(\d{4})[年]?",
            # 2021-2023
            r"(\d{4})\s*-\s*(\d{4})",
        ]
        
        for pattern in range_patterns:
            match = re.search(pattern, text)
            if match:
                groups = match.groups()
                if len(groups) == 4:  # 年月-年月格式
                    start_year, start_month, end_year, end_month = groups
                    dates.append(f"{start_year}-{start_month.zfill(2)}")
                    dates.append(f"{end_year}-{end_month.zfill(2)}")
                    return dates
                elif len(groups) == 2:  # 年-年格式
                    start_year, end_year = groups
                    dates.append(f"{start_year}-01")
                    dates.append(f"{end_year}-01")
                    return dates
        
        # 如果没有匹配到范围格式，尝试匹配单个日期
        single_date_patterns = [
            r"(\d{4})[年\-/](\d{1,2})[月]?",  # 2021年3月 或 2021-03
            r"(\d{4})[年]?",  # 2021年 或 2021
        ]
        
        for pattern in single_date_patterns:
            matches = re.findall(pattern, text)
            for match in matches:
                if isinstance(match, tuple):
                    year, month = match[0], match[1] if len(match) > 1 else "01"
                    date_str = f"{year}-{month.zfill(2)}"
                    if date_str not in dates:
                        dates.append(date_str)
                else:
                    date_str = f"{match}-01"
                    if date_str not in dates:
                        dates.append(date_str)
        
        # 去重并保持顺序（不排序，保持原始顺序）
        seen = set()
        result = []
        for date in dates:
            if date not in seen:
                seen.add(date)
                result.append(date)
        
        return result[:2]  # 最多返回两个日期
    
    def _recognize_path(
        self,
        text: str,
        module: str,
        resume_data: Optional[Dict[str, Any]]
    ) -> Tuple[Optional[str], Optional[int]]:
        """识别路径和索引"""
        path = None
        index = None
        
        # 识别索引
        index_patterns = [
            r"第\s*(\d+)\s*[条个]",
            r"第\s*(一|二|三|四|五|六|七|八|九|十)\s*[条个]",
        ]
        
        cn_to_num = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5,
                     "六": 6, "七": 7, "八": 8, "九": 9, "十": 10}
        
        for pattern in index_patterns:
            match = re.search(pattern, text)
            if match:
                idx_str = match.group(1)
                if idx_str in cn_to_num:
                    index = cn_to_num[idx_str] - 1  # 转为 0-based
                else:
                    index = int(idx_str) - 1
                break
        
        # 特殊处理：skills 模块是顶层字段，不需要子字段
        if module == "skills":
            # skills 是顶层字段，直接返回 "skills"
            return "skills", None
        
        # 识别具体字段
        field_patterns = {
            "company": ["公司", "公司名"],
            "position": ["职位", "岗位"],
            "name": ["名字", "姓名"],
            "school": ["学校"],
            "major": ["专业"],
            "description": ["描述", "内容", "详情", "介绍"],
        }
        
        for field, keywords in field_patterns.items():
            for keyword in keywords:
                if keyword in text:
                    if index is not None:
                        path = f"{module}[{index}].{field}"
                    else:
                        path = f"{module}.{field}"
                    break
            if path:
                break
        
        return path, index
    
    def extract_update_value(self, text: str) -> Optional[str]:
        """提取更新的值"""
        patterns = [
            r'(?:改[成为]|换成|设置?为|更新为)\s*[「""\'"]?(.+?)[」""\'"]?\s*$',
            r'(?:改[成为]|换成|设置?为|更新为)\s*(.+?)(?:[,，。]|$)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1).strip()
        
        return None


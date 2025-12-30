"""
任务规划器 (Task Planner)

实现：
1. 意图识别 - 从用户输入识别操作意图
2. 任务分解 - 将复杂请求分解为子任务
3. 路径映射 - 将自然语言映射到 JSON 路径
"""
from typing import Dict, Any, Optional, List, Tuple
from enum import Enum
from dataclasses import dataclass
import re


class IntentType(str, Enum):
    """意图类型"""
    READ = "read"           # 读取/查看
    UPDATE = "update"       # 修改/更新
    ADD = "add"             # 添加
    DELETE = "delete"       # 删除
    QUESTION = "question"   # 提问
    UNKNOWN = "unknown"     # 未知


# 意图关键词映射
INTENT_KEYWORDS = {
    IntentType.READ: ["查看", "看看", "显示", "获取", "读取", "是什么", "有哪些", "什么是"],
    IntentType.UPDATE: ["修改", "改成", "更新", "换成", "设置", "改为", "变成", "更改"],
    IntentType.ADD: [
        "添加", "新增", "加上", "增加", "补充",
        "工作经历", "实习经历", "工作过", "实习过",
        "add", "add a work experience", "work experience", "internship"
    ],
    IntentType.DELETE: ["删除", "移除", "去掉", "清除"],
    IntentType.QUESTION: ["怎么", "如何", "为什么", "什么"],
}

# 模块关键词映射 (自然语言 -> JSON 路径)
MODULE_KEYWORDS = {
    "basic": ["基本", "个人", "姓名", "名字", "电话", "邮箱", "联系", "职位", "城市", "地址"],
    "education": ["教育", "学校", "大学", "学历", "专业", "学位"],
    "workExperience": ["工作", "实习", "公司", "职位", "经历", "work experience", "internship", "job"],
    "projects": ["项目", "作品"],
    "skillContent": ["技能", "能力", "特长"],
}

# 字段关键词映射
FIELD_KEYWORDS = {
    # basic 字段
    "name": ["名字", "姓名"],
    "title": ["职位", "头衔", "岗位"],
    "email": ["邮箱", "邮件", "email"],
    "phone": ["电话", "手机", "联系方式"],
    "location": ["城市", "地址", "位置"],
    # education 字段
    "school": ["学校", "院校", "大学"],
    "major": ["专业"],
    "degree": ["学位", "学历"],
    # workExperience 字段
    "company": ["公司", "企业", "单位"],
    "position": ["职位", "岗位"],
    "description": ["描述", "内容", "详情"],
}


@dataclass
class IntentResult:
    """意图识别结果"""
    intent: IntentType              # 意图类型
    module: Optional[str] = None    # 目标模块 (basic, education, etc.)
    field: Optional[str] = None     # 目标字段 (name, school, etc.)
    index: Optional[int] = None     # 数组索引
    value: Optional[str] = None     # 提取的值
    confidence: float = 0.0         # 置信度
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "intent": self.intent.value,
            "module": self.module,
            "field": self.field,
            "index": self.index,
            "value": self.value,
            "confidence": self.confidence
        }
    
    def get_path(self) -> Optional[str]:
        """构建 JSON 路径"""
        if not self.module:
            return None
        
        path = self.module
        
        # 添加数组索引
        if self.index is not None:
            path += f"[{self.index}]"
        
        # 添加字段
        if self.field:
            path += f".{self.field}"
        
        return path


class IntentRecognizer:
    """
    意图识别器
    
    从用户自然语言输入中识别：
    - 操作意图 (读/写/增/删)
    - 目标模块 (basic/education/...)
    - 目标字段 (name/school/...)
    - 提取的值
    """
    
    def recognize(self, user_input: str, context: Optional[Dict] = None) -> IntentResult:
        """
        识别用户意图
        
        Args:
            user_input: 用户输入文本
            context: 上下文（当前任务等）
        
        Returns:
            IntentResult 对象
        """
        # 1. 识别意图类型
        intent = self._recognize_intent_type(user_input)
        
        # 2. 识别目标模块
        module = self._recognize_module(user_input)
        
        # 3. 识别目标字段
        field = self._recognize_field(user_input)
        
        # 4. 识别数组索引
        index = self._extract_index(user_input)
        
        # 5. 提取值
        value = self._extract_value(user_input, intent)
        
        # 6. 计算置信度
        confidence = self._calculate_confidence(intent, module, field, value)
        
        # 7. 推断缺失信息 / 字段归一
        if field and not module:
            module = self._infer_module_from_field(field)
        
        # 工作经历模块下，将识别为 title 的“职位”归一到 position
        if module == "workExperience" and field == "title":
            field = "position"
        
        return IntentResult(
            intent=intent,
            module=module,
            field=field,
            index=index,
            value=value,
            confidence=confidence
        )
    
    def _recognize_intent_type(self, text: str) -> IntentType:
        """识别意图类型"""
        text_lower = text.lower()
        
        # 计算每种意图的匹配分数
        scores = {}
        for intent, keywords in INTENT_KEYWORDS.items():
            score = sum(1 for kw in keywords if kw in text)
            scores[intent] = score
        
        # 返回得分最高的意图
        if max(scores.values()) > 0:
            return max(scores.keys(), key=lambda k: scores[k])
        
        # 默认：如果包含"改成"、"是"等赋值模式，判定为 UPDATE
        if re.search(r'改成|换成|设置为|改为', text):
            return IntentType.UPDATE
        
        # 如果包含工作/实习相关描述，默认视为添加经历
        work_patterns = [
            r'工作过|实习过',
            r'在.+工作|在.+实习',
            r'在.+做',  # "在腾讯做前端开发"
            r'worked at|work experience|internship',
            r'公司是|职位是|岗位是',
        ]
        if any(re.search(p, text_lower) for p in work_patterns):
            return IntentType.ADD
        
        return IntentType.UNKNOWN
    
    def _recognize_module(self, text: str) -> Optional[str]:
        """识别目标模块（按关键词匹配数量打分，避免被通用字段抢占）"""
        # 优先检测工作/实习相关模式
        work_patterns = [
            r'在.+工作', r'在.+实习', r'在.+做',
            r'工作过', r'实习过',
            r'公司是', r'职位是', r'岗位是',
        ]
        if any(re.search(p, text) for p in work_patterns):
            return "workExperience"
        
        best_module = None
        best_score = 0
        for module, keywords in MODULE_KEYWORDS.items():
            score = sum(1 for kw in keywords if kw in text)
            if score > best_score:
                best_score = score
                best_module = module
        return best_module
    
    def _recognize_field(self, text: str) -> Optional[str]:
        """识别目标字段"""
        for field, keywords in FIELD_KEYWORDS.items():
            for kw in keywords:
                if kw in text:
                    return field
        return None
    
    def _extract_index(self, text: str) -> Optional[int]:
        """提取数组索引"""
        # 匹配 "第一个"、"第1条"、"第一条" 等
        patterns = [
            (r'第(\d+)(?:个|条|段)', lambda m: int(m.group(1)) - 1),
            (r'第(一|二|三|四|五)(?:个|条|段)', lambda m: "一二三四五".index(m.group(1))),
            (r'\[(\d+)\]', lambda m: int(m.group(1))),
        ]
        
        for pattern, converter in patterns:
            match = re.search(pattern, text)
            if match:
                try:
                    return converter(match)
                except:
                    pass
        
        return None
    
    def _extract_value(self, text: str, intent: IntentType) -> Optional[str]:
        """提取值"""
        if intent not in [IntentType.UPDATE, IntentType.ADD]:
            return None
        
        # 尝试多种模式提取值
        patterns = [
            r'(?:改成|换成|设置为|改为|变成|是)\s*[「『"\'"]?([^「『」』"\'"]+)[」』"\'"]?',
            r'(?:改成|换成|设置为|改为|变成|是)\s*(.+?)(?:$|，|。)',
            r'叫\s*(.+?)(?:$|，|。)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                value = match.group(1).strip()
                # 清理多余的标点
                value = re.sub(r'[。，！？]$', '', value)
                if value:
                    return value
        
        return None
    
    def _calculate_confidence(self, intent: IntentType, module: Optional[str], 
                             field: Optional[str], value: Optional[str]) -> float:
        """计算置信度"""
        score = 0.0
        
        if intent != IntentType.UNKNOWN:
            score += 0.3
        if module:
            score += 0.3
        if field:
            score += 0.2
        if value:
            score += 0.2
        
        return min(score, 1.0)
    
    def _infer_module_from_field(self, field: str) -> Optional[str]:
        """从字段推断模块"""
        basic_fields = ["name", "title", "email", "phone", "location"]
        education_fields = ["school", "major", "degree"]
        work_fields = ["company", "position"]
        
        if field in basic_fields:
            return "basic"
        elif field in education_fields:
            return "education"
        elif field in work_fields:
            return "workExperience"
        
        return None


class TaskPlanner:
    """
    任务规划器
    
    基于意图识别结果，规划工具调用
    """
    
    def __init__(self):
        self.intent_recognizer = IntentRecognizer()
        # 必填字段规则（后续可扩展到 education / projects 等）
        self.required_fields = {
            "workExperience": ["company", "position", "startDate", "endDate"]
        }
    
    def plan(self, user_input: str, resume_data: Optional[Dict] = None) -> Dict[str, Any]:
        """
        规划任务
        
        Args:
            user_input: 用户输入
            resume_data: 当前简历数据（用于上下文）
        
        Returns:
            包含 intent_result, tool_call, reply 的字典
        """
        # 1. 识别意图
        intent_result = self.intent_recognizer.recognize(user_input)
        
        # 2. 构建工具调用
        tool_call, need_llm, issues = self._build_tool_call(intent_result, user_input, resume_data)
        
        # 3. 生成回复建议
        reply = self._generate_reply(intent_result, tool_call, issues)
        
        return {
            "intent_result": intent_result.to_dict(),
            "tool_call": tool_call,
            "reply": reply,
            "need_llm": need_llm or intent_result.confidence < 0.6
        }
    
    def _build_tool_call(self, intent: IntentResult, user_input: str, resume_data: Optional[Dict]) -> Tuple[Optional[Dict], bool, List[str]]:
        """构建工具调用"""
        issues: List[str] = []
        path = intent.get_path()
        
        if intent.intent == IntentType.READ:
            return ({
                "name": "CVReader",
                "params": {"path": path} if path else {}
            }, False, issues)
        
        elif intent.intent == IntentType.UPDATE:
            if not path or not intent.value:
                issues.append("缺少路径或更新内容")
                return None, True, issues
            return ({
                "name": "CVEditor",
                "params": {
                    "path": path,
                    "action": "update",
                    "value": intent.value
                }
            }, False, issues)
        
        elif intent.intent == IntentType.ADD:
            if not intent.module:
                issues.append("未识别目标模块")
                return None, True, issues
            
            # 目前仅对 workExperience 做结构化提取，其它模块交给 LLM
            if intent.module == "workExperience":
                experiences = self._extract_work_experiences(user_input)
                
                if not experiences:
                    issues.append("未能从输入中提取有效的工作经历信息")
                    return None, True, issues
                
                # 多段经历：先让用户确认
                if len(experiences) > 1:
                    # 将解析到的公司列表提示给用户，由用户确认
                    companies = [exp.get("company") or "未识别公司" for exp in experiences]
                    issues.append(f"检测到 {len(experiences)} 段工作/实习经历：{companies}，请确认是否全部添加或指定要添加的段落")
                    return None, True, issues
                
                exp = experiences[0]
                
                # 必填字段校验
                missing = [f for f in self.required_fields["workExperience"] if not exp.get(f)]
                if missing:
                    issues.append(self._build_missing_prompt(exp, missing))
                    # 返回部分提取的信息，用于多轮对话补充
                    return ({"partial_experience": exp}, False, issues)
                
                return ({
                    "name": "CVEditor",
                    "params": {
                        "path": "workExperience",
                        "action": "add",
                        "value": exp
                    }
                }, False, issues)
            
            # 其它模块交给 LLM 处理
            issues.append("添加操作需要更多信息，交给 LLM 处理")
            return None, True, issues
        
        elif intent.intent == IntentType.DELETE:
            if not path:
                issues.append("缺少删除路径")
                return None, True, issues
            return ({
                "name": "CVEditor",
                "params": {
                    "path": path,
                    "action": "delete"
                }
            }, False, issues)
        
        return None, True, issues
    
    def _generate_reply(self, intent: IntentResult, tool_call: Optional[Dict], issues: List[str]) -> str:
        """生成回复建议"""
        # 检查是否是有效的工具调用（排除 partial_experience）
        is_valid_tool_call = tool_call and isinstance(tool_call, dict) and tool_call.get("name")
        
        if not is_valid_tool_call:
            # 如果有已知问题，直接反馈
            if issues:
                return "需要更多信息：" + "；".join(issues)
            if intent.intent == IntentType.UNKNOWN:
                return "我不太确定您想要做什么，能否更具体地描述一下？"
            elif intent.intent == IntentType.ADD:
                return "添加操作需要更多信息，请详细说明您想添加的内容。"
            else:
                return "请提供更多信息，例如具体要修改哪个字段。"
        
        if tool_call["name"] == "CVReader":
            path = tool_call["params"].get("path")
            if path:
                return f"好的，我来查看您的 {self._path_to_chinese(path)}..."
            else:
                return "好的，我来查看您的完整简历..."
        
        elif tool_call["name"] == "CVEditor":
            path = tool_call["params"].get("path")
            action = tool_call["params"].get("action")
            value = tool_call["params"].get("value")
            
            if action == "update":
                return f"好的，我将把 {self._path_to_chinese(path)} 更新为「{value}」"
            elif action == "delete":
                return f"好的，我将删除 {self._path_to_chinese(path)}"
            elif action == "add":
                return f"好的，我将添加新的 {self._path_to_chinese(path)}"
        
        return "正在处理您的请求..."
    
    def _path_to_chinese(self, path: str) -> str:
        """将路径转换为中文描述"""
        mappings = {
            "basic.name": "姓名",
            "basic.title": "职位",
            "basic.email": "邮箱",
            "basic.phone": "电话",
            "basic.location": "城市",
            "education": "教育经历",
            "workExperience": "工作经历",
            "projects": "项目经历",
            "skillContent": "技能",
        }
        
        # 直接匹配
        if path in mappings:
            return mappings[path]
        
        # 部分匹配
        for key, value in mappings.items():
            if path.startswith(key):
                return value
        
        return path

    # ============ 工作经历解析与时间标准化 ============
    def _extract_work_experiences(self, text: str) -> List[Dict[str, Any]]:
        """
        从自然语言中提取工作/实习经历
        - 支持多段描述（通过“另外”“还有”“同时”等分隔）
        - 提取 company / position / startDate / endDate / description
        """
        # 按常见连接词拆分多段描述
        parts = re.split(r"[，,。]?另外|还有|同时|并且", text)
        experiences: List[Dict[str, Any]] = []
        
        for seg in parts:
            seg = seg.strip()
            if not seg:
                continue
            
            company = self._match_first(seg, [
                r"在([\u4e00-\u9fa5A-Za-z0-9·\.\-]+?)工作",
                r"在([\u4e00-\u9fa5A-Za-z0-9·\.\-]+?)实习",
                r"在([\u4e00-\u9fa5A-Za-z0-9·\.\-]+?)做",  # 新增：在腾讯做
                r"公司是([\u4e00-\u9fa5A-Za-z0-9·\.\-]+)",
                r"([\u4e00-\u9fa5A-Za-z0-9·\.\-]+)工作过",
                r"worked at ([A-Za-z0-9\\-_]+)",
                r"at ([A-Z][A-Za-z0-9\\-_]+)",
            ])
            
            position = self._match_first(seg, [
                r"职位是([^，。,；；\s]+)",
                r"岗位是([^，。,；；\s]+)",
                r"担任([^，。,；；\s]+)",
                r"作为([^，。,；；\s]+)",
                r"做([\u4e00-\u9fa5A-Za-z]+?开发)",  # 做前端开发
                r"做([\u4e00-\u9fa5A-Za-z]+?工程师)",  # 做前端工程师
                r"是([^，。,；；\s]+?工程师)",
                # 独立的职位名称（前端工程师、后端开发等），不含空格和标点
                r"(?:^|[\s，,])([前后全]端[A-Za-z\u4e00-\u9fa5]{0,6}(?:工程师|开发|架构师))",
                r"(?:^|[\s，,])([\u4e00-\u9fa5A-Za-z]{2,8}(?:工程师|实习生|开发|设计师|经理|总监|主管))(?:[\s，,]|$)",
                r"as a ([A-Za-z ]+?)(?: from| at|,|\\.|\b$)",
                r"as an ([A-Za-z ]+?)(?: from| at|,|\\.|\b$)",
            ])
            
            # 时间提取
            start_raw, end_raw = self._match_time(seg)
            start_norm = self._normalize_date(start_raw) if start_raw else ""
            end_norm = self._normalize_date(end_raw) if end_raw else ""
            
            # 描述提取：取“主要负责/负责”之后
            desc = self._match_first(seg, [
                r"主要负责[:：]?(.+)",
                r"负责[:：]?(.+)",
            ]) or ""
            # 如果仍然为空，则尝试使用整段中除开头公司/时间的剩余部分
            if not desc:
                # 简单截断到时间描述之后
                tail_match = re.search(r"(?:时间[是为].+?)(?:，|。)?(.+)", seg)
                if tail_match:
                    desc = tail_match.group(1).strip()
                elif "。" in seg:
                    desc = seg.split("。")[-1].strip()
            if not desc:
                desc = "待补充描述"
            
            exp = {
                "company": self._clean_text(company or ""),
                "position": self._clean_text(position or ""),
                "startDate": start_norm or start_raw or "",
                "endDate": end_norm or end_raw or "",
                "description": desc.strip()
            }
            # 如果描述过短或仅包含日期信息，标记为待补充
            if exp["description"] and ("结束时间" in exp["description"] or "开始时间" in exp["description"]):
                exp["description"] = "待补充描述"
            if exp["description"] and re.match(r"^[0-9/.\-年月到至~— ]+$", exp["description"]):
                exp["description"] = "待补充描述"
            if not exp["description"]:
                exp["description"] = "待补充描述"
            # 如果至少有公司或描述，才认为有效
            if any([exp["company"], exp["description"], exp["position"]]):
                experiences.append(exp)
        
        return experiences
    
    def _match_first(self, text: str, patterns: List[str]) -> Optional[str]:
        for p in patterns:
            m = re.search(p, text)
            if m:
                return m.group(1).strip()
        return None
    
    def _clean_text(self, text: str) -> str:
        """简单清洗文本，去掉尾部的助词或多余标点"""
        if not text:
            return text
        text = text.strip()
        # 去掉开头的年份残留
        text = re.sub(r"^[0-9]{4}年\s*", "", text)
        text = re.sub(r"^年\s*", "", text)
        if text.endswith("的"):
            text = text[:-1]
        return text

    def _build_missing_prompt(self, exp: Dict[str, Any], missing: List[str]) -> str:
        """针对缺失字段生成更友好的追问提示"""
        company = exp.get("company") or "这段经历"
        known_time = ""
        if exp.get("startDate") or exp.get("endDate"):
            known_time = f"，时间 {exp.get('startDate') or '?'} 至 {exp.get('endDate') or '?'}"
        missing_map = {
            "company": "公司",
            "position": "职位",
            "startDate": "开始时间(YYYY-MM)",
            "endDate": "结束时间(YYYY-MM)",
            "description": "工作描述"
        }
        missing_cn = "、".join(missing_map.get(m, m) for m in missing)
        return (
            f"我已识别到{company}{known_time}。"
            f" 请补充缺少的字段：{missing_cn}。例如：职位可填“前端工程师”。"
        )
    
    def _match_time(self, text: str) -> Tuple[Optional[str], Optional[str]]:
        # 优先匹配“时间是 … 到 …”模式
        m = re.search(r"时间[是为]?\s*([0-9]{4}[^\s到至~—\-，。,；；]*)\s*(?:到|至|~|—|-)\s*([0-9]{4}[^\s，。；]*)", text)
        if m:
            return m.group(1).strip(), m.group(2).strip()
        
        # 备用：匹配 “YYYY.M-YYYY.M” / “YYYY/MM/DD-YYYY/MM/DD”
        m = re.search(r"([0-9]{4}[^到至~—\-，。,；；]{0,8})\s*(?:到|至|~|—|\-)\s*([0-9]{4}[^，。；；]{0,8}|现在|至今)", text)
        if m:
            return m.group(1).strip(), m.group(2).strip()
        
        # 备用：更宽松的“YYYY年xxx到YYYY年yyy”匹配
        m = re.search(r"([0-9]{4}年[^到至~—\-，。,；；]*)到([0-9]{4}年[^，。；；]*)", text)
        if m:
            return m.group(1).strip(), m.group(2).strip()
        
        m = re.search(r"开始时间[是为]?\s*([0-9]{4}[./年-]?[0-9]{0,2}[月]?).*?(?:结束时间|结束日期)[是为]?\s*([0-9]{4}[./年-]?[0-9]{0,2}[月]?|现在|至今)", text)
        if m:
            return m.group(1).strip(), m.group(2).strip()
        
        m = re.search(r"from\s*([0-9]{4}[./-]?[0-9]{0,2})\s*(?:to|-)\s*([0-9]{4}[./-]?[0-9]{0,2}|present)", text, re.IGNORECASE)
        if m:
            return m.group(1).strip(), m.group(2).strip()
        
        return None, None
    
    def _normalize_date(self, raw: str) -> str:
        """将多种时间格式规范为 YYYY-MM，支持 “现在/至今”"""
        if not raw:
            return ""
        raw = raw.strip()
        if raw in ["现在", "至今", "到现在", "至此"]:
            return "至今"
        # 粗略处理“年初/年底”语义
        if "初" in raw:
            raw = raw.replace("初", "01")
        if "底" in raw or "末" in raw:
            raw = raw.replace("底", "12").replace("末", "12")
        
        # 提取年份和月份
        m = re.match(r"(?P<y>\d{4})[年./-]?(?P<m>\d{1,2})?", raw)
        if m:
            y = m.group("y")
            mth = m.group("m") or "01"
            try:
                m_int = int(mth)
                mth = f"{m_int:02d}"
            except:
                mth = "01"
            return f"{y}-{mth}"
        
        return raw


# 便捷函数
def create_task_planner() -> TaskPlanner:
    """创建任务规划器"""
    return TaskPlanner()


def recognize_intent(user_input: str) -> IntentResult:
    """识别意图的便捷函数"""
    recognizer = IntentRecognizer()
    return recognizer.recognize(user_input)



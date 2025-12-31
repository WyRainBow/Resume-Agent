"""
动态任务图 Agent

使用 LLM Function Calling 实现非线性、动态的任务规划。
替代原有的规则引擎（task_planner.py）。

特性：
1. LLM 原生推理，无需关键词匹配
2. RAG 知识库增强回复
3. STAR 法则渐进式追问
4. 多轮对话状态管理

注意：此模块依赖 langchain_core，如果未安装会使用 mock 实现
"""
import json
import re
from typing import Dict, Any, Optional, List, Callable, Union, Tuple
from dataclasses import dataclass, field
from enum import Enum

# Langchain 依赖（可选）
LANGCHAIN_AVAILABLE = False
try:
    from langchain_core.tools import BaseTool, StructuredTool, Tool
    from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
    LANGCHAIN_AVAILABLE = True
except ImportError:
    # Mock classes for when langchain is not available
    class BaseTool:
        pass
    class StructuredTool:
        pass
    class Tool:
        pass
    class AIMessage:
        def __init__(self, content=""):
            self.content = content
    class HumanMessage:
        def __init__(self, content=""):
            self.content = content
    class SystemMessage:
        def __init__(self, content=""):
            self.content = content

# Pydantic 兼容处理
try:
    from pydantic import BaseModel, Field
except ImportError:
    from pydantic.v1 import BaseModel, Field

# 导入现有工具
from .tools import create_cv_reader, create_cv_editor
from .knowledge_base import get_knowledge_base, get_star_guidancer, STARGuidancer


class TaskNodeType(str, Enum):
    """任务节点类型"""
    QUERY = "query"       # 查询/读取
    MODIFY = "modify"     # 修改/更新
    ADD = "add"          # 添加
    DELETE = "delete"     # 删除
    CLARIFY = "clarify"   # 澄清/追问
    GUIDE = "guide"      # 引导/建议


@dataclass
class TaskNode:
    """任务节点"""
    type: TaskNodeType
    description: str
    tool_call: Optional[Dict[str, Any]] = None
    followup_questions: List[str] = field(default_factory=list)
    context: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type.value,
            "description": self.description,
            "tool_call": self.tool_call,
            "followup_questions": self.followup_questions,
            "context": self.context
        }


@dataclass
class TaskGraph:
    """动态任务图"""
    nodes: List[TaskNode] = field(default_factory=list)
    current_index: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def add_node(self, node: TaskNode):
        self.nodes.append(node)

    def get_current_node(self) -> Optional[TaskNode]:
        if 0 <= self.current_index < len(self.nodes):
            return self.nodes[self.current_index]
        return None

    def advance(self) -> bool:
        """移动到下一个节点"""
        if self.current_index < len(self.nodes) - 1:
            self.current_index += 1
            return True
        return False

    def is_complete(self) -> bool:
        return self.current_index >= len(self.nodes)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "nodes": [n.to_dict() for n in self.nodes],
            "current_index": self.current_index,
            "is_complete": self.is_complete(),
            "metadata": self.metadata
        }


class ToolInputSchemas:
    """工具输入的 Pydantic 模型"""

    class CVReaderInput(BaseModel):
        path: str = Field(default="", description="JSON 路径，空字符串返回完整简历")

    class CVEditorUpdateInput(BaseModel):
        path: str = Field(description="JSON 路径，如 workExperience[0].company")
        value: Any = Field(description="新值")

    class CVEditorAddInput(BaseModel):
        path: str = Field(description="模块名，如 workExperience, education")
        value: Dict[str, Any] = Field(description="要添加的对象")

    class CVEditorDeleteInput(BaseModel):
        path: str = Field(description="JSON 路径，如 workExperience[0]")


class LangChainResumeAgent:
    """
    LangChain 简历 Agent

    使用 AgentExecutor 实现动态推理，替代规则引擎。
    """

    # System Prompt
    SYSTEM_PROMPT = """你是 RA AI，一个专业的简历助手。你擅长使用 STAR 法则帮助用户创建和优化简历。

## 你的能力

1. **读取简历** - 使用 CVReader 工具查看简历内容
2. **编辑简历** - 使用 CVEditor 工具修改简历（update/add/delete）
3. **智能建议** - 基于最佳实践和 STAR 法则提供简历优化建议
4. **追问引导** - 根据用户输入，主动追问缺失的关键信息

## 简历结构

```json
{
  "basic": {"name", "title", "email", "phone", "location"},
  "education": [{"school", "major", "degree", "startDate", "endDate", "description"}],
  "workExperience": [{"company", "position", "startDate", "endDate", "description"}],
  "projects": [{"name", "role", "startDate", "endDate", "description"}],
  "skillContent": "技能描述"
}
```

## STAR 法则指导

当用户添加或修改工作/项目经历时，引导其使用 STAR 法则：

- **S (Situation)**: 情境 - 描述背景和问题
- **T (Task)**: 任务 - 明确目标和挑战
- **A (Action)**: 行动 - 采取的具体措施和技术
- **R (Result)**: 结果 - 量化成果和价值

### 好的描述示例
"在公司面临高并发流量挑战时（S），我负责优化核心接口性能（T）。通过引入 Redis 缓存和数据库索引优化（A），将接口响应时间从 500ms 降至 50ms，QPS 提升 10 倍（R）。"

### 需改进的描述
"负责后端开发工作，提升了系统性能。"
（缺少具体的背景、行动细节和量化结果）

## 工作流程

1. **理解意图** - 分析用户想做什么
2. **检查数据** - 使用 CVReader 查看当前状态
3. **执行操作** - 使用 CVEditor 进行修改
4. **STAR 分析** - 检查描述是否完整，必要时追问

## 注意事项

1. 修改前先读取，确认目标存在
2. 添加工作经历必须包含：company, position, startDate, endDate
3. 如果信息不完整，先追问用户再执行操作
4. 日期格式统一使用 YYYY-MM
5. 描述过短（<50字）时，主动引导用户补充 STAR 要素

## 工具使用规则

- **CVReader**: 读取前先判断用户想看什么，返回后做友好总结
- **CVEditor_add**: 添加前检查必填字段，描述过短时引导补充
- **CVEditor_update**: 修改前先读取确认当前值
- **CVEditor_delete**: 删除前确认用户意图，避免误删
"""

    def __init__(
        self,
        resume_data: Optional[Dict[str, Any]] = None,
        session_id: Optional[str] = None,
        llm_call_fn: Optional[Callable] = None,
        enable_rag: bool = True,
        enable_star: bool = True,
        milvus_uri: str = "http://localhost:19530"
    ):
        """
        初始化 Agent

        Args:
            resume_data: 简历数据
            session_id: 会话 ID
            llm_call_fn: LLM 调用函数 (签名为: call_llm(messages, tools=None) -> dict)
            enable_rag: 启用 RAG 知识库
            enable_star: 启用 STAR 法则引导
            milvus_uri: Milvus 地址
        """
        self.resume_data = resume_data or {}
        self.session_id = session_id or "default"
        self.llm_call_fn = llm_call_fn
        self.enable_rag = enable_rag
        self.enable_star = enable_star
        self.milvus_uri = milvus_uri

        # 初始化工具
        self._init_tools()

        # 初始化知识库
        self.knowledge_base = None
        self.star_guidancer = None
        if enable_rag:
            self.knowledge_base = get_knowledge_base(milvus_uri)
        if enable_star:
            self.star_guidancer = get_star_guidancer()

        # 对话历史
        self.chat_history: List[Dict[str, str]] = []

        # 当前任务图
        self.task_graph: Optional[TaskGraph] = None

    def _init_tools(self):
        """初始化 LangChain 工具"""
        self.cv_reader_tool = create_cv_reader(self.resume_data)
        self.cv_editor_tool = create_cv_editor(self.resume_data)

        # 包装为 LangChain StructuredTool
        self.langchain_tools = [
            Tool(
                name="CVReader",
                description="读取简历数据。path参数可选，空字符串返回完整简历，指定路径如'basic.name'返回具体字段。",
                func=lambda **kwargs: self._wrap_reader_result(self.cv_reader._run(**kwargs))
            ),
            StructuredTool.from_function(
                name="CVEditor_update",
                description="更新简历字段。需要 path（JSON路径）和 value（新值）。",
                func=lambda path, value: self._wrap_editor_result(self.cv_editor._run(
                    path=path, action="update", value=value
                )),
                args_schema=ToolInputSchemas.CVEditorUpdateInput
            ),
            StructuredTool.from_function(
                name="CVEditor_add",
                description="添加新的简历条目。需要 path（模块名如workExperience）和 value（对象数据）。",
                func=lambda path, value: self._wrap_editor_result(self.cv_editor._run(
                    path=path, action="add", value=value
                )),
                args_schema=ToolInputSchemas.CVEditorAddInput
            ),
            StructuredTool.from_function(
                name="CVEditor_delete",
                description="删除简历条目。需要 path（JSON路径如workExperience[0]）。",
                func=lambda path: self._wrap_editor_result(self.cv_editor._run(
                    path=path, action="delete"
                )),
                args_schema=ToolInputSchemas.CVEditorDeleteInput
            )
        ]

    def _wrap_reader_result(self, result: Dict) -> str:
        """包装 CVReader 结果为字符串"""
        if result.get("success"):
            data = result.get("data", {})
            return json.dumps(data, ensure_ascii=False, indent=2)
        return f"Error: {result.get('message', 'Unknown error')}"

    def _wrap_editor_result(self, result: Dict) -> str:
        """包装 CVEditor 结果为字符串"""
        if result.get("success"):
            # 同步数据
            self.resume_data.clear()
            self.resume_data.update(self.cv_editor.resume_data)
            return json.dumps(result, ensure_ascii=False)
        return f"Error: {result.get('message', 'Unknown error')}"

    def process_message(self, user_message: str) -> Dict[str, Any]:
        """
        处理用户消息

        Returns:
            {
                "reply": str,
                "tool_calls": List[Dict],
                "tool_results": List[Dict],
                "followup_questions": List[str],
                "task_graph": Dict,
                "resume_modified": bool,
                "rag_sources": List[str]
            }
        """
        # 添加到历史
        self.chat_history.append({"role": "user", "content": user_message})

        # 1. 使用 RAG 获取上下文（增强检索策略）
        rag_context, rag_sources = self._get_rag_context(user_message)
        if rag_context:
            print(f"[RAG] 检索到 {len(rag_sources)} 个相关文档")

        # 2. 构建消息（集成 RAG）
        messages = self._build_messages(user_message, rag_context)

        # 3. 调用 LLM（带工具调用）
        tool_results = []
        tool_calls = []
        reply = ""

        if self.llm_call_fn:
            # 构建 LangChain 风格的工具定义
            lc_tools = self._get_tool_definitions()

            response = self.llm_call_fn(
                messages=messages,
                tools=lc_tools,
                temperature=0.1
            )

            # 解析响应
            content = response.get("content", "")
            response_tool_calls = response.get("tool_calls", [])

            if response_tool_calls:
                # 执行工具调用
                for tc in response_tool_calls:
                    tool_calls.append(tc)
                    result = self._execute_tool_call(tc)
                    tool_results.append(result)

                # 同步数据
                if any(r.get("success") for r in tool_results):
                    # 重新获取 LLM 回复，包含工具结果
                    messages_with_results = messages + [
                        {"role": "assistant", "content": content, "tool_calls": response_tool_calls}
                    ]
                    for tc, tr in zip(response_tool_calls, tool_results):
                        messages_with_results.append({
                            "role": "tool",
                            "tool_call_id": tc.get("id", ""),
                            "content": json.dumps(tr, ensure_ascii=False)
                        })

                    final_response = self.llm_call_fn(messages=messages_with_results)
                    reply = final_response.get("content", "")
                else:
                    reply = content or "操作未成功完成。"
            else:
                reply = content
        else:
            # 没有 LLM 函数，使用本地逻辑
            reply, tool_calls, tool_results = self._process_without_llm(user_message)

        # 4. 生成追问（STAR 法则）
        followup_questions = []
        if self.star_guidancer:
            followup_questions = self._generate_followups(user_message, tool_calls, tool_results)

        # 5. 添加回复到历史
        self.chat_history.append({"role": "assistant", "content": reply})

        # 6. 检查简历是否被修改
        resume_modified = any(
            tc.get("name", "").startswith("CVEditor") and tr.get("success")
            for tc, tr in zip(tool_calls, tool_results)
        )

        return {
            "reply": reply,
            "tool_calls": tool_calls,
            "tool_results": tool_results,
            "followup_questions": followup_questions,
            "resume_modified": resume_modified,
            "rag_context_used": bool(rag_context),
            "rag_sources": rag_sources
        }

    def _build_messages(self, user_message: str, rag_context: str = "") -> List[Dict]:
        """
        构建消息列表，集成 RAG 上下文

        Args:
            user_message: 用户消息
            rag_context: RAG 检索到的上下文

        Returns:
            消息列表
        """
        messages = []

        # System prompt - 基础指令
        system_prompt = self.SYSTEM_PROMPT

        # 注入 RAG 上下文
        if rag_context:
            system_prompt += f"\n\n## 知识库参考\n{rag_context}\n请参考以上信息来优化回复。"

        messages.append({"role": "system", "content": system_prompt})

        # 添加简历摘要（帮助 LLM 理解当前状态）
        resume_summary = self._get_resume_summary()
        if resume_summary:
            messages.append({
                "role": "system",
                "content": f"当前简历状态: {resume_summary}"
            })

        # 最近对话历史（最近 5 轮，共 10 条消息）
        recent_history = self.chat_history[-10:] if len(self.chat_history) > 10 else self.chat_history
        messages.extend(recent_history)

        # 当前消息
        messages.append({"role": "user", "content": user_message})

        return messages

    def _get_rag_context(self, user_message: str) -> Tuple[str, List[str]]:
        """
        获取 RAG 上下文，支持多种检索策略

        Returns:
            (上下文字符串, 检索到的文档来源列表)
        """
        if not self.knowledge_base:
            return "", []

        # 1. 语义检索
        docs = self.knowledge_base.search(user_message, top_k=3)

        if not docs:
            return "", []

        # 2. 构建上下文
        context_parts = []
        sources = []

        for doc in docs:
            content = doc.page_content.strip()
            source = doc.metadata.get("source", "unknown")
            category = doc.metadata.get("category", "general")

            if content:
                # 添加分类标签
                category_label = {
                    "star": "STAR法则",
                    "template": "模板",
                    "best_practice": "最佳实践",
                    "position": "职位参考",
                    "industry": "行业知识"
                }.get(category, category)

                context_parts.append(f"【{category_label}】\n{content}")
                sources.append(source)

        return "\n\n".join(context_parts), sources

    def _get_tool_definitions(self) -> List[Dict]:
        """获取工具定义（LLM 格式）"""
        return [
            {
                "type": "function",
                "function": {
                    "name": "CVReader",
                    "description": "读取简历数据。path可选，空字符串返回完整简历。",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "path": {
                                "type": "string",
                                "description": "JSON路径，如basic.name或workExperience，空字符串返回完整简历"
                            }
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "CVEditor_update",
                    "description": "更新简历字段值。",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "path": {
                                "type": "string",
                                "description": "JSON路径，如workExperience[0].company或basic.email"
                            },
                            "value": {"description": "新值"}
                        },
                        "required": ["path", "value"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "CVEditor_add",
                    "description": "添加新的简历条目到数组。",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "path": {
                                "type": "string",
                                "description": "模块名，如workExperience、education、projects",
                                "enum": ["workExperience", "education", "projects"]
                            },
                            "value": {
                                "type": "object",
                                "description": "要添加的对象，必须包含必填字段"
                            }
                        },
                        "required": ["path", "value"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "CVEditor_delete",
                    "description": "删除简历条目。",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "path": {
                                "type": "string",
                                "description": "JSON路径，如workExperience[0]删除第一条工作经历"
                            }
                        },
                        "required": ["path"]
                    }
                }
            }
        ]

    def _execute_tool_call(self, tool_call: Dict) -> Dict[str, Any]:
        """执行工具调用"""
        name = tool_call.get("name", "")
        args = tool_call.get("arguments", {})

        # 兼容不同格式
        if "params" in tool_call:
            args = tool_call["params"]

        try:
            if name == "CVReader":
                result = self.cv_reader_tool._run(path=args.get("path", ""))
            elif name == "CVEditor_update":
                result = self.cv_editor_tool._run(
                    path=args["path"],
                    action="update",
                    value=args.get("value")
                )
            elif name == "CVEditor_add":
                result = self.cv_editor_tool._run(
                    path=args["path"],
                    action="add",
                    value=args.get("value", {})
                )
            elif name == "CVEditor_delete":
                result = self.cv_editor_tool._run(
                    path=args["path"],
                    action="delete"
                )
            else:
                result = {"success": False, "message": f"Unknown tool: {name}"}

            # 同步数据
            if result.get("success"):
                self.resume_data.clear()
                self.resume_data.update(self.cv_editor_tool.resume_data)

            return result

        except Exception as e:
            return {"success": False, "message": str(e)}

    def _process_without_llm(self, user_message: str) -> tuple:
        """
        无 LLM 时的本地处理（降级方案）

        Returns:
            (reply, tool_calls, tool_results)
        """
        # 简单的关键词匹配（降级方案）
        reply = "我需要更多信息来处理您的请求。请尝试更具体地描述您想做什么。"
        tool_calls = []
        tool_results = []

        return reply, tool_calls, tool_results

    def _generate_followups(
        self,
        user_message: str,
        tool_calls: List[Dict],
        tool_results: List[Dict]
    ) -> List[str]:
        """
        生成 STAR 法则追问问题

        Args:
            user_message: 用户原始消息
            tool_calls: 工具调用列表
            tool_results: 工具执行结果列表

        Returns:
            追问问题列表
        """
        questions = []

        # 1. 检查工具调用中是否有描述需要 STAR 优化
        for tc, tr in zip(tool_calls, tool_results):
            tool_name = tc.get("name", "")

            # 添加操作后检查描述完整性
            if tool_name in ["CVEditor_add", "CVEditor_update"] and tr.get("success"):
                value = (tc.get("arguments", {}).get("value") or
                        tc.get("params", {}).get("value", {}))

                if isinstance(value, dict):
                    description = value.get("description", "")
                    position = value.get("position", "")
                    company = value.get("company", "")
                    path = tc.get("arguments", {}).get("path") or tc.get("params", {}).get("path", "")

                    # 判断是否需要追问
                    need_followup = False

                    # 描述过短
                    if description and len(description) < 50:
                        need_followup = True

                    # STAR 完整性检查
                    if description and self.star_guidancer:
                        analysis = self.star_guidancer.analyze_description(description)
                        if analysis["completeness"] < 0.6:
                            need_followup = True
                            questions.extend(
                                self.star_guidancer.generate_followup_questions({
                                    "current_description": description,
                                    "position": position,
                                    "company": company
                                }, max_questions=2)
                            )

                    # 如果描述为空或过短，添加通用追问
                    if not description or len(description) < 20:
                        module_name = {"workExperience": "工作经历", "education": "教育经历",
                                      "projects": "项目经历"}.get(path, "这段经历")
                        questions.append(
                            f"能否详细描述一下{module_name}？包括：背景、具体做了什么、使用的技术/方法、取得的成果。"
                        )

        # 2. 检查用户是否在描述经历但信息不完整（未触发工具调用时）
        if not tool_calls and self.star_guidancer:
            analysis = self.star_guidancer.analyze_description(user_message)

            # 判断是否是经历描述
            is_experience_description = any(
                kw in user_message for kw in
                ["工作", "实习", "公司", "负责", "参与", "项目", "开发", "设计"]
            )

            if is_experience_description and analysis["completeness"] < 0.6:
                # 根据缺失的 STAR 要素生成追问
                generated = self.star_guidancer.generate_followup_questions({
                    "current_description": user_message
                }, max_questions=2)

                # 去重
                for q in generated:
                    if q not in questions:
                        questions.append(q)

        # 3. 检查是否有必填字段缺失（针对工作经历）
        for tc, tr in zip(tool_calls, tool_results):
            if tc.get("name") == "CVEditor_add":
                value = (tc.get("arguments", {}).get("value") or
                        tc.get("params", {}).get("value", {}))
                path = tc.get("arguments", {}).get("path") or tc.get("params", {}).get("path", "")

                if isinstance(value, dict) and path == "workExperience":
                    required_fields = {
                        "company": "公司名称",
                        "position": "职位名称",
                        "startDate": "开始时间",
                        "endDate": "结束时间"
                    }

                    missing = [name for field, name in required_fields.items()
                              if not value.get(field)]

                    if missing:
                        questions.append(f"请补充以下信息：{'、'.join(missing)}")

        # 限制追问数量，避免过多
        return questions[:3]

    def _get_resume_summary(self) -> str:
        """获取简历摘要"""
        if not self.resume_data:
            return "空简历"

        parts = []
        basic = self.resume_data.get("basic", {})
        if basic.get("name"):
            parts.append(f"姓名:{basic['name']}")

        counts = {}
        for key in ["education", "workExperience", "projects"]:
            items = self.resume_data.get(key, [])
            if items:
                name = {"education": "教育", "workExperience": "工作", "projects": "项目"}[key]
                counts[name] = len(items)

        if counts:
            parts.append(", ".join(f"{k}:{v}条" for k, v in counts.items()))

        return ", ".join(parts) if parts else "空简历"

    def update_resume_data(self, new_data: Dict[str, Any]):
        """更新简历数据"""
        self.resume_data = new_data
        self.cv_reader_tool = create_cv_reader(self.resume_data)
        self.cv_editor_tool = create_cv_editor(self.resume_data)
        self._init_tools()

    def clear_history(self):
        """清空对话历史"""
        self.chat_history = []


# 便捷函数
def create_dynamic_agent(
    resume_data: Optional[Dict[str, Any]] = None,
    session_id: Optional[str] = None,
    llm_call_fn: Optional[Callable] = None,
    enable_rag: bool = True,
    enable_star: bool = True,
    milvus_uri: str = "http://localhost:19530"
) -> LangChainResumeAgent:
    """创建动态任务 Agent"""
    return LangChainResumeAgent(
        resume_data=resume_data,
        session_id=session_id,
        llm_call_fn=llm_call_fn,
        enable_rag=enable_rag,
        enable_star=enable_star,
        milvus_uri=milvus_uri
    )

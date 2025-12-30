"""
核心智能体 (Core Agent) - LangChain 版本

基于 LangChain 框架实现简历 AI 助手。
使用 TaskPlanner 进行意图识别和任务规划，再由 LLM 处理复杂请求。
"""
import json
import re
from typing import Dict, Any, Optional, List, AsyncGenerator
from dataclasses import dataclass
from enum import Enum

from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

# 导入任务规划器
from .task_planner import TaskPlanner, IntentRecognizer, IntentResult, IntentType, create_task_planner

# 导入工具
from .tools import (
    create_cv_reader,
    create_cv_editor,
    ALL_TOOLS_FUNCTION_DEFS
)

# LLM 调用
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from llm import call_llm, call_llm_stream


# ==================== 系统提示词 ====================

SYSTEM_PROMPT = """你是 RA AI，一个专业的简历助手。帮助用户创建和编辑简历。

## 可用工具

1. **CVReader** - 读取简历数据
   - path: JSON 路径（可选），不填返回完整简历
   - 示例路径: basic.name, education[0].school, workExperience

2. **CVEditor** - 编辑简历数据
   - path: JSON 路径（必填）
   - action: update(修改)/add(添加到数组)/delete(删除)
   - value: 新值（update/add 必填）

## 简历结构

```json
{
  "basic": { "name", "title", "email", "phone", "location" },
  "education": [{ "school", "major", "degree", "startDate", "endDate", "description" }],
  "workExperience": [{ "company", "position", "startDate", "endDate", "description" }],
  "projects": [{ "name", "role", "startDate", "endDate", "description" }],
  "skillContent": "技能描述"
}
```

## 输出格式

你必须以 JSON 格式回复：

```json
{
  "tool_call": {
    "name": "CVReader 或 CVEditor",
    "params": { ... }
  },
  "reply": "给用户的友好回复"
}
```

如果不需要工具调用：
```json
{
  "tool_call": null,
  "reply": "直接回复用户"
}
```

## 规则和示例

### 查询操作
- "查看我的名字" → CVReader, path="basic.name"
- "查看教育经历" → CVReader, path="education"
- "查看第一条工作经历" → CVReader, path="workExperience[0]"
- "第一个工作是腾讯" → CVReader, path="workExperience[0]" (然后检查公司是否为腾讯)
- "第一个XX" → 如果XX是工作/教育/项目，使用 CVReader 查询第一条

### 修改操作
- "把名字改成X" → CVEditor, path="basic.name", action="update", value="X"
- "把第一条工作经历的公司改成腾讯" → CVEditor, path="workExperience[0].company", action="update", value="腾讯"
- "第一个工作是腾讯" → 如果是要修改，CVEditor, path="workExperience[0].company", action="update", value="腾讯"

### 添加操作
- "添加一段工作经历" → CVEditor, path="workExperience", action="add", value={...}
- "在腾讯工作过" → CVEditor, path="workExperience", action="add", value={company:"腾讯", ...}

### 删除操作
- "删除第一段实习" → CVEditor, path="workExperience[0]", action="delete"
- "删除第一条工作经历" → CVEditor, path="workExperience[0]", action="delete"

### 注意事项
1. "第一个"、"第一条"、"第一段" 都对应索引 [0]
2. "第二个"、"第二条" 对应索引 [1]，以此类推
3. 如果用户说"第一个工作是腾讯"但简历中没有工作经历，先查询确认
4. 不确定用户意图时，先使用 CVReader 查询，再决定是否需要修改
5. **重要：对于添加、修改、删除操作，必须生成 tool_call，不能只返回文本回复**
6. 如果用户提供了完整的工作经历信息（公司、职位、时间），必须生成 CVEditor 工具调用
7. 回复要简洁友好，但必须包含 tool_call"""


class AgentState(str, Enum):
    """Agent 状态"""
    IDLE = "idle"
    PROCESSING = "processing"
    EXECUTING_TOOL = "executing_tool"


@dataclass
class AgentResponse:
    """Agent 响应"""
    reply: str
    tool_call: Optional[Dict[str, Any]] = None
    tool_result: Optional[Dict[str, Any]] = None
    intent_result: Optional[Dict[str, Any]] = None
    resume_modified: bool = False
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "reply": self.reply,
            "tool_call": self.tool_call,
            "tool_result": self.tool_result,
            "intent_result": self.intent_result,
            "resume_modified": self.resume_modified,
            "error": self.error
        }


class CoreAgent:
    """
    核心智能体
    
    处理流程：
    1. TaskPlanner 进行意图识别和任务规划
    2. 如果置信度高，直接执行工具调用
    3. 如果置信度低或复杂请求，调用 LLM 处理
    4. 支持多轮对话补充信息（待补充经历存入 pending_experience）
    """

    def __init__(self, resume_data: Optional[Dict[str, Any]] = None):
        """
        初始化 Agent
        
        Args:
            resume_data: 简历数据字典
        """
        self._resume_data = resume_data or {}
        self.state = AgentState.IDLE
        self.chat_history: List[Dict[str, str]] = []
        
        # 待补充的工作经历（多轮对话时保存部分信息）
        self.pending_experience: Optional[Dict[str, Any]] = None
        
        # 初始化任务规划器
        self.task_planner = create_task_planner()
        
        # 创建工具实例
        self._init_tools()

    def _init_tools(self):
        """初始化工具"""
        self.cv_reader = create_cv_reader(self._resume_data)
        self.cv_editor = create_cv_editor(self._resume_data)

    @property
    def resume_data(self) -> Dict[str, Any]:
        return self._resume_data

    @resume_data.setter
    def resume_data(self, data: Dict[str, Any]):
        self._resume_data = data
        self._init_tools()

    def process_message(self, user_message: str) -> AgentResponse:
        """
        处理用户消息（同步版本）
        
        Args:
            user_message: 用户输入
        
        Returns:
            AgentResponse 对象
        """
        self.state = AgentState.PROCESSING

        try:
            # 1. 添加到历史
            self.chat_history.append({"role": "user", "content": user_message})

            # 2. 检查是否有待补充的经历，尝试合并补充信息
            merged_result = self._try_merge_pending_experience(user_message)
            if merged_result:
                # 合并成功，直接使用合并后的结果
                plan_result = merged_result
            else:
                # 3. 使用任务规划器进行意图识别
                plan_result = self.task_planner.plan(user_message, self._resume_data)
            
            intent_result = plan_result["intent_result"]
            
            # 4. 判断是否需要 LLM
            tool_call = None
            reply = ""
            
            # 检查 tool_call 是否是有效的工具调用（排除 partial_experience）
            tc = plan_result["tool_call"]
            is_valid_tool_call = tc and isinstance(tc, dict) and tc.get("name") in ["CVReader", "CVEditor"]
            intent_type = intent_result.get("intent", "").lower()
            confidence = intent_result.get("confidence", 0)
            
            if is_valid_tool_call and not plan_result["need_llm"]:
                # 高置信度，直接使用规划器的结果
                tool_call = tc
                reply = plan_result["reply"]
                # 清除待补充经历（因为已经成功构建工具调用）
                self.pending_experience = None
            else:
                # 判断是否需要调用 LLM
                # 对于 ADD 操作，如果置信度低（<0.7）且没有有效工具调用，也应该调用 LLM
                # 因为可能是意图识别错误（如"删除第一个"被误识别为"添加"）
                should_call_llm = (
                    plan_result["need_llm"] or  # 规划器明确要求 LLM
                    intent_type == "unknown" or  # 无法识别意图
                    confidence < 0.5 or  # 置信度太低
                    (not is_valid_tool_call and intent_type == "add" and confidence < 0.7) or  # ADD 意图但置信度低，可能是误识别
                    (not is_valid_tool_call and intent_type != "add")  # 没有有效工具调用且不是添加操作
                )
                
                if should_call_llm:
                    # 调用 LLM 处理复杂或模糊的请求
                    prompt = self._build_prompt(user_message)
                    llm_response = call_llm("deepseek", prompt)
                    parsed = self._parse_response(llm_response)
                    tool_call = parsed.get("tool_call")
                    reply = parsed.get("reply", "")
                    
                    # 标准化工具调用中的时间格式
                    if tool_call and tool_call.get("name") == "CVEditor":
                        params = tool_call.get("params", {})
                        if params.get("action") == "add" and params.get("path") == "workExperience":
                            value = params.get("value", {})
                            if isinstance(value, dict):
                                # 标准化时间格式
                                if value.get("startDate"):
                                    value["startDate"] = self._normalize_date_string(value["startDate"])
                                if value.get("endDate"):
                                    value["endDate"] = self._normalize_date_string(value["endDate"])
                    
                    # 如果 LLM 没有生成工具调用，但回复中提到了"添加"、"已添加"等
                    # 尝试从 pending_experience 和用户输入中提取信息并生成工具调用
                    if not tool_call and (
                        "添加" in reply or "已添加" in reply or "已为您" in reply or "已成功" in reply
                    ):
                        # 如果有 pending_experience，尝试合并
                        if self.pending_experience:
                            extracted = self._extract_supplement_info(user_message)
                            if extracted:
                                merged = self.pending_experience.copy()
                                for key, value in extracted.items():
                                    if value:
                                        merged[key] = value
                                
                                # 检查是否字段完整
                                required_fields = ["company", "position", "startDate", "endDate"]
                                missing = [f for f in required_fields if not merged.get(f)]
                                
                                if not missing:
                                    # 字段完整，生成工具调用
                                    tool_call = {
                                        "name": "CVEditor",
                                        "params": {
                                            "path": "workExperience",
                                            "action": "add",
                                            "value": merged
                                        }
                                    }
                                    self.pending_experience = None
                                    reply = "好的，我将添加新的 工作经历"
                        else:
                            # 没有 pending_experience，尝试从用户输入中直接提取完整信息
                            extracted = self._extract_supplement_info(user_message)
                            if extracted:
                                # 尝试从 LLM 回复中提取公司名称（如果用户输入中没有）
                                if not extracted.get("company"):
                                    company_match = re.search(r"在([\u4e00-\u9fa5A-Za-z0-9·\.\-]+)", reply)
                                    if company_match:
                                        extracted["company"] = company_match.group(1)
                                
                                required_fields = ["company", "position", "startDate", "endDate"]
                                missing = [f for f in required_fields if not extracted.get(f)]
                                
                                if not missing:
                                    # 字段完整，生成工具调用
                                    tool_call = {
                                        "name": "CVEditor",
                                        "params": {
                                            "path": "workExperience",
                                            "action": "add",
                                            "value": extracted
                                        }
                                    }
                                    reply = "好的，我将添加新的 工作经历"
                else:
                    # 规划器已经给出明确的澄清/补充信息提示，直接返回提示
                    # 保存待补充的经历信息（如果有）
                    if not merged_result:
                        self._save_pending_experience(plan_result)
                    return AgentResponse(
                        reply=plan_result["reply"],
                        intent_result=plan_result.get("intent_result"),
                        tool_call=None,
                        tool_result=None,
                        resume_modified=False
                    )

            # 4. 执行工具（如果有）
            tool_result = None
            resume_modified = False

            if tool_call:
                self.state = AgentState.EXECUTING_TOOL
                
                # 额外校验：避免写入空记录或缺失关键字段
                validation_error = self._validate_tool_call(tool_call)
                if validation_error:
                    # 如果是添加工作经历但缺少字段，保存到 pending_experience
                    if (tool_call.get("name") == "CVEditor" and 
                        tool_call.get("params", {}).get("action") == "add" and
                        tool_call.get("params", {}).get("path") == "workExperience"):
                        value = tool_call.get("params", {}).get("value")
                        if isinstance(value, dict):
                            self.pending_experience = {
                                "company": value.get("company", ""),
                                "position": value.get("position", ""),
                                "startDate": value.get("startDate", ""),
                                "endDate": value.get("endDate", ""),
                                "description": value.get("description", "")
                            }
                    
                    self.chat_history.append({"role": "assistant", "content": validation_error})
                    return AgentResponse(
                        reply=validation_error,
                        tool_call=None,
                        tool_result=None,
                        intent_result=intent_result,
                        resume_modified=False
                    )
                
                tool_result = self._execute_tool(tool_call)
                
                if tool_call["name"] == "CVEditor" and tool_result.get("success"):
                    resume_modified = True
                
                # 附加工具结果到回复
                if tool_result.get("success"):
                    if tool_call["name"] == "CVReader" and tool_result.get("data"):
                        data_str = json.dumps(tool_result["data"], ensure_ascii=False, indent=2)
                        if len(data_str) > 500:
                            data_str = data_str[:500] + "\n... (数据已截断)"
                        reply += f"\n\n```json\n{data_str}\n```"
                else:
                    reply = f"❌ 操作失败: {tool_result.get('message', '未知错误')}"

            # 5. 添加到历史
            self.chat_history.append({"role": "assistant", "content": reply})

            return AgentResponse(
                reply=reply,
                tool_call=tool_call,
                tool_result=tool_result,
                intent_result=intent_result,
                resume_modified=resume_modified
            )

        except Exception as e:
            return AgentResponse(
                reply=f"抱歉，处理请求时出错：{e}",
                error=str(e)
            )
        finally:
            self.state = AgentState.IDLE

    async def process_message_stream(self, user_message: str) -> AsyncGenerator[Dict[str, Any], None]:
        """
        处理用户消息（流式版本）
        
        Yields:
            事件字典 {type, content}
        """
        self.state = AgentState.PROCESSING

        try:
            # 1. 添加到历史
            self.chat_history.append({"role": "user", "content": user_message})

            # 2. 使用任务规划器
            plan_result = self.task_planner.plan(user_message, self._resume_data)
            intent_result = plan_result["intent_result"]
            
            yield {"type": "intent", "content": intent_result}

            # 3. 判断是否需要 LLM
            tool_call = None
            reply = ""
            
            if not plan_result["need_llm"] and plan_result["tool_call"]:
                tool_call = plan_result["tool_call"]
                reply = plan_result["reply"]
            else:
                # 调用 LLM
                prompt = self._build_prompt(user_message)
                full_response = ""
                for chunk in call_llm_stream("deepseek", prompt):
                    full_response += chunk
                
                parsed = self._parse_response(full_response)
                tool_call = parsed.get("tool_call")
                reply = parsed.get("reply", "")

            # 4. 执行工具
            if tool_call:
                self.state = AgentState.EXECUTING_TOOL
                yield {"type": "tool_call", "content": tool_call}

                tool_result = self._execute_tool(tool_call)
                yield {"type": "tool_result", "content": tool_result}

                if tool_call["name"] == "CVEditor" and tool_result.get("success"):
                    yield {"type": "resume_modified", "content": True}

            # 5. 返回回复
            if reply:
                yield {"type": "reply", "content": reply}

            self.chat_history.append({"role": "assistant", "content": reply})

        except Exception as e:
            yield {"type": "error", "content": str(e)}

        finally:
            self.state = AgentState.IDLE
            yield {"type": "done", "content": None}

    def _build_prompt(self, user_message: str) -> str:
        """构建提示词"""
        parts = [SYSTEM_PROMPT]

        # 添加简历摘要
        resume_summary = self._get_resume_summary()
        if resume_summary:
            parts.append(f"【当前简历摘要】\n{resume_summary}")

        # 添加最近对话历史（最多5轮）
        recent = self.chat_history[-10:] if len(self.chat_history) > 10 else self.chat_history
        if recent:
            history_str = "\n".join([
                f"{m['role'].upper()}: {m['content'][:200]}" for m in recent
            ])
            parts.append(f"【对话历史】\n{history_str}")

        # 添加当前消息
        parts.append(f"【用户消息】\n{user_message}")

        return "\n\n".join(parts)

    def _get_resume_summary(self) -> str:
        """获取简历摘要"""
        if not self._resume_data:
            return "简历为空"

        parts = []
        basic = self._resume_data.get("basic", {})
        if basic.get("name"):
            parts.append(f"姓名: {basic['name']}")
        if basic.get("title"):
            parts.append(f"职位: {basic['title']}")

        education = self._resume_data.get("education", [])
        if education:
            parts.append(f"教育经历: {len(education)}条")

        work = self._resume_data.get("workExperience", [])
        if work:
            parts.append(f"工作经历: {len(work)}条")

        projects = self._resume_data.get("projects", [])
        if projects:
            parts.append(f"项目经历: {len(projects)}条")

        return ", ".join(parts) if parts else "简历为空"

    def _parse_response(self, response: str) -> Dict[str, Any]:
        """解析 LLM 响应"""
        # 尝试提取 JSON 代码块
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass

        # 尝试直接解析
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            pass

        # 尝试找到 JSON 对象
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            try:
                return json.loads(json_match.group(0))
            except json.JSONDecodeError:
                pass

        # 无法解析，返回原始回复
        return {"tool_call": None, "reply": response}

    def _execute_tool(self, tool_call: Dict[str, Any]) -> Dict[str, Any]:
        """执行工具调用"""
        name = tool_call.get("name")
        params = tool_call.get("params", {})

        if name == "CVReader":
            return self.cv_reader._run(**params)
        elif name == "CVEditor":
            result = self.cv_editor._run(**params)
            # 同步数据：Pydantic 会复制字典，需要手动同步回 _resume_data
            if result.get("success"):
                self._resume_data.clear()
                self._resume_data.update(self.cv_editor.resume_data)
            return result
        else:
            return {"success": False, "message": f"未知工具: {name}"}

    def _validate_tool_call(self, tool_call: Dict[str, Any]) -> Optional[str]:
        """
        在执行前做安全校验，避免写入空记录或缺失关键信息。
        返回错误提示字符串；若校验通过返回 None。
        """
        if tool_call.get("name") != "CVEditor":
            return None
        
        params = tool_call.get("params", {})
        path = params.get("path", "")
        action = params.get("action", "")
        value = params.get("value")
        
        # 仅针对工作经历的添加做严格校验
        if action == "add" and path == "workExperience":
            required_fields = ["company", "position", "startDate", "endDate"]
            if not isinstance(value, dict):
                return "需要提供工作经历的结构化信息（公司、职位、时间、描述），请补充后再试。"
            missing = [f for f in required_fields if not value.get(f)]
            if missing:
                missing_cn = "、".join(missing)
                return f"添加工作经历缺少关键信息：{missing_cn}。请补充公司/职位/起止时间等再试。"
        return None

    def _save_pending_experience(self, plan_result: Dict[str, Any]):
        """
        保存待补充的工作经历信息，供下一轮对话合并使用
        """
        intent_result = plan_result.get("intent_result", {})
        intent = intent_result.get("intent", "").lower()
        
        # 只有在 ADD 意图且针对 workExperience 时才保存
        if intent != "add" or intent_result.get("module") != "workExperience":
            return
        
        # 从 tool_call 中提取部分经历信息（如果有）
        tool_call = plan_result.get("tool_call")
        if isinstance(tool_call, dict) and "partial_experience" in tool_call:
            exp = tool_call["partial_experience"]
            self.pending_experience = {
                "company": exp.get("company", ""),
                "position": exp.get("position", ""),
                "startDate": exp.get("startDate", ""),
                "endDate": exp.get("endDate", ""),
                "description": exp.get("description", "")
            }
        else:
            # 即使没有提取到任何字段，也保存一个空的 pending_experience
            # 以便用户可以在后续对话中逐步补充
            self.pending_experience = {
                "company": "",
                "position": "",
                "startDate": "",
                "endDate": "",
                "description": ""
            }

    def _try_merge_pending_experience(self, user_message: str) -> Optional[Dict[str, Any]]:
        """
        尝试将用户输入的补充信息与待补充的经历合并
        
        Returns:
            如果合并成功，返回新的 plan_result；否则返回 None
        """
        if not self.pending_experience:
            return None
        
        # 使用任务规划器提取当前输入中的信息
        # 先尝试直接解析补充信息
        extracted = self._extract_supplement_info(user_message)
        if not extracted:
            return None
        
        # 合并信息
        merged = self.pending_experience.copy()
        for key, value in extracted.items():
            if value:  # 只覆盖非空值
                # 对于公司名称，如果 pending_experience 中已有且新值不包含"公司"关键词，保留旧值
                if key == "company" and merged.get("company") and "公司" not in value:
                    # 如果新值看起来更像是职位名称（包含"工程师"等），不覆盖
                    if any(term in value for term in ["工程师", "开发", "设计师", "经理", "总监", "主管"]):
                        continue
                merged[key] = value
        
        # 检查是否字段完整
        required_fields = ["company", "position", "startDate", "endDate"]
        missing = [f for f in required_fields if not merged.get(f)]
        
        if not missing:
            # 字段完整，构建工具调用
            self.pending_experience = None  # 清除待补充信息
            return {
                "intent_result": {
                    "intent": "ADD",
                    "module": "workExperience",
                    "value": merged,
                    "confidence": 0.9
                },
                "tool_call": {
                    "name": "CVEditor",
                    "params": {
                        "path": "workExperience",
                        "action": "add",
                        "value": merged
                    }
                },
                "reply": "好的，我将添加新的 工作经历",
                "need_llm": False
            }
        else:
            # 仍有缺失字段，更新待补充信息并返回提示
            self.pending_experience = merged
            known_parts = []
            if merged.get("company"):
                known_parts.append(merged["company"])
            if merged.get("startDate") and merged.get("endDate"):
                known_parts.append(f"时间 {merged['startDate']} 至 {merged['endDate']}")
            known_str = "，".join(known_parts) if known_parts else "这段经历"
            
            missing_cn = {"company": "公司", "position": "职位", "startDate": "开始时间", "endDate": "结束时间"}
            missing_str = "、".join([missing_cn.get(f, f) for f in missing])
            
            return {
                "intent_result": {
                    "intent": "ADD",
                    "module": "workExperience",
                    "value": merged,
                    "confidence": 0.7
                },
                "tool_call": None,
                "reply": f"我已识别到{known_str}。请补充缺少的字段：{missing_str}。",
                "need_llm": False
            }

    def _normalize_date_string(self, date_str: str) -> str:
        """
        标准化时间字符串为 YYYY-MM 格式
        """
        if not date_str:
            return ""
        
        date_str = date_str.strip()
        
        # 如果已经是 YYYY-MM 格式，直接返回
        if re.match(r'^\d{4}-\d{2}$', date_str):
            return date_str
        
        # 如果是 YYYY 格式，转换为 YYYY-01
        if re.match(r'^\d{4}$', date_str):
            return f"{date_str}-01"
        
        # 尝试提取年份和月份
        match = re.match(r'(\d{4})[年./-]?(\d{1,2})?', date_str)
        if match:
            year = match.group(1)
            month = match.group(2) or "01"
            try:
                month_int = int(month)
                if month_int < 1 or month_int > 12:
                    month = "01"
                else:
                    month = f"{month_int:02d}"
            except:
                month = "01"
            return f"{year}-{month}"
        
        return date_str
    
    def _extract_supplement_info(self, text: str) -> Optional[Dict[str, Any]]:
        """
        从补充信息中提取职位、时间、公司等字段
        """
        result = {}
        
        # 提取职位（支持更灵活的格式）
        position_patterns = [
            r"职位[是为]?\s*([^\s，。,；]+)",
            r"岗位[是为]?\s*([^\s，。,；]+)",
            r"担任\s*([^\s，。,；]+)",
            r"做\s*([\u4e00-\u9fa5A-Za-z]+?(?:工程师|开发|设计师|经理|总监|主管))",
            # 匹配独立的职位名称（前后可能有逗号、空格）
            r"[,，]\s*([\u4e00-\u9fa5A-Za-z]{2,8}(?:工程师|实习生|开发|设计师|经理|总监|主管|架构师))",
            r"([\u4e00-\u9fa5A-Za-z]{2,8}(?:工程师|实习生|开发|设计师|经理|总监|主管|架构师))\s*[,，]",
            r"([\u4e00-\u9fa5A-Za-z]{2,8}(?:工程师|实习生|开发|设计师|经理|总监|主管|架构师))",
        ]
        for p in position_patterns:
            m = re.search(p, text)
            if m:
                pos = m.group(1).strip()
                # 排除一些误匹配
                if pos not in ["工作", "实习", "经历", "职位", "岗位", "公司"]:
                    result["position"] = pos
                    break
        
        # 提取时间（支持更灵活的格式）
        time_patterns = [
            r"([0-9]{4})[年./-]?([0-9]{1,2})?[月]?\s*(?:到|至|-|~)\s*([0-9]{4})[年./-]?([0-9]{1,2})?",
            r"([0-9]{4})\s*-\s*([0-9]{4})",
            r"([0-9]{4})\s*年\s*-\s*([0-9]{4})\s*年",
        ]
        for p in time_patterns:
            m = re.search(p, text)
            if m:
                groups = m.groups()
                if len(groups) >= 4:
                    start_y, start_m, end_y, end_m = groups[:4]
                    result["startDate"] = f"{start_y}-{(start_m or '01').zfill(2)}"
                    result["endDate"] = f"{end_y}-{(end_m or '01').zfill(2)}"
                elif len(groups) == 2:
                    result["startDate"] = f"{groups[0]}-01"
                    result["endDate"] = f"{groups[1]}-01"
                break
        
        # 提取公司（支持更灵活的格式，包括在末尾的情况）
        # 先提取职位和时间，避免被误识别为公司
        position_text = result.get("position", "")
        has_time = bool(result.get("startDate") or result.get("endDate"))
        
        company_patterns = [
            r"在([\u4e00-\u9fa5A-Za-z0-9·\.\-]+?)(?:工作|实习|做)",
            r"公司[是为]?\s*([\u4e00-\u9fa5A-Za-z0-9·\.\-]+)",
            r"([\u4e00-\u9fa5A-Za-z0-9·\.\-]+)工作过",
            # 匹配末尾的公司名称（"北京，2022-2024 年，后端工程师 ，腾讯"）
            # 但要排除职位名称、城市名称和时间格式
            r"[,，]\s*([\u4e00-\u9fa5A-Za-z0-9·\.\-]{2,10})\s*$",
            r"在([\u4e00-\u9fa5A-Za-z0-9·\.\-]{2,10})$",
            r"^([\u4e00-\u9fa5A-Za-z0-9·\.\-]{2,10})$",
        ]
        excluded_terms = ["工作", "实习", "经历", "职位", "岗位", "北京", "上海", "深圳", "广州", "杭州", "工程师", "开发", "设计师", "经理", "总监", "主管", "架构师"]
        if position_text:
            excluded_terms.append(position_text)
        
        # 排除时间格式（如 "2020-2022"）
        time_pattern = re.compile(r'^\d{4}[-~至到]\d{4}')
        
        for p in company_patterns:
            m = re.search(p, text.strip())
            if m:
                company = m.group(1).strip()
                # 排除时间格式
                if time_pattern.match(company):
                    continue
                # 排除一些常见的非公司名词和职位名称
                if company not in excluded_terms and not any(term in company for term in ["工程师", "开发", "设计师", "经理", "总监", "主管"]):
                    # 如果已经提取了时间，且公司名称看起来像时间，跳过
                    if has_time and re.match(r'^\d{4}', company):
                        continue
                    result["company"] = company
                    break
        
        return result if result else None

    def clear_history(self):
        """清空对话历史"""
        self.chat_history = []


# ==================== 便捷函数 ====================

def create_agent(resume_data: Optional[Dict[str, Any]] = None) -> CoreAgent:
    """创建 Agent 实例"""
    return CoreAgent(resume_data=resume_data)


async def handle_message_stream(
    message: str,
    resume_data: Dict[str, Any],
    agent: Optional[CoreAgent] = None
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    处理消息的便捷函数（流式）
    """
    if agent is None:
        agent = create_agent(resume_data=resume_data)
    else:
        agent.resume_data = resume_data

    async for event in agent.process_message_stream(message):
        yield event

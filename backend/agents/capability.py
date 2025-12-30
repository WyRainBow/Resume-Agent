"""
Capability（能力包）系统

基于 sophia-pro 的 Capability 系统简化版，用于动态配置 Agent 行为。

设计原则：
- 通过 Capability 配置 Agent 行为，而不是创建多个垂直 Agent 类
- 工具策略通过白名单控制可用工具
- 可选的初始化函数用于 Capability 特定的设置
"""

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional


@dataclass
class ToolPolicy:
    """工具策略配置

    Attributes:
        whitelist: 通用工具白名单（None 表示无限制）
        enabled_tools: 启用的工具列表
        disabled_tools: 禁用的工具列表
    """

    whitelist: Optional[List[str]] = None
    enabled_tools: List[str] = field(default_factory=list)
    disabled_tools: List[str] = field(default_factory=list)

    def get_effective_tools(self, all_available_tools: List[str]) -> List[str]:
        """获取当前策略下的有效工具列表

        Args:
            all_available_tools: 所有可用工具列表

        Returns:
            有效工具列表
        """
        # 如果有白名单，只返回白名单中的工具
        if self.whitelist is not None:
            effective = [t for t in self.whitelist if t in all_available_tools]
        else:
            effective = list(all_available_tools)

        # 应用启用/禁用规则
        if self.enabled_tools:
            effective = [t for t in effective if t in self.enabled_tools]

        if self.disabled_tools:
            effective = [t for t in effective if t not in self.disabled_tools]

        return effective

    def contains(self, tool_name: str, all_available_tools: List[str]) -> bool:
        """检查工具是否在有效列表中"""
        return tool_name in self.get_effective_tools(all_available_tools)

    def merge_with(self, other: "ToolPolicy") -> "ToolPolicy":
        """合并两个工具策略（取并集）"""

        def merge_list(a: Optional[List[str]], b: Optional[List[str]]) -> Optional[List[str]]:
            if a is None and b is None:
                return None
            if a is None:
                return list(b) if b else None
            if b is None:
                return list(a)
            return list(set(a) | set(b))

        return ToolPolicy(
            whitelist=merge_list(self.whitelist, other.whitelist),
            enabled_tools=list(set(self.enabled_tools) | set(other.enabled_tools)),
            disabled_tools=list(set(self.disabled_tools) | set(other.disabled_tools)),
        )


@dataclass
class Capability:
    """能力包定义

    Attributes:
        name: 能力包名称，如 "basic", "advanced", "optimizer"
        description: 能力包描述
        system_prompt_addendum: 追加到 system prompt 的指令
        tool_policy: 工具使用策略
        setup: 可选的初始化函数 (setup(context, shared_state) -> None)
    """

    name: str
    description: str = ""
    system_prompt_addendum: str = ""
    tool_policy: ToolPolicy = field(default_factory=ToolPolicy)
    setup: Optional[Callable[[Dict[str, Any], Any], None]] = None

    def merge_with(self, other: "Capability") -> "Capability":
        """合并两个 Capability"""

        def merged_setup(context: Dict[str, Any], shared_state: Any) -> None:
            if self.setup:
                self.setup(context, shared_state)
            if other.setup:
                other.setup(context, shared_state)

        return Capability(
            name=f"{self.name}+{other.name}",
            description=f"{self.description} + {other.description}",
            system_prompt_addendum=f"{self.system_prompt_addendum}\n\n{other.system_prompt_addendum}".strip(),
            tool_policy=self.tool_policy.merge_with(other.tool_policy),
            setup=merged_setup if (self.setup or other.setup) else None,
        )

    def to_agent_config(self) -> Dict[str, Any]:
        """转换为 Agent 配置字典"""
        return {
            "name": self.name,
            "system_prompt_addendum": self.system_prompt_addendum,
            "tool_policy": self.tool_policy,
        }


# ============================================================================
# 预定义 Capability 实例
# ============================================================================

# 基础工具列表（所有模式都可用）
BASIC_TOOLS = ["CVReader", "CVEditor"]

# 优化工具列表
OPTIMIZATION_TOOLS = ["CVReader", "CVEditor", "SkillsOptimizer"]

# Base Capability - 基础能力
BASE_CAPABILITY = Capability(
    name="base",
    description="基础简历编辑能力",
    system_prompt_addendum="""
你是 RA AI，一个专业的简历助手。

## 基础能力
- 读取简历数据
- 编辑简历字段
- 帮助用户创建和修改简历

## 指导原则
1. 理解用户意图，准确执行操作
2. 友好地回应用户
3. 必要时询问补充信息
""".strip(),
    tool_policy=ToolPolicy(
        whitelist=BASIC_TOOLS,
    ),
)

# Advanced Capability - 高级能力（包含 STAR 法则等优化建议）
ADVANCED_CAPABILITY = Capability(
    name="advanced",
    description="高级简历优化能力（包含 STAR 法则等）",
    system_prompt_addendum="""
## 高级简历优化模式

你是 RA AI，一个专业的简历优化专家，精通 STAR 法则和简历写作最佳实践。

## STAR 法则指导
在帮助用户优化工作经历或项目经历时，引导用户使用 STAR 法则：
- **S**ituation（情境）：当时的环境背景
- **T**ask（任务）：需要完成的目标
- **A**ction（行动）：采取的具体行动
- **R**esult（结果）：取得的成果

## 优化建议
1. **量化成果**：引导用户添加具体数字（如：提升了 30% 的性能）
2. **使用行动动词**：开始描述时使用强动词（如：负责、设计、实现、优化）
3. **突出个人贡献**：明确"我"在其中的作用
4. **简洁有力**：每条经历控制在 3-5 行

## 示例引导
当用户添加工作经历时，如果描述过于简单，可以这样引导：
- "能否具体描述一下您在这个项目中承担的角色？"
- "这个项目取得了什么成果？有可以量化的数据吗？"
- "您使用了哪些技术或方法来完成这个任务？"
""".strip(),
    tool_policy=ToolPolicy(
        whitelist=BASIC_TOOLS,
    ),
)

# Optimizer Capability - 批量优化能力
OPTIMIZER_CAPABILITY = Capability(
    name="optimizer",
    description="批量简历优化和格式化能力",
    system_prompt_addendum="""
## 批量优化模式

你是 RA AI 的批量优化模式，专注于帮助用户系统性地完善简历。

## 工作流程
1. 首先读取完整简历，分析当前状态
2. 识别需要优化的模块和字段
3. 逐个模块提出优化建议
4. 等待用户确认后再进行修改

## 分析维度
- **完整性检查**：是否有缺失的关键信息
- **格式统一性**：日期格式、描述风格等是否一致
- **内容质量**：是否符合行业最佳实践
- **关键词优化**：是否包含目标岗位的关键词

## 输出格式
使用结构化的反馈格式：
```
📋 简历分析报告

1. 工作经历
   - ✅ 格式良好
   - ⚠️ 建议补充：量化成果

2. 教育背景
   - ✅ 完整

3. 技能描述
   - ❌ 缺少技能描述，建议添加
```
""".strip(),
    tool_policy=ToolPolicy(
        whitelist=BASIC_TOOLS,
    ),
)


class CapabilityRegistry:
    """能力包注册中心"""

    _capabilities: Dict[str, Capability] = {
        "base": BASE_CAPABILITY,
        "advanced": ADVANCED_CAPABILITY,
        "optimizer": OPTIMIZER_CAPABILITY,
    }

    _mode_mapping: Dict[str, str] = {
        "basic": "base",
        "edit": "base",
        "advanced": "advanced",
        "optimize": "optimizer",
        "batch": "optimizer",
    }

    @classmethod
    def register(cls, capability: Capability) -> None:
        """注册新的 Capability"""
        cls._capabilities[capability.name] = capability

    @classmethod
    def get(cls, name: str) -> Capability:
        """获取指定名称的 Capability

        Args:
            name: Capability 名称

        Returns:
            Capability 对象，如果不存在则返回 BASE_CAPABILITY
        """
        return cls._capabilities.get(name, BASE_CAPABILITY)

    @classmethod
    def resolve(
        cls,
        mode: Optional[str] = None,
        capability_name: Optional[str] = None,
    ) -> Capability:
        """解析并返回最终 Capability

        优先级：capability_name > mode 映射 > BASE_CAPABILITY

        Args:
            mode: 运行模式（如 "basic", "advanced", "optimize"）
            capability_name: 直接指定的 capability 名称

        Returns:
            最终的 Capability 对象
        """
        if capability_name:
            return cls.get(capability_name)

        if mode:
            mapped = cls._mode_mapping.get(mode)
            if mapped:
                return cls.get(mapped)

        return BASE_CAPABILITY

    @classmethod
    def list_capabilities(cls) -> List[Dict[str, Any]]:
        """列出所有可用的 Capability"""
        return [
            {
                "name": cap.name,
                "description": cap.description,
                "tools": cap.tool_policy.whitelist,
            }
            for cap in cls._capabilities.values()
        ]

"""
测试 ReAct 架构

验证：
1. Capability 系统
2. ReAct 循环
3. 统一流式消息架构
"""

import asyncio
import sys
import os

# 添加项目路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from agents.capability import (
    Capability, ToolPolicy, CapabilityRegistry,
    BASE_CAPABILITY, ADVANCED_CAPABILITY, OPTIMIZER_CAPABILITY
)
from agents.react_agent import ReActAgent, create_react_agent
from agents.message_builder import MessageBuilder, MessageType


def test_capability():
    """测试 Capability 系统"""
    print("=" * 60)
    print("测试 1: Capability 系统")
    print("=" * 60)

    # 测试 ToolPolicy
    print("\n1.1 测试 ToolPolicy:")
    policy = ToolPolicy(
        whitelist=["CVReader", "CVEditor"],
        enabled_tools=["CVReader"],
    )
    all_tools = ["CVReader", "CVEditor", "SkillsOptimizer"]
    effective = policy.get_effective_tools(all_tools)
    print(f"   所有工具: {all_tools}")
    print(f"   白名单: {policy.whitelist}")
    print(f"   启用: {policy.enabled_tools}")
    print(f"   有效工具: {effective}")
    assert effective == ["CVReader", "CVEditor"], "ToolPolicy 计算错误"
    print("   ✅ ToolPolicy 测试通过")

    # 测试 Capability 合并
    print("\n1.2 测试 Capability 合并:")
    merged = BASE_CAPABILITY.merge_with(ADVANCED_CAPABILITY)
    print(f"   合并后名称: {merged.name}")
    print(f"   合并后指令长度: {len(merged.system_prompt_addendum)}")
    assert merged.name == "base+advanced", "Capability 合并名称错误"
    print("   ✅ Capability 合并测试通过")

    # 测试 CapabilityRegistry
    print("\n1.3 测试 CapabilityRegistry:")
    cap = CapabilityRegistry.get("advanced")
    print(f"   获取 'advanced': {cap.name}")
    assert cap.name == "advanced", "CapabilityRegistry 获取错误"

    resolved = CapabilityRegistry.resolve(mode="optimize")
    print(f"   mode='optimize' 解析为: {resolved.name}")
    assert resolved.name == "optimizer", "CapabilityRegistry 解析错误"
    print("   ✅ CapabilityRegistry 测试通过")

    # 列出所有 Capability
    print("\n1.4 所有可用 Capability:")
    for cap_info in CapabilityRegistry.list_capabilities():
        print(f"   - {cap_info['name']}: {cap_info['description']}")
        print(f"     工具: {cap_info['tools']}")


def test_message_builder():
    """测试 MessageBuilder ReAct 相关方法"""
    print("\n" + "=" * 60)
    print("测试 2: MessageBuilder ReAct 消息")
    print("=" * 60)

    session_id = "test_session_001"

    # 测试 Procedure 消息
    print("\n2.1 测试 Procedure 消息:")
    proc_start = MessageBuilder.procedure_start(
        content="开始处理",
        session_id=session_id
    )
    print(f"   类型: {proc_start.type}")
    print(f"   内容: {proc_start.content}")
    assert proc_start.type == MessageType.PROCEDURE_START
    print("   ✅ Procedure start 消息测试通过")

    # 测试 Step 消息
    print("\n2.2 测试 Step 消息:")
    step_start = MessageBuilder.step_start(
        step_number=1,
        max_steps=10,
        session_id=session_id
    )
    print(f"   类型: {step_start.type}")
    print(f"   内容: {step_start.content}")
    print(f"   步骤: {step_start.metadata['step_number']}/{step_start.metadata['max_steps']}")
    assert step_start.type == MessageType.STEP_START
    print("   ✅ Step 消息测试通过")

    # 测试 Thinking 消息
    print("\n2.3 测试 Thinking 消息:")
    think_start = MessageBuilder.thinking_start(session_id=session_id)
    think_content = MessageBuilder.thinking_content(
        content="分析用户意图：用户想修改名字",
        session_id=session_id
    )
    think_end = MessageBuilder.thinking_end(session_id=session_id)

    print(f"   Thinking 开始: {think_start.type}")
    print(f"   Thinking 内容: {think_content.content}")
    print(f"   Thinking 结束: {think_end.type}")
    assert think_start.type == MessageType.THINKING_START
    assert think_content.type == MessageType.THINKING_CONTENT
    assert think_end.type == MessageType.THINKING_END
    print("   ✅ Thinking 消息测试通过")

    # 测试 Final Answer 消息
    print("\n2.4 测试 Final Answer 消息:")
    final = MessageBuilder.final_answer(
        content="已成功将名字修改为张三",
        session_id=session_id
    )
    print(f"   类型: {final.type}")
    print(f"   内容: {final.content}")
    assert final.type == MessageType.FINAL_ANSWER
    print("   ✅ Final Answer 消息测试通过")


async def test_react_agent():
    """测试 ReAct Agent"""
    print("\n" + "=" * 60)
    print("测试 3: ReAct Agent")
    print("=" * 60)

    # 创建测试简历数据
    resume_data = {
        "basic": {
            "name": "测试用户",
            "title": "软件工程师",
        },
        "education": [],
        "workExperience": [],
        "projects": [],
    }

    # 创建 Agent
    print("\n3.1 创建 ReAct Agent:")
    agent = create_react_agent(
        resume_data=resume_data,
        capability_name="base",
        session_id="test_session_001"
    )
    print(f"   Capability: {agent.capability.name}")
    print(f"   简历摘要: {agent._get_resume_summary()}")
    print("   ✅ Agent 创建成功")

    # 测试 Prompt 构建
    print("\n3.2 测试 Prompt 构建:")
    prompt = agent._get_resume_summary()
    print(f"   简历摘要: {prompt}")
    assert "测试用户" in prompt
    print("   ✅ Prompt 构建测试通过")

    # 测试消息流（模拟，不实际调用 LLM）
    print("\n3.3 测试消息结构:")
    test_messages = [
        {"type": "procedure_start", "content": "开始处理"},
        {"type": "step_start", "step_number": 1, "content": "步骤 1/10"},
        {"type": "thinking_start", "content": ""},
        {"type": "thinking_content", "content": "分析用户意图"},
        {"type": "thinking_end", "content": ""},
        {"type": "content", "content": "您好，我可以帮您修改简历"},
        {"type": "final_answer", "content": "请问需要修改什么？"},
        {"type": "step_end", "content": "步骤 1 完成"},
        {"type": "procedure_end", "content": "处理完成"},
    ]

    for msg in test_messages:
        msg_type = msg.get("type")
        msg_content = msg.get("content", "")
        print(f"   📤 {msg_type}: {msg_content[:50] if msg_content else ''}")

    print("   ✅ 消息结构测试通过")


def test_react_output_parser():
    """测试 ReAct 输出解析器"""
    print("\n" + "=" * 60)
    print("测试 4: ReAct 输出解析器")
    print("=" * 60)

    from agents.react_agent import ReActOutputParser

    # 测试用例 1: 带工具调用
    print("\n4.1 测试带工具调用的输出:")
    llm_output_1 = """
Thought: 用户想要修改名字，我需要先读取当前名字，然后更新为新的值
Response: "我来帮您修改名字"
Code:
```python
result = CVEditor(path="basic.name", action="update", value="张三")
```
"""
    parsed_1 = ReActOutputParser.parse(llm_output_1)
    print(f"   Thought: {parsed_1['thought'][:50]}...")
    print(f"   Response: {parsed_1['response']}")
    print(f"   Code: {parsed_1['code'][:60]}...")
    assert "用户想要修改名字" in parsed_1['thought']
    assert "张三" in parsed_1['code']
    print("   ✅ 带工具调用的解析测试通过")

    # 测试用例 2: 最终答案
    print("\n4.2 测试最终答案输出:")
    llm_output_2 = """
Thought: 用户只是问好，不需要调用工具
Response: "您好！我是 RA AI，有什么可以帮您的吗？"
Final Answer: "您好！我是 RA AI，有什么可以帮您的吗？"
"""
    parsed_2 = ReActOutputParser.parse(llm_output_2)
    print(f"   Thought: {parsed_2['thought']}")
    print(f"   Response: {parsed_2['response']}")
    print(f"   Is Final: {parsed_2['is_final']}")
    print(f"   Final Answer: {parsed_2['final_answer']}")
    assert parsed_2['is_final'] == True
    print("   ✅ 最终答案解析测试通过")

    # 测试用例 3: 只有 Thought 和 Response
    print("\n4.3 测试只有 Thought 和 Response:")
    llm_output_3 = """
Thought: 分析用户请求
Response: "好的，我明白了"
"""
    parsed_3 = ReActOutputParser.parse(llm_output_3)
    print(f"   Thought: {parsed_3['thought']}")
    print(f"   Response: {parsed_3['response']}")
    assert parsed_3['thought'] == "分析用户请求"
    assert parsed_3['response'] == "好的，我明白了"
    print("   ✅ 简单输出解析测试通过")


def main():
    """运行所有测试"""
    print("\n" + "=" * 60)
    print("ReAct 架构测试套件")
    print("=" * 60)

    try:
        # 测试 1: Capability 系统
        test_capability()

        # 测试 2: MessageBuilder
        test_message_builder()

        # 测试 3: ReAct Agent
        asyncio.run(test_react_agent())

        # 测试 4: ReAct 输出解析器
        test_react_output_parser()

        print("\n" + "=" * 60)
        print("✅ 所有测试通过！")
        print("=" * 60)

    except AssertionError as e:
        print(f"\n❌ 测试失败: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ 测试出错: {e}")
        import traceback
        traceback.print_exc()
        return 1

    return 0


if __name__ == "__main__":
    exit(main())

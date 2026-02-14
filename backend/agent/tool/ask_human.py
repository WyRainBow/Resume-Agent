import os
import sys

from backend.agent.tool import BaseTool


class AskHuman(BaseTool):
    """Add a tool to ask human for help."""

    name: str = "ask_human"
    description: str = "Use this tool to ask human for help."
    parameters: str = {
        "type": "object",
        "properties": {
            "inquire": {
                "type": "string",
                "description": "The question you want to ask human.",
            }
        },
        "required": ["inquire"],
    }

    async def execute(self, inquire: str) -> str:
        """
        Web 场景默认非阻塞：
        - 避免在 uvicorn 服务进程中调用 input() 导致请求卡死
        - 直接将询问文案返回给上层，交给前端继续展示/引导用户输入

        如需在本地 CLI 强制交互，可设置环境变量：
        ASK_HUMAN_STDIN=1
        """
        enable_stdin = os.getenv("ASK_HUMAN_STDIN", "0") == "1"
        if enable_stdin and sys.stdin and sys.stdin.isatty():
            return input(f"""Bot: {inquire}\n\nYou: """).strip()
        return inquire.strip()

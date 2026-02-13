"""
TTS (Text-to-Speech) 服务
使用 Edge TTS（微软免费方案）
"""

import io
import asyncio
import subprocess
import tempfile
import os
from pathlib import Path
from typing import Optional, Literal
import logging

logger = logging.getLogger(__name__)

# 支持的语言和声音
LANGUAGE_VOICES = {
    "zh-CN": ["zh-CN-XiaoxiaoNeural", "zh-CN-XiaoyiNeural"],  # 中文
    "en-US": ["en-US-JennyNeural", "en-US-GuyNeural"],       # 英文
    "ja-JP": ["ja-JP-NanamiNeural"],                             # 日文
    "ko-KR": ["ko-KR-SunHiNeural"],                               # 韩文
}

# 默认配置
DEFAULT_LANGUAGE = "zh-CN"
DEFAULT_VOICE = "zh-CN-XiaoxiaoNeural"


class EdgeTTSService:
    """Edge TTS 服务类"""

    _instance: Optional["EdgeTTSService"] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        """初始化 Edge TTS"""
        try:
            # 检查是否安装了 edge-tts
            result = subprocess.run(
                ["edge-tts", "--help"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode == 0:
                logger.info("Edge TTS is available")
            else:
                raise RuntimeError("edge-tts not found")
        except FileNotFoundError:
            logger.warning("edge-tts not installed, install with: pip install edge-tts")
            raise RuntimeError("edge-tts not installed")

    def synthesize(
        self,
        text: str,
        voice: str = DEFAULT_VOICE,
        rate: str = "+0%",
        volume: str = "+0%",
        format: Literal["mp3", "wav"] = "mp3",
    ) -> bytes:
        """
        将文本转换为语音

        Args:
            text: 要转换的文本
            voice: 说话人声音（例如：zh-CN-XiaoxiaoNeural）
            rate: 语速（例如：+10%, -10%, +0%）
            volume: 音量（例如：+10%, -10%, +0%）
            format: 音频格式

        Returns:
            音频数据的 bytes
        """
        try:
            # 清理文本
            text = self._clean_text(text)
            if not text:
                raise ValueError("Text is empty after cleaning")

            logger.info(f"Synthesizing text: {text[:50]}... with voice: {voice}")

            # 使用 edge-tts 命令行工具
            with tempfile.NamedTemporaryFile(suffix=f".{format}", delete=False) as temp_file:
                temp_path = temp_file.name

            # 构建 command
            cmd = [
                "edge-tts",
                "--text", text,
                "--voice", voice,
                "--rate", rate,
                "--volume", volume,
                "--write-media", temp_path,
            ]

            # 执行合成
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30,  # 30秒超时
                check=True,
            )

            # 读取音频文件
            if os.path.exists(temp_path):
                with open(temp_path, "rb") as f:
                    audio_bytes = f.read()

                # 清理临时文件
                os.remove(temp_path)

                logger.info(f"Audio generated successfully: {len(audio_bytes)} bytes")
                return audio_bytes
            else:
                raise RuntimeError("Audio file not generated")

        except subprocess.TimeoutExpired:
            logger.error("TTS synthesis timeout")
            raise RuntimeError("Speech synthesis timeout")
        except subprocess.CalledProcessError as e:
            logger.error(f"TTS command failed: {e}")
            raise RuntimeError(f"Speech synthesis failed: {e}")
        except Exception as e:
            logger.error(f"Failed to synthesize speech: {e}")
            raise RuntimeError(f"Speech synthesis failed: {e}")

    def _clean_text(self, text: str) -> str:
        """清理文本，移除不适合朗读的字符"""
        # 移除 markdown 语法
        text = text.replace("*", "").replace("#", "").replace("_", "")

        # 移除代码块
        lines = []
        in_code_block = False
        for line in text.split("\n"):
            if line.strip().startswith("```"):
                in_code_block = not in_code_block
                continue
            if not in_code_block:
                lines.append(line)

        text = "\n".join(lines)

        # 移除 URL
        import re
        text = re.sub(r"http[s]?://\S+", "", text)

        # 移除过多的空格和换行
        text = " ".join(text.split())

        return text.strip()

    def get_available_voices(self, language: str = DEFAULT_LANGUAGE) -> list:
        """获取指定语言的可用声音列表"""
        return LANGUAGE_VOICES.get(language, [])


# 全局单例实例
tts_service = EdgeTTSService()


def get_tts_service() -> EdgeTTSService:
    """获取 TTS 服务实例"""
    return tts_service

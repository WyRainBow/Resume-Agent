"""
TTS (Text-to-Speech) 服务
使用 Coqui TTS 进行文本转语音
"""

import io
import os
import tempfile
from pathlib import Path
from typing import Optional, Literal
import logging

from TTS.api import TTS
import torch
import numpy as np

logger = logging.getLogger(__name__)

# 支持的模型列表（使用自包含说话人的模型）
AVAILABLE_MODELS = {
    # 中文模型：Baker（TacoTron2）和 VITS，自包含说话人
    "zh-CN-baker": "tts_models/zh-CN/baker/tacotron2-DDC-GST",
    "zh-CN-vits": "tts_models/zh-CN/baker/vits",

    # 英文模型：LJSpeech，自包含说话人
    "en-US": "tts_models/en/ljspeech/vits",

    # 多语言模型：需要 speaker_wav（可选）
    # "zh-CN": "tts_models/multilingual/multi-dataset/xtts_v2",
}

# 默认模型：中文 Baker 模型（自包含说话人，不需要音频克隆）
DEFAULT_MODEL = "zh-CN-baker"

# 音频格式
AudioFormat = Literal["wav", "mp3"]


class TTSService:
    """TTS 服务类"""

    _instance: Optional["TTSService"] = None
    _model: Optional[TTS] = None
    _current_model_name: Optional[str] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if self._model is None:
            self._load_model()

    def _load_model(self, model_name: str = DEFAULT_MODEL):
        """加载 TTS 模型"""
        try:
            model_path = AVAILABLE_MODELS.get(model_name, DEFAULT_MODEL)

            # 检测 GPU 可用性
            device = "cuda" if torch.cuda.is_available() else "cpu"
            logger.info(f"Loading TTS model: {model_path} on {device}")

            # 加载模型：使用 model_name 按名称加载（会下载并解析 config），
            # model_path 用于本地路径且需同时提供 config_path
            self._model = TTS(model_name=model_path).to(device)
            self._current_model_name = model_name

            logger.info(f"TTS model loaded successfully on {device}")
        except Exception as e:
            logger.error(f"Failed to load TTS model: {e}")
            raise RuntimeError(f"TTS model loading failed: {e}")

    def synthesize(
        self,
        text: str,
        model_name: str = DEFAULT_MODEL,
        language: str = "zh-cn",
        speaker_wav: Optional[str] = None,
        format: AudioFormat = "wav",
    ) -> bytes:
        """
        将文本转换为语音

        Args:
            text: 要转换的文本
            model_name: 模型名称
            language: 语言代码 (zh-cn, en-us, etc.)
            speaker_wav: 说话人音频文件路径（用于声音克隆）
            format: 音频格式 (wav, mp3)

        Returns:
            音频数据的 bytes
        """
        try:
            # 如果需要切换模型
            if model_name != self._current_model_name:
                self._load_model(model_name)

            # 清理文本
            text = self._clean_text(text)
            if not text:
                raise ValueError("Text is empty after cleaning")

            logger.info(f"Synthesizing text: {text[:50]}...")

            # 生成音频到临时文件
            with tempfile.NamedTemporaryFile(suffix=f".{format}", delete=False) as temp_file:
                temp_path = temp_file.name

            try:
                # 使用 TTS 生成音频
                # 注意：Baker、LJSpeech 等模型自带说话人，不需要 speaker_wav
                # 只有使用需要声音克隆的模型（如 xtxs_v2）才需要 speaker_wav
                if speaker_wav:
                    # 声音克隆模式
                    self._model.tts_to_file(
                        text=text,
                        file_path=temp_path,
                        speaker_wav=speaker_wav,
                    )
                else:
                    # 使用模型自带的说话人
                    # VITS 模型会使用默认说话人
                    self._model.tts_to_file(
                        text=text,
                        file_path=temp_path,
                    )

                # 读取音频文件
                with open(temp_path, "rb") as f:
                    audio_bytes = f.read()

                logger.info(f"Audio generated successfully: {len(audio_bytes)} bytes")
                return audio_bytes

            finally:
                # 清理临时文件
                if os.path.exists(temp_path):
                    os.remove(temp_path)

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

    def get_supported_languages(self) -> list:
        """获取支持的语言列表"""
        return ["zh-cn", "en-us", "ja-jp", "ko-kr"]


# 全局单例实例
tts_service = TTSService()


def get_tts_service() -> TTSService:
    """获取 TTS 服务实例"""
    return tts_service

"""
TTS (Text-to-Speech) 路由
"""

import io
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backend.services.tts_service import get_tts_service
from backend.core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/api/tts", tags=["TTS"])


class TTSRequest(BaseModel):
    """TTS 请求模型"""

    text: str = Field(..., description="要转换的文本", min_length=1, max_length=5000)
    model_name: str = Field(default="zh-CN-baker", description="模型名称: zh-CN-baker(中文), en-US(英文)")
    language: str = Field(default="zh-cn", description="语言代码（可选，某些模型会自动识别）")
    format: str = Field(default="wav", description="音频格式: wav, mp3")
    speaker_wav_url: Optional[str] = Field(default=None, description="说话人音频URL（用于声音克隆，暂不支持）")


class TTSResponse(BaseModel):
    """TTS 响应模型"""

    success: bool
    message: str
    audio_format: str
    content_length: int


@router.post("/synthesize", response_model=TTSResponse)
async def synthesize_speech(request: TTSRequest):
    """
    将文本转换为语音

    Args:
        request: TTS 请求

    Returns:
        音频文件流
    """
    try:
        tts_service = get_tts_service()

        # 验证音频格式
        if request.format not in ["wav", "mp3"]:
            raise HTTPException(status_code=400, detail="Unsupported audio format. Use 'wav' or 'mp3'")

        # 生成音频
        audio_bytes = tts_service.synthesize(
            text=request.text,
            model_name=request.model_name,
            language=request.language,
            speaker_wav=None,  # 暂不支持声音克隆
            format=request.format,
        )

        # 确定媒体类型
        media_type = "audio/wav" if request.format == "wav" else "audio/mpeg"

        # 返回音频流
        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="speech.{request.format}"',
                "Content-Length": str(len(audio_bytes)),
                "Access-Control-Allow-Origin": "*",  # CORS
            },
        )

    except ValueError as e:
        logger.error(f"Validation error in TTS: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        logger.error(f"Runtime error in TTS: {e}")
        raise HTTPException(status_code=500, detail="Speech synthesis failed")
    except Exception as e:
        logger.error(f"Unexpected error in TTS: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/languages")
async def get_supported_languages():
    """获取支持的语言列表"""
    try:
        tts_service = get_tts_service()
        languages = tts_service.get_supported_languages()
        return {"success": True, "languages": languages}
    except Exception as e:
        logger.error(f"Error getting supported languages: {e}")
        raise HTTPException(status_code=500, detail="Failed to get supported languages")


@router.get("/health")
async def health_check():
    """健康检查"""
    try:
        tts_service = get_tts_service()
        return {
            "success": True,
            "status": "healthy",
            "model_loaded": tts_service._model is not None,
        }
    except Exception as e:
        logger.error(f"TTS health check failed: {e}")
        return {"success": False, "status": "unhealthy", "error": str(e)}

"""
TTS (Text-to-Speech) 路由
使用 Edge TTS（微软免费方案）
"""

import io
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backend.services.tts_service_edge import get_tts_service
from backend.core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/api/tts", tags=["TTS"])


class TTSRequest(BaseModel):
    """TTS 请求模型"""

    text: str = Field(..., description="要转换的文本", min_length=1, max_length=5000)
    voice: Optional[str] = Field(default="zh-CN-XiaoxiaoNeural", description="声音")
    rate: Optional[str] = Field(default="+0%", description="语速")
    volume: Optional[str] = Field(default="+0%", description="音量")
    format: str = Field(default="mp3", description="音频格式: mp3, wav")


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
        if request.format not in ["mp3", "wav"]:
            raise HTTPException(status_code=400, detail="Unsupported audio format. Use 'mp3' or 'wav'")

        # 生成音频
        audio_bytes = tts_service.synthesize(
            text=request.text,
            voice=request.voice or "zh-CN-XiaoxiaoNeural",
            rate=request.rate or "+0%",
            volume=request.volume or "+0%",
            format=request.format,
        )

        # 确定媒体类型
        media_type = "audio/mpeg" if request.format == "mp3" else "audio/wav"

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


@router.get("/voices")
async def get_available_voices(language: str = Query("zh-CN", description="语言代码")):
    """获取可用声音列表"""
    try:
        tts_service = get_tts_service()
        voices = tts_service.get_available_voices(language)
        return {"success": True, "language": language, "voices": voices}
    except Exception as e:
        logger.error(f"Error getting available voices: {e}")
        raise HTTPException(status_code=500, detail="Failed to get available voices")


@router.get("/health")
async def health_check():
    """健康检查"""
    try:
        tts_service = get_tts_service()
        return {
            "success": True,
            "status": "healthy",
            "service": "edge-tts",
        }
    except Exception as e:
        logger.error(f"TTS health check failed: {e}")
        return {"success": False, "status": "unhealthy", "error": str(e)}

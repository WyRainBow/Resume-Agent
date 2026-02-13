/**
 * TTS (Text-to-Speech) API 服务
 */

import { useRef, useCallback, useEffect } from 'react';

const TTS_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || ''
  ? (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || '').startsWith('http')
    ? (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || '')
    : `https://${import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || ''}`
  : import.meta.env.PROD
    ? ''
    : 'http://localhost:9000';

export interface TTSRequest {
  text: string;
  modelName?: string;
  language?: string;
  format?: 'wav' | 'mp3';
}

export interface TTSConfig {
  speed?: number;        // 播放速度 (0.5 - 2.0)
  pitch?: number;        // 音调 (0.5 - 2.0)
  volume?: number;       // 音量 (0.0 - 1.0)
  autoPlay?: boolean;    // 自动播放
}

/**
 * 合成语音
 */
export async function synthesizeSpeech(request: TTSRequest): Promise<Blob> {
  const response = await fetch(`${TTS_BASE_URL}/api/tts/synthesize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: request.text,
      model_name: request.modelName || 'zh-CN-baker',  // 使用自包含说话人的模型
      language: request.language || 'zh-cn',
      format: request.format || 'wav',
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || 'Speech synthesis failed');
  }

  const blob = await response.blob();
  return blob;
}

/**
 * 获取支持的语言列表
 */
export async function getSupportedLanguages(): Promise<string[]> {
  const response = await fetch(`${TTS_BASE_URL}/api/tts/languages`);

  if (!response.ok) {
    throw new Error('Failed to get supported languages');
  }

  const data = await response.json();
  return data.languages || [];
}

/**
 * TTS 健康检查
 */
export async function checkTTSHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${TTS_BASE_URL}/api/tts/health`);
    const data = await response.json();
    return data.success && data.status === 'healthy';
  } catch {
    return false;
  }
}

/**
 * TTS Player Hook
 */
interface UseTTSPlayerOptions extends TTSConfig {
  onPlayStart?: () => void;
  onPlayEnd?: () => void;
  onError?: (error: Error) => void;
}

export function useTTSPlayer(options: UseTTSPlayerOptions = {}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false);
  const isPausedRef = useRef(false);

  // 创建音频元素
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const audio = new Audio();
      audioRef.current = audio;

      // 设置事件监听
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('error', handleError);

      return () => {
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('error', handleError);
        audio.pause();
        audio.src = '';
      };
    }
  }, []);

  const handleEnded = useCallback(() => {
    isPlayingRef.current = false;
    isPausedRef.current = false;
    options.onPlayEnd?.();
  }, [options]);

  const handleError = useCallback((event: Event) => {
    const error = new Error('Audio playback error');
    isPlayingRef.current = false;
    isPausedRef.current = false;
    options.onError?.(error);
  }, [options]);

  /**
   * 播放文本
   */
  const play = useCallback(async (text: string, ttsConfig: TTSConfig = {}) => {
    try {
      if (isPlayingRef.current && audioRef.current) {
        // 如果正在播放，先停止
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      // 合成语音
      const blob = await synthesizeSpeech({
        text,
        modelName: 'zh-CN',
        language: 'zh-cn',
        format: 'wav',
      });

      // 创建音频 URL
      const audioUrl = URL.createObjectURL(blob);

      if (audioRef.current) {
        audioRef.current.src = audioUrl;

        // 设置播放参数
        audioRef.current.playbackRate = ttsConfig.speed || options.speed || 1.0;

        // 播放
        isPlayingRef.current = true;
        isPausedRef.current = false;
        options.onPlayStart?.();

        await audioRef.current.play();

        // 释放 URL 对象（延迟到播放结束）
        audioRef.current.addEventListener('ended', () => {
          URL.revokeObjectURL(audioUrl);
        }, { once: true });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to play speech');
      options.onError?.(err);
    }
  }, [options]);

  /**
   * 暂停
   */
  const pause = useCallback(() => {
    if (audioRef.current && isPlayingRef.current && !isPausedRef.current) {
      audioRef.current.pause();
      isPausedRef.current = true;
    }
  }, []);

  /**
   * 恢复播放
   */
  const resume = useCallback(() => {
    if (audioRef.current && isPausedRef.current) {
      audioRef.current.play();
      isPausedRef.current = false;
    }
  }, []);

  /**
   * 停止
   */
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      isPlayingRef.current = false;
      isPausedRef.current = false;
    }
  }, []);

  /**
   * 获取播放状态
   */
  const getState = useCallback(() => {
    return {
      isPlaying: isPlayingRef.current,
      isPaused: isPausedRef.current,
      currentTime: audioRef.current?.currentTime || 0,
      duration: audioRef.current?.duration || 0,
    };
  }, []);

  return {
    play,
    pause,
    resume,
    stop,
    getState,
  };
}

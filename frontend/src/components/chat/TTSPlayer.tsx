/**
 * TTS 播放器组件
 * 用于朗读 AI 回复内容
 */

import { useState, useCallback } from 'react';
import { Volume2, VolumeX, Play, Pause, StopCircle } from 'lucide-react';
import { useTTSPlayer } from '@/services/tts';

interface TTSPlayerProps {
  content: string;      // 要朗读的文本内容
  messageId?: string;    // 消息ID（用于区分不同消息）
  disabled?: boolean;    // 是否禁用
}

export default function TTSPlayer({ content, messageId, disabled = false }: TTSPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { play, pause, resume, stop } = useTTSPlayer({
    onPlayStart: () => {
      setIsPlaying(true);
      setIsPaused(false);
      setError(null);
    },
    onPlayEnd: () => {
      setIsPlaying(false);
      setIsPaused(false);
    },
    onError: (err) => {
      setError(err.message);
      setIsPlaying(false);
      setIsPaused(false);
    },
  });

  // 处理点击播放按钮
  const handlePlay = useCallback(async () => {
    if (!content || disabled) return;

    // 清理文本（移除 markdown 等）
    const cleanText = cleanContentForTTS(content);
    if (!cleanText) return;

    if (isPaused) {
      // 如果是暂停状态，恢复播放
      resume();
    } else {
      // 否则重新播放
      await play(cleanText);
    }
  }, [content, disabled, isPaused, play, resume]);

  // 处理暂停
  const handlePause = useCallback(() => {
    pause();
  }, [pause]);

  // 处理停止
  const handleStop = useCallback(() => {
    stop();
  }, [stop]);

  if (!content || disabled) {
    return null;
  }

  return (
    <div className="flex items-center gap-1">
      {error && (
        <div className="text-xs text-red-500 mr-2">
          朗读失败
        </div>
      )}

      {!isPlaying ? (
        // 未播放状态：显示播放按钮
        <button
          type="button"
          onClick={handlePlay}
          disabled={disabled}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="朗读"
          aria-label="朗读内容"
        >
          <Volume2 className="w-4 h-4" />
        </button>
      ) : (
        // 播放中状态：显示暂停/停止按钮
        <>
          {!isPaused ? (
            <button
              type="button"
              onClick={handlePause}
              className="p-1.5 rounded hover:bg-gray-100 text-indigo-600 hover:text-indigo-700 transition-colors"
              title="暂停"
              aria-label="暂停朗读"
            >
              <Pause className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePlay}
              className="p-1.5 rounded hover:bg-gray-100 text-indigo-600 hover:text-indigo-700 transition-colors"
              title="继续"
              aria-label="继续朗读"
            >
              <Play className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={handleStop}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            title="停止"
            aria-label="停止朗读"
          >
            <StopCircle className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
}

/**
 * 清理内容用于 TTS
 */
function cleanContentForTTS(content: string): string {
  let text = content;

  // 移除 markdown 语法
  text = text.replace(/[#*_`~]/g, '');

  // 移除代码块
  text = text.replace(/```[\s\S]*?```/g, '');

  // 移除链接
  text = text.replace(/https?:\/\/[^\s]+/g, '');

  // 移除过多的空格和换行
  text = text.replace(/\s+/g, ' ').trim();

  // 限制长度（TTS 可能有最大长度限制）
  const maxLength = 2000;
  if (text.length > maxLength) {
    text = text.substring(0, maxLength) + '...';
  }

  return text;
}

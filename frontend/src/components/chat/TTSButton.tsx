/**
 * TTS 按钮组件 - 简化版本
 * 可直接集成到消息的反馈按钮区域
 */

import { useState } from 'react';
import { Volume2, VolumeX, Loader2 } from 'lucide-react';
import { synthesizeSpeech } from '@/services/tts';

interface TTSButtonProps {
  text: string;
  disabled?: boolean;
  className?: string;
}

export default function TTSButton({ text, disabled = false, className = '' }: TTSButtonProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  const handleClick = async () => {
    if (isLoading || isPlaying) {
      // 如果正在播放或加载，则停止
      setIsPlaying(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(false);

    try {
      // 清理文本
      const cleanText = text
        .replace(/[#*_`~]/g, '')  // 移除 markdown 语法
        .replace(/```[\s\S]*?```/g, '')  // 移除代码块
        .replace(/https?:\/\/[^\s]+/g, '')  // 移除链接
        .replace(/\s+/g, ' ')  // 移除过多的空格
        .trim()
        .substring(0, 2000);  // 限制长度

      if (!cleanText) return;

      // 合成语音
      const audioBlob = await synthesizeSpeech({
        text: cleanText,
        modelName: 'zh-CN',
        language: 'zh-cn',
        format: 'wav',
      });

      // 播放音频
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        setError(true);
        setIsPlaying(false);
        setIsLoading(false);
        URL.revokeObjectURL(audioUrl);
      };

      setIsLoading(false);
      setIsPlaying(true);
      await audio.play();
    } catch (err) {
      console.error('TTS 播放失败:', err);
      setError(true);
      setIsLoading(false);
    }
  };

  // 如果文本为空或被禁用，不显示按钮
  if (!text || text.trim().length === 0 || disabled) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className={`p-1.5 rounded hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        error
          ? 'text-red-500 hover:text-red-600'
          : isPlaying
          ? 'text-indigo-600 hover:text-indigo-700'
          : 'text-gray-400 hover:text-gray-600'
      } ${className}`}
      title={error ? '朗读失败' : isPlaying ? '停止朗读' : '朗读'}
      aria-label={error ? '朗读失败' : isPlaying ? '停止朗读' : '朗读内容'}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : error ? (
        <VolumeX className="w-4 h-4" />
      ) : (
        <Volume2 className="w-4 h-4" />
      )}
    </button>
  );
}

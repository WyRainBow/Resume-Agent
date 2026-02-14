/**
 * 流式语音输入组件
 * 支持麦克风录音 + WebSocket 实时传输 + ASR 识别
 */

import { useState } from 'react';
import { Mic, MicOff, StopCircle } from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

interface VoiceInputProps {
  onTextChange: (text: string, isFinal: boolean) => void;
  disabled?: boolean;
  language?: string;
}

export default function VoiceInput({
  onTextChange,
  disabled = false,
  language = 'zh-CN',
}: VoiceInputProps) {
  const {
    isRecording,
    isSpeaking,
    isProcessing,
    startRecording,
    stopRecording,
  } = useSpeechRecognition({
    onTextChange,
    vad: true, // 启用 VAD（语音活动检测）
    language,
    minSpeechDuration: 500, // 最小 500ms 说话才算有效
    silenceThreshold: 0.02, // 静音阈值
  });

  return (
    <div className="flex items-center gap-2">
      {/* 录音按钮 */}
      {!isRecording && !isSpeaking ? (
        <button
          type="button"
          onClick={startRecording}
          disabled={disabled || isProcessing}
          className={`p-3 rounded-full transition-all ${
            disabled
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-50'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 active:scale-95'
          }`}
          title={
            isProcessing
              ? '处理中...'
              : '点击开始语音输入（类似微信语音）'
          }
        >
          {isRecording ? (
            <MicOff className="w-5 h-5" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </button>
      ) : (
        /* 停止按钮 */
        <button
          type="button"
          onClick={stopRecording}
          className="p-3 rounded-full bg-red-600 text-white hover:bg-red-700 hover:scale-105 active:scale-95 transition-all"
          title="停止录音"
        >
          <StopCircle className="w-5 h-5" />
        </button>
      )}

      {/* 状态指示器 */}
      {isRecording && (
        <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-lg">
          <div className="relative">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-indigo-900">
              正在录音...
            </span>
            <span className="text-xs text-indigo-600">
              请清晰说话
            </span>
          </div>
        </div>
      )}

      {isSpeaking && !isRecording && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg">
          <div className="relative">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-bounce" />
          <div className="absolute inset-0 rounded-full border-2 border-green-300 animate-ping" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-green-900">
              正在识别...
            </span>
            <span className="text-xs text-green-600">
              请稍候
            </span>
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
          <div className="relative">
            <div className="w-3 h-3 bg-gray-400 rounded-full animate-spin" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">
              处理中...
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

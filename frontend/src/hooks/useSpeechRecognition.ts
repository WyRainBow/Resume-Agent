/**
 * 流式语音输入组件（VAD + WebSocket + ASR）
 * 类似微信语音的体验
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { getApiBaseUrl } from '@/lib/runtimeEnv';

interface UseSpeechRecognitionOptions {
  onTextChange: (text: string, isFinal: boolean) => void;
  onSpeakingChange?: (isSpeaking: boolean) => void;
  vad?: boolean;         // 启用 VAD（语音活动检测）
  language?: string;
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions) {
  const {
    onTextChange,
    onSpeakingChange,
    vad = true,
  } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speechTimerRef = useRef<NodeJS.Timeout | null>(null);

  // VAD 参数
  const SILENCE_THRESHOLD = 0.02; // 静音阈值
  const MIN_SPEECH_DURATION = 500; // 最小 500ms 说话才算有效

  // 清理资源
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (websocketRef.current) {
        websocketRef.current.close();
      }
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
    };
  }, []);

  // 分析音频（VAD）
  const analyzeAudioLevel = useCallback((audioData: Float32Array) => {
    if (!vad) return true;
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    const rms = Math.sqrt(sum / audioData.length);
    return rms > SILENCE_THRESHOLD;
  }, [vad]);

  // 发送音频到 WebSocket
  const sendAudioToWebSocket = useCallback((audioBlob: Blob) => {
    const websocket = websocketRef.current;
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        websocket.send(reader.result);
      }
    };
    reader.readAsArrayBuffer(audioBlob);
  }, []);

  // 停止录音
  const stopRecording = useCallback(() => {
    setIsRecording(false);
    setIsSpeaking(false);
    setIsProcessing(false);
    onSpeakingChange?.(false);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (websocketRef.current) {
      websocketRef.current.close();
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
  }, [onSpeakingChange]);

  // 开始录音
  const startRecording = useCallback(async () => {
    try {
      setIsProcessing(true);
      setIsRecording(true);
      onSpeakingChange?.(true);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      const processor = audioContextRef.current.createScriptProcessor(analyser.fftSize, 1, 1);

      source.connect(analyser);
      analyser.connect(processor);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });
      mediaRecorderRef.current = mediaRecorder;

      let audioChunks: Blob[] = [];
      let isAboveThreshold = false;
      let silenceCount = 0;
      const SILENCE_COUNT_THRESHOLD = 5;
      let speechStartTime = 0;

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        const audioData = e.inputBuffer.getChannelData(0);
        const hasVoice = analyzeAudioLevel(audioData);

        if (hasVoice) {
          if (!isAboveThreshold) {
            isAboveThreshold = true;
            speechStartTime = Date.now();
            onSpeakingChange?.(true);
          }
          silenceCount = 0;
        } else if (isAboveThreshold) {
          silenceCount++;
          if (silenceCount >= SILENCE_COUNT_THRESHOLD) {
            const speechDuration = Date.now() - speechStartTime;
            if (speechDuration >= MIN_SPEECH_DURATION) {
              const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
              sendAudioToWebSocket(audioBlob);
              stopRecording();
            } else {
              stopRecording();
            }
          }
        }
      };

      mediaRecorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) {
          audioChunks.push(e.data);
        }
      };

      // 构建动态 WebSocket URL
      const apiBaseUrl = getApiBaseUrl();
      const wsUrl = apiBaseUrl.replace(/^http/, 'ws') + '/api/asr/ws/stream';
      const websocket = new WebSocket(wsUrl);
      websocketRef.current = websocket;

      websocket.onopen = () => {
        console.log('[Speech] WebSocket connected');
        setIsProcessing(false);
      };

      websocket.onmessage = (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        if (data.type === 'final') {
          onTextChange?.(data.text, true);
          setIsSpeaking(false);
          onSpeakingChange?.(false);
        } else if (data.type === 'interim') {
          onTextChange?.(data.text, false);
          setIsSpeaking(true);
        }
      };

      websocket.onerror = (error) => {
        console.error('[Speech] WebSocket error:', error);
        alert('语音服务连接失败，请检查网络或稍后重试');
        setIsProcessing(false);
        setIsRecording(false);
        onSpeakingChange?.(false);
      };

      websocket.onclose = (event) => {
        console.log('[Speech] WebSocket closed:', event.code, event.reason);
        if (event.code !== 1000) { // 1000 = 正常关闭
          console.warn('[Speech] Abnormal closure');
        }
      };

      mediaRecorder.start(250);
    } catch (error) {
      console.error('[Speech] Failed to start recording:', error);
      setIsProcessing(false);
      setIsRecording(false);
    }
  }, [analyzeAudioLevel, onSpeakingChange, onTextChange, sendAudioToWebSocket, stopRecording]);

  return {
    isRecording,
    isSpeaking,
    isProcessing,
    startRecording,
    stopRecording,
  };
}

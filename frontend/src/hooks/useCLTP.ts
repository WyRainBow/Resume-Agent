/**
 * useCLTP Hook
 *
 * 封装 CLTPSession 的使用，提供便捷的 React Hook 接口
 * 处理事件：span:start, span:end, message:partial, message:complete
 * 更新 React 状态
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { CLTPSessionImpl } from '@/cltp/core/CLTPSession';
import { SSETransportAdapter, createSSETransportAdapter } from '@/cltp/adapters/SSETransportAdapter';
import { SSETransport } from '@/transports/SSETransport';
import type { ContentMessage } from '@/cltp/types/messages';
import type { DefaultPayloads } from '@/cltp/types/channels';

/**
 * useCLTP Hook 的返回值
 */
export interface UseCLTPResult {
    /** 当前思考内容（think 频道） */
    currentThought: string;
    /** 当前答案内容（plain 频道） */
    currentAnswer: string;
    /** 是否正在处理 */
    isProcessing: boolean;
    /** 是否已连接 */
    isConnected: boolean;
    /** 答案完成信号（用于触发 finalize） */
    answerCompleteCount: number;
    /** 发送用户消息 */
    sendMessage: (message: string) => Promise<void>;
    /** 完成当前流式消息并清理状态 */
    finalizeStream: () => void;
    /** 断开连接 */
    disconnect: () => void;
}

/**
 * useCLTP Hook 的配置选项
 */
export interface UseCLTPOptions {
    /** 会话 ID */
    conversationId?: string;
    /** SSE 基础 URL */
    baseUrl?: string;
    /** 心跳超时时间（毫秒） */
    heartbeatTimeout?: number;
    /** 简历数据 */
    resumeData?: any;
}

/**
 * useCLTP Hook - 在 React 组件中使用 CLTP Session
 *
 * @param options - 配置选项
 * @returns CLTP 会话状态和控制函数
 */
export function useCLTP(options: UseCLTPOptions = {}): UseCLTPResult {
    const {
        conversationId = `conv-${Date.now()}`,
        baseUrl = 'http://localhost:9000',
        heartbeatTimeout = 60000,
        resumeData,
    } = options;

    const [currentThought, setCurrentThought] = useState('');
    const [currentAnswer, setCurrentAnswer] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [answerCompleteCount, setAnswerCompleteCount] = useState(0);

    const currentThoughtRef = useRef('');
    const currentAnswerRef = useRef('');

    const sessionRef = useRef<CLTPSessionImpl<DefaultPayloads> | null>(null);
    const sseTransportRef = useRef<SSETransport | null>(null);
    const adapterRef = useRef<SSETransportAdapter<DefaultPayloads> | null>(null);

    // Initialize CLTP Session
    useEffect(() => {
        // Reset state when conversationId changes to avoid leaking previous session state
        setCurrentThought('');
        setCurrentAnswer('');
        setIsProcessing(false);
        setIsConnected(false);
        setAnswerCompleteCount(0);
        currentThoughtRef.current = '';
        currentAnswerRef.current = '';

        // Create SSE transport
        const sseTransport = new SSETransport({
            baseUrl,
            heartbeatTimeout,
            onConnect: () => {
                console.log('[useCLTP] SSE Connected');
                setIsConnected(true);
            },
            onDisconnect: () => {
                console.log('[useCLTP] SSE Disconnected');
                setIsConnected(false);
                if (!currentThoughtRef.current && !currentAnswerRef.current) {
                    setIsProcessing(false);
                }
                console.log('[useCLTP] onDisconnect state', {
                    thoughtLength: currentThoughtRef.current.length,
                    answerLength: currentAnswerRef.current.length,
                });
            },
            onError: (error) => {
                console.error('[useCLTP] SSE Error:', error);
                setIsConnected(false);
                if (!currentThoughtRef.current && !currentAnswerRef.current) {
                    setIsProcessing(false);
                }
            },
        });

        // Ensure backend receives a stable conversation_id for multi-turn chat
        sseTransport.setConversationId(conversationId);
        sseTransportRef.current = sseTransport;

        // Create SSE transport adapter
        const adapter = createSSETransportAdapter(sseTransport);
        adapter.setResumeData(resumeData ?? null);
        adapterRef.current = adapter;

        // Create CLTP session
        const session = new CLTPSessionImpl<DefaultPayloads>({
            conversationId,
            transport: adapter,
        });

        sessionRef.current = session;

        // Initialize session
        session.initialize().catch((error) => {
            console.error('[useCLTP] Failed to initialize session:', error);
        });

        // Set up event listeners
        const unsubscribePartial = session.events.on('message:partial', (message: ContentMessage<DefaultPayloads>) => {
            // 关键：保持文本内容原样，直接用于更新状态
            const payload = message.metadata.payload;
            const text = typeof payload === 'string' ? payload : (payload as any).text || '';

            console.log('[useCLTP] message:partial received', {
                channel: message.metadata.channel,
                textLength: text.length,
                done: message.metadata.done,
            });

            if (message.metadata.channel === 'think') {
                // 思考过程：直接替换（避免重复）
                setCurrentThought(text);
            } else if (message.metadata.channel === 'plain') {
                // 答案：增量更新（流式传输）
                setCurrentAnswer(text);
            }
        });

        const unsubscribeComplete = session.events.on('message:complete', (message: ContentMessage<DefaultPayloads>) => {
            // 消息完成时的处理
            const payload = message.metadata.payload;
            const text = typeof payload === 'string' ? payload : (payload as any).text || '';

            console.log('[useCLTP] message:complete received', {
                channel: message.metadata.channel,
                textLength: text.length,
                done: message.metadata.done,
            });

            if (message.metadata.channel === 'think') {
                setCurrentThought(text);
            } else if (message.metadata.channel === 'plain') {
                setCurrentAnswer(text);
                setAnswerCompleteCount((count) => {
                    const next = count + 1;
                    console.log('[useCLTP] answerCompleteCount incremented', { from: count, to: next });
                    return next;
                });
            }
        });

        const unsubscribeSpanStart = session.events.on('span:start', () => {
            setIsProcessing(true);
        });

        const unsubscribeSpanEnd = session.events.on('span:end', () => {
            // Span 结束时，等待消息完成后再设置 isProcessing = false
            // 这里不立即设置，让 message:complete 事件处理
        });

        // Connect to transport
        session.connect().catch((error) => {
            console.error('[useCLTP] Failed to connect:', error);
        });

        // Cleanup
        return () => {
            unsubscribePartial();
            unsubscribeComplete();
            unsubscribeSpanStart();
            unsubscribeSpanEnd();
            session.close().catch((error) => {
                console.error('[useCLTP] Error closing session:', error);
            });
        };
    }, [conversationId, baseUrl, heartbeatTimeout]);

    // Update resume data without resetting the session
    useEffect(() => {
        if (!adapterRef.current) return;
        adapterRef.current.setResumeData(resumeData ?? null);
        console.log('[useCLTP] resumeData updated', {
            hasResumeData: !!resumeData,
        });
    }, [resumeData]);

    useEffect(() => {
        currentThoughtRef.current = currentThought;
    }, [currentThought]);

    useEffect(() => {
        currentAnswerRef.current = currentAnswer;
    }, [currentAnswer]);

    /**
     * Send user message
     */
    const sendMessage = useCallback(async (message: string) => {
        if (!sessionRef.current || !adapterRef.current) {
            console.error('[useCLTP] Session not initialized');
            return;
        }

        try {
            // Reset state for new message
            console.log('[useCLTP] sendMessage reset state');
            setCurrentThought('');
            setCurrentAnswer('');
            setIsProcessing(true);

            // Create user message
            const userMessage = {
                type: 'user' as const,
                id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp: new Date().toISOString(),
                parentCLSpanId: null,
                metadata: {
                    action: 'send',
                    payload: { text: message },
                },
            };

            // Send via adapter
            await adapterRef.current.sendUserMessage(userMessage);
        } catch (error) {
            console.error('[useCLTP] Failed to send message:', error);
            setIsProcessing(false);
        }
    }, []);

    /**
     * Finalize current stream (clear state and stop processing)
     */
    const finalizeStream = useCallback(() => {
        console.log('[useCLTP] finalizeStream called');
        setCurrentThought('');
        setCurrentAnswer('');
        setIsProcessing(false);
    }, []);

    /**
     * Disconnect
     */
    const disconnect = useCallback(() => {
        if (sessionRef.current) {
            sessionRef.current.close().catch((error) => {
                console.error('[useCLTP] Error disconnecting:', error);
            });
        }
        if (sseTransportRef.current) {
            sseTransportRef.current.disconnect();
        }
        setIsConnected(false);
        setIsProcessing(false);
    }, []);

    return {
        currentThought,
        currentAnswer,
        isProcessing,
        isConnected,
        answerCompleteCount,
        sendMessage,
        finalizeStream,
        disconnect,
    };
}

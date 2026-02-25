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
import { SSETransport, type SSEEvent } from '@/transports/SSETransport';
import { getApiBaseUrl, isAgentEnabled } from '@/lib/runtimeEnv';
import type { ContentMessage } from '@/cltp/types/messages';
import type { DefaultPayloads } from '@/cltp/types/channels';

const IS_DEV = import.meta.env.DEV;
const THINKING_PLACEHOLDER = '正在思考...';

function mergeThoughtText(prev: string, next: string): string {
    const a = (prev || '').trim();
    const b = (next || '').trim();
    if (!b) return a;
    if (!a || a === THINKING_PLACEHOLDER) return b;
    if (a === b) return a;
    // 流式覆盖（新值是旧值扩展）或回退（旧值更长）都以最新快照为准
    if (b.startsWith(a) || a.startsWith(b)) return b;
    // 不同阶段 thought（如“识别请求” -> “调用工具完成”）做串联保留
    return `${a}\n${b}`;
}

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
    /** 最近一次传输错误 */
    lastError: string | null;
    /** 答案完成信号（用于触发 finalize） */
    answerCompleteCount: number;
    /** 发送用户消息 */
    sendMessage: (message: string, resumeDataOverride?: any) => Promise<void>;
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
    /** 原始 SSE 事件回调 */
    onSSEEvent?: (event: SSEEvent) => void;
}

/**
 * useCLTP Hook - 在 React 组件中使用 CLTP Session
 *
 * @param options - 配置选项
 * @returns CLTP 会话状态和控制函数
 */
export function useCLTP(options: UseCLTPOptions = {}): UseCLTPResult {
    const agentEnabled = isAgentEnabled();
    const {
        conversationId = `conv-${Date.now()}`,
        baseUrl = getApiBaseUrl(),
        heartbeatTimeout = 60000,
        resumeData,
        onSSEEvent,
    } = options;

    const [currentThought, setCurrentThought] = useState('');
    const [currentAnswer, setCurrentAnswer] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [lastError, setLastError] = useState<string | null>(null);
    const [answerCompleteCount, setAnswerCompleteCount] = useState(0);

    const currentThoughtRef = useRef('');
    const currentAnswerRef = useRef('');
    const pendingThoughtRef = useRef('');
    const pendingAnswerRef = useRef('');
    const committedThoughtRef = useRef('');
    const committedAnswerRef = useRef('');
    const flushRafRef = useRef<number | null>(null);

    const sessionRef = useRef<CLTPSessionImpl<DefaultPayloads> | null>(null);
    const sseTransportRef = useRef<SSETransport | null>(null);
    const adapterRef = useRef<SSETransportAdapter<DefaultPayloads> | null>(null);
    const onSSEEventRef = useRef<typeof onSSEEvent>(onSSEEvent);
    const streamStartedAtRef = useRef(0);
    const firstChunkLoggedRef = useRef(false);
    const chunkWindowStartedAtRef = useRef(0);
    const chunkWindowCountRef = useRef(0);
    const hasRealThoughtRef = useRef(false);
    const hasCompletedCurrentRunRef = useRef(false);

    useEffect(() => {
        onSSEEventRef.current = onSSEEvent;
    }, [onSSEEvent]);

    // Initialize CLTP Session
    useEffect(() => {
        if (!agentEnabled) {
            setCurrentThought('');
            setCurrentAnswer('');
            setIsProcessing(false);
            setIsConnected(false);
            setLastError(null);
            return;
        }

        // Reset state when conversationId changes to avoid leaking previous session state
        setCurrentThought('');
        setCurrentAnswer('');
        setIsProcessing(false);
        setIsConnected(false);
        setLastError(null);
        setAnswerCompleteCount(0);
        currentThoughtRef.current = '';
        currentAnswerRef.current = '';
        pendingThoughtRef.current = '';
        pendingAnswerRef.current = '';
        committedThoughtRef.current = '';
        committedAnswerRef.current = '';
        streamStartedAtRef.current = 0;
        firstChunkLoggedRef.current = false;
        chunkWindowStartedAtRef.current = 0;
        chunkWindowCountRef.current = 0;
        hasRealThoughtRef.current = false;
        hasCompletedCurrentRunRef.current = false;
        if (flushRafRef.current !== null) {
            cancelAnimationFrame(flushRafRef.current);
            flushRafRef.current = null;
        }

        const flushPending = () => {
            flushRafRef.current = null;

            const nextThought = pendingThoughtRef.current;
            const nextAnswer = pendingAnswerRef.current;

            if (nextThought !== committedThoughtRef.current) {
                committedThoughtRef.current = nextThought;
                setCurrentThought(nextThought);
            }

            if (nextAnswer !== committedAnswerRef.current) {
                committedAnswerRef.current = nextAnswer;
                setCurrentAnswer(nextAnswer);
            }
        };

        const scheduleFlush = () => {
            if (flushRafRef.current !== null) {
                return;
            }
            flushRafRef.current = requestAnimationFrame(flushPending);
        };

        const flushNow = () => {
            if (flushRafRef.current !== null) {
                cancelAnimationFrame(flushRafRef.current);
                flushRafRef.current = null;
            }
            flushPending();
        };

        const recordChunkMetric = (channel: string) => {
            if (!IS_DEV) return;
            const now = performance.now();
            if (!firstChunkLoggedRef.current) {
                firstChunkLoggedRef.current = true;
                if (streamStartedAtRef.current > 0) {
                    console.debug('[StreamMetrics]', {
                        type: 'first_chunk',
                        channel,
                        latencyMs: Math.round(now - streamStartedAtRef.current),
                    });
                }
            }

            if (chunkWindowStartedAtRef.current === 0) {
                chunkWindowStartedAtRef.current = now;
            }

            chunkWindowCountRef.current += 1;
            const elapsed = now - chunkWindowStartedAtRef.current;
            if (elapsed >= 1000) {
                const cps = (chunkWindowCountRef.current * 1000) / elapsed;
                console.debug('[StreamMetrics]', {
                    type: 'chunk_rate',
                    chunksPerSecond: Number(cps.toFixed(2)),
                    chunksInWindow: chunkWindowCountRef.current,
                    windowMs: Math.round(elapsed),
                });
                chunkWindowStartedAtRef.current = now;
                chunkWindowCountRef.current = 0;
            }
        };

        // Create SSE transport
        const sseTransport = new SSETransport({
            baseUrl,
            heartbeatTimeout,
            // 对写操作流（/api/agent/stream）禁用自动重试，避免服务端重复执行工具调用。
            autoReconnect: false,
            onMessage: (event) => {
                onSSEEventRef.current?.(event);
            },
            onConnect: () => {
                setIsConnected(true);
                setLastError(null);
            },
            onDisconnect: () => {
                setIsConnected(false);
                // Keep processing state when stream already has content:
                // UI still needs a short window to finish typewriter + finalize message
                // before transient stream blocks are cleared.
                const hasBufferedContent =
                    Boolean((currentThoughtRef.current || pendingThoughtRef.current || '').trim()) ||
                    Boolean((currentAnswerRef.current || pendingAnswerRef.current || '').trim());
                if (!hasBufferedContent && !hasCompletedCurrentRunRef.current) {
                    setIsProcessing(false);
                }
            },
            onError: (error) => {
                console.error('[useCLTP] SSE Error:', error);
                setIsConnected(false);
                // Avoid stuck "processing" state on transport errors.
                setIsProcessing(false);
                setLastError(error?.message || 'SSE transport error');
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

            if (message.metadata.channel === 'think') {
                hasRealThoughtRef.current = true;
                const mergedThought = mergeThoughtText(pendingThoughtRef.current, text);
                pendingThoughtRef.current = mergedThought;
                currentThoughtRef.current = mergedThought;
                recordChunkMetric('think');
                scheduleFlush();
            } else if (message.metadata.channel === 'plain') {
                if (!hasRealThoughtRef.current && pendingThoughtRef.current === THINKING_PLACEHOLDER) {
                    pendingThoughtRef.current = '';
                    currentThoughtRef.current = '';
                }
                pendingAnswerRef.current = text;
                currentAnswerRef.current = text;
                recordChunkMetric('plain');
                scheduleFlush();
            }
        });

        const unsubscribeComplete = session.events.on('message:complete', (message: ContentMessage<DefaultPayloads>) => {
            // 消息完成时的处理
            const payload = message.metadata.payload;
            const text = typeof payload === 'string' ? payload : (payload as any).text || '';

            if (message.metadata.channel === 'think') {
                hasRealThoughtRef.current = true;
                const mergedThought = mergeThoughtText(pendingThoughtRef.current, text);
                pendingThoughtRef.current = mergedThought;
                currentThoughtRef.current = mergedThought;
                recordChunkMetric('think');
                flushNow();
            } else if (message.metadata.channel === 'plain') {
                if (!hasRealThoughtRef.current && pendingThoughtRef.current === THINKING_PLACEHOLDER) {
                    pendingThoughtRef.current = '';
                    currentThoughtRef.current = '';
                }
                pendingAnswerRef.current = text;
                currentAnswerRef.current = text;
                recordChunkMetric('plain');
                flushNow();
                hasCompletedCurrentRunRef.current = true;
                setAnswerCompleteCount((count) => {
                    return count + 1;
                });
            }
        });

        const unsubscribeSpanStart = session.events.on('span:start', () => {
            setIsProcessing(true);
            hasCompletedCurrentRunRef.current = false;
        });

        const unsubscribeSpanEnd = session.events.on('span:end', () => {
            // 某些后端路径可能没有发送 plain channel 的 done chunk（is_complete=true），
            // 导致 message:complete 不触发。这里在 run 结束时兜底补一次 complete 信号。
            if (hasCompletedCurrentRunRef.current) {
                return;
            }
            const thought = (currentThoughtRef.current || pendingThoughtRef.current || '').trim();
            const answer = (currentAnswerRef.current || pendingAnswerRef.current || '').trim();
            if (!thought && !answer) {
                return;
            }
            hasCompletedCurrentRunRef.current = true;
            flushNow();
            setAnswerCompleteCount((count) => count + 1);
        });

        // Connect to transport
        session.connect().catch((error) => {
            console.error('[useCLTP] Failed to connect:', error);
        });

        // Cleanup
        return () => {
            if (flushRafRef.current !== null) {
                cancelAnimationFrame(flushRafRef.current);
                flushRafRef.current = null;
            }
            unsubscribePartial();
            unsubscribeComplete();
            unsubscribeSpanStart();
            unsubscribeSpanEnd();
            session.close().catch((error) => {
                console.error('[useCLTP] Error closing session:', error);
            });
        };
    }, [agentEnabled, conversationId, baseUrl, heartbeatTimeout]);

    // Update resume data without resetting the session
    useEffect(() => {
        if (!adapterRef.current) return;
        adapterRef.current.setResumeData(resumeData ?? null);
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
    const sendMessage = useCallback(async (message: string, resumeDataOverride?: any) => {
        if (!agentEnabled) {
            setLastError('Agent is disabled by VITE_AGENT_ENABLED');
            return;
        }
        if (!sessionRef.current || !adapterRef.current) {
            console.error('[useCLTP] Session not initialized');
            return;
        }

        try {
            // 允许调用方在本次发送前显式注入最新 resume_data，避免 setState 异步导致的竞态
            if (resumeDataOverride !== undefined) {
                adapterRef.current.setResumeData(resumeDataOverride ?? null);
            }
            // Reset state for new message
            setCurrentThought('');
            setCurrentAnswer('');
            setIsProcessing(true);
            setLastError(null);
            pendingThoughtRef.current = '';
            pendingAnswerRef.current = '';
            committedThoughtRef.current = '';
            committedAnswerRef.current = '';
            currentThoughtRef.current = '';
            currentAnswerRef.current = '';
            streamStartedAtRef.current = performance.now();
            firstChunkLoggedRef.current = false;
            chunkWindowStartedAtRef.current = 0;
            chunkWindowCountRef.current = 0;
            hasRealThoughtRef.current = false;
            pendingThoughtRef.current = THINKING_PLACEHOLDER;
            currentThoughtRef.current = THINKING_PLACEHOLDER;
            committedThoughtRef.current = THINKING_PLACEHOLDER;
            setCurrentThought(THINKING_PLACEHOLDER);

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
    }, [agentEnabled]);

    /**
     * Finalize current stream (clear state and stop processing)
     */
    const finalizeStream = useCallback(() => {
        setCurrentThought('');
        setCurrentAnswer('');
        setIsProcessing(false);
        pendingThoughtRef.current = '';
        pendingAnswerRef.current = '';
        committedThoughtRef.current = '';
        committedAnswerRef.current = '';
        currentThoughtRef.current = '';
        currentAnswerRef.current = '';
        hasRealThoughtRef.current = false;
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
        lastError,
        answerCompleteCount,
        sendMessage,
        finalizeStream,
        disconnect,
    };
}

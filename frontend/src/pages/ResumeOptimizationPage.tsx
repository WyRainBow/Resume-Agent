/**
 * 简历优化页面
 *
 * 左侧：对话区域
 * 右侧：简历预览
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Sparkles } from 'lucide-react';
import { DiagnosisReportCard } from '@/components/DiagnosisReportCard';
import { GuidanceChoicesCard } from '@/components/GuidanceChoicesCard';

interface Message {
  type: 'text' | 'diagnosis_report' | 'guidance_choices' | 'followup' | 'error' | 'update_success';
  content?: string;
  role: 'user' | 'assistant';
  choices?: any[];
  [key: string]: any;
}

export function ResumeOptimizationPage() {
  const { resumeId } = useParams<{ resumeId: string }>();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentModule, setCurrentModule] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 页面加载时自动触发诊断
  useEffect(() => {
    handleDiagnose();
  }, [resumeId]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleDiagnose = async () => {
    setIsProcessing(true);

    try {
      const response = await fetch('/api/resume-optimization/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume_id: resumeId })
      });

      if (!response.ok) {
        throw new Error('诊断失败');
      }

      const data = await response.json();

      // 添加消息
      setMessages([
        {
          type: 'text',
          content: '收到！让我先看看您的简历。',
          role: 'assistant'
        },
        {
          type: 'diagnosis_report',
          ...data.report,
          message: data.message,
          role: 'assistant'
        },
        {
          type: 'guidance_choices',
          choices: data.choices,
          message: '您想从哪个方面开始优化？',
          role: 'assistant'
        }
      ]);

    } catch (error) {
      console.error('诊断失败:', error);
      setMessages([
        {
          type: 'error',
          content: '抱歉，诊断失败了。请稍后再试。',
          role: 'assistant'
        }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendMessage = async (message: string) => {
    // 添加用户消息
    setMessages(prev => [...prev, {
      type: 'text',
      content: message,
      role: 'user'
    }]);

    setIsProcessing(true);

    try {
      const response = await fetch('/api/resume-optimization/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume_id: resumeId,
          message: message,
          session_id: `session_${resumeId}_${Date.now()}`,
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error('发送消息失败');
      }

      // 处理流式响应
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('无法读取响应');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(5));

              // 添加 AI 消息
              setMessages(prev => {
                const lastMessage = prev[prev.length - 1];

                // 如果是新的消息类型，创建新消息
                if (lastMessage?.role !== 'assistant' || lastMessage?.type !== data.type) {
                  return [...prev, {
                    type: data.type,
                    content: data.content,
                    role: 'assistant',
                    ...data
                  }];
                }

                // 否则更新最后一条消息
                return prev.map((msg, index) =>
                  index === prev.length - 1 ? { ...msg, ...data } : msg
                );
              });

              // 更新当前模块
              if (data.path) {
                const module = extractModuleFromPath(data.path);
                setCurrentModule(module);
              }

            } catch (e) {
              console.error('解析消息失败:', e);
            }
          }
        }
      }

    } catch (error) {
      console.error('发送消息失败:', error);
      setMessages(prev => [...prev, {
        type: 'error',
        content: '抱歉，出错了。请稍后再试。',
        role: 'assistant'
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleChoiceClick = (choice: any) => {
    // 用户点击了引导选项
    handleSendMessage(choice.text);
  };

  const extractModuleFromPath = (path: string): string | null => {
    if (path.includes('summary')) return 'summary';
    if (path.includes('experience')) return 'experience';
    if (path.includes('projects')) return 'projects';
    if (path.includes('education')) return 'education';
    if (path.includes('skills')) return 'skills';
    return null;
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 主内容区域 */}
      <div className="flex flex-col w-full">
        {/* 顶部导航栏 */}
        <div className="h-14 bg-white border-b flex items-center px-4">
          <button
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            onClick={() => navigate(-1)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            返回
          </button>
          <h1 className="ml-4 text-lg font-semibold flex items-center">
            <Sparkles className="h-5 w-5 mr-2 text-purple-600" />
            优化简历
          </h1>
        </div>

        {/* 左右分栏 */}
        <div className="flex flex-1 overflow-hidden">
          {/* 左侧：对话区域 */}
          <div className="w-full md:w-1/2 border-r bg-white overflow-y-auto">
            <div className="p-4 space-y-4">
              {messages.map((message, index) => (
                <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}>
                    {message.type === 'diagnosis_report' && (
                      <DiagnosisReportCard data={message} />
                    )}
                    {message.type === 'guidance_choices' && (
                      <GuidanceChoicesCard
                        choices={message.choices || []}
                        onChoiceClick={handleChoiceClick}
                      />
                    )}
                    {message.type === 'text' && message.content && (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* 输入框 */}
            <div className="border-t p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="告诉我您想优化哪个模块..."
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      const target = e.target as HTMLInputElement;
                      if (target.value.trim()) {
                        handleSendMessage(target.value);
                        target.value = '';
                      }
                    }
                  }}
                  disabled={isProcessing}
                />
                <button
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                  onClick={() => {
                    const input = document.querySelector('input') as HTMLInputElement;
                    if (input?.value.trim()) {
                      handleSendMessage(input.value);
                      input.value = '';
                    }
                  }}
                  disabled={isProcessing}
                >
                  发送
                </button>
              </div>
            </div>
          </div>

          {/* 右侧：简历预览（移动端隐藏） */}
          <div className="hidden md:block w-1/2 bg-gray-100 overflow-auto p-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">简历预览</h2>
              <p className="text-gray-600">简历ID: {resumeId}</p>
              {currentModule && (
                <div className="mt-4 p-3 bg-purple-50 rounded-lg">
                  <p className="text-sm text-purple-800">
                    正在优化模块: <span className="font-semibold">{currentModule}</span>
                  </p>
                </div>
              )}
              {/* TODO: 集成实际的简历预览组件 */}
              <div className="mt-6 text-gray-400 text-center">
                简历预览功能开发中...
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

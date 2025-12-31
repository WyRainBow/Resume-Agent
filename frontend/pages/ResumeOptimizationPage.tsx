/**
 * 简历优化页面
 *
 * 左侧：对话区域
 * 右侧：简历预览
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatPanel } from '@/components/ChatPanel';
import { ResumePreview } from '@/components/ResumePreview';
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
  const [resumeData, setResumeData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentModule, setCurrentModule] = useState<string | null>(null);
  const [sessionId] = useState<string>(`session_${resumeId}_${Date.now()}`);

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
          session_id: sessionId,
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

              // 如果更新成功，重新加载简历数据
              if (data.type === 'update_success') {
                await loadResumeData();
              }

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

  const loadResumeData = async () => {
    try {
      const response = await fetch(`/api/resume/${resumeId}`);
      if (response.ok) {
        const data = await response.json();
        setResumeData(data.resume);
      }
    } catch (error) {
      console.error('加载简历数据失败:', error);
    }
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
      <div className="flex flex-1">
        {/* 顶部导航栏 */}
        <div className="h-14 bg-white border-b flex items-center px-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            返回
          </Button>
          <h1 className="ml-4 text-lg font-semibold flex items-center">
            <Sparkles className="h-5 w-5 mr-2 text-purple-600" />
            优化简历
          </h1>
        </div>

        {/* 左右分栏 */}
        <div className="flex h-[calc(100vh-3.5rem)]">
          {/* 左侧：对话区域 (40%) */}
          <div className="w-2/5 border-r bg-white">
            <ChatPanel
              messages={messages}
              onSendMessage={handleSendMessage}
              isProcessing={isProcessing}
              renderMessage={(message: Message) => {
                if (message.type === 'diagnosis_report') {
                  return <DiagnosisReportCard data={message} />;
                }
                if (message.type === 'guidance_choices') {
                  return (
                    <GuidanceChoicesCard
                      choices={message.choices || []}
                      onChoiceClick={handleChoiceClick}
                    />
                  );
                }
                return null;
              }}
            />
          </div>

          {/* 右侧：简历预览 (60%) */}
          <div className="w-3/5 bg-gray-100 overflow-auto">
            <ResumePreview
              resumeData={resumeData}
              highlightModule={currentModule}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

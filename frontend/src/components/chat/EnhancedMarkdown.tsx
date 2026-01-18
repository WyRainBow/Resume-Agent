/**
 * EnhancedMarkdown 组件 - 增强的 Markdown 渲染
 *
 * 复刻自 sophia-pro 项目的 Markdown 渲染功能，支持：
 * - 代码高亮
 * - 表格
 * - 链接
 * - 列表
 * - 引用
 */

import { Check, Copy } from 'lucide-react';
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import MermaidBlock from './MermaidBlock';

/**
 * 自定义代码渲染器类型
 */
export type CustomCodeRenderer = (code: string) => React.ReactNode;

/**
 * CodeBlock 组件 - 优化的代码块显示组件
 *
 * 特性：
 * - 现代卡片样式（参考 ChatGPT/Sophia-Pro/Claude）
 * - 右上角复制按钮（绝对定位）
 * - 语言标识在左上角
 * - 复制图标和状态反馈
 */
interface CodeBlockProps {
  code: string;
  language: string;
}

function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (typeof navigator === 'undefined') return;
    if (!navigator.clipboard?.writeText) return;

    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  return (
    <div className="not-prose relative mb-4 group">
      {/* 代码块容器 - 现代卡片样式（参考 ChatGPT/Sophia-Pro/Claude） */}
      <div className="relative overflow-hidden rounded-lg border border-gray-300 bg-[#0d1117] shadow-sm">
        {/* 语言标识 - 左上角 */}
        <div className="absolute top-0 left-0 z-10 px-3 py-2">
          <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
            {language}
          </span>
        </div>

        {/* 复制按钮 - 右上角（参考 ChatGPT 样式） */}
        <button
          type="button"
          onClick={handleCopy}
          className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2.5 py-1.5
                     text-[11px] font-medium text-gray-300
                     bg-gray-800
                     border border-gray-600
                     rounded-md
                     hover:bg-gray-700
                     hover:text-gray-100
                     hover:border-gray-500
                     transition-all duration-200"
          title="复制代码"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-400" />
              <span className="text-green-400">已复制</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>复制</span>
            </>
          )}
        </button>

        {/* 代码内容区域 */}
        <div className="pt-8 pb-4">
          <SyntaxHighlighter
            language={language}
            style={vscDarkPlus}
            PreTag="div"
            customStyle={{
              margin: 0,
              padding: '0 1rem',
              backgroundColor: 'transparent',
              fontSize: '13px',
              lineHeight: '1.6',
            }}
            codeTagProps={{
              style: {
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
              },
            }}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      </div>
    </div>
  );
}

/**
 * EnhancedMarkdown 组件的 Props
 */
export interface EnhancedMarkdownProps {
  /** Markdown 文本内容 */
  children: string;
  /** CSS 类名 */
  className?: string;
  /** 自定义代码渲染器 */
  customCodeRenderers?: Record<string, CustomCodeRenderer>;
}

/**
 * EnhancedMarkdown 组件 - 增强的 Markdown 渲染组件
 *
 * 支持代码高亮、表格、链接、列表、引用、Mermaid 图表等 Markdown 功能
 *
 * @param props - 组件属性
 * @returns React 组件
 *
 * @example
 * ```tsx
 * <EnhancedMarkdown>
 *   # Hello World
 *   ```python
 *   print("Hello")
 *   ```
 *   ```mermaid
 *   graph TD; A-->B
 *   ```
 * </EnhancedMarkdown>
 * ```
 */
export default function EnhancedMarkdown({
  children,
  className = '',
  customCodeRenderers = {},
}: EnhancedMarkdownProps) {
  return (
    <div className={className}>
      <div
        className="prose max-w-none
          prose-headings:text-gray-900 prose-headings:font-bold prose-headings:mt-3 prose-headings:mb-2
          prose-h1:text-base prose-h2:text-sm prose-h3:text-xs
          prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-2 prose-p:text-sm
          prose-strong:text-gray-900 prose-strong:font-semibold
          prose-ul:list-disc prose-ul:ml-3 prose-ul:mb-2 prose-ul:text-sm prose-ul:space-y-0.5
          prose-ol:list-decimal prose-ol:ml-3 prose-ol:mb-2 prose-ol:text-sm prose-ol:space-y-0.5
          prose-li:text-gray-700 prose-li:mb-1
          prose-code:text-sm prose-code:bg-gray-200 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
          prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-3 prose-blockquote:italic prose-blockquote:text-sm
          prose-a:text-indigo-600 prose-a:underline hover:prose-a:text-indigo-800
          prose-table:border-collapse prose-table:border prose-table:border-gray-300
          prose-th:border prose-th:border-gray-300 prose-th:px-2 prose-th:py-1 prose-th:bg-gray-100
          prose-td:border prose-td:border-gray-300 prose-td:px-2 prose-td:py-1"
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks]}
          components={{
          // 自定义段落样式
          p: ({ node, children, ...props }: any) => {
            const text = String(children);
            // 处理特殊占位符
            if (text.includes('summary') || text.includes('keywords') || text.match(/^[a-z_]+$/)) {
              return (
                <div className="bg-gray-100 border border-gray-300 rounded px-3 py-2 my-2 inline-block">
                  <code className="text-gray-600 text-sm">{text}</code>
                </div>
              );
            }
            return <p {...props}>{children}</p>;
          },
          // 代码块样式（支持语法高亮、Mermaid、自定义渲染器）
          pre: ({ children, ...props }: any) => {
            const codeElement = React.Children.toArray(children)[0] as any;
            if (codeElement?.type === 'code') {
              const { className, children: codeChildren } = codeElement.props;
              const match = /language-(\w+)/.exec(className || '');
              const language = match ? match[1] : 'text';
              const code = String(codeChildren).replace(/\n$/, '');

              // Mermaid 图表支持
              if (language === 'mermaid') {
                return <MermaidBlock code={code} className="mb-4" />;
              }

              // 自定义代码渲染器
              if (language === 'component' && customCodeRenderers[language]) {
                return <>{customCodeRenderers[language](code)}</>;
              }

              // 其他自定义渲染器
              if (customCodeRenderers[language]) {
                return <>{customCodeRenderers[language](code)}</>;
              }

              // 默认代码高亮 - 使用 CodeBlock 组件
              return <CodeBlock code={code} language={language} />;
            }
            return <pre {...props}>{children}</pre>;
          },
          // 代码样式（内联和块级）
          code: ({ node, inline, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            const isBlock = !inline && match;

            // 块级代码（有语言标识）- 使用 CodeBlock 组件
            if (isBlock) {
              const language = match[1];
              const code = String(children).replace(/\n$/, '');

              // Mermaid 图表支持
              if (language === 'mermaid') {
                return <MermaidBlock code={code} className="mb-4" />;
              }

              return <CodeBlock code={code} language={language} />;
            }

            // 内联代码
            return (
              <code className="bg-gray-200 rounded-sm px-1 font-mono text-sm" {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
      </div>
    </div>
  );
}


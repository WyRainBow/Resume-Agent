/**
 * MermaidBlock 组件 - Mermaid 图表渲染
 *
 * 支持 Mermaid 图表的渲染，包括流程图、序列图等
 */

import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

export interface MermaidBlockProps {
  /** Mermaid 代码 */
  code: string;
  /** CSS 类名 */
  className?: string;
}

/**
 * MermaidBlock 组件 - Mermaid 图表渲染组件
 *
 * @param props - 组件属性
 * @returns React 组件
 *
 * @example
 * ```tsx
 * <MermaidBlock code="graph TD; A-->B" />
 * ```
 */
export default function MermaidBlock({ code, className = '' }: MermaidBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!containerRef.current || !code.trim()) {
        return;
      }

      try {
        setError(null);

        // 初始化 mermaid
        mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'strict',
          fontFamily: 'sans-serif',
        });

        // 生成唯一 ID
        const id = `mermaid-${Math.random().toString(36).substring(2, 11)}`;

        // 渲染 mermaid 图表
        const { svg: renderedSvg } = await mermaid.render(id, code);
        setSvg(renderedSvg);
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
      }
    };

    renderDiagram();
  }, [code]);

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <p className="text-red-600 text-sm">Mermaid 渲染错误: {error}</p>
        <pre className="mt-2 text-xs text-red-500 overflow-x-auto">
          {code}
        </pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className={`bg-gray-50 border border-gray-200 rounded-lg p-4 ${className}`}>
        <p className="text-gray-500 text-sm">正在渲染图表...</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`mermaid-container ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}




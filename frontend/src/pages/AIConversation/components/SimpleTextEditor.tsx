import React, { useState, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import { 
  Undo2, 
  Redo2, 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  AlignLeft, 
  AlignCenter, 
  Link as LinkIcon,
  Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'
import './editor.css'

interface SimpleTextEditorProps {
  content: string
  onChange: (content: string) => void
  onAIWrite?: () => void
  placeholder?: string
}

const ToolbarButton = ({ 
  onClick, 
  isActive = false, 
  children,
  title
}: { 
  onClick: () => void; 
  isActive?: boolean; 
  children: React.ReactNode;
  title?: string
}) => (
  <button
    type="button"
    onClick={(e) => {
      e.preventDefault()
      e.stopPropagation()
      onClick()
    }}
    title={title}
    className={cn(
      "p-1.5 rounded-md transition-colors",
      isActive 
        ? "bg-gray-100 text-blue-600" 
        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
    )}
  >
    {children}
  </button>
)

export const SimpleTextEditor: React.FC<SimpleTextEditorProps> = ({
  content,
  onChange,
  onAIWrite,
  placeholder = "请输入内容..."
}) => {
  const [isEmpty, setIsEmpty] = useState(!content || content === '<p></p>')

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      onChange(html)
      setIsEmpty(html === '<p></p>' || html === '')
    },
  })

  // 当外部 content 变化时，更新编辑器
  useEffect(() => {
    if (editor && content && content !== editor.getHTML()) {
      editor.commands.setContent(content)
      setIsEmpty(content === '<p></p>' || content === '')
    }
  }, [content, editor])

  if (!editor) return null

  return (
    <div className="w-full border border-gray-200 rounded-xl bg-white overflow-hidden focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50/30">
        <div className="flex items-center gap-1">
          <ToolbarButton 
            onClick={() => editor.chain().focus().undo().run()}
            title="撤销"
          >
            <Undo2 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton 
            onClick={() => editor.chain().focus().redo().run()}
            title="重做"
          >
            <Redo2 className="w-4 h-4" />
          </ToolbarButton>
          
          <div className="w-px h-4 bg-gray-200 mx-1" />
          
          <ToolbarButton 
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            title="加粗"
          >
            <Bold className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton 
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            title="斜体"
          >
            <Italic className="w-4 h-4" />
          </ToolbarButton>
          
          <div className="w-px h-4 bg-gray-200 mx-1" />
          
          <ToolbarButton 
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive('bulletList')}
            title="无序列表"
          >
            <List className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton 
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive('orderedList')}
            title="有序列表"
          >
            <ListOrdered className="w-4 h-4" />
          </ToolbarButton>
          
          <div className="w-px h-4 bg-gray-200 mx-1" />
          
          <ToolbarButton 
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            isActive={editor.isActive({ textAlign: 'left' })}
            title="左对齐"
          >
            <AlignLeft className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton 
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            isActive={editor.isActive({ textAlign: 'center' })}
            title="居中对齐"
          >
            <AlignCenter className="w-4 h-4" />
          </ToolbarButton>
          
          <div className="w-px h-4 bg-gray-200 mx-1" />
          
          <ToolbarButton 
            onClick={() => {
              const url = window.prompt('请输入链接地址')
              if (url) {
                editor.chain().focus().setLink({ href: url }).run()
              }
            }}
            isActive={editor.isActive('link')}
            title="插入链接"
          >
            <LinkIcon className="w-4 h-4" />
          </ToolbarButton>
        </div>

        {onAIWrite && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onAIWrite()
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-50 text-purple-600 hover:bg-purple-100 transition-all border border-purple-100"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-xs font-bold">AI 帮写</span>
          </button>
        )}
      </div>

      {/* 编辑区域 */}
      <div className="relative p-4 min-h-[150px]">
        {isEmpty && (
          <div className="absolute top-4 left-4 right-4 text-sm text-slate-400 pointer-events-none whitespace-pre-line">
            {placeholder}
          </div>
        )}
        <div onClick={() => editor.chain().focus().run()}>
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}


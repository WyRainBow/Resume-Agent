/**
 * 富文本编辑器组件
 * 基于 TipTap，支持加粗、斜体、下划线、列表等格式
 * 输出 HTML 格式，后端转换为 LaTeX
 */
import React, { useEffect, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import Underline from '@tiptap/extension-underline'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import BulletList from '@tiptap/extension-bullet-list'
import OrderedList from '@tiptap/extension-ordered-list'
import ListItem from '@tiptap/extension-list-item'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Undo,
  Redo,
  Wand2,
  IndentIncrease,
  IndentDecrease,
  Layout,
} from 'lucide-react'
import { cn } from '../../../../../lib/utils'
import { BetterSpace } from './BetterSpace'
import AIPolishDialog from '../AIPolishDialog'
import FormatLayoutDialog from '../FormatLayoutDialog'
import type { ResumeData } from '../../types'
import './tiptap.css'

interface RichEditorProps {
  content?: string
  onChange: (content: string) => void
  placeholder?: string
  onPolish?: () => void  // AI 润色回调（已废弃，使用内置润色）
  resumeData?: ResumeData  // 简历数据，用于 AI 润色
  polishPath?: string  // JSON 路径，例如 "skillContent" 或 "projects.0.description"
}

/**
 * 工具栏按钮
 */
interface MenuButtonProps {
  onClick: () => void
  isActive?: boolean
  disabled?: boolean
  children: React.ReactNode
  tooltip?: string
}

const MenuButton = ({
  onClick,
  isActive = false,
  disabled = false,
  children,
  tooltip,
}: MenuButtonProps) => {
  const [showTooltip, setShowTooltip] = React.useState(false)

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onClick()
  }

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleClick}
        disabled={disabled}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={cn(
          'h-9 w-9 rounded-md transition-all duration-200 hover:scale-105 p-0 flex items-center justify-center',
          isActive
            ? 'bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700'
            : 'hover:bg-gray-100 dark:hover:bg-neutral-800',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {children}
      </button>
      {tooltip && showTooltip && (
        <div
          className={cn(
            'absolute -bottom-8 left-1/2 transform -translate-x-1/2',
            'px-2 py-1 text-xs rounded-md whitespace-nowrap z-50',
            'bg-gray-800 text-white dark:bg-neutral-700'
          )}
        >
          {tooltip}
        </div>
      )}
    </div>
  )
}

const RichEditor = ({
  content = '',
  onChange,
  onPolish,
  resumeData,
  polishPath = 'skillContent',
}: RichEditorProps) => {
  const [showPolishDialog, setShowPolishDialog] = useState(false)
  const [showFormatDialog, setShowFormatDialog] = useState(false)

  const handlePolish = () => {
    if (resumeData) {
      setShowPolishDialog(true)
    } else if (onPolish) {
      // 兼容旧的 onPolish 回调
      onPolish()
    }
  }

  const handleApplyPolish = (polishedContent: string) => {
    onChange(polishedContent)
  }

  const handleFormat = () => {
    setShowFormatDialog(true)
  }

  const handleApplyFormat = (formattedContent: string) => {
    onChange(formattedContent)
  }
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: false,
        orderedList: false,
        listItem: false,
        heading: {
          levels: [1, 2, 3],
        },
      }),
      BulletList.configure({
        HTMLAttributes: {
          class: 'custom-list',
        },
      }),
      OrderedList.configure({
        HTMLAttributes: {
          class: 'custom-list-ordered',
        },
      }),
      ListItem,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
      }),
      TextStyle,
      Underline,
      Color,
      Highlight.configure({ multicolor: true }),
      BetterSpace,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm sm:prose lg:prose-lg max-w-none focus:outline-none min-h-[150px] px-4 py-3',
          'dark:prose-invert',
          'dark:prose-headings:text-neutral-200',
          'dark:prose-p:text-neutral-300',
          'dark:prose-strong:text-neutral-200',
          'dark:prose-em:text-neutral-200',
          'dark:prose-blockquote:text-neutral-300',
          'dark:prose-blockquote:border-neutral-700',
          'dark:prose-ul:text-neutral-300',
          'dark:prose-ol:text-neutral-300'
        ),
      },
    },
    immediatelyRender: false,
  })

  // 内容变化时更新编辑器
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  if (!editor) {
    return null
  }

  return (
    <div
      className={cn(
        'rounded-lg overflow-hidden border shadow-sm',
        'bg-white border-gray-100',
        'dark:bg-neutral-900/30 dark:border-neutral-800'
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 工具栏 */}
      <div
        className={cn(
          'border-b px-2 py-1.5 flex flex-wrap items-center gap-3',
          'bg-gray-50 dark:bg-neutral-900/50 dark:border-neutral-800'
        )}
      >
        {/* 文字样式 */}
        <div className="flex items-center gap-0.5">
          <MenuButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            tooltip="加粗"
          >
            <Bold className="h-5 w-5" />
          </MenuButton>
          <MenuButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            tooltip="斜体"
          >
            <Italic className="h-5 w-5" />
          </MenuButton>
          <MenuButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            isActive={editor.isActive('underline')}
            tooltip="下划线"
          >
            <UnderlineIcon className="h-5 w-5" />
          </MenuButton>
        </div>

        <div className={cn('h-5 w-px', 'bg-gray-200 dark:bg-neutral-800')} />

        {/* 对齐方式 */}
        <div className="flex items-center gap-0.5">
          <MenuButton
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            isActive={editor.isActive({ textAlign: 'left' })}
            tooltip="左对齐"
          >
            <AlignLeft className="h-5 w-5" />
          </MenuButton>
          <MenuButton
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            isActive={editor.isActive({ textAlign: 'center' })}
            tooltip="居中"
          >
            <AlignCenter className="h-5 w-5" />
          </MenuButton>
          <MenuButton
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            isActive={editor.isActive({ textAlign: 'right' })}
            tooltip="右对齐"
          >
            <AlignRight className="h-5 w-5" />
          </MenuButton>
          <MenuButton
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            isActive={editor.isActive({ textAlign: 'justify' })}
            tooltip="两端对齐"
          >
            <AlignJustify className="h-5 w-5" />
          </MenuButton>
        </div>

        <div className={cn('h-5 w-px', 'bg-gray-200 dark:bg-neutral-800')} />

        {/* 列表 */}
        <div className="flex items-center gap-0.5">
          <MenuButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive('bulletList')}
            tooltip="无序列表"
          >
            <List className="h-5 w-5" />
          </MenuButton>
          <MenuButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive('orderedList')}
            tooltip="有序列表"
          >
            <ListOrdered className="h-5 w-5" />
          </MenuButton>
          <MenuButton
            onClick={() => editor.chain().focus().sinkListItem('listItem').run()}
            disabled={!editor.can().sinkListItem('listItem')}
            tooltip="增加缩进 (Tab)"
          >
            <IndentIncrease className="h-5 w-5" />
          </MenuButton>
          <MenuButton
            onClick={() => editor.chain().focus().liftListItem('listItem').run()}
            disabled={!editor.can().liftListItem('listItem')}
            tooltip="减少缩进 (Shift+Tab)"
          >
            <IndentDecrease className="h-5 w-5" />
          </MenuButton>
        </div>

        <div className={cn('h-5 w-px', 'bg-gray-200 dark:bg-neutral-800')} />

        {/* 撤销/重做 */}
        <div className="flex items-center gap-0.5">
          <MenuButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            tooltip="撤销"
          >
            <Undo className="h-4 w-4" />
          </MenuButton>
          <MenuButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            tooltip="重做"
          >
            <Redo className="h-4 w-4" />
          </MenuButton>

          {/* AI 智能排版按钮 */}
          <button
            onClick={handleFormat}
            className="ml-2 px-3 py-1.5 text-sm rounded-md bg-gradient-to-r from-blue-400 to-indigo-500 hover:from-indigo-500 hover:to-blue-400 text-white shadow-md transition-all duration-300 flex items-center gap-1"
          >
            <Layout className="h-4 w-4" />
            AI 智能排版
          </button>

          {/* AI 润色按钮 */}
          {(resumeData || onPolish) && (
            <button
              onClick={handlePolish}
              className="ml-2 px-3 py-1.5 text-sm rounded-md bg-gradient-to-r from-purple-400 to-pink-500 hover:from-pink-500 hover:to-purple-400 text-white shadow-md transition-all duration-300 flex items-center gap-1"
            >
              <Wand2 className="h-4 w-4" />
              AI 润色
            </button>
          )}
        </div>
      </div>

      {/* 编辑区域 */}
      <EditorContent editor={editor} />

      {/* AI 智能排版对话框 */}
      <FormatLayoutDialog
        open={showFormatDialog}
        onOpenChange={setShowFormatDialog}
        content={content || ''}
        onApply={handleApplyFormat}
        resumeData={resumeData}
        path={polishPath}
      />

      {/* AI 润色对话框 */}
      {resumeData && (
        <AIPolishDialog
          open={showPolishDialog}
          onOpenChange={setShowPolishDialog}
          content={content || ''}
          onApply={handleApplyPolish}
          resumeData={resumeData}
          path={polishPath}
        />
      )}
    </div>
  )
}

export default RichEditor


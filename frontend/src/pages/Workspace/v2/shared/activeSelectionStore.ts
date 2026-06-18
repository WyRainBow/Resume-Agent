/**
 * 当前富文本选区的全局通道
 * 富文本编辑器实例分散在多个 RichEditor 里，而 AI 助手对话窗口是全局组件。
 * RichEditor 在选区变化时把"非空选区"推入本 store，对话窗口订阅后即可引用选中文字、
 * 并在改写后用 applyHtmlToSelection 把结果写回那段选区（写回逻辑抢救自旧划词气泡）。
 */
import type { Editor } from '@tiptap/core'
import { DOMParser as ProseMirrorDOMParser } from 'prosemirror-model'

export interface ActiveSelection {
  editor: Editor
  from: number
  to: number
  text: string
  html: string
  /** 选区是否整体加粗（捕获时由 editor.isActive('bold') 判定，用于改写后保留加粗） */
  bold: boolean
  /** 来源字段路径，如 selfEvaluation / projects.0.description，供改写接口做场景判断 */
  path: string
}

let current: ActiveSelection | null = null
const listeners = new Set<() => void>()

export function setActiveSelection(sel: ActiveSelection | null) {
  current = sel
  listeners.forEach((l) => l())
}

export function getActiveSelection(): ActiveSelection | null {
  return current
}

export function subscribeActiveSelection(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * 把 HTML 改写结果写回某段选区。
 * 按最终 HTML 整体替换 [from, to)，经 ProseMirror DOMParser 解析为 slice，
 * 避免 setBold/unsetBold 受当前选区状态影响导致样式未落地。
 * 返回是否写回成功。
 */
export function applyHtmlToSelection(sel: ActiveSelection, html: string): boolean {
  const { editor, from, to } = sel
  if (!editor || editor.isDestroyed) return false

  const { state } = editor
  const container = document.createElement('div')
  container.innerHTML = html
  const parser = ProseMirrorDOMParser.fromSchema(state.schema)
  const slice = parser.parseSlice(container, {
    preserveWhitespace: true,
    context: state.doc.resolve(from),
  })
  if (slice.content.size === 0) return false

  const tr = state.tr.replaceRange(from, to, slice)
  if (!tr.docChanged) return false

  editor.view.dispatch(tr.scrollIntoView())
  return true
}

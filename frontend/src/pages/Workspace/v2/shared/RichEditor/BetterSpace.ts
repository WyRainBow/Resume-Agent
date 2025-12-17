/**
 * TipTap 扩展：更好的空格处理
 * 连续空格时插入不间断空格
 */
import { Extension } from '@tiptap/core'

export const BetterSpace = Extension.create({
  name: 'betterSpace',

  addKeyboardShortcuts() {
    return {
      'Space': ({ editor }) => {
        const { state, view } = editor
        const { selection } = state
        const { $from } = selection

        const prevChar = $from.nodeBefore?.text?.slice(-1)

        // 如果前一个字符是空格，插入不间断空格
        if (prevChar === ' ') {
          view.dispatch(view.state.tr.insertText('\u00A0'))
          return true
        }
        return false
      },
    }
  },
})



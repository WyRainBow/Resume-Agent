import { useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Clipboard, Code2, Wand2 } from 'lucide-react'
import { cn } from '../../../lib/utils'
import type { ResumeData } from './types'
import { formatResumeJson, parseResumeJsonDraft } from './utils/jsonResumeEditor'

interface JsonEditModeProps {
  resumeData: ResumeData
  onUpdate: (data: ResumeData) => void
}

const RICH_TEXT_RULES = `JSON 富文本规则：
1. 加粗：使用 <strong>要加粗的文字</strong>、不要用 **文字**。
2. 无序列表：使用 <ul class="custom-list"><li><p>内容</p></li></ul>。
3. 列表中加粗：把要强调的词完整包进 <strong>...</strong>。
4. 常见富文本字段：education[].description、experience[].details、projects[].description、skillContent、selfEvaluation。`

export default function JsonEditMode({ resumeData, onUpdate }: JsonEditModeProps) {
  const [draft, setDraft] = useState(() => formatResumeJson(resumeData))
  const [error, setError] = useState<string | null>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [rulesCopied, setRulesCopied] = useState(false)
  const [jsonCopied, setJsonCopied] = useState(false)
  const lastAppliedJsonRef = useRef(formatResumeJson(resumeData))

  useEffect(() => {
    const nextJson = formatResumeJson(resumeData)
    lastAppliedJsonRef.current = nextJson
    if (!isFocused) {
      setDraft(nextJson)
      setError(null)
    }
  }, [resumeData, isFocused])

  const handleChange = (value: string) => {
    setDraft(value)
    const parsed = parseResumeJsonDraft(value)

    if (!parsed.ok) {
      setError(parsed.error)
      return
    }

    setError(null)
    const normalized = formatResumeJson(parsed.data)
    if (normalized === lastAppliedJsonRef.current) return
    lastAppliedJsonRef.current = normalized
    onUpdate(parsed.data)
  }

  const handleBlur = () => {
    setIsFocused(false)
    const parsed = parseResumeJsonDraft(draft)
    if (parsed.ok) {
      setDraft(formatResumeJson(parsed.data))
    }
  }

  const handleFormat = () => {
    const parsed = parseResumeJsonDraft(draft)
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }

    const formatted = formatResumeJson(parsed.data)
    setDraft(formatted)
    setError(null)
    lastAppliedJsonRef.current = formatted
    onUpdate(parsed.data)
  }

  const handleCopyRules = async () => {
    try {
      await copyText(RICH_TEXT_RULES)
      setRulesCopied(true)
      window.setTimeout(() => setRulesCopied(false), 1600)
    } catch (error) {
      console.error('复制 JSON 富文本规则失败:', error)
    }
  }

  const copyText = async (text: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return
    }

    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  }

  const handleCopyJson = async () => {
    const parsed = parseResumeJsonDraft(draft)
    const textToCopy = parsed.ok ? formatResumeJson(parsed.data) : draft

    try {
      await copyText(textToCopy)
      setJsonCopied(true)
      window.setTimeout(() => setJsonCopied(false), 1600)
    } catch (error) {
      console.error('复制 JSON 失败:', error)
    }
  }

  return (
    <div className="h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      <div className="h-full flex flex-col p-5">
        <div
          className={cn(
            'mb-4 rounded-xl border p-4 shadow-sm',
            'bg-white border-slate-200',
            'dark:bg-slate-900 dark:border-slate-800'
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="group relative h-10 w-10">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-100 dark:text-slate-700 dark:ring-slate-200">
                  <Code2 className="h-5 w-5" />
                </div>
                <div className="absolute left-0 top-full h-3 w-[380px]" />
                <div
                  className={cn(
                    'pointer-events-auto absolute left-0 top-full z-50 mt-3 w-[380px] rounded-xl border p-4 text-left opacity-0 shadow-xl transition-opacity duration-150',
                    'invisible group-hover:visible group-hover:opacity-100',
                    'bg-white text-slate-700 border-slate-200',
                    'dark:bg-white dark:text-slate-700 dark:border-slate-200'
                  )}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-sm font-bold text-slate-900">JSON 富文本规则</div>
                    <button
                      type="button"
                      onClick={handleCopyRules}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 hover:text-slate-900"
                    >
                      <Clipboard className="h-3.5 w-3.5" />
                      {rulesCopied ? '已复制' : '复制规则'}
                    </button>
                  </div>
                  <div className="space-y-2 text-xs leading-5">
                    <p>
                      <span className="font-semibold">加粗：</span>
                      使用 <code className="rounded bg-slate-100 px-1 py-0.5">{'<strong>要加粗的文字</strong>'}</code>、
                      不要用 <code className="rounded bg-slate-100 px-1 py-0.5">**文字**</code>。
                    </p>
                    <p>
                      <span className="font-semibold">无序列表：</span>
                      使用 <code className="rounded bg-slate-100 px-1 py-0.5">{'<ul class="custom-list"><li><p>内容</p></li></ul>'}</code>。
                    </p>
                    <p>
                      <span className="font-semibold">列表中加粗：</span>
                      把要强调的词完整包进 <code className="rounded bg-slate-100 px-1 py-0.5">{'<strong>...</strong>'}</code>。
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  JSON 编辑
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  合法 JSON 会立即同步模块编辑、并触发 LaTeX 自动渲染。
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyJson}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                  'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
                  'hover:bg-slate-200 hover:text-slate-900',
                  'dark:bg-slate-100 dark:text-slate-700 dark:ring-slate-200'
                )}
              >
                <Clipboard className="h-3.5 w-3.5" />
                {jsonCopied ? '已复制' : '复制 JSON'}
              </button>
              <button
                type="button"
                onClick={handleFormat}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                  'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
                  'hover:bg-slate-200 hover:text-slate-900',
                  'dark:bg-slate-100 dark:text-slate-700 dark:ring-slate-200'
                )}
              >
                <Wand2 className="h-3.5 w-3.5" />
                格式化 JSON
              </button>
              <div
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
                  error
                    ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-300'
                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                )}
              >
                {error ? <AlertCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {error ? '未同步' : '已同步'}
              </div>
            </div>
          </div>
          {error && (
            <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 dark:bg-rose-950/30 dark:text-rose-300">
              {error}
            </p>
          )}
        </div>

        <textarea
          value={draft}
          onChange={(event) => handleChange(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          spellCheck={false}
          className={cn(
            'min-h-0 flex-1 resize-none rounded-xl border p-4 font-mono text-sm leading-6 shadow-inner outline-none',
            'bg-slate-100 text-slate-900 caret-slate-900 border-slate-200',
            'placeholder:text-slate-400 selection:bg-blue-200/70',
            'focus:border-blue-300 focus:ring-2 focus:ring-blue-100',
            'dark:bg-slate-100 dark:text-slate-900 dark:border-slate-200',
            error && 'border-rose-500 focus:ring-rose-400/30'
          )}
        />
      </div>
    </div>
  )
}

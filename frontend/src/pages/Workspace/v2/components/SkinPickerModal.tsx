/**
 * 皮肤选择框:两张预览卡(NEO / 清新),点选即持久化并关闭。
 * 两处触发:①首次进入编辑页(从未选过皮肤,v2/index.tsx);②顶栏「界面皮肤」按钮。
 * 首次进入不传 onClose(强制选择);顶栏按钮传 onClose(可点遮罩取消)。
 */
import { createPortal } from 'react-dom'
import { getSkinOrDefault, setStoredSkin, type WorkspaceSkin } from '@/lib/skin'

interface SkinPickerModalProps {
  open: boolean
  onPicked: (skin: WorkspaceSkin) => void
  /** 传入则允许点遮罩关闭(不改皮肤);首次进入不传,强制选择 */
  onClose?: () => void
}

function SkinCard({
  title,
  desc,
  preview,
  active,
  onClick,
}: {
  title: string
  desc: string
  preview: React.ReactNode
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'group flex-1 min-w-0 text-left rounded-xl border bg-white p-4 shadow-sm transition-all hover:border-blue-500 hover:shadow-md dark:bg-slate-900 ' +
        (active
          ? 'border-blue-500 ring-2 ring-blue-200 dark:border-blue-400 dark:ring-blue-900'
          : 'border-slate-200 dark:border-slate-700')
      }
    >
      <div className="h-28 overflow-hidden rounded-lg border border-slate-100 dark:border-slate-800">
        {preview}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-base font-bold text-slate-800 dark:text-slate-100">{title}</span>
        {active && (
          <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            当前
          </span>
        )}
      </div>
      <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{desc}</div>
      <div className="mt-3 w-full rounded-md bg-slate-900 py-1.5 text-center text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 dark:bg-slate-100 dark:text-slate-900">
        {active ? '保持这个' : '换成这个'}
      </div>
    </button>
  )
}

/** NEO 皮肤缩略示意:米白底 + 黑粗边直角块 + 硬阴影 */
function NeoPreview() {
  return (
    <div className="flex h-full flex-col gap-2 bg-[#F0F0E8] p-3">
      <div className="h-3 w-20 border-2 border-black bg-[#4285F4] shadow-[2px_2px_0px_0px_#000000]" />
      <div className="h-4 w-full border-2 border-black bg-white shadow-[2px_2px_0px_0px_#000000]" />
      <div className="h-4 w-3/4 border-2 border-black bg-white shadow-[2px_2px_0px_0px_#000000]" />
      <div className="mt-auto h-5 w-16 border-2 border-black bg-black" />
    </div>
  )
}

/** 清新皮肤缩略示意:浅灰底 + 细灰边圆角块 + 柔和阴影 */
function FreshPreview() {
  return (
    <div className="flex h-full flex-col gap-2 bg-slate-50 p-3">
      <div className="h-3 w-20 rounded-full bg-blue-400/80" />
      <div className="h-4 w-full rounded-md border border-slate-200 bg-white shadow-sm" />
      <div className="h-4 w-3/4 rounded-md border border-slate-200 bg-white shadow-sm" />
      <div className="mt-auto h-5 w-16 rounded-md bg-blue-500" />
    </div>
  )
}

export function SkinPickerModal({ open, onPicked, onClose }: SkinPickerModalProps) {
  if (!open) return null

  const current = getSkinOrDefault()

  const pick = (skin: WorkspaceSkin) => {
    setStoredSkin(skin)
    onPicked(skin)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose ? () => onClose() : undefined}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">界面皮肤</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          选择工作台与首页的界面风格,随时可切换。
        </p>
        <div className="mt-4 flex gap-4">
          <SkinCard
            title="NEO"
            desc="黑边直角、硬朗醒目"
            preview={<NeoPreview />}
            active={current === 'neo'}
            onClick={() => pick('neo')}
          />
          <SkinCard
            title="清新"
            desc="圆角浅边、柔和简洁(默认)"
            preview={<FreshPreview />}
            active={current === 'fresh'}
            onClick={() => pick('fresh')}
          />
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default SkinPickerModal

/**
 * 首次进入编辑页的皮肤选择框:两张预览卡(NEO / 清新),点选即持久化并关闭。
 * 只在用户从未选过皮肤(getStoredSkin() === null)时由 v2/index.tsx 弹出;
 * 之后的切换走顶栏 Palette 按钮。
 */
import { setStoredSkin, type WorkspaceSkin } from '@/lib/skin'

interface SkinPickerModalProps {
  open: boolean
  onPicked: (skin: WorkspaceSkin) => void
}

function SkinCard({
  title,
  desc,
  preview,
  onClick,
}: {
  title: string
  desc: string
  preview: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex-1 min-w-0 text-left rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-blue-500 hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="h-28 overflow-hidden rounded-lg border border-slate-100 dark:border-slate-800">
        {preview}
      </div>
      <div className="mt-3 text-base font-bold text-slate-800 dark:text-slate-100">{title}</div>
      <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{desc}</div>
      <div className="mt-3 w-full rounded-md bg-slate-900 py-1.5 text-center text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 dark:bg-slate-100 dark:text-slate-900">
        用这个进入
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

export function SkinPickerModal({ open, onPicked }: SkinPickerModalProps) {
  if (!open) return null

  const pick = (skin: WorkspaceSkin) => {
    setStoredSkin(skin)
    onPicked(skin)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">选择你喜欢的界面风格</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          随时可以在顶栏的皮肤按钮里切换。
        </p>
        <div className="mt-4 flex gap-4">
          <SkinCard
            title="NEO"
            desc="黑边直角、硬朗醒目(默认)"
            preview={<NeoPreview />}
            onClick={() => pick('neo')}
          />
          <SkinCard
            title="清新"
            desc="圆角浅边、柔和简洁"
            preview={<FreshPreview />}
            onClick={() => pick('fresh')}
          />
        </div>
      </div>
    </div>
  )
}

export default SkinPickerModal

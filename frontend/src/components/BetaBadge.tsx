/**
 * Beta 角标：标识当前为测试版。
 * 挂在 Logo / 弹窗标题旁，让用户知道产品仍在打磨，对不完美处多一分包容。
 */
export function BetaBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm bg-amber-500 px-1 py-px text-[9px] font-bold uppercase leading-none tracking-wide text-white border border-black ${className}`}
      title="当前为测试版，部分功能仍在打磨"
    >
      Beta
    </span>
  )
}

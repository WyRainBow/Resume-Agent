import { useState } from 'react'
import { User } from 'lucide-react'
import { cn } from '@/lib/utils'

type AvatarProps = {
  src?: string | null
  name?: string | null
  email?: string | null
  /** 控制尺寸与形状的类，如 "w-9 h-9"；可覆盖默认底色 / 边框。 */
  className?: string
  /** 兜底首字母的字号类，如 "text-sm"。 */
  textClassName?: string
}

/**
 * 用户头像：优先展示图片，失败时回退到首字母，再回退到通用图标。
 *
 * Google（lh3.googleusercontent.com）头像跨域加载会校验 Referer，
 * 必须带 referrerPolicy="no-referrer" 才不会被拦截；同时用 onError
 * 兜底，避免外部图片失效时露出浏览器破图标。
 */
export function Avatar({ src, name, email, className, textClassName }: AvatarProps) {
  const [failed, setFailed] = useState(false)
  const initial = (name || email || '').trim().charAt(0).toUpperCase()
  const showImage = Boolean(src) && !failed

  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-full flex items-center justify-center',
        'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
        className,
      )}
    >
      {showImage ? (
        <img
          src={src as string}
          alt={name || email || ''}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : initial ? (
        <span className={cn('font-bold leading-none', textClassName)}>{initial}</span>
      ) : (
        <User className="w-1/2 h-1/2" />
      )}
    </div>
  )
}

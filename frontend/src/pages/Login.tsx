import { useEffect } from 'react'
import { buildAuthWebUrl, isAuthWebEnabled } from '@/lib/runtimeEnv'

// 2026-07-17 身份统一：旧 JWT 用户名/密码表单已随 JWT 下架删除。
// 登录唯一入口 = Next.js(BetterAuth)；未配置 VITE_AUTH_WEB_URL 时无登录方式（部署必配）。
export default function LoginPage() {
  const authWebUrl = isAuthWebEnabled()
    ? buildAuthWebUrl('/account', `${window.location.origin}/workspace`)
    : ''

  useEffect(() => {
    if (authWebUrl) {
      window.location.assign(authWebUrl)
    }
  }, [authWebUrl])

  if (authWebUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md bg-white shadow-md rounded-lg p-6 text-center">
          <h1 className="text-xl font-bold text-gray-900">正在前往登录</h1>
          <p className="mt-3 text-sm text-gray-500">登录由 Next.js + BetterAuth 统一处理。</p>
          <a
            href={authWebUrl}
            className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-black px-4 py-2 text-white"
          >
            继续登录
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white shadow-md rounded-lg p-6 text-center">
        <h1 className="text-xl font-bold text-gray-900">登录暂不可用</h1>
        <p className="mt-3 text-sm text-gray-500">
          本部署未配置认证服务（VITE_AUTH_WEB_URL），请联系管理员启用 BetterAuth 登录。
        </p>
      </div>
    </div>
  )
}

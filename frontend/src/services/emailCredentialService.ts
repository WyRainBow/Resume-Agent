// 邮箱发信凭证服务(仅管理员功能):连接/断开 QQ 邮箱,授权码只上行不回传
import { getApiBaseUrl } from '@/lib/runtimeEnv'
import { BETTER_AUTH_TOKEN } from '@/contexts/AuthContext'

export type EmailCredentialStatus = {
  configured: boolean
  masked_email: string | null
}

/** BetterAuth 用户的 token 是占位符,不能当 Bearer 发(会顶掉代理侧的 cookie session);
 * 该场景下省略 Authorization,纯靠 cookie 让 auth-web 代理注入可信头。 */
function buildAuthHeaders(token: string): Record<string, string> {
  if (!token || token === BETTER_AUTH_TOKEN) return {}
  return { Authorization: `Bearer ${token}` }
}

async function parseOrThrow(resp: Response, fallback: string): Promise<EmailCredentialStatus> {
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: fallback }))
    throw new Error(err.detail || fallback)
  }
  return (await resp.json()) as EmailCredentialStatus
}

export async function getEmailCredentialStatus(token: string): Promise<EmailCredentialStatus> {
  const resp = await fetch(`${getApiBaseUrl()}/api/email/credential`, {
    headers: buildAuthHeaders(token),
  })
  return parseOrThrow(resp, '读取邮箱连接状态失败')
}

export async function saveEmailCredential(
  token: string,
  emailAddress: string,
  authCode: string,
): Promise<EmailCredentialStatus> {
  const resp = await fetch(`${getApiBaseUrl()}/api/email/credential`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(token) },
    body: JSON.stringify({ email_address: emailAddress, auth_code: authCode }),
  })
  return parseOrThrow(resp, '保存邮箱凭证失败')
}

export async function deleteEmailCredential(token: string): Promise<EmailCredentialStatus> {
  const resp = await fetch(`${getApiBaseUrl()}/api/email/credential`, {
    method: 'DELETE',
    headers: buildAuthHeaders(token),
  })
  return parseOrThrow(resp, '断开邮箱连接失败')
}

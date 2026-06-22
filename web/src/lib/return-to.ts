const DEFAULT_RETURN_TO =
  process.env.AUTH_DEFAULT_RETURN_TO || "http://localhost:5173/workspace";

const DEFAULT_ALLOWED_RETURN_HOSTS = ["localhost:5173", "127.0.0.1:5173"];

// 生产域名不写死在代码里：复用代理 CORS 白名单（AUTH_PROXY_ALLOWED_ORIGINS）——
// 能跨域调用业务 API 的前端 Origin，同样允许作为登录后的回跳目标；
// 默认回跳目标自身的 host 也一并加入，避免 getDefaultReturnTo 被白名单卡空。
function configuredReturnHosts(): string[] {
  const hosts: string[] = [];

  const rawOrigins =
    process.env.AUTH_PROXY_ALLOWED_ORIGINS ||
    process.env.NEXT_PUBLIC_LEGACY_FRONTEND_URL ||
    "";
  for (const origin of rawOrigins.split(",")) {
    const trimmed = origin.trim();
    if (!trimmed) continue;
    try {
      hosts.push(new URL(trimmed).host);
    } catch {
      // 忽略无法解析为 URL 的配置项
    }
  }

  try {
    hosts.push(new URL(DEFAULT_RETURN_TO).host);
  } catch {
    // DEFAULT_RETURN_TO 为相对路径时无 host，忽略
  }

  return hosts;
}

const ALLOWED_RETURN_HOSTS = new Set<string>([
  ...DEFAULT_ALLOWED_RETURN_HOSTS,
  ...configuredReturnHosts(),
]);

export function getDefaultReturnTo() {
  return sanitizeReturnTo(DEFAULT_RETURN_TO);
}

export function resolveReturnTo(value?: string | string[]) {
  return sanitizeReturnTo(value) || getDefaultReturnTo();
}

export function sanitizeReturnTo(value?: string | string[]) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return "";

  try {
    const url = new URL(raw);
    if (ALLOWED_RETURN_HOSTS.has(url.host)) {
      return url.toString();
    }
  } catch {
    if (raw.startsWith("/") && !raw.startsWith("//")) {
      return raw;
    }
  }

  return "";
}

export function buildAccountCallbackUrl(returnTo: string) {
  if (!returnTo) return "/account";
  const params = new URLSearchParams({ returnTo });
  return `/account?${params.toString()}`;
}

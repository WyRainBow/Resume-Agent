const ALLOWED_RETURN_HOSTS = new Set(["localhost:5173", "127.0.0.1:5173"]);

const DEFAULT_RETURN_TO =
  process.env.AUTH_DEFAULT_RETURN_TO || "http://localhost:5173/workspace";

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

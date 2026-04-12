import { getApiBaseUrl } from "@/lib/runtimeEnv";

export interface AgentModelOption {
  id: string;
  label: string;
  provider: string;
  description: string;
  model: string;
  configured: boolean;
  supported: boolean;
  available: boolean;
  disabled_reason?: string | null;
  is_default: boolean;
}

interface AgentModelResponse {
  selected: string;
  models: AgentModelOption[];
}

const AGENT_MODEL_STORAGE_KEY = "agent:selected-llm-profile";

export async function fetchAgentModels(
  baseUrl = getApiBaseUrl(),
  headers: Record<string, string> = {},
): Promise<AgentModelResponse> {
  const response = await fetch(`${baseUrl}/api/agent/config/models`, {
    headers: {
      Accept: "application/json",
      ...headers,
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || `Failed to load agent models (${response.status})`);
  }

  return (await response.json()) as AgentModelResponse;
}

export function readStoredAgentModelProfile(): string | null {
  try {
    return window.localStorage.getItem(AGENT_MODEL_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeStoredAgentModelProfile(profileId: string): void {
  try {
    window.localStorage.setItem(AGENT_MODEL_STORAGE_KEY, profileId);
  } catch {
    // Ignore storage errors and keep runtime state only.
  }
}

export function resolvePreferredAgentModel(
  options: AgentModelOption[],
  preferredId?: string | null,
): string {
  const preferred = (preferredId || "").trim();
  if (preferred && options.some((item) => item.id === preferred && item.available)) {
    return preferred;
  }

  const defaultOption = options.find((item) => item.is_default && item.available);
  if (defaultOption) {
    return defaultOption.id;
  }

  const firstAvailable = options.find((item) => item.available);
  if (firstAvailable) {
    return firstAvailable.id;
  }

  return "";
}

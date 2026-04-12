export type AIProvider = 'kimi' | 'zhipu' | 'doubao' | 'deepseek'

export const DEFAULT_AI_PROVIDER: AIProvider = 'kimi'

export const AI_PROVIDER_LABELS: Record<AIProvider, string> = {
  kimi: 'Kimi',
  zhipu: '智谱',
  doubao: '豆包',
  deepseek: 'DeepSeek',
}

export const DEFAULT_AI_MODEL = 'kimi-for-coding'

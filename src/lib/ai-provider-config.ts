export type ProviderId =
  | 'openai'
  | 'anthropic'
  | 'ollama'
  | 'deepseek'
  | 'minimax'
  | 'kimi'
  | 'generic';

export type ProviderProtocol = 'openai-compatible' | 'anthropic-messages' | 'ollama-chat';

export interface ProviderPreset {
  id: ProviderId;
  protocol: ProviderProtocol;
  defaultApiBaseUrl: string;
  defaultModel: string;
  apiKeyRequired: boolean;
  labelZh: string;
  labelEn: string;
  hintZh: string;
  hintEn: string;
}

export interface AIProviderConfig {
  providerId: ProviderId;
  genericProtocol: ProviderProtocol;
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export const AI_PROVIDER_CONFIG_STORAGE_KEY = 'ai-provider-config-v1';
export const AI_PROVIDER_API_KEY_SESSION_KEY = 'ai-provider-api-key-v1';
export const AI_PROVIDER_CONFIG_UPDATED_EVENT = 'ai-provider-config-updated';

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'openai',
    protocol: 'openai-compatible',
    defaultApiBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    apiKeyRequired: true,
    labelZh: 'OpenAI 官方',
    labelEn: 'OpenAI Official',
    hintZh: '官方 OpenAI 接口（也可替换为 OpenAI 兼容中转地址）。',
    hintEn: 'Official OpenAI endpoint (or an OpenAI-compatible relay URL).',
  },
  {
    id: 'anthropic',
    protocol: 'anthropic-messages',
    defaultApiBaseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-3-5-sonnet-latest',
    apiKeyRequired: true,
    labelZh: 'Anthropic 官方',
    labelEn: 'Anthropic Official',
    hintZh: '官方 Claude Messages API。',
    hintEn: 'Official Claude Messages API.',
  },
  {
    id: 'ollama',
    protocol: 'ollama-chat',
    defaultApiBaseUrl: 'http://localhost:11434',
    defaultModel: 'llama3.1',
    apiKeyRequired: false,
    labelZh: 'Ollama 本地',
    labelEn: 'Ollama Local',
    hintZh: '本地模型服务（默认不要求 API Key）。',
    hintEn: 'Local model runtime (API key optional).',
  },
  {
    id: 'deepseek',
    protocol: 'openai-compatible',
    defaultApiBaseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    apiKeyRequired: true,
    labelZh: 'DeepSeek 官方',
    labelEn: 'DeepSeek Official',
    hintZh: 'DeepSeek 官方（OpenAI 兼容）。',
    hintEn: 'DeepSeek official (OpenAI-compatible).',
  },
  {
    id: 'minimax',
    protocol: 'openai-compatible',
    defaultApiBaseUrl: 'https://api.minimaxi.com/v1',
    defaultModel: 'MiniMax-Text-01',
    apiKeyRequired: true,
    labelZh: 'MiniMax',
    labelEn: 'MiniMax',
    hintZh: 'MiniMax 官方或兼容中转地址。',
    hintEn: 'MiniMax official or compatible relay endpoint.',
  },
  {
    id: 'kimi',
    protocol: 'openai-compatible',
    defaultApiBaseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    apiKeyRequired: true,
    labelZh: 'Kimi (Moonshot)',
    labelEn: 'Kimi (Moonshot)',
    hintZh: 'Kimi 官方或 OpenAI 兼容中转。',
    hintEn: 'Kimi official or OpenAI-compatible relay.',
  },
  {
    id: 'generic',
    protocol: 'openai-compatible',
    defaultApiBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    apiKeyRequired: true,
    labelZh: '通用适配',
    labelEn: 'Generic Adapter',
    hintZh: '用于自定义官方/中转平台，支持三种协议。',
    hintEn: 'Use custom official/relay provider with selectable protocol.',
  },
];

export const PROTOCOL_OPTIONS: Array<{ value: ProviderProtocol; labelZh: string; labelEn: string }> = [
  { value: 'openai-compatible', labelZh: 'OpenAI 兼容', labelEn: 'OpenAI Compatible' },
  { value: 'anthropic-messages', labelZh: 'Anthropic Messages', labelEn: 'Anthropic Messages' },
  { value: 'ollama-chat', labelZh: 'Ollama Chat', labelEn: 'Ollama Chat' },
];

export const GENERIC_PROTOCOL_DEFAULTS: Record<
  ProviderProtocol,
  { apiBaseUrl: string; model: string; apiKeyRequired: boolean }
> = {
  'openai-compatible': {
    apiBaseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    apiKeyRequired: true,
  },
  'anthropic-messages': {
    apiBaseUrl: 'https://api.anthropic.com',
    model: 'claude-3-5-sonnet-latest',
    apiKeyRequired: true,
  },
  'ollama-chat': {
    apiBaseUrl: 'http://localhost:11434',
    model: 'llama3.1',
    apiKeyRequired: false,
  },
};

export const DEFAULT_AI_PROVIDER_CONFIG: AIProviderConfig = {
  providerId: 'openai',
  genericProtocol: 'openai-compatible',
  apiBaseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  temperature: 0.2,
  maxTokens: 1800,
};

export function getProviderPreset(providerId: ProviderId): ProviderPreset {
  return PROVIDER_PRESETS.find((provider) => provider.id === providerId) || PROVIDER_PRESETS[0];
}

export function toProviderId(raw: string | undefined): ProviderId {
  if (!raw) return 'openai';
  const matched = PROVIDER_PRESETS.find((provider) => provider.id === raw);
  return matched ? matched.id : 'openai';
}

export function toProtocol(raw: string | undefined, fallback: ProviderProtocol): ProviderProtocol {
  if (raw === 'openai-compatible' || raw === 'anthropic-messages' || raw === 'ollama-chat') {
    return raw;
  }
  return fallback;
}

export function resolveProtocol(config: AIProviderConfig): ProviderProtocol {
  if (config.providerId === 'generic') {
    return config.genericProtocol;
  }
  return getProviderPreset(config.providerId).protocol;
}

export function isApiKeyRequired(config: AIProviderConfig): boolean {
  if (config.providerId === 'generic') {
    return GENERIC_PROTOCOL_DEFAULTS[config.genericProtocol].apiKeyRequired;
  }
  return getProviderPreset(config.providerId).apiKeyRequired;
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function normalizeConfig(partial: Partial<AIProviderConfig>): AIProviderConfig {
  const providerId = toProviderId(typeof partial.providerId === 'string' ? partial.providerId : undefined);
  const genericProtocol = toProtocol(
    typeof partial.genericProtocol === 'string' ? partial.genericProtocol : undefined,
    'openai-compatible'
  );
  const preset = getProviderPreset(providerId);

  return {
    providerId,
    genericProtocol,
    apiBaseUrl:
      typeof partial.apiBaseUrl === 'string' && partial.apiBaseUrl.trim()
        ? partial.apiBaseUrl
        : providerId === 'generic'
          ? GENERIC_PROTOCOL_DEFAULTS[genericProtocol].apiBaseUrl
          : preset.defaultApiBaseUrl,
    apiKey: typeof partial.apiKey === 'string' ? partial.apiKey : '',
    model:
      typeof partial.model === 'string' && partial.model.trim()
        ? partial.model
        : providerId === 'generic'
          ? GENERIC_PROTOCOL_DEFAULTS[genericProtocol].model
          : preset.defaultModel,
    temperature: clamp(Number(partial.temperature), 0, 1, DEFAULT_AI_PROVIDER_CONFIG.temperature),
    maxTokens: clamp(Number(partial.maxTokens), 200, 4000, DEFAULT_AI_PROVIDER_CONFIG.maxTokens),
  };
}

export function loadPersistedAIProviderConfig(): AIProviderConfig {
  if (typeof window === 'undefined') return DEFAULT_AI_PROVIDER_CONFIG;

  let partial: Partial<AIProviderConfig> = {};
  try {
    const raw = localStorage.getItem(AI_PROVIDER_CONFIG_STORAGE_KEY);
    if (raw) {
      partial = JSON.parse(raw) as Partial<AIProviderConfig>;
    }
  } catch {
    partial = {};
  }

  const apiKey = sessionStorage.getItem(AI_PROVIDER_API_KEY_SESSION_KEY) || '';
  return normalizeConfig({
    ...partial,
    apiKey,
  });
}

export function persistAIProviderConfig(config: AIProviderConfig): void {
  if (typeof window === 'undefined') return;

  const normalized = normalizeConfig(config);
  const { apiKey, ...safeConfig } = normalized;
  localStorage.setItem(AI_PROVIDER_CONFIG_STORAGE_KEY, JSON.stringify(safeConfig));

  if (apiKey.trim()) {
    sessionStorage.setItem(AI_PROVIDER_API_KEY_SESSION_KEY, apiKey.trim());
  } else {
    sessionStorage.removeItem(AI_PROVIDER_API_KEY_SESSION_KEY);
  }

  window.dispatchEvent(new CustomEvent(AI_PROVIDER_CONFIG_UPDATED_EVENT));
}

export function buildProviderConfigPayload(config: AIProviderConfig, isZh: boolean) {
  const preset = getProviderPreset(config.providerId);
  const protocol = resolveProtocol(config);
  return {
    providerId: config.providerId,
    providerName: isZh ? preset.labelZh : preset.labelEn,
    protocol,
    apiBaseUrl: config.apiBaseUrl.trim(),
    apiKey: config.apiKey.trim(),
    model: config.model.trim(),
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    requiresApiKey: isApiKeyRequired(config),
  };
}


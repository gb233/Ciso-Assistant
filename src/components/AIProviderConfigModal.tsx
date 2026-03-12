'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Save, Settings2, X } from 'lucide-react';
import {
  buildProviderConfigPayload,
  GENERIC_PROTOCOL_DEFAULTS,
  getProviderPreset,
  isApiKeyRequired,
  PROTOCOL_OPTIONS,
  PROVIDER_PRESETS,
  toProtocol,
  toProviderId,
  type AIProviderConfig,
} from '@/lib/ai-provider-config';

interface ConnectionState {
  status: 'idle' | 'success' | 'error';
  message: string;
}

interface AIProviderConfigModalProps {
  isZh: boolean;
  isOpen: boolean;
  initialConfig: AIProviderConfig;
  onClose: () => void;
  onSave: (config: AIProviderConfig) => void;
}

export default function AIProviderConfigModal({
  isZh,
  isOpen,
  initialConfig,
  onClose,
  onSave,
}: AIProviderConfigModalProps) {
  const [draft, setDraft] = useState<AIProviderConfig>(initialConfig);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [error, setError] = useState('');
  const [connectionState, setConnectionState] = useState<ConnectionState>({ status: 'idle', message: '' });

  useEffect(() => {
    if (!isOpen) return;
    setDraft(initialConfig);
    setError('');
    setConnectionState({ status: 'idle', message: '' });
  }, [initialConfig, isOpen]);

  const activePreset = useMemo(() => getProviderPreset(draft.providerId), [draft.providerId]);
  const apiKeyRequired = useMemo(() => isApiKeyRequired(draft), [draft]);

  const validateProviderConfig = (): string | null => {
    if (!draft.apiBaseUrl.trim()) {
      return isZh ? '请填写 API 地址。' : 'Please provide API base URL.';
    }
    if (!draft.model.trim()) {
      return isZh ? '请填写模型名称。' : 'Please provide a model.';
    }
    if (apiKeyRequired && !draft.apiKey.trim()) {
      return isZh ? '请填写 API Key。' : 'Please provide API key.';
    }
    return null;
  };

  const handleTestConnection = async () => {
    const validationError = validateProviderConfig();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setConnectionState({ status: 'idle', message: '' });
    setIsTestingConnection(true);

    try {
      const response = await fetch('/api/ai-assistant/analyze/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestType: 'connection-test',
          language: isZh ? 'zh' : 'en',
          providerConfig: buildProviderConfigPayload(draft, isZh),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || (isZh ? '连接测试失败。' : 'Connection test failed.'));
      }

      const message =
        typeof payload?.message === 'string' && payload.message.trim()
          ? payload.message
          : isZh
            ? '连接成功。'
            : 'Connection successful.';

      setConnectionState({ status: 'success', message });
    } catch (testError) {
      console.error('AI provider connection test failed', testError);
      setConnectionState({
        status: 'error',
        message:
          testError instanceof Error
            ? testError.message
            : isZh
              ? '连接测试失败，请检查配置后重试。'
              : 'Connection test failed. Please verify the settings.',
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSave = () => {
    const validationError = validateProviderConfig();
    if (validationError) {
      setError(validationError);
      return;
    }
    onSave(draft);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/45 px-4">
      <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2 text-slate-900">
            <Settings2 className="h-5 w-5 text-cyan-700" />
            <h3 className="text-lg font-semibold">{isZh ? 'AI 配置' : 'AI Configuration'}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label={isZh ? '关闭' : 'Close'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-700">
              <span className="mb-1 block">{isZh ? '提供商' : 'Provider'}</span>
              <select
                value={draft.providerId}
                onChange={(event) => {
                  const providerId = toProviderId(event.target.value);
                  const preset = getProviderPreset(providerId);
                  setDraft((prev) => ({
                    ...prev,
                    providerId,
                    apiBaseUrl:
                      providerId === 'generic'
                        ? GENERIC_PROTOCOL_DEFAULTS[prev.genericProtocol].apiBaseUrl
                        : preset.defaultApiBaseUrl,
                    model:
                      providerId === 'generic'
                        ? GENERIC_PROTOCOL_DEFAULTS[prev.genericProtocol].model
                        : preset.defaultModel,
                    apiKey: '',
                  }));
                  setError('');
                  setConnectionState({ status: 'idle', message: '' });
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {PROVIDER_PRESETS.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {isZh ? provider.labelZh : provider.labelEn}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-slate-500">
                {isZh ? activePreset.hintZh : activePreset.hintEn}
              </span>
            </label>

            {draft.providerId === 'generic' && (
              <label className="text-sm text-slate-700">
                <span className="mb-1 block">{isZh ? '协议类型' : 'Protocol'}</span>
                <select
                  value={draft.genericProtocol}
                  onChange={(event) => {
                    const protocol = toProtocol(event.target.value, draft.genericProtocol);
                    const defaults = GENERIC_PROTOCOL_DEFAULTS[protocol];
                    setDraft((prev) => ({
                      ...prev,
                      genericProtocol: protocol,
                      apiBaseUrl: defaults.apiBaseUrl,
                      model: defaults.model,
                      apiKey: defaults.apiKeyRequired ? prev.apiKey : '',
                    }));
                    setError('');
                    setConnectionState({ status: 'idle', message: '' });
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  {PROTOCOL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {isZh ? option.labelZh : option.labelEn}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="text-sm text-slate-700">
              <span className="mb-1 block">{isZh ? 'API 地址' : 'API Base URL'}</span>
              <input
                value={draft.apiBaseUrl}
                onChange={(event) => setDraft((prev) => ({ ...prev, apiBaseUrl: event.target.value }))}
                placeholder={activePreset.defaultApiBaseUrl}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-1 block">{isZh ? '模型' : 'Model'}</span>
              <input
                value={draft.model}
                onChange={(event) => setDraft((prev) => ({ ...prev, model: event.target.value }))}
                placeholder={activePreset.defaultModel}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </label>

            <label className="text-sm text-slate-700 md:col-span-2">
              <span className="mb-1 block">
                API Key
                {apiKeyRequired ? '' : isZh ? '（可选）' : ' (Optional)'}
              </span>
              <input
                type="password"
                value={draft.apiKey}
                onChange={(event) => setDraft((prev) => ({ ...prev, apiKey: event.target.value }))}
                placeholder={apiKeyRequired ? 'sk-...' : isZh ? '本地模型可留空' : 'Can be empty for local models'}
                autoComplete="off"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <span className="mt-1 block text-xs text-slate-500">
                {isZh
                  ? '安全提示：API Key 会保存在当前浏览器会话中，用于全局复用；关闭会话后失效。'
                  : 'Security note: API key is kept in current browser session for global reuse and expires after session ends.'}
              </span>
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-1 block">Temperature</span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.1}
                value={draft.temperature}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setDraft((prev) => ({ ...prev, temperature: Number.isFinite(value) ? value : prev.temperature }));
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-1 block">{isZh ? '最大输出 Token' : 'Max Output Tokens'}</span>
              <input
                type="number"
                min={400}
                max={4000}
                step={100}
                value={draft.maxTokens}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setDraft((prev) => ({ ...prev, maxTokens: Number.isFinite(value) ? value : prev.maxTokens }));
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTestingConnection}
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isTestingConnection ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              {isTestingConnection ? (isZh ? '测试中...' : 'Testing...') : isZh ? '测试连接' : 'Test Connection'}
            </button>

            {connectionState.status !== 'idle' && (
              <span className={`text-sm ${connectionState.status === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                {connectionState.message}
              </span>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            {isZh ? '取消' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center rounded-lg bg-cyan-700 px-4 py-2 text-sm text-white hover:bg-cyan-800"
          >
            <Save className="mr-2 h-4 w-4" />
            {isZh ? '保存并应用' : 'Save & Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}


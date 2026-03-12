'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Settings2, Sparkles, X } from 'lucide-react';
import type { AssessmentData } from '@/lib/assessment-model';
import {
  AI_PROVIDER_CONFIG_UPDATED_EVENT,
  buildProviderConfigPayload,
  isApiKeyRequired,
  loadPersistedAIProviderConfig,
  persistAIProviderConfig,
  type AIProviderConfig,
} from '@/lib/ai-provider-config';
import AIProviderConfigModal from './AIProviderConfigModal';

interface FrameworkContext {
  id: string;
  name: string;
  fullName?: string;
  version: string;
  type?: string;
  domain?: string;
  presentationMode?: string;
}

interface RequirementContext {
  id: string;
  code: string;
  name: string;
  description: string;
  categoryName?: string;
  subcategoryName?: string;
  sourceRef?: string;
  obligationStrength?: string;
  verification?: string;
  contentLanguage?: string;
  applicability?: Record<string, string | undefined>;
}

interface AIRequirementInterpreterProps {
  isZh: boolean;
  framework: FrameworkContext;
  requirement: RequirementContext;
  assessment?: AssessmentData;
  onApplyToNotes: (text: string) => void;
}

export default function AIRequirementInterpreter({
  isZh,
  framework,
  requirement,
  assessment,
  onApplyToNotes,
}: AIRequirementInterpreterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [config, setConfig] = useState<AIProviderConfig>(() => loadPersistedAIProviderConfig());
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [generatedAt, setGeneratedAt] = useState('');

  useEffect(() => {
    const sync = () => setConfig(loadPersistedAIProviderConfig());
    window.addEventListener(AI_PROVIDER_CONFIG_UPDATED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(AI_PROVIDER_CONFIG_UPDATED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const providerReady = useMemo(() => {
    const needsKey = isApiKeyRequired(config);
    if (!config.apiBaseUrl.trim() || !config.model.trim()) return false;
    if (needsKey && !config.apiKey.trim()) return false;
    return true;
  }, [config]);

  const handleGenerate = async () => {
    if (!providerReady) {
      setError(isZh ? '请先完成 AI 配置并填写有效 Key。' : 'Please configure AI provider and API key first.');
      setIsConfigOpen(true);
      return;
    }

    setIsGenerating(true);
    setError('');
    setResult('');

    try {
      const response = await fetch('/api/ai-assistant/analyze/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestType: 'interpret',
          language: isZh ? 'zh' : 'en',
          providerConfig: buildProviderConfigPayload(config, isZh),
          framework,
          controlContext: {
            requirement,
            assessmentStatus: assessment?.assessmentStatus || 'UNASSESSED',
            assessmentNotes: assessment?.notes || '',
          },
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || (isZh ? 'AI 解读失败。' : 'AI interpretation failed.'));
      }

      const analysis = typeof payload?.analysis === 'string' ? payload.analysis.trim() : '';
      if (!analysis) {
        throw new Error(isZh ? 'AI 返回为空，请重试。' : 'AI returned an empty result.');
      }
      setResult(analysis);
      setGeneratedAt(new Date().toISOString());
    } catch (interpreterError) {
      console.error('AI interpretation failed', interpreterError);
      setError(
        interpreterError instanceof Error
          ? interpreterError.message
          : isZh
            ? 'AI 解读失败，请稍后重试。'
            : 'AI interpretation failed. Please try again.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          setError('');
        }}
        className="inline-flex items-center rounded border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-medium text-cyan-700 hover:bg-cyan-100"
      >
        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
        {isZh ? 'AI解读' : 'AI Interpret'}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{isZh ? '控制项 AI 解读' : 'Control AI Interpretation'}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {framework.name} · {requirement.code}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                aria-label={isZh ? '关闭' : 'Close'}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-5 space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <span className="font-medium">{isZh ? '当前状态：' : 'Current status: '}</span>
                {assessment?.assessmentStatus || 'UNASSESSED'}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="inline-flex items-center rounded-lg bg-cyan-700 px-4 py-2 text-sm text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {isGenerating ? (isZh ? '解读中...' : 'Interpreting...') : isZh ? '生成解读' : 'Generate Interpretation'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfigOpen(true)}
                  className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Settings2 className="mr-2 h-4 w-4" />
                  {isZh ? 'AI配置' : 'AI Config'}
                </button>
                <span className="text-xs text-slate-500">
                  {isZh ? '解读使用全局 AI 配置。' : 'Interpretation uses global AI configuration.'}
                </span>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {result && (
                <div className="rounded-lg border border-cyan-200 bg-cyan-50/40 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-cyan-900">{isZh ? 'AI 解读结果' : 'AI Interpretation Result'}</h4>
                    {generatedAt && (
                      <span className="text-xs text-cyan-700">
                        {new Date(generatedAt).toLocaleString(isZh ? 'zh-CN' : 'en-US')}
                      </span>
                    )}
                  </div>
                  <pre className="whitespace-pre-wrap text-sm leading-6 text-slate-800 font-sans">{result}</pre>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onApplyToNotes(result)}
                      className="rounded-lg border border-cyan-300 bg-white px-3 py-2 text-sm text-cyan-800 hover:bg-cyan-50"
                    >
                      {isZh ? '写入评估备注' : 'Apply to Notes'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <AIProviderConfigModal
        isZh={isZh}
        isOpen={isConfigOpen}
        initialConfig={config}
        onClose={() => setIsConfigOpen(false)}
        onSave={(next) => {
          setConfig(next);
          persistAIProviderConfig(next);
        }}
      />
    </>
  );
}


'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Save, Sparkles, Settings2 } from 'lucide-react';
import type { AssessmentStatus } from '@/lib/assessment-model';

interface AssistantFrameworkInfo {
  id: string;
  name: string;
  version: string;
  type?: string;
  domain?: string;
}

interface AssistantSummary {
  assessedCount: number;
  totalRequirements: number;
  completionRate: number;
  averageAssessmentScore: number;
  maturityLevel: string;
}

interface AssistantRequirement {
  id: string;
  code: string;
  name: string;
  categoryName: string;
  subcategoryName: string;
  assessmentStatus: AssessmentStatus;
  notes: string;
}

type ProviderId =
  | 'openai'
  | 'anthropic'
  | 'ollama'
  | 'deepseek'
  | 'minimax'
  | 'kimi'
  | 'generic';

type ProviderProtocol = 'openai-compatible' | 'anthropic-messages' | 'ollama-chat';

interface ProviderPreset {
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

interface AssistantConfig {
  providerId: ProviderId;
  genericProtocol: ProviderProtocol;
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

interface BusinessContext {
  industry: string;
  organizationSize: string;
  currentState: string;
  annualBudget: string;
  annualKpi: string;
  targetGoals: string;
  timeline: string;
  constraints: string;
}

interface AIAssessmentAssistantProps {
  isZh: boolean;
  framework: AssistantFrameworkInfo;
  summary: AssistantSummary;
  assessmentStatusDistribution: Record<AssessmentStatus, number>;
  assessedRequirements: AssistantRequirement[];
}

interface ConnectionState {
  status: 'idle' | 'success' | 'error';
  message: string;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function markdownToHtml(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const html: string[] = [];
  let inUl = false;
  let inOl = false;
  let inTable = false;

  const closeListsAndTable = () => {
    if (inUl) {
      html.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      html.push('</ol>');
      inOl = false;
    }
    if (inTable) {
      html.push('</tbody></table>');
      inTable = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      closeListsAndTable();
      continue;
    }

    if (/^---+$/.test(line)) {
      closeListsAndTable();
      html.push('<hr />');
      continue;
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      closeListsAndTable();
      const level = headingMatch[1].length;
      const content = renderInline(escapeHtml(headingMatch[2]));
      html.push(`<h${level}>${content}</h${level}>`);
      continue;
    }

    if (line.startsWith('>')) {
      closeListsAndTable();
      const content = renderInline(escapeHtml(line.replace(/^>\s?/, '')));
      html.push(`<blockquote>${content}</blockquote>`);
      continue;
    }

    if (line.includes('|')) {
      const cells = line.split('|').map((x) => x.trim()).filter(Boolean);
      const separator = cells.every((c) => /^:?-{3,}:?$/.test(c));

      if (!separator && cells.length >= 2) {
        if (!inTable) {
          closeListsAndTable();
          inTable = true;
          html.push('<table><tbody>');
        }
        const isHeader = !html[html.length - 1].startsWith('<tr>');
        const tag = isHeader ? 'th' : 'td';
        const row = cells
          .map((cell) => `<${tag}>${renderInline(escapeHtml(cell))}</${tag}>`)
          .join('');
        html.push(`<tr>${row}</tr>`);
        continue;
      }
    }

    const ulMatch = line.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      if (!inUl) {
        closeListsAndTable();
        inUl = true;
        html.push('<ul>');
      }
      html.push(`<li>${renderInline(escapeHtml(ulMatch[1]))}</li>`);
      continue;
    }

    const olMatch = line.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      if (!inOl) {
        closeListsAndTable();
        inOl = true;
        html.push('<ol>');
      }
      html.push(`<li>${renderInline(escapeHtml(olMatch[1]))}</li>`);
      continue;
    }

    closeListsAndTable();
    html.push(`<p>${renderInline(escapeHtml(line))}</p>`);
  }

  closeListsAndTable();
  return html.join('\n');
}

const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'openai',
    protocol: 'openai-compatible',
    defaultApiBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    apiKeyRequired: true,
    labelZh: 'OpenAI 官方',
    labelEn: 'OpenAI Official',
    hintZh: '官方 OpenAI 接口（也可替换为国内中转 OpenAI 兼容地址）。',
    hintEn: 'Official OpenAI endpoint (or replace with OpenAI-compatible relay URL).',
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
    hintZh: 'MiniMax 或其兼容中转地址。',
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

const PROTOCOL_OPTIONS: Array<{ value: ProviderProtocol; labelZh: string; labelEn: string }> = [
  {
    value: 'openai-compatible',
    labelZh: 'OpenAI 兼容',
    labelEn: 'OpenAI Compatible',
  },
  {
    value: 'anthropic-messages',
    labelZh: 'Anthropic Messages',
    labelEn: 'Anthropic Messages',
  },
  {
    value: 'ollama-chat',
    labelZh: 'Ollama Chat',
    labelEn: 'Ollama Chat',
  },
];

const GENERIC_PROTOCOL_DEFAULTS: Record<ProviderProtocol, { apiBaseUrl: string; model: string; apiKeyRequired: boolean }> = {
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

const ASSISTANT_CONFIG_KEY = 'ai-assessment-assistant-config-v2';
const ASSISTANT_CONTEXT_KEY = 'ai-assessment-assistant-context-v1';

function getProviderPreset(providerId: ProviderId): ProviderPreset {
  return PROVIDER_PRESETS.find((provider) => provider.id === providerId) || PROVIDER_PRESETS[0];
}

function toProviderId(raw: string | undefined): ProviderId {
  if (!raw) return 'openai';
  const matched = PROVIDER_PRESETS.find((provider) => provider.id === raw);
  return matched ? matched.id : 'openai';
}

function toProtocol(raw: string | undefined, fallback: ProviderProtocol): ProviderProtocol {
  if (raw === 'openai-compatible' || raw === 'anthropic-messages' || raw === 'ollama-chat') {
    return raw;
  }
  return fallback;
}

const DEFAULT_CONFIG: AssistantConfig = {
  providerId: 'openai',
  genericProtocol: 'openai-compatible',
  apiBaseUrl: getProviderPreset('openai').defaultApiBaseUrl,
  apiKey: '',
  model: getProviderPreset('openai').defaultModel,
  temperature: 0.2,
  maxTokens: 1800,
};

const DEFAULT_CONTEXT: BusinessContext = {
  industry: '',
  organizationSize: '',
  currentState: '',
  annualBudget: '',
  annualKpi: '',
  targetGoals: '',
  timeline: '',
  constraints: '',
};

const GAP_STATUS_ORDER: Record<AssessmentStatus, number> = {
  NOT_STARTED: 0,
  IN_PROGRESS: 1,
  IMPLEMENTED: 2,
  VERIFIED_EFFECTIVE: 3,
  NOT_APPLICABLE: 4,
  UNASSESSED: 5,
};

function resolveProtocol(config: AssistantConfig): ProviderProtocol {
  if (config.providerId === 'generic') {
    return config.genericProtocol;
  }
  return getProviderPreset(config.providerId).protocol;
}

function isApiKeyRequired(config: AssistantConfig): boolean {
  if (config.providerId === 'generic') {
    return GENERIC_PROTOCOL_DEFAULTS[config.genericProtocol].apiKeyRequired;
  }
  return getProviderPreset(config.providerId).apiKeyRequired;
}

export default function AIAssessmentAssistant({
  isZh,
  framework,
  summary,
  assessmentStatusDistribution,
  assessedRequirements,
}: AIAssessmentAssistantProps) {
  const [config, setConfig] = useState<AssistantConfig>(DEFAULT_CONFIG);
  const [businessContext, setBusinessContext] = useState<BusinessContext>(DEFAULT_CONTEXT);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [error, setError] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [generatedAt, setGeneratedAt] = useState<string>('');
  const [connectionState, setConnectionState] = useState<ConnectionState>({ status: 'idle', message: '' });

  useEffect(() => {
    try {
      const rawConfig = localStorage.getItem(ASSISTANT_CONFIG_KEY);
      if (rawConfig) {
        const parsed = JSON.parse(rawConfig) as Partial<AssistantConfig>;
        const providerId = toProviderId(typeof parsed.providerId === 'string' ? parsed.providerId : undefined);
        const preset = getProviderPreset(providerId);
        const genericProtocol = toProtocol(
          typeof parsed.genericProtocol === 'string' ? parsed.genericProtocol : undefined,
          'openai-compatible'
        );

        setConfig((prev) => ({
          ...prev,
          providerId,
          genericProtocol,
          apiBaseUrl:
            typeof parsed.apiBaseUrl === 'string' && parsed.apiBaseUrl.trim()
              ? parsed.apiBaseUrl
              : providerId === 'generic'
                ? GENERIC_PROTOCOL_DEFAULTS[genericProtocol].apiBaseUrl
                : preset.defaultApiBaseUrl,
          model:
            typeof parsed.model === 'string' && parsed.model.trim()
              ? parsed.model
              : providerId === 'generic'
                ? GENERIC_PROTOCOL_DEFAULTS[genericProtocol].model
                : preset.defaultModel,
          temperature: typeof parsed.temperature === 'number' ? parsed.temperature : prev.temperature,
          maxTokens: typeof parsed.maxTokens === 'number' ? parsed.maxTokens : prev.maxTokens,
        }));
      }

      const rawBusinessContext = localStorage.getItem(ASSISTANT_CONTEXT_KEY);
      if (rawBusinessContext) {
        const parsedContext = JSON.parse(rawBusinessContext) as Partial<BusinessContext>;
        setBusinessContext((prev) => ({
          ...prev,
          ...Object.fromEntries(
            Object.entries(parsedContext).filter(([, value]) => typeof value === 'string')
          ),
        }));
      }
    } catch (loadError) {
      console.error('Failed to load AI assistant settings', loadError);
    }
  }, []);

  const activePreset = useMemo(() => getProviderPreset(config.providerId), [config.providerId]);
  const activeProtocol = resolveProtocol(config);
  const apiKeyRequired = isApiKeyRequired(config);

  const prioritizedGaps = useMemo(() => {
    return assessedRequirements
      .filter((item) => item.assessmentStatus === 'NOT_STARTED' || item.assessmentStatus === 'IN_PROGRESS')
      .sort((a, b) => GAP_STATUS_ORDER[a.assessmentStatus] - GAP_STATUS_ORDER[b.assessmentStatus])
      .slice(0, 20)
      .map((item) => ({
        code: item.code,
        name: item.name,
        categoryName: item.categoryName,
        subcategoryName: item.subcategoryName,
        assessmentStatus: item.assessmentStatus,
        notes: item.notes,
      }));
  }, [assessedRequirements]);

  const persistSettings = () => {
    try {
      // API key is intentionally not persisted.
      const { apiKey: _apiKey, ...safeConfig } = config;
      localStorage.setItem(ASSISTANT_CONFIG_KEY, JSON.stringify(safeConfig));
      localStorage.setItem(ASSISTANT_CONTEXT_KEY, JSON.stringify(businessContext));
      setError('');
    } catch (saveError) {
      console.error('Failed to save AI assistant settings', saveError);
      setError(isZh ? '保存配置失败，请重试。' : 'Failed to save settings.');
    }
  };

  const validateProviderConfig = (): string | null => {
    if (!config.apiBaseUrl.trim()) {
      return isZh ? '请填写 API 地址。' : 'Please provide API base URL.';
    }
    if (!config.model.trim()) {
      return isZh ? '请填写模型名称。' : 'Please provide a model.';
    }
    if (apiKeyRequired && !config.apiKey.trim()) {
      return isZh ? '请填写 API Key。' : 'Please provide API key.';
    }
    return null;
  };

  const buildProviderConfigPayload = () => ({
    providerId: config.providerId,
    providerName: isZh ? activePreset.labelZh : activePreset.labelEn,
    protocol: activeProtocol,
    apiBaseUrl: config.apiBaseUrl.trim(),
    apiKey: config.apiKey.trim(),
    model: config.model.trim(),
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    requiresApiKey: apiKeyRequired,
  });

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
          providerConfig: buildProviderConfigPayload(),
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

  const handleGenerate = async () => {
    const validationError = validateProviderConfig();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const response = await fetch('/api/ai-assistant/analyze/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestType: 'analysis',
          language: isZh ? 'zh' : 'en',
          providerConfig: buildProviderConfigPayload(),
          framework,
          reportSummary: summary,
          assessmentStatusDistribution,
          prioritizedGaps,
          businessContext,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || (isZh ? 'AI 分析失败。' : 'AI analysis failed.'));
      }

      const analysis = typeof payload?.analysis === 'string' ? payload.analysis.trim() : '';
      if (!analysis) {
        throw new Error(isZh ? 'AI 返回为空，请调整输入后重试。' : 'AI returned an empty result.');
      }

      setAnalysisResult(analysis);
      setGeneratedAt(new Date().toISOString());
    } catch (generateError) {
      console.error('AI analysis failed', generateError);
      setError(
        generateError instanceof Error
          ? generateError.message
          : isZh
            ? '分析失败，请重试。'
            : 'Failed to generate analysis.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportHtml = () => {
    if (!analysisResult) {
      setError(isZh ? '请先生成 AI 评估方案。' : 'Please generate AI analysis first.');
      return;
    }

    const summaryLabels = isZh
      ? {
          perspective: '报告视角',
          framework: '框架',
          completion: '评估覆盖率',
          score: '状态指数',
          maturity: '成熟度',
          generated: '生成时间',
          perspectiveValue: 'CISO / 安全总监视角（V1）',
          distribution: '评估状态分布',
          analysis: 'AI 评估方案',
        }
      : {
          perspective: 'Perspective',
          framework: 'Framework',
          completion: 'Coverage',
          score: 'Status Index',
          maturity: 'Maturity',
          generated: 'Generated At',
          perspectiveValue: 'CISO / Security Director (V1)',
          distribution: 'Assessment Status Distribution',
          analysis: 'AI Assessment Plan',
        };

    const statusLabelMap: Record<AssessmentStatus, string> = isZh
      ? {
          UNASSESSED: '未评估',
          NOT_APPLICABLE: '不适用',
          NOT_STARTED: '未启动',
          IN_PROGRESS: '进行中',
          IMPLEMENTED: '已实施',
          VERIFIED_EFFECTIVE: '已验证有效',
        }
      : {
          UNASSESSED: 'Unassessed',
          NOT_APPLICABLE: 'Not Applicable',
          NOT_STARTED: 'Not Started',
          IN_PROGRESS: 'In Progress',
          IMPLEMENTED: 'Implemented',
          VERIFIED_EFFECTIVE: 'Verified Effective',
        };

    const generatedText = generatedAt
      ? new Date(generatedAt).toLocaleString(isZh ? 'zh-CN' : 'en-US')
      : new Date().toLocaleString(isZh ? 'zh-CN' : 'en-US');

    const distributionHtml = Object.entries(assessmentStatusDistribution)
      .map(
        ([status, count]) =>
          `<tr><td>${escapeHtml(statusLabelMap[status as AssessmentStatus] || status)}</td><td>${count}</td></tr>`
      )
      .join('');

    const analysisHtml = markdownToHtml(analysisResult);

    const html = `<!doctype html>
<html lang="${isZh ? 'zh-CN' : 'en'}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(framework.name)} - AI Assessment Report</title>
  <style>
    :root {
      --bg: #f4f8fb;
      --card: #ffffff;
      --text: #0f172a;
      --muted: #475569;
      --border: #dbe7f0;
      --accent: #0e7490;
      --accent-soft: #ecfeff;
      --shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      color: var(--text);
      background: linear-gradient(135deg, #e6f3ff 0%, #f8fdff 40%, #f4f8fb 100%);
      line-height: 1.6;
      padding: 32px 20px;
    }
    .container { max-width: 1060px; margin: 0 auto; }
    .hero {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      box-shadow: var(--shadow);
      margin-bottom: 18px;
    }
    .hero h1 { margin: 0 0 8px; font-size: 28px; }
    .hero p { margin: 0; color: var(--muted); }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
      margin-top: 16px;
    }
    .meta-card {
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--accent-soft);
      padding: 12px;
    }
    .meta-label { font-size: 12px; color: var(--muted); margin-bottom: 6px; }
    .meta-value { font-size: 16px; font-weight: 700; }
    .section {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      box-shadow: var(--shadow);
      padding: 22px;
      margin-top: 16px;
    }
    h2 { margin: 0 0 14px; font-size: 20px; color: #0b4a5d; }
    h3 { margin: 18px 0 10px; font-size: 17px; color: #0b4a5d; }
    h4 { margin: 14px 0 8px; font-size: 15px; }
    p { margin: 8px 0; }
    blockquote {
      margin: 10px 0;
      padding: 8px 12px;
      border-left: 4px solid #22d3ee;
      background: #ecfeff;
      color: #164e63;
    }
    code {
      background: #e2e8f0;
      border-radius: 6px;
      padding: 1px 6px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
      font-size: 14px;
    }
    th, td {
      border: 1px solid var(--border);
      padding: 8px 10px;
      vertical-align: top;
      text-align: left;
    }
    th { background: #f0f9ff; }
    ul, ol { margin: 8px 0 8px 20px; }
    hr {
      border: 0;
      border-top: 1px dashed #bfd8e8;
      margin: 16px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <section class="hero">
      <h1>${escapeHtml(isZh ? 'AI 安全评估报告' : 'AI Security Assessment Report')}</h1>
      <p>${escapeHtml(framework.name)} ${escapeHtml(framework.version || '')}</p>
      <div class="meta-grid">
        <div class="meta-card"><div class="meta-label">${summaryLabels.perspective}</div><div class="meta-value">${summaryLabels.perspectiveValue}</div></div>
        <div class="meta-card"><div class="meta-label">${summaryLabels.framework}</div><div class="meta-value">${escapeHtml(framework.name)}</div></div>
        <div class="meta-card"><div class="meta-label">${summaryLabels.completion}</div><div class="meta-value">${summary.completionRate}% (${summary.assessedCount}/${summary.totalRequirements})</div></div>
        <div class="meta-card"><div class="meta-label">${summaryLabels.score}</div><div class="meta-value">${summary.averageAssessmentScore}</div></div>
        <div class="meta-card"><div class="meta-label">${summaryLabels.maturity}</div><div class="meta-value">${escapeHtml(summary.maturityLevel)}</div></div>
        <div class="meta-card"><div class="meta-label">${summaryLabels.generated}</div><div class="meta-value">${escapeHtml(generatedText)}</div></div>
      </div>
    </section>

    <section class="section">
      <h2>${summaryLabels.distribution}</h2>
      <table>
        <thead><tr><th>${isZh ? '状态' : 'Status'}</th><th>${isZh ? '数量' : 'Count'}</th></tr></thead>
        <tbody>${distributionHtml}</tbody>
      </table>
    </section>

    <section class="section">
      <h2>${summaryLabels.analysis}</h2>
      ${analysisHtml}
    </section>
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${framework.id}-ai-assessment-report-${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-700" />
            {isZh ? 'AI 安全评估助手' : 'AI Security Assessment Assistant'}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {isZh
              ? '基于当前框架评估结果与企业背景，生成分阶段、可执行的改进方案。'
              : 'Generate phased and actionable plans from current assessment results and business context.'}
          </p>
        </div>
        <button
          type="button"
          onClick={persistSettings}
          className="inline-flex items-center px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          <Save className="w-4 h-4 mr-2" />
          {isZh ? '保存配置' : 'Save'}
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 p-4 space-y-4">
        <div className="text-sm font-medium text-gray-800 flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-gray-500" />
          {isZh ? 'AI 接入配置' : 'AI Provider Configuration'}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm text-gray-700">
            <span className="block mb-1">{isZh ? '提供商' : 'Provider'}</span>
            <select
              value={config.providerId}
              onChange={(event) => {
                const providerId = toProviderId(event.target.value);
                const preset = getProviderPreset(providerId);

                setConfig((prev) => ({
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

                setConnectionState({ status: 'idle', message: '' });
                setError('');
              }}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {PROVIDER_PRESETS.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {isZh ? provider.labelZh : provider.labelEn}
                </option>
              ))}
            </select>
            <span className="text-xs text-gray-500 mt-1 block">
              {isZh ? activePreset.hintZh : activePreset.hintEn}
            </span>
          </label>

          {config.providerId === 'generic' && (
            <label className="text-sm text-gray-700">
              <span className="block mb-1">{isZh ? '协议类型' : 'Protocol'}</span>
              <select
                value={config.genericProtocol}
                onChange={(event) => {
                  const protocol = toProtocol(event.target.value, config.genericProtocol);
                  const defaults = GENERIC_PROTOCOL_DEFAULTS[protocol];
                  setConfig((prev) => ({
                    ...prev,
                    genericProtocol: protocol,
                    apiBaseUrl: defaults.apiBaseUrl,
                    model: defaults.model,
                    apiKey: defaults.apiKeyRequired ? prev.apiKey : '',
                  }));
                  setConnectionState({ status: 'idle', message: '' });
                  setError('');
                }}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {PROTOCOL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {isZh ? option.labelZh : option.labelEn}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="text-sm text-gray-700">
            <span className="block mb-1">{isZh ? 'API 地址' : 'API Base URL'}</span>
            <input
              value={config.apiBaseUrl}
              onChange={(event) => setConfig((prev) => ({ ...prev, apiBaseUrl: event.target.value }))}
              placeholder={activePreset.defaultApiBaseUrl}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </label>

          <label className="text-sm text-gray-700">
            <span className="block mb-1">{isZh ? '模型' : 'Model'}</span>
            <input
              value={config.model}
              onChange={(event) => setConfig((prev) => ({ ...prev, model: event.target.value }))}
              placeholder={activePreset.defaultModel}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </label>

          <label className="text-sm text-gray-700 md:col-span-2">
            <span className="block mb-1">
              API Key
              {apiKeyRequired ? '' : isZh ? '（可选）' : ' (Optional)'}
            </span>
            <input
              type="password"
              value={config.apiKey}
              onChange={(event) => setConfig((prev) => ({ ...prev, apiKey: event.target.value }))}
              placeholder={apiKeyRequired ? 'sk-...' : isZh ? '本地模型可留空' : 'Can be empty for local models'}
              autoComplete="off"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <span className="text-xs text-gray-500 mt-1 block">
              {isZh
                ? '安全提示：API Key 仅保存在当前页面内存中，不会写入本地存储。'
                : 'Security note: API key stays in memory for this page and is not persisted.'}
            </span>
          </label>

          <label className="text-sm text-gray-700">
            <span className="block mb-1">Temperature</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.1}
              value={config.temperature}
              onChange={(event) => {
                const value = Number(event.target.value);
                setConfig((prev) => ({ ...prev, temperature: Number.isFinite(value) ? value : prev.temperature }));
              }}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </label>
          <label className="text-sm text-gray-700">
            <span className="block mb-1">{isZh ? '最大输出 Token' : 'Max Output Tokens'}</span>
            <input
              type="number"
              min={400}
              max={4000}
              step={100}
              value={config.maxTokens}
              onChange={(event) => {
                const value = Number(event.target.value);
                setConfig((prev) => ({ ...prev, maxTokens: Number.isFinite(value) ? value : prev.maxTokens }));
              }}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </label>
        </div>

        <div className="flex items-center flex-wrap gap-3">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTestingConnection}
            className="inline-flex items-center px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isTestingConnection ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            {isTestingConnection
              ? isZh
                ? '测试中...'
                : 'Testing...'
              : isZh
                ? '测试连接'
                : 'Test Connection'}
          </button>

          {connectionState.status !== 'idle' && (
            <span
              className={`text-sm ${
                connectionState.status === 'success' ? 'text-green-700' : 'text-red-700'
              }`}
            >
              {connectionState.message}
            </span>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 p-4 space-y-4">
        <div className="text-sm font-medium text-gray-800">
          {isZh ? '企业画像与目标输入' : 'Enterprise Context Input'}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm text-gray-700">
            <span className="block mb-1">{isZh ? '行业' : 'Industry'}</span>
            <input
              value={businessContext.industry}
              onChange={(event) => setBusinessContext((prev) => ({ ...prev, industry: event.target.value }))}
              placeholder={isZh ? '如：金融、互联网、制造' : 'e.g. finance, internet, manufacturing'}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </label>
          <label className="text-sm text-gray-700">
            <span className="block mb-1">{isZh ? '企业规模' : 'Organization Size'}</span>
            <input
              value={businessContext.organizationSize}
              onChange={(event) => setBusinessContext((prev) => ({ ...prev, organizationSize: event.target.value }))}
              placeholder={isZh ? '如：500人，3个研发中心' : 'e.g. 500 staff, 3 R&D centers'}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </label>
          <label className="text-sm text-gray-700 md:col-span-2">
            <span className="block mb-1">{isZh ? '当前安全现状' : 'Current Security Posture'}</span>
            <textarea
              value={businessContext.currentState}
              onChange={(event) => setBusinessContext((prev) => ({ ...prev, currentState: event.target.value }))}
              rows={3}
              placeholder={isZh ? '已上线能力、痛点、主要风险...' : 'Current capabilities, pain points, key risks...'}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </label>
          <label className="text-sm text-gray-700">
            <span className="block mb-1">{isZh ? '年度预算' : 'Annual Budget'}</span>
            <input
              value={businessContext.annualBudget}
              onChange={(event) => setBusinessContext((prev) => ({ ...prev, annualBudget: event.target.value }))}
              placeholder={isZh ? '如：300万人民币' : 'e.g. USD 400k'}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </label>
          <label className="text-sm text-gray-700">
            <span className="block mb-1">{isZh ? '年度 KPI' : 'Annual KPI'}</span>
            <input
              value={businessContext.annualKpi}
              onChange={(event) => setBusinessContext((prev) => ({ ...prev, annualKpi: event.target.value }))}
              placeholder={isZh ? '如：覆盖率80%，高危项整改率95%' : 'e.g. 80% coverage, 95% high-risk remediation'}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </label>
          <label className="text-sm text-gray-700 md:col-span-2">
            <span className="block mb-1">{isZh ? '目标与期望达成结果' : 'Target Outcomes'}</span>
            <textarea
              value={businessContext.targetGoals}
              onChange={(event) => setBusinessContext((prev) => ({ ...prev, targetGoals: event.target.value }))}
              rows={3}
              placeholder={isZh ? '如：通过等保三级测评、降低重大事件概率...' : 'e.g. achieve compliance baseline, reduce major incidents...'}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </label>
          <label className="text-sm text-gray-700">
            <span className="block mb-1">{isZh ? '目标周期' : 'Timeline'}</span>
            <input
              value={businessContext.timeline}
              onChange={(event) => setBusinessContext((prev) => ({ ...prev, timeline: event.target.value }))}
              placeholder={isZh ? '如：6个月/12个月' : 'e.g. 6 months / 12 months'}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </label>
          <label className="text-sm text-gray-700">
            <span className="block mb-1">{isZh ? '约束条件' : 'Constraints'}</span>
            <input
              value={businessContext.constraints}
              onChange={(event) => setBusinessContext((prev) => ({ ...prev, constraints: event.target.value }))}
              placeholder={isZh ? '如：人力紧张、业务不停机' : 'e.g. limited staffing, no downtime'}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
          className="inline-flex items-center px-4 py-2 bg-cyan-700 text-white rounded-lg hover:bg-cyan-800 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
          {isGenerating
            ? isZh
              ? 'AI 分析中...'
              : 'Analyzing...'
            : isZh
              ? '生成 AI 评估方案'
              : 'Generate AI Plan'}
        </button>
        <span className="text-xs text-gray-500">
          {isZh
            ? '将使用当前框架评估状态分布 + 差距项 + 企业输入生成方案。'
            : 'Uses current framework status distribution + gap items + enterprise context.'}
        </span>
        {analysisResult && (
          <button
            type="button"
            onClick={handleExportHtml}
            className="inline-flex items-center px-4 py-2 bg-white border border-cyan-300 text-cyan-800 rounded-lg hover:bg-cyan-50"
          >
            {isZh ? '导出 HTML 报告' : 'Export HTML Report'}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {analysisResult && (
        <div className="rounded-lg border border-cyan-200 bg-cyan-50/40 p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold text-cyan-900">{isZh ? 'AI 分析输出' : 'AI Analysis'}</h4>
            {generatedAt && (
              <span className="text-xs text-cyan-700">
                {isZh ? '生成时间：' : 'Generated at: '}
                {new Date(generatedAt).toLocaleString(isZh ? 'zh-CN' : 'en-US')}
              </span>
            )}
          </div>
          <pre className="text-sm text-gray-800 whitespace-pre-wrap leading-6 font-sans">{analysisResult}</pre>
        </div>
      )}
    </div>
  );
}

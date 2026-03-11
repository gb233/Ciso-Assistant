import { NextRequest, NextResponse } from 'next/server';

type ProviderProtocol = 'openai-compatible' | 'anthropic-messages' | 'ollama-chat';

type ChatCompletionContentPart = {
  type?: string;
  text?: string;
};

type OpenAICompatibleResponse = {
  choices?: Array<{
    message?: {
      content?: string | ChatCompletionContentPart[];
    };
  }>;
  error?: {
    message?: string;
  };
};

type AnthropicResponse = {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
  error?: {
    message?: string;
  };
};

type OllamaResponse = {
  message?: {
    content?: string;
  };
  response?: string;
  error?: string;
};

interface ProviderConfig {
  providerId?: string;
  providerName?: string;
  protocol?: ProviderProtocol;
  apiBaseUrl: string;
  apiKey?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  requiresApiKey?: boolean;
}

type RequestType = 'analysis' | 'connection-test';

interface ProviderCallResult {
  content: string;
  rawText: string;
}

function resolveOpenAICompatibleUrl(rawBase: string): string {
  const trimmed = rawBase.trim().replace(/\/+$/, '');

  if (trimmed.endsWith('/chat/completions')) {
    return trimmed;
  }

  if (/\/v\d+$/.test(trimmed)) {
    return `${trimmed}/chat/completions`;
  }

  return `${trimmed}/v1/chat/completions`;
}

function resolveAnthropicMessagesUrl(rawBase: string): string {
  const trimmed = rawBase.trim().replace(/\/+$/, '');

  if (trimmed.endsWith('/v1/messages')) {
    return trimmed;
  }

  if (trimmed.endsWith('/v1')) {
    return `${trimmed}/messages`;
  }

  return `${trimmed}/v1/messages`;
}

function resolveOllamaChatUrl(rawBase: string): string {
  const trimmed = rawBase.trim().replace(/\/+$/, '');

  if (trimmed.endsWith('/api/chat')) {
    return trimmed;
  }

  if (trimmed.endsWith('/api')) {
    return `${trimmed}/chat`;
  }

  return `${trimmed}/api/chat`;
}

function extractOpenAICompatibleContent(payload: OpenAICompatibleResponse): string {
  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (part && typeof part.text === 'string' ? part.text : ''))
      .join('\n')
      .trim();
  }

  return '';
}

function extractAnthropicContent(payload: AnthropicResponse): string {
  if (!Array.isArray(payload?.content)) {
    return '';
  }

  return payload.content
    .map((part) => (part && typeof part.text === 'string' ? part.text : ''))
    .join('\n')
    .trim();
}

function extractOllamaContent(payload: OllamaResponse): string {
  if (typeof payload?.message?.content === 'string') {
    return payload.message.content.trim();
  }

  if (typeof payload?.response === 'string') {
    return payload.response.trim();
  }

  return '';
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function pickProtocol(raw: unknown): ProviderProtocol {
  if (raw === 'anthropic-messages' || raw === 'ollama-chat' || raw === 'openai-compatible') {
    return raw;
  }
  return 'openai-compatible';
}

function pickRequestType(raw: unknown): RequestType {
  return raw === 'connection-test' ? 'connection-test' : 'analysis';
}

async function callOpenAICompatible(
  providerConfig: ProviderConfig,
  systemPrompt: string,
  instruction: string,
  temperature: number,
  maxTokens: number
): Promise<ProviderCallResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (providerConfig.apiKey?.trim()) {
    headers.Authorization = `Bearer ${providerConfig.apiKey.trim()}`;
  }

  const upstreamResponse = await fetch(resolveOpenAICompatibleUrl(providerConfig.apiBaseUrl), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: providerConfig.model.trim(),
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: instruction },
      ],
    }),
    cache: 'no-store',
  });

  const upstreamText = await upstreamResponse.text();
  const upstreamJson = parseJson<OpenAICompatibleResponse>(upstreamText);

  if (!upstreamResponse.ok) {
    const upstreamMessage =
      upstreamJson?.error?.message ||
      upstreamText ||
      `Upstream request failed with status ${upstreamResponse.status}`;
    throw new Error(`AI provider error (${upstreamResponse.status}): ${upstreamMessage}`);
  }

  const content = upstreamJson ? extractOpenAICompatibleContent(upstreamJson) : '';
  if (!content) {
    throw new Error('AI provider returned an empty response.');
  }

  return { content, rawText: upstreamText };
}

async function callAnthropicMessages(
  providerConfig: ProviderConfig,
  systemPrompt: string,
  instruction: string,
  temperature: number,
  maxTokens: number
): Promise<ProviderCallResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
  };

  if (providerConfig.apiKey?.trim()) {
    headers['x-api-key'] = providerConfig.apiKey.trim();
  }

  const upstreamResponse = await fetch(resolveAnthropicMessagesUrl(providerConfig.apiBaseUrl), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: providerConfig.model.trim(),
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: instruction,
            },
          ],
        },
      ],
    }),
    cache: 'no-store',
  });

  const upstreamText = await upstreamResponse.text();
  const upstreamJson = parseJson<AnthropicResponse>(upstreamText);

  if (!upstreamResponse.ok) {
    const upstreamMessage =
      upstreamJson?.error?.message ||
      upstreamText ||
      `Upstream request failed with status ${upstreamResponse.status}`;
    throw new Error(`AI provider error (${upstreamResponse.status}): ${upstreamMessage}`);
  }

  const content = upstreamJson ? extractAnthropicContent(upstreamJson) : '';
  if (!content) {
    throw new Error('AI provider returned an empty response.');
  }

  return { content, rawText: upstreamText };
}

async function callOllamaChat(
  providerConfig: ProviderConfig,
  systemPrompt: string,
  instruction: string,
  temperature: number,
  maxTokens: number
): Promise<ProviderCallResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (providerConfig.apiKey?.trim()) {
    headers.Authorization = `Bearer ${providerConfig.apiKey.trim()}`;
  }

  const upstreamResponse = await fetch(resolveOllamaChatUrl(providerConfig.apiBaseUrl), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: providerConfig.model.trim(),
      stream: false,
      options: {
        temperature,
        num_predict: maxTokens,
      },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: instruction },
      ],
    }),
    cache: 'no-store',
  });

  const upstreamText = await upstreamResponse.text();
  const upstreamJson = parseJson<OllamaResponse>(upstreamText);

  if (!upstreamResponse.ok) {
    const upstreamMessage =
      upstreamJson?.error || upstreamText || `Upstream request failed with status ${upstreamResponse.status}`;
    throw new Error(`AI provider error (${upstreamResponse.status}): ${upstreamMessage}`);
  }

  const content = upstreamJson ? extractOllamaContent(upstreamJson) : '';
  if (!content) {
    throw new Error('AI provider returned an empty response.');
  }

  return { content, rawText: upstreamText };
}

async function callProvider(
  protocol: ProviderProtocol,
  providerConfig: ProviderConfig,
  systemPrompt: string,
  instruction: string,
  temperature: number,
  maxTokens: number
): Promise<ProviderCallResult> {
  if (protocol === 'anthropic-messages') {
    return callAnthropicMessages(providerConfig, systemPrompt, instruction, temperature, maxTokens);
  }

  if (protocol === 'ollama-chat') {
    return callOllamaChat(providerConfig, systemPrompt, instruction, temperature, maxTokens);
  }

  return callOpenAICompatible(providerConfig, systemPrompt, instruction, temperature, maxTokens);
}

function buildPrompts(
  requestType: RequestType,
  language: 'zh' | 'en',
  payload: {
    framework: unknown;
    reportSummary: unknown;
    assessmentStatusDistribution: unknown;
    prioritizedGaps: unknown[];
    businessContext: unknown;
  }
): { systemPrompt: string; instruction: string } {
  if (requestType === 'connection-test') {
    return {
      systemPrompt:
        language === 'zh'
          ? '你是连接测试助手。只返回最简洁结果。'
          : 'You are a connectivity test assistant. Return a concise response only.',
      instruction:
        language === 'zh'
          ? '连接测试：如果你收到此消息，请仅回复 CONNECTED。'
          : 'Connectivity test: if you can read this, reply with CONNECTED only.',
    };
  }

  const systemPrompt =
    language === 'zh'
      ? '你是一名资深网络安全合规与治理专家。请以 CISO/安全总监决策视角输出，强调业务风险、预算权衡、治理优先级，同时给出可执行落地清单。输出必须结构化并引用用户提供的评估现状。'
      : 'You are a senior cybersecurity compliance and governance expert. Write from a CISO/Security Director decision perspective, focusing on business risk, governance priorities, and budget trade-offs while providing execution-ready actions grounded in the provided assessment data.';

  const instruction =
    language === 'zh'
      ? [
          '请基于以下输入生成详细分析，使用 Markdown 输出，并严格包含这些小节：',
          '1) 关键结论（3-5条）',
          '2) 主要差距与根因（按优先级）',
          '3) 90天行动计划（按周或阶段，列出责任角色/预期产出）',
          '4) 6-12个月路线图（能力建设、流程、技术、组织）',
          '5) 预算分配建议（按人力/工具/服务）',
          '6) KPI与里程碑（可量化指标）',
          '7) 主要风险与缓解策略',
          '8) 下一步立即执行清单（10条以内）',
          '',
          '要求：',
          '- 必须结合框架类型和当前评估状态分布。',
          '- 优先处理 NOT_STARTED 和 IN_PROGRESS 差距项。',
          '- 对预算和资源约束给出权衡方案。',
          '- 结论要具体，避免泛泛而谈。',
          '',
          '输入数据（JSON）：',
          JSON.stringify(payload, null, 2),
        ].join('\n')
      : [
          'Generate a detailed analysis in Markdown with these mandatory sections:',
          '1) Key Findings (3-5)',
          '2) Priority Gaps and Root Causes',
          '3) 90-day Execution Plan (phase, owner role, deliverables)',
          '4) 6-12 Month Roadmap (capability/process/tech/organization)',
          '5) Budget Allocation Guidance (people/tools/services)',
          '6) KPI and Milestones (quantifiable)',
          '7) Risks and Mitigations',
          '8) Immediate Next Actions (max 10)',
          '',
          'Requirements:',
          '- Tie recommendations to framework context and status distribution.',
          '- Prioritize NOT_STARTED and IN_PROGRESS gaps.',
          '- Include trade-offs based on budget/resource constraints.',
          '- Be specific and implementation-oriented.',
          '',
          'Input JSON:',
          JSON.stringify(payload, null, 2),
        ].join('\n');

  return { systemPrompt, instruction };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const requestType = pickRequestType(body?.requestType);
    const language = body?.language === 'en' ? 'en' : 'zh';
    const providerConfig = (body?.providerConfig || {}) as ProviderConfig;
    const protocol = pickProtocol(providerConfig.protocol);

    if (!providerConfig.apiBaseUrl?.trim()) {
      return NextResponse.json({ error: 'Missing providerConfig.apiBaseUrl' }, { status: 400 });
    }
    if (!providerConfig.model?.trim()) {
      return NextResponse.json({ error: 'Missing providerConfig.model' }, { status: 400 });
    }

    const requiresApiKey =
      typeof providerConfig.requiresApiKey === 'boolean'
        ? providerConfig.requiresApiKey
        : protocol !== 'ollama-chat';

    if (requiresApiKey && !providerConfig.apiKey?.trim()) {
      return NextResponse.json({ error: 'Missing providerConfig.apiKey' }, { status: 400 });
    }

    const framework = body?.framework || {};
    const reportSummary = body?.reportSummary || {};
    const assessmentStatusDistribution = body?.assessmentStatusDistribution || {};
    const prioritizedGaps = Array.isArray(body?.prioritizedGaps) ? body.prioritizedGaps : [];
    const businessContext = body?.businessContext || {};

    const payload = {
      framework,
      reportSummary,
      assessmentStatusDistribution,
      prioritizedGaps,
      businessContext,
    };

    const { systemPrompt, instruction } = buildPrompts(requestType, language, payload);

    const temperature = clamp(Number(providerConfig.temperature ?? 0.2), 0, 1, 0.2);
    const maxTokens = clamp(Number(providerConfig.maxTokens ?? 1800), 200, 4000, 1800);

    const { content } = await callProvider(
      protocol,
      providerConfig,
      systemPrompt,
      instruction,
      temperature,
      maxTokens
    );

    if (requestType === 'connection-test') {
      return NextResponse.json({
        ok: true,
        message:
          language === 'zh'
            ? `连接成功，模型返回：${content}`
            : `Connection succeeded. Model reply: ${content}`,
        provider: providerConfig.providerId || 'custom',
        model: providerConfig.model.trim(),
      });
    }

    return NextResponse.json({
      analysis: content,
      provider: providerConfig.providerId || 'custom',
      model: providerConfig.model.trim(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request payload or unexpected server error.';
    console.error('AI assistant analyze failed:', error);
    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 }
    );
  }
}

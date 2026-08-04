import {
  PlanPreviewResponseSchema,
  type PlanPreviewInvalidInputResponse,
  type PlanPreviewInvalidRequestResponse,
  type PlanPreviewRequest,
  type PlanPreviewSuccessResponse,
} from '@today-dont-push/contracts';

export interface PlanPreviewClientOptions {
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  readonly fetchImpl?: typeof fetch;
}

export type PlanPreviewClientResult =
  | {
      readonly kind: 'success';
      readonly response: PlanPreviewSuccessResponse;
    }
  | {
      readonly kind: 'invalid_request';
      readonly response: PlanPreviewInvalidRequestResponse;
    }
  | {
      readonly kind: 'invalid_input';
      readonly response: PlanPreviewInvalidInputResponse;
    }
  | {
      readonly kind: 'network_error' | 'timeout' | 'client_error' | 'http_error';
      readonly message: string;
      readonly status?: number;
    };

export type PlanPreviewClient = (
  request: PlanPreviewRequest,
) => Promise<PlanPreviewClientResult>;

const DEFAULT_TIMEOUT_MS = 8_000;

function getApiBaseUrl(explicitBaseUrl?: string): string {
  const configured = explicitBaseUrl ?? import.meta.env.VITE_API_BASE_URL ?? '';
  return configured.replace(/\/$/, '');
}

function buildEndpoint(baseUrl: string): string {
  return baseUrl.length > 0 ? `${baseUrl}/v1/plans/preview` : '/v1/plans/preview';
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function parseJsonSafely(payload: string): unknown {
  return JSON.parse(payload);
}

export async function previewDailyPlan(
  request: PlanPreviewRequest,
  options: PlanPreviewClientOptions = {},
): Promise<PlanPreviewClientResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const baseUrl = getApiBaseUrl(options.baseUrl);
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(buildEndpoint(baseUrl), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type') ?? '';
    const rawText = await response.text();

    if (response.status !== 200 && response.status !== 400 && response.status !== 422) {
      return {
        kind: 'http_error',
        status: response.status,
        message:
          response.status === 413
            ? '这次填写的内容有点多，先删减一点再试。'
            : '服务暂时没有给出可用结果，请稍后再试。',
      };
    }

    if (!contentType.includes('application/json')) {
      return {
        kind: 'client_error',
        message: '服务返回的内容看不懂，请稍后再试。',
      };
    }

    let json: unknown;
    try {
      json = parseJsonSafely(rawText);
    } catch {
      return {
        kind: 'client_error',
        message: '服务返回的内容格式不完整，请稍后再试。',
      };
    }

    const parsed = PlanPreviewResponseSchema.safeParse(json);
    if (!parsed.success) {
      return {
        kind: 'client_error',
        message: '服务返回的结果和公开契约不一致，请稍后再试。',
      };
    }

    if (response.status === 200 && parsed.data.status === 'ok') {
      return { kind: 'success', response: parsed.data };
    }
    if (response.status === 400 && parsed.data.status === 'invalid_request') {
      return { kind: 'invalid_request', response: parsed.data };
    }
    if (response.status === 422 && parsed.data.status === 'invalid_input') {
      return { kind: 'invalid_input', response: parsed.data };
    }

    return {
      kind: 'client_error',
      message: '服务返回的状态和内容对不上，请稍后再试。',
    };
  } catch (error) {
    if (isAbortError(error)) {
      return {
        kind: 'timeout',
        message: '这次等待有点久，我们先停一下，稍后再试。',
      };
    }
    return {
      kind: 'network_error',
      message: '暂时连不上服务，请确认前后端都已启动后重试。',
    };
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

const DEFAULT_ALLOWED_ORIGIN = 'http://127.0.0.1:5173';
const FEISHU_BASE_URL = 'https://open.feishu.cn/open-apis';
const PRIORITIES = ['不着急', '正常', '有点急', '十万火急！'];
const MAX_CONTENT_LENGTH = 5000;
const MAX_SHORT_TEXT_LENGTH = 200;

export const FEISHU_FIELDS = {
  content: '需求内容',
  requesterName: '你的名字',
  deadline: 'Deadline',
  priority: '优先级',
  status: '状态'
};

export default {
  async fetch(request, env) {
    const corsHeaders = getCorsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);
    if (url.pathname !== '/api/requests') {
      return jsonResponse({ success: false, error: 'METHOD_NOT_ALLOWED' }, 404, corsHeaders);
    }

    if (request.method !== 'POST') {
      return jsonResponse({ success: false, error: 'METHOD_NOT_ALLOWED' }, 405, corsHeaders);
    }

    const body = await safeReadJson(request);
    const payload = validateRequestPayload(body);

    if (!payload) {
      return jsonResponse({ success: false, error: 'INVALID_PAYLOAD' }, 400, corsHeaders);
    }

    try {
      await createFeishuRecord(payload, env);
      return jsonResponse({ success: true }, 200, corsHeaders);
    } catch (error) {
      console.error('Submission failed', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      return jsonResponse({ success: false, error: 'SUBMISSION_FAILED' }, 502, corsHeaders);
    }
  }
};

function getCorsHeaders(request, env) {
  const allowedOrigin = env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN;
  const requestOrigin = request.headers.get('Origin');
  const origin = requestOrigin === allowedOrigin ? allowedOrigin : allowedOrigin;

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

function jsonResponse(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}

export async function safeReadJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function validateRequestPayload(input) {
  if (!isRecord(input)) {
    return null;
  }

  const content = normalizeRequiredString(input.content, MAX_CONTENT_LENGTH);
  if (!content) {
    return null;
  }

  const requesterName = normalizeOptionalString(input.requesterName, MAX_SHORT_TEXT_LENGTH);
  const deadline = normalizeOptionalString(input.deadline, MAX_SHORT_TEXT_LENGTH);
  const priority = normalizePriority(input.priority);

  if (input.priority !== undefined && input.priority !== '' && !priority) {
    return null;
  }

  return {
    content,
    ...(requesterName ? { requesterName } : {}),
    ...(deadline ? { deadline } : {}),
    ...(priority ? { priority } : {})
  };
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeRequiredString(value, maxLength) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    return null;
  }

  return trimmed;
}

function normalizeOptionalString(value, maxLength) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  if (!value || value.length > maxLength) {
    return undefined;
  }

  return value;
}

function normalizePriority(value) {
  if (typeof value !== 'string') {
    return undefined;
  }

  return PRIORITIES.includes(value) ? value : undefined;
}

export function mapPayloadToFeishuFields(payload) {
  return {
    [FEISHU_FIELDS.content]: payload.content,
    ...(payload.requesterName ? { [FEISHU_FIELDS.requesterName]: payload.requesterName } : {}),
    ...(payload.deadline ? { [FEISHU_FIELDS.deadline]: payload.deadline } : {}),
    ...(payload.priority ? { [FEISHU_FIELDS.priority]: payload.priority } : {}),
    [FEISHU_FIELDS.status]: 'New'
  };
}

async function createFeishuRecord(payload, env) {
  if (env.MOCK_FEISHU === 'true') {
    console.info('MOCK_FEISHU enabled: request accepted without writing to Feishu.');
    return;
  }

  assertFeishuConfig(env);

  const token = await getTenantAccessToken(env.FEISHU_APP_ID, env.FEISHU_APP_SECRET);
  const url = `${FEISHU_BASE_URL}/bitable/v1/apps/${env.FEISHU_BITABLE_APP_TOKEN}/tables/${env.FEISHU_BITABLE_TABLE_ID}/records`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify({
      fields: mapPayloadToFeishuFields(payload)
    })
  });

  if (!response.ok) {
    console.error('Feishu record creation failed', {
      status: response.status,
      statusText: response.statusText
    });
    throw new Error('FEISHU_RECORD_CREATE_FAILED');
  }
}

async function getTenantAccessToken(appId, appSecret) {
  const response = await fetch(`${FEISHU_BASE_URL}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify({
      app_id: appId,
      app_secret: appSecret
    })
  });

  if (!response.ok) {
    console.error('Feishu token request failed', {
      status: response.status,
      statusText: response.statusText
    });
    throw new Error('FEISHU_TOKEN_FAILED');
  }

  const data = await response.json();
  if (!data.tenant_access_token) {
    console.error('Feishu token response did not include tenant_access_token', {
      code: data.code,
      msg: data.msg
    });
    throw new Error('FEISHU_TOKEN_MISSING');
  }

  return data.tenant_access_token;
}

function assertFeishuConfig(env) {
  const requiredKeys = [
    'FEISHU_APP_ID',
    'FEISHU_APP_SECRET',
    'FEISHU_BITABLE_APP_TOKEN',
    'FEISHU_BITABLE_TABLE_ID'
  ];

  const missingKeys = requiredKeys.filter((key) => !env[key]);
  if (missingKeys.length > 0) {
    console.error('Missing Feishu Worker configuration', { missingKeys });
    throw new Error('FEISHU_CONFIG_MISSING');
  }
}

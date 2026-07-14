import assert from 'node:assert/strict';
import worker, { mapPayloadToFeishuFields, validateRequestPayload } from './worker.js';

assert.equal(validateRequestPayload({ content: '   ' }), null);

assert.deepEqual(
  validateRequestPayload({
    content: '  优化新品详情页  ',
    requesterName: ' Alex ',
    deadline: '2026-07-20',
    priority: '正常'
  }),
  {
    content: '优化新品详情页',
    requesterName: ' Alex ',
    deadline: '2026-07-20',
    priority: '正常'
  }
);

assert.equal(
  validateRequestPayload({
    content: '优化新品详情页',
    priority: '马上'
  }),
  null
);

assert.deepEqual(mapPayloadToFeishuFields({ content: '优化新品详情页' }), {
  需求内容: '优化新品详情页',
  状态: 'New'
});

assert.deepEqual(
  mapPayloadToFeishuFields({
    content: '优化新品详情页',
    requesterName: 'Alex',
    deadline: '2026-07-20',
    priority: '正常'
  }),
  {
    需求内容: '优化新品详情页',
    你的名字: 'Alex',
    Deadline: '2026-07-20',
    优先级: '正常',
    状态: 'New'
  }
);

const successResponse = await worker.fetch(
  new Request('http://127.0.0.1:8787/api/requests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://127.0.0.1:5173'
    },
    body: JSON.stringify({ content: '优化新品详情页', priority: '正常' })
  }),
  { MOCK_FEISHU: 'true', ALLOWED_ORIGIN: 'http://127.0.0.1:5173' }
);

assert.equal(successResponse.status, 200);
assert.deepEqual(await successResponse.json(), { success: true });

const invalidResponse = await worker.fetch(
  new Request('http://127.0.0.1:8787/api/requests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://127.0.0.1:5173'
    },
    body: JSON.stringify({ content: '   ' })
  }),
  { MOCK_FEISHU: 'true', ALLOWED_ORIGIN: 'http://127.0.0.1:5173' }
);

assert.equal(invalidResponse.status, 400);
assert.deepEqual(await invalidResponse.json(), { success: false, error: 'INVALID_PAYLOAD' });

console.log('Worker tests passed');

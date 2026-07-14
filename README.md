# Yilia Request Portal

A small personal request portal built with plain HTML, CSS, vanilla JavaScript, and a Cloudflare Worker.

The front end has no build step and no framework. The Worker keeps Feishu credentials server-side and writes valid submissions to Feishu Bitable.

## Final Structure

```text
index.html
style.css
script.js
worker/
  worker.js
  worker.test.mjs
README.md
wrangler.toml
package.json
.env.example
```

`worker.test.mjs` is a small Node test file for Worker validation and mock submission checks. `wrangler.toml` and `package.json` are kept for Worker development and deployment.

## What It Does

- Landing page with `提需求` and `Just say hi`
- `提需求` avoids the desktop mouse up to three times
- Escaping behavior is disabled on touch devices and for reduced-motion users
- `Just say hi` shows a temporary Toast
- Request form with required `需求内容`
- Optional `你的名字`, `截止时间`, and `优先级`
- Selectable and deselectable priority pills
- Immediate submission with no confirmation dialog
- Loading state prevents duplicate submissions
- Failure state keeps all form values
- Success receipt shows exactly the submitted values
- Empty optional fields are hidden from the receipt
- Cloudflare Worker supports mock mode and Feishu Bitable submission

## Run the Static Front End

You can open `index.html` directly in a browser, but serving the files locally is recommended so browser behavior matches deployment.

```bash
npm run serve
```

Open:

```text
http://127.0.0.1:5173
```

The front end submits to this default Worker URL:

```text
http://127.0.0.1:8787/api/requests
```

For a different endpoint, define this before `script.js` in `index.html`:

```html
<script>
  window.YILIA_REQUEST_API_URL = "https://your-worker.example.com/api/requests";
</script>
```

## Run the Worker Locally

Install Wrangler:

```bash
npm install
```

Start the Worker:

```bash
npm run worker:dev
```

Local mock mode is enabled in `wrangler.toml`:

```text
MOCK_FEISHU=true
ALLOWED_ORIGIN=http://127.0.0.1:5173
```

## Test

Run the Worker validation and mock submission tests:

```bash
npm run test
```

Test the Worker manually:

```bash
curl -X POST http://127.0.0.1:8787/api/requests \
  -H "Content-Type: application/json" \
  -H "Origin: http://127.0.0.1:5173" \
  -d '{"content":"优化新品详情页","requesterName":"Alex","deadline":"2026-07-20","priority":"正常"}'
```

Expected mock response:

```json
{"success":true}
```

Empty content should be rejected:

```bash
curl -i -X POST http://127.0.0.1:8787/api/requests \
  -H "Content-Type: application/json" \
  -H "Origin: http://127.0.0.1:5173" \
  -d '{"content":"   "}'
```

Expected response:

```json
{"success":false,"error":"INVALID_PAYLOAD"}
```

## Worker Environment Variables

Set real values in Cloudflare before production deployment:

```text
FEISHU_APP_ID
FEISHU_APP_SECRET
FEISHU_BITABLE_APP_TOKEN
FEISHU_BITABLE_TABLE_ID
ALLOWED_ORIGIN
MOCK_FEISHU
```

Recommended secret setup:

```bash
wrangler secret put FEISHU_APP_ID
wrangler secret put FEISHU_APP_SECRET
wrangler secret put FEISHU_BITABLE_APP_TOKEN
wrangler secret put FEISHU_BITABLE_TABLE_ID
```

For production:

```text
MOCK_FEISHU=false
ALLOWED_ORIGIN=https://your-production-domain.example
```

## Feishu Bitable Fields

Create a Bitable table with fields matching these names exactly:

```text
需求内容
你的名字
Deadline
优先级
状态
```

Field expectations:

- `需求内容`: text or multi-line text
- `你的名字`: text
- `Deadline`: date or text, depending on your table setup
- `优先级`: single select with `不着急`, `正常`, `有点急`, `十万火急！`
- `状态`: single select or text, receives `New`

The field mapping is centralized in `worker/worker.js` as `FEISHU_FIELDS`.

## Deploy

Deploy the static front-end files with any static host:

```text
index.html
style.css
script.js
```

Deploy the Worker:

```bash
npm run worker:deploy
```

Update `window.YILIA_REQUEST_API_URL` in `index.html` if the Worker URL differs from the local default.

## Information Still Needed

- Feishu App ID
- Feishu App Secret
- Bitable App Token
- Table ID
- Confirmation that Feishu field names match `worker/worker.js`
- Production front-end domain for `ALLOWED_ORIGIN`
- Production Worker URL for front-end submissions

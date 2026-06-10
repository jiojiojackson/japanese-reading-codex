const INDEX_KEY = "system/index.json";
const CSS_KEY = "assets/document.css";

export const sharedDocumentCss = `:root {
  color-scheme: light;
  --paper: #fffdfa;
  --ink: #242424;
  --muted: #6d6a63;
}

* {
  box-sizing: border-box;
}

body {
  background: #f4f1eb;
  color: var(--ink);
  font-family: "Yu Mincho", "Hiragino Mincho ProN", "Noto Serif JP", serif;
  margin: 0;
  min-height: 100vh;
  padding: 28px 16px;
}

main {
  background: var(--paper);
  border: 1px solid #ded8cc;
  margin: 0 auto;
  max-width: 760px;
  min-height: 72vh;
  padding: clamp(22px, 4vw, 48px);
}

h1 {
  font-family: "Hiragino Sans", "Yu Gothic", sans-serif;
  font-size: clamp(22px, 3vw, 30px);
  line-height: 1.2;
  margin: 0 0 12px;
}

.meta {
  color: var(--muted);
  font-family: "Hiragino Sans", "Yu Gothic", sans-serif;
  font-size: 13px;
  margin: 0 0 34px;
}

.document {
  font-size: clamp(17px, 1.55vw, 19px);
  line-height: 1.95;
  white-space: pre-wrap;
}

ruby {
  ruby-align: center;
}

rt {
  color: #0f5f54;
  font-family: "Hiragino Sans", "Yu Gothic", sans-serif;
  font-size: 0.42em;
  font-weight: 600;
}

@media (max-width: 640px) {
  body {
    padding: 0;
  }

  main {
    border: 0;
    min-height: 100vh;
  }

  .document {
    line-height: 1.9;
  }
}
`;

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {})
    }
  });
}

export function textResponse(message, status = 400) {
  return new Response(message, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" }
  });
}

export function getBucket(env) {
  if (!env.DOCS_BUCKET) {
    throw new Error("Missing R2 binding: DOCS_BUCKET");
  }
  return env.DOCS_BUCKET;
}

export async function readIndex(bucket) {
  const object = await bucket.get(INDEX_KEY);
  if (!object) return [];
  try {
    const parsed = JSON.parse(await object.text());
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function writeIndex(bucket, docs) {
  const sorted = [...docs].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  await bucket.put(INDEX_KEY, JSON.stringify(sorted, null, 2), {
    httpMetadata: {
      contentType: "application/json; charset=utf-8",
      cacheControl: "no-store"
    }
  });
  return sorted;
}

export async function ensureSharedCss(bucket) {
  await bucket.put(CSS_KEY, sharedDocumentCss, {
    httpMetadata: {
      contentType: "text/css; charset=utf-8",
      cacheControl: "public, max-age=31536000, immutable"
    }
  });
}

export function documentKey(id) {
  return `documents/${id}.html`;
}

export function makeId() {
  const random = crypto.getRandomValues(new Uint8Array(8));
  const suffix = [...random].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${Date.now().toString(36)}-${suffix}`;
}

export function normalizeDocument(input, id) {
  const title = String(input.title || "").trim().slice(0, 120);
  const source = String(input.source || "").slice(0, 200000);
  const annotations = Array.isArray(input.annotations)
    ? input.annotations
        .map((item) => ({
          index: Number(item.index),
          char: String(item.char || "").slice(0, 2),
          ruby: String(item.ruby || "").trim().slice(0, 80)
        }))
        .filter((item) => Number.isInteger(item.index) && item.index >= 0 && item.char && item.ruby)
    : [];

  if (!title) {
    throw new Error("文件名不能为空");
  }

  return { id, title, source, annotations };
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderBody(source, annotations) {
  const byPosition = new Map();
  for (const item of annotations) {
    byPosition.set(`${item.index}:${item.char}`, item.ruby);
  }

  let html = "";
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const ruby = byPosition.get(`${index}:${char}`);
    html += ruby
      ? `<ruby><rb>${escapeHtml(char)}</rb><rt>${escapeHtml(ruby)}</rt></ruby>`
      : escapeHtml(char);
  }
  return html;
}

export function renderDocumentHtml(doc, origin) {
  const updatedAt = doc.updatedAt || new Date().toISOString();
  const data = JSON.stringify(doc).replaceAll("<", "\\u003c");
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(doc.title)}</title>
    <link rel="stylesheet" href="${origin}/assets/document.css">
  </head>
  <body>
    <main>
      <h1>${escapeHtml(doc.title)}</h1>
      <p class="meta">更新于 ${escapeHtml(new Date(updatedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }))}</p>
      <article class="document">${renderBody(doc.source, doc.annotations)}</article>
    </main>
    <script id="document-data" type="application/json">${data}</script>
  </body>
</html>`;
}

export async function readDocument(bucket, id) {
  const object = await bucket.get(documentKey(id));
  if (!object) return null;
  const html = await object.text();
  const match = html.match(/<script id="document-data" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) return null;
  return JSON.parse(match[1]);
}

export async function saveDocument(bucket, doc, origin) {
  await ensureSharedCss(bucket);
  const now = new Date().toISOString();
  const stored = { ...doc, updatedAt: now };
  const html = renderDocumentHtml(stored, origin);
  await bucket.put(documentKey(stored.id), html, {
    httpMetadata: {
      contentType: "text/html; charset=utf-8",
      cacheControl: "public, max-age=300"
    },
    customMetadata: {
      title: stored.title,
      updatedAt: stored.updatedAt
    }
  });

  const index = await readIndex(bucket);
  const next = [
    { id: stored.id, title: stored.title, updatedAt: stored.updatedAt },
    ...index.filter((item) => item.id !== stored.id)
  ];
  await writeIndex(bucket, next);
  return stored;
}

export async function removeDocument(bucket, id) {
  await bucket.delete(documentKey(id));
  const index = await readIndex(bucket);
  await writeIndex(bucket, index.filter((item) => item.id !== id));
}

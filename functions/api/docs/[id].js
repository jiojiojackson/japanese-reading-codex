import {
  getBucket,
  json,
  normalizeDocument,
  readDocument,
  removeDocument,
  saveDocument,
  textResponse
} from "../../_lib/storage.js";

export async function onRequestGet({ env, params }) {
  const bucket = getBucket(env);
  const doc = await readDocument(bucket, params.id);
  return doc ? json(doc) : textResponse("文档不存在", 404);
}

export async function onRequestPut({ request, env, params }) {
  const bucket = getBucket(env);
  const origin = new URL(request.url).origin;

  try {
    const payload = await request.json();
    const existing = await readDocument(bucket, params.id);
    if (!existing) return textResponse("文档不存在", 404);

    const doc = normalizeDocument(payload, params.id);
    return json(await saveDocument(bucket, doc, origin));
  } catch (error) {
    return textResponse(error.message);
  }
}

export async function onRequestDelete({ env, params }) {
  const bucket = getBucket(env);
  await removeDocument(bucket, params.id);
  return new Response(null, { status: 204 });
}

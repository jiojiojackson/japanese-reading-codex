import {
  getBucket,
  json,
  makeId,
  normalizeDocument,
  readIndex,
  saveDocument,
  textResponse
} from "../_lib/storage.js";

export async function onRequestGet({ env }) {
  const bucket = getBucket(env);
  return json(await readIndex(bucket));
}

export async function onRequestPost({ request, env }) {
  const bucket = getBucket(env);
  const origin = new URL(request.url).origin;
  let payload;

  try {
    payload = await request.json();
    const doc = normalizeDocument(payload, makeId());
    return json(await saveDocument(bucket, doc, origin), { status: 201 });
  } catch (error) {
    return textResponse(error.message);
  }
}

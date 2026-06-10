import { documentKey, getBucket, textResponse } from "../_lib/storage.js";

export async function onRequestGet({ env, params }) {
  const bucket = getBucket(env);
  const object = await bucket.get(documentKey(params.id));
  if (!object) return textResponse("文档不存在", 404);

  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType || "text/html; charset=utf-8",
      "cache-control": "public, max-age=300"
    }
  });
}

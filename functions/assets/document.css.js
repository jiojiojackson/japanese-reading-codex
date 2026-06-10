import { getBucket, sharedDocumentCss } from "../_lib/storage.js";

const headers = {
  "content-type": "text/css; charset=utf-8",
  "cache-control": "public, max-age=31536000, immutable"
};

export async function onRequestGet({ env }) {
  const bucket = getBucket(env);
  const object = await bucket.get("assets/document.css");
  if (object) {
    return new Response(object.body, { headers });
  }
  return new Response(sharedDocumentCss, { headers });
}

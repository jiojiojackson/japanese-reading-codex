const PUBLIC_PREFIXES = ["/view/"];
const PUBLIC_PATHS = ["/assets/document.css"];

function isPublicPath(pathname) {
  return PUBLIC_PATHS.includes(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function unauthorized() {
  return new Response("Authentication required", {
    status: 401,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "www-authenticate": 'Basic realm="Furigana Editor", charset="UTF-8"'
    }
  });
}

function forbidden(message) {
  return new Response(message, {
    status: 500,
    headers: { "content-type": "text/plain; charset=utf-8" }
  });
}

function safeEqual(left, right) {
  const a = String(left);
  const b = String(right);
  let result = a.length === b.length ? 0 : 1;
  const length = Math.max(a.length, b.length);

  for (let index = 0; index < length; index += 1) {
    result |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }

  return result === 0;
}

function readBasicCredentials(request) {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Basic ")) return null;

  try {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(":");
    if (separator === -1) return null;
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1)
    };
  } catch {
    return null;
  }
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const pathname = new URL(request.url).pathname;

  if (isPublicPath(pathname)) {
    return next();
  }

  const expectedUsername = env.EDITOR_USERNAME;
  const expectedPassword = env.EDITOR_PASSWORD;

  if (!expectedUsername || !expectedPassword) {
    return forbidden("Missing EDITOR_USERNAME or EDITOR_PASSWORD environment variable");
  }

  const credentials = readBasicCredentials(request);
  if (
    !credentials ||
    !safeEqual(credentials.username, expectedUsername) ||
    !safeEqual(credentials.password, expectedPassword)
  ) {
    return unauthorized();
  }

  return next();
}

const crypto = require("crypto");

const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;
const MAX_BODY_BYTES = 16 * 1024;
const loginAttempts = new Map();
const requestBuckets = new Map();

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Variável ${name} não configurada`);
  return value;
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function hashId(value) {
  return crypto.createHash("sha256").update(`${requiredEnv("ANALYTICS_SALT")}:${value}`).digest("hex");
}

function setHeaders(res, headers) {
  if (typeof res.setHeader === "function") {
    for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  } else if (typeof res.set === "function") {
    res.set(headers);
  }
}

function json(res, status, payload, headers = {}) {
  const responseHeaders = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  };
  if (typeof res.statusCode === "number") {
    res.statusCode = status;
    setHeaders(res, responseHeaders);
    res.end(JSON.stringify(payload));
    return;
  }
  res.status(status).set(responseHeaders).send(payload);
}

function securityHeaders(res) {
  setHeaders(res, {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Content-Security-Policy": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; connect-src 'self'",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  });
}

function trustedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const expected = requiredEnv("PUBLIC_ORIGIN").replace(/\/$/, "");
  return origin === expected;
}

function rateLimit(map, key, max, windowMs) {
  const now = Date.now();
  const current = map.get(key);
  if (!current || now >= current.resetAt) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }
  if (current.count >= max) return { allowed: false, retryAfter: Math.ceil((current.resetAt - now) / 1000) };
  current.count += 1;
  return { allowed: true, retryAfter: 0 };
}

function requestKey(req, prefix) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return `${prefix}:${forwarded || req.socket?.remoteAddress || "unknown"}`;
}

function rejectRate(res, retryAfter) {
  return json(res, 429, { error: "Muitas tentativas. Tente novamente mais tarde." }, { "Retry-After": String(retryAfter) });
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(header.split(";").filter(Boolean).map((part) => {
    const index = part.indexOf("=");
    if (index < 0) return [part.trim(), ""];
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }));
}

function sessionToken() {
  const issued = Date.now();
  const nonce = crypto.randomBytes(18).toString("hex");
  const body = `${issued}.${nonce}`;
  const signature = crypto.createHmac("sha256", requiredEnv("SESSION_SECRET")).update(body).digest("hex");
  return `${body}.${signature}`;
}

function isAdmin(req) {
  const value = parseCookies(req).admin_session;
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 3 || !/^\d+$/.test(parts[0])) return false;
  if (Date.now() - Number(parts[0]) > SESSION_MAX_AGE_SECONDS * 1000) return false;
  const expected = crypto.createHmac("sha256", requiredEnv("SESSION_SECRET")).update(`${parts[0]}.${parts[1]}`).digest("hex");
  return safeEqual(parts[2], expected);
}

function adminCookie(value, maxAge = SESSION_MAX_AGE_SECONDS) {
  return `admin_session=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    let finished = false;
    req.on("data", (chunk) => {
      if (finished) return;
      raw += chunk;
      if (Buffer.byteLength(raw) > MAX_BODY_BYTES) {
        finished = true;
        const error = new Error("Payload muito grande");
        error.statusCode = 413;
        reject(error);
        req.resume();
      }
    });
    req.on("end", () => {
      if (finished) return;
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { const error = new Error("JSON inválido"); error.statusCode = 400; reject(error); }
    });
    req.on("error", reject);
  });
}

async function supabaseRpc(name, body) {
  const baseUrl = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
  const key = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${baseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body || {}),
  });
  const text = await response.text();
  if (!response.ok) {
    console.error(`[supabase] ${name} failed with ${response.status}`);
    throw new Error("Banco indisponível");
  }
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

module.exports = {
  SESSION_MAX_AGE_SECONDS,
  loginAttempts,
  requestBuckets,
  safeEqual,
  hashId,
  json,
  securityHeaders,
  trustedOrigin,
  rateLimit,
  requestKey,
  rejectRate,
  sessionToken,
  adminCookie,
  isAdmin,
  readJson,
  supabaseRpc,
};

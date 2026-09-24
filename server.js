const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");

const ROOT = __dirname;
function loadLocalEnv() {
  const envFile = path.join(ROOT, ".env");
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/i);
    if (!match || match[1] in process.env) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}
loadLocalEnv();

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const TIME_ZONE = process.env.TIME_ZONE || "America/Sao_Paulo";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const ALLOW_FILE_ORIGIN = !IS_PRODUCTION && process.env.ALLOW_FILE_ORIGIN !== "false";
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const SESSION_SECRET = process.env.SESSION_SECRET || (IS_PRODUCTION ? "" : crypto.randomBytes(32).toString("hex"));
const ANALYTICS_SALT = process.env.ANALYTICS_SALT || (IS_PRODUCTION ? "" : crypto.randomBytes(32).toString("hex"));
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "analytics.json");
const ACTIVE_WINDOW_MS = 90 * 1000;
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 16 * 1024;
const RETENTION_DAYS = Math.max(7, Number(process.env.DATA_RETENTION_DAYS || 90));
const loginAttempts = new Map();
const requestBuckets = new Map();

if (!ADMIN_PASSWORD) {
  throw new Error("ADMIN_PASSWORD é obrigatória. Configure o arquivo .env antes de iniciar o servidor.");
}
if (IS_PRODUCTION && ADMIN_PASSWORD.length < 12) {
  throw new Error("ADMIN_PASSWORD precisa ter pelo menos 12 caracteres em produção.");
}
if (IS_PRODUCTION && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  throw new Error("SESSION_SECRET precisa ter pelo menos 32 caracteres em produção.");
}
if (IS_PRODUCTION && (!process.env.ANALYTICS_SALT || process.env.ANALYTICS_SALT.length < 32)) {
  throw new Error("ANALYTICS_SALT precisa ter pelo menos 32 caracteres em produção.");
}

function emptyStore() {
  return {
    version: 1,
    totalVisits: 0,
    totalCareerStarts: 0,
    visitors: {},
    sessions: {},
    daily: {},
  };
}

function loadStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return { ...emptyStore(), ...parsed };
  } catch (error) {
    return emptyStore();
  }
}

let store = loadStore();
let saveTimer = null;

function saveStoreSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
  }, 250);
}

function todayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dayStore(day) {
  if (!store.daily[day] || typeof store.daily[day] !== "object") {
    store.daily[day] = { visits: 0, careerStarts: 0, visitors: {} };
  }
  store.daily[day].visits = Number(store.daily[day].visits) || 0;
  store.daily[day].careerStarts = Number(store.daily[day].careerStarts) || 0;
  if (!store.daily[day].visitors || typeof store.daily[day].visitors !== "object") store.daily[day].visitors = {};
  return store.daily[day];
}

function hashId(value) {
  return crypto.createHash("sha256").update(`${ANALYTICS_SALT}:${value}`).digest("hex");
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function cleanSessions() {
  const cutoff = Date.now() - 2 * 24 * 60 * 60 * 1000;
  for (const [key, session] of Object.entries(store.sessions)) {
    if (session.lastSeen < cutoff) delete store.sessions[key];
  }
}

function cleanOldAnalytics() {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const cutoffDay = todayKey(new Date(cutoff));
  for (const [day, item] of Object.entries(store.daily)) {
    if (day < cutoffDay) delete store.daily[day];
    else if (!item || typeof item !== "object") delete store.daily[day];
  }
  for (const [visitorHash, visitor] of Object.entries(store.visitors)) {
    if (!visitor || visitor.lastSeen < cutoff) delete store.visitors[visitorHash];
  }
}

function clientAddress(req) {
  return req.socket.remoteAddress || "unknown";
}

function takeRateLimit(map, key, max, windowMs) {
  const now = Date.now();
  const current = map.get(key);
  if (!current || now >= current.resetAt) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }
  if (current.count >= max) {
    return { allowed: false, retryAfter: Math.ceil((current.resetAt - now) / 1000) };
  }
  current.count += 1;
  return { allowed: true, retryAfter: 0 };
}

function rateLimitResponse(res, retryAfter) {
  sendJson(res, 429, { error: "Muitas tentativas. Tente novamente mais tarde." }, {
    "Retry-After": String(retryAfter),
  });
}

function expectedOrigin(req) {
  if (PUBLIC_ORIGIN) return PUBLIC_ORIGIN;
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0].trim();
  const forwardedHost = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost").split(",")[0].trim();
  return `${forwardedProto}://${forwardedHost}`;
}

function isTrustedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  if (origin === "null") return ALLOW_FILE_ORIGIN;
  return origin === expectedOrigin(req);
}

function applySecurityHeaders(req, res) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0].trim();
  const isHttps = IS_PRODUCTION || forwardedProto === "https";
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Content-Security-Policy", "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self';");
  if (isHttps) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
}

function recordEvent(payload) {
  const allowedEvents = new Set(["visit", "game_finished", "heartbeat", "career_started"]);
  const event = typeof payload.event === "string" ? payload.event : "";
  const visitorId = typeof payload.visitorId === "string" ? payload.visitorId : "";
  const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : "";
  const device = ["mobile", "tablet", "desktop"].includes(payload.device)
    ? payload.device
    : "desktop";
  const count = Math.max(1, Math.min(1000, Math.floor(Number(payload.count) || 1)));

  if (!allowedEvents.has(event) || !/^[A-Za-z0-9_-]{8,120}$/.test(visitorId) || !/^[A-Za-z0-9_-]{8,120}$/.test(sessionId)) {
    return false;
  }

  const now = Date.now();
  cleanOldAnalytics();
  const day = dayStore(todayKey());
  const visitorHash = hashId(visitorId);
  const sessionHash = hashId(`${visitorId}:${sessionId}`);
  const visitor = store.visitors[visitorHash] || {
    firstSeen: now,
    lastSeen: now,
    device,
  };

  visitor.lastSeen = now;
  visitor.device = device;
  store.visitors[visitorHash] = visitor;

  const session = store.sessions[sessionHash] || {
    visitorHash,
    startedAt: now,
    lastSeen: now,
    device,
  };
  session.lastSeen = now;
  session.device = device;
  store.sessions[sessionHash] = session;

  if (event === "visit" || event === "game_finished") {
    store.totalVisits += event === "game_finished" ? count : 1;
    day.visits += event === "game_finished" ? count : 1;
  }
  if (event === "visit") {
    day.visitors[visitorHash] = true;
  }
  if (event === "career_started") {
    store.totalCareerStarts += 1;
    day.careerStarts += 1;
    day.visitors[visitorHash] = true;
  }

  cleanSessions();
  saveStoreSoon();
  return true;
}

function metrics() {
  cleanOldAnalytics();
  cleanSessions();
  const now = Date.now();
  const activeVisitors = new Set();
  const devices = { mobile: 0, tablet: 0, desktop: 0 };
  for (const session of Object.values(store.sessions)) {
    if (now - session.lastSeen <= ACTIVE_WINDOW_MS) activeVisitors.add(session.visitorHash);
  }
  for (const visitor of Object.values(store.visitors)) {
    if (devices[visitor.device] !== undefined) devices[visitor.device] += 1;
  }

  const days = [];
  for (let offset = 13; offset >= 0; offset -= 1) {
    const date = new Date(now - offset * 24 * 60 * 60 * 1000);
    const key = todayKey(date);
    const item = dayStore(key);
    days.push({
      date: key,
      visits: item.visits,
      uniqueVisitors: Object.keys(item.visitors).length,
      careerStarts: item.careerStarts,
    });
  }

  const today = dayStore(todayKey());
  return {
    totalVisits: store.totalVisits,
    uniqueVisitors: Object.keys(store.visitors).length,
    totalCareerStarts: store.totalCareerStarts,
    activeNow: activeVisitors.size,
    today: {
      visits: today.visits,
      uniqueVisitors: Object.keys(today.visitors).length,
      careerStarts: today.careerStarts,
    },
    devices,
    days,
    updatedAt: new Date(now).toISOString(),
  };
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(header.split(";").filter(Boolean).map((part) => {
    const index = part.indexOf("=");
    if (index < 0) return [part.trim(), ""];
    try { return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())]; }
    catch (error) { return [part.slice(0, index).trim(), ""]; }
  }));
}

function makeSessionCookie() {
  const issued = Date.now();
  const nonce = crypto.randomBytes(18).toString("hex");
  const body = `${issued}.${nonce}`;
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("hex");
  return `${body}.${signature}`;
}

function isAdmin(req) {
  const authorization = req.headers.authorization || "";
  const bearer = ALLOW_FILE_ORIGIN && req.headers.origin === "null" && authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";
  const value = bearer || parseCookies(req).admin_session;
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 3 || !/^\d+$/.test(parts[0])) return false;
  if (Date.now() - Number(parts[0]) > SESSION_MAX_AGE_MS) return false;
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(`${parts[0]}.${parts[1]}`).digest("hex");
  return safeEqual(parts[2], expected);
}

function sendJson(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(body);
}

function isJsonRequest(req) {
  return String(req.headers["content-type"] || "").toLowerCase().startsWith("application/json");
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
      catch (error) { const invalid = new Error("JSON inválido"); invalid.statusCode = 400; reject(invalid); }
    });
    req.on("error", (error) => { if (!finished) reject(error); });
  });
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
  }[ext] || "application/octet-stream";
}

function serveStatic(req, res, pathname) {
  let requested;
  try { requested = decodeURIComponent(pathname === "/" ? "/index.html" : pathname === "/admin" || pathname === "/admin/" ? "/admin.html" : pathname); }
  catch (error) { sendJson(res, 404, { error: "Página não encontrada" }); return; }

  const publicFile = requested === "/index.html" || requested === "/admin.html";
  const publicAsset = requested.startsWith("/css/") || requested.startsWith("/js/");
  if (!publicFile && !publicAsset) {
    sendJson(res, 404, { error: "Página não encontrada" });
    return;
  }

  const filePath = path.resolve(ROOT, `.${requested}`);
  const relativePath = path.relative(ROOT, filePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    sendJson(res, 404, { error: "Página não encontrada" });
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendJson(res, 404, { error: "Página não encontrada" });
      return;
    }
    res.writeHead(200, {
      "Content-Type": contentType(filePath),
      "Cache-Control": pathname === "/" || pathname.startsWith("/admin") ? "no-store" : "public, max-age=300",
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = parsed.pathname;
  applySecurityHeaders(req, res);

  // Permite que o arquivo local aberto pelo usuário converse com o servidor local.
  // O painel continua protegido pela senha e nenhuma origem pública é liberada.
  if (req.headers.origin === "null" && ALLOW_FILE_ORIGIN) {
    res.setHeader("Access-Control-Allow-Origin", "null");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (pathname === "/api/analytics" && req.method === "POST") {
      if (!isTrustedOrigin(req)) {
        sendJson(res, 403, { error: "Origem não autorizada" });
        return;
      }
      const analyticsLimit = takeRateLimit(requestBuckets, `analytics:${clientAddress(req)}`, 180, 60 * 1000);
      if (!analyticsLimit.allowed) {
        rateLimitResponse(res, analyticsLimit.retryAfter);
        return;
      }
      if (!isJsonRequest(req)) {
        sendJson(res, 415, { error: "Content-Type precisa ser application/json" });
        return;
      }
      const accepted = recordEvent(await readJson(req));
      sendJson(res, accepted ? 202 : 400, { ok: accepted });
      return;
    }

    if (pathname === "/api/admin/login" && req.method === "POST") {
      if (!isTrustedOrigin(req)) {
        sendJson(res, 403, { error: "Origem não autorizada" });
        return;
      }
      const loginKey = `login:${clientAddress(req)}`;
      const loginLimit = takeRateLimit(loginAttempts, loginKey, 5, 15 * 60 * 1000);
      if (!loginLimit.allowed) {
        rateLimitResponse(res, loginLimit.retryAfter);
        return;
      }
      if (!isJsonRequest(req)) {
        sendJson(res, 415, { error: "Content-Type precisa ser application/json" });
        return;
      }
      const payload = await readJson(req);
      if (!safeEqual(payload.password || "", ADMIN_PASSWORD)) {
        sendJson(res, 401, { error: "Senha inválida" });
        return;
      }
      loginAttempts.delete(loginKey);
      const sessionToken = makeSessionCookie();
      const secure = IS_PRODUCTION || String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https" ? "; Secure" : "";
      const response = { ok: true };
      if (req.headers.origin === "null" && ALLOW_FILE_ORIGIN) response.token = sessionToken;
      sendJson(res, 200, response, {
        "Set-Cookie": `admin_session=${encodeURIComponent(sessionToken)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MAX_AGE_MS / 1000}${secure}`,
      });
      return;
    }

    if (pathname === "/api/admin/logout" && req.method === "POST") {
      if (!isTrustedOrigin(req)) {
        sendJson(res, 403, { error: "Origem não autorizada" });
        return;
      }
      sendJson(res, 200, { ok: true }, { "Set-Cookie": "admin_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0" });
      return;
    }

    if (pathname === "/api/admin/metrics" && req.method === "GET") {
      const metricsLimit = takeRateLimit(requestBuckets, `metrics:${clientAddress(req)}`, 120, 60 * 1000);
      if (!metricsLimit.allowed) {
        rateLimitResponse(res, metricsLimit.retryAfter);
        return;
      }
      if (!isAdmin(req)) {
        sendJson(res, 401, { error: "Não autenticado" });
        return;
      }
      sendJson(res, 200, metrics());
      return;
    }

    if (req.method === "GET") {
      serveStatic(req, res, pathname);
      return;
    }

    sendJson(res, 405, { error: "Método não permitido" });
  } catch (error) {
    if (!res.headersSent) sendJson(res, error.statusCode || 500, { error: error.statusCode ? error.message : "Erro interno" });
    if (!error.statusCode) console.error("[server]", error.message);
  }
});

server.listen(PORT, HOST, () => {
  const networkAddresses = Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => item && item.family === "IPv4" && !item.internal)
    .map((item) => `http://${item.address}:${PORT}`);
  console.log(`[server] Jogo: http://localhost:${PORT}`);
  console.log(`[server] Painel: http://localhost:${PORT}/admin`);
  console.log(`[server] Rede local: ${networkAddresses.join(" | ") || `http://<IP-do-computador>:${PORT}`}`);
});

function shutdown() {
  clearTimeout(saveTimer);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

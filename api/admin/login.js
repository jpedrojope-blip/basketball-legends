const {
  loginAttempts,
  rateLimit,
  requestKey,
  rejectRate,
  trustedOrigin,
  securityHeaders,
  json,
  readJson,
  safeEqual,
  sessionToken,
  adminCookie,
} = require("../_lib");

module.exports = async (req, res) => {
  securityHeaders(res);
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido" });
  if (!trustedOrigin(req)) return json(res, 403, { error: "Origem não autorizada" });
  const key = requestKey(req, "login");
  const limit = rateLimit(loginAttempts, key, 5, 15 * 60 * 1000);
  if (!limit.allowed) return rejectRate(res, limit.retryAfter);
  if (!String(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
    return json(res, 415, { error: "Content-Type precisa ser application/json" });
  }
  try {
    const body = await readJson(req);
    if (!safeEqual(body.password || "", process.env.ADMIN_PASSWORD || "")) return json(res, 401, { error: "Senha inválida" });
    loginAttempts.delete(key);
    return json(res, 200, { ok: true }, { "Set-Cookie": adminCookie(sessionToken()) });
  } catch (error) {
    return json(res, error.statusCode || 400, { error: error.message });
  }
};

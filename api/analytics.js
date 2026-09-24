const {
  requestBuckets,
  rateLimit,
  requestKey,
  rejectRate,
  trustedOrigin,
  securityHeaders,
  json,
  readJson,
  hashId,
  supabaseRpc,
} = require("./_lib");

module.exports = async (req, res) => {
  securityHeaders(res);
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido" });
  if (!trustedOrigin(req)) return json(res, 403, { error: "Origem não autorizada" });
  const limit = rateLimit(requestBuckets, requestKey(req, "analytics"), 180, 60 * 1000);
  if (!limit.allowed) return rejectRate(res, limit.retryAfter);
  if (!String(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
    return json(res, 415, { error: "Content-Type precisa ser application/json" });
  }

  try {
    const body = await readJson(req);
    const allowedEvents = new Set(["career_started", "game_finished", "heartbeat"]);
    const event = typeof body.event === "string" ? body.event : "";
    const visitorId = typeof body.visitorId === "string" ? body.visitorId : "";
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    const eventId = typeof body.eventId === "string" ? body.eventId : "";
    const device = ["mobile", "tablet", "desktop"].includes(body.device) ? body.device : "desktop";
    const count = Math.max(1, Math.min(1000, Number.isFinite(Number(body.count)) ? Math.floor(Number(body.count)) : 1));
    if (!allowedEvents.has(event) || !/^[A-Za-z0-9_-]{8,120}$/.test(visitorId) || !/^[A-Za-z0-9_-]{8,120}$/.test(sessionId) || !/^[A-Za-z0-9_-]{16,120}$/.test(eventId)) {
      return json(res, 400, { error: "Evento inválido" });
    }
    await supabaseRpc("manba_record_event", {
      p_event: event,
      p_visitor_hash: hashId(visitorId),
      p_session_hash: hashId(`${visitorId}:${sessionId}`),
      p_device: device,
      p_event_id: eventId,
      p_count: count,
    });
    return json(res, 202, { ok: true });
  } catch (error) {
    return json(res, error.statusCode || 503, { error: error.statusCode ? error.message : "Não foi possível registrar agora" });
  }
};

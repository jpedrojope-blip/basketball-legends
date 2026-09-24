const {
  requestBuckets,
  rateLimit,
  requestKey,
  rejectRate,
  securityHeaders,
  json,
  isAdmin,
  supabaseRpc,
} = require("../_lib");

module.exports = async (req, res) => {
  securityHeaders(res);
  if (req.method !== "GET") return json(res, 405, { error: "Método não permitido" });
  const limit = rateLimit(requestBuckets, requestKey(req, "metrics"), 120, 60 * 1000);
  if (!limit.allowed) return rejectRate(res, limit.retryAfter);
  if (!isAdmin(req)) return json(res, 401, { error: "Não autenticado" });
  try {
    const data = await supabaseRpc("manba_get_metrics", {});
    return json(res, 200, {
      totalVisits: Number(data?.totalGamesFinished || 0),
      uniqueVisitors: Number(data?.totalPlayers || 0),
      totalCareerStarts: Number(data?.totalCareersStarted || 0),
      activeNow: Number(data?.activeNow || 0),
      today: {
        visits: Number(data?.today?.gamesFinished || 0),
        uniqueVisitors: Number(data?.today?.players || 0),
        careerStarts: Number(data?.today?.careersStarted || 0),
      },
      devices: data?.devices || { mobile: 0, tablet: 0, desktop: 0 },
      days: Array.isArray(data?.days) ? data.days.map((day) => ({
        date: String(day.date || "").slice(0, 10),
        visits: Number(day.gamesFinished || 0),
        uniqueVisitors: Number(day.players || 0),
        careerStarts: Number(day.careersStarted || 0),
      })) : [],
      updatedAt: data?.updatedAt || new Date().toISOString(),
    });
  } catch {
    return json(res, 503, { error: "Não foi possível atualizar agora" });
  }
};

const { trustedOrigin, securityHeaders, json, adminCookie } = require("../_lib");

module.exports = async (req, res) => {
  securityHeaders(res);
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido" });
  if (!trustedOrigin(req)) return json(res, 403, { error: "Origem não autorizada" });
  return json(res, 200, { ok: true }, { "Set-Cookie": adminCookie("", 0) });
};

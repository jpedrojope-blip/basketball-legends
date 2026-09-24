// Telemetria mínima: nenhum dado da carreira é lido ou enviado.
(function () {
  const API = `${window.location.protocol === "file:" ? "http://localhost:8787" : ""}/api/analytics`;
  const VISITOR_KEY = "bl_analytics_visitor";
  const SESSION_KEY = "bl_analytics_session";
  const HEARTBEAT_MS = 30 * 1000;
  let hasStartedPlaying = false;


  function randomId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }

  function getOrCreate(storage, key) {
    try {
      let value = storage.getItem(key);
      if (!value) {
        value = randomId();
        storage.setItem(key, value);
      }
      return value;
    } catch (error) {
      return randomId();
    }
  }

  const visitorId = getOrCreate(window.localStorage, VISITOR_KEY);
  const sessionId = getOrCreate(window.sessionStorage, SESSION_KEY);

  function deviceType() {
    const width = Math.min(window.innerWidth || 1024, window.screen && window.screen.width || 1024);
    if (width <= 640) return "mobile";
    if (width <= 900) return "tablet";
    return "desktop";
  }

  function send(event, count = 1) {
    const body = JSON.stringify({
      event,
      eventId: randomId(),
      visitorId,
      sessionId,
      device: deviceType(),
      count: Math.max(1, Math.min(1000, Math.floor(Number(count) || 1))),
    });
    try {
      fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
        credentials: "include",
      }).catch(() => {});
    } catch (error) {
      // O jogo continua funcionando mesmo se o painel estiver indisponível.
    }
  }

  window.Analytics = {
    track(event, details = {}) {
      if (!["career_started", "game_finished", "heartbeat"].includes(event)) return;
      if (event === "career_started") hasStartedPlaying = true;
      if (event === "heartbeat" && !hasStartedPlaying) return;
      send(event, details.count);
    },
  };

  window.setInterval(() => {
    if (!document.hidden && hasStartedPlaying) send("heartbeat");
  }, HEARTBEAT_MS);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && hasStartedPlaying) send("heartbeat");
  });
})();

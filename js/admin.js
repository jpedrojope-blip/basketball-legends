(function () {
  const $ = (id) => document.getElementById(id);
  const loginView = $("login-view");
  const dashboardView = $("dashboard-view");
  const loginForm = $("login-form");
  const loginError = $("login-error");
  const TOKEN_KEY = "bl_admin_session";
  let sessionToken = sessionStorage.getItem(TOKEN_KEY) || "";

  const openedAsFile = window.location.protocol === "file:";
  if (openedAsFile) {
    loginError.textContent = "Conectando ao servidor local…";
  }

  const API_ORIGIN = openedAsFile ? "http://localhost:8787" : "";

  function showLogin(message) {
    loginView.classList.remove("hidden");
    dashboardView.classList.add("hidden");
    loginError.textContent = message || "";
  }

  function showDashboard() {
    loginView.classList.add("hidden");
    dashboardView.classList.remove("hidden");
  }

  async function request(path, options) {
    const headers = { "Content-Type": "application/json" };
    if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
    const response = await fetch(`${API_ORIGIN}${path}`, {
      credentials: "include",
      headers,
      ...options,
    });
    let body = {};
    try { body = await response.json(); } catch (error) {}
    if (!response.ok) {
      const error = new Error(body.error || "Não foi possível carregar o painel");
      error.status = response.status;
      throw error;
    }
    return body;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("pt-BR").format(value || 0);
  }

  function formatDay(value) {
    const [, month, day] = value.split("-");
    return `${day}/${month}`;
  }

  function renderChart(days) {
    const chart = $("traffic-chart");
    const max = Math.max(1, ...days.map((day) => day.visits));
    chart.innerHTML = days.map((day) => {
      const visitsHeight = Math.max(4, (day.visits / max) * 100);
      const uniqueHeight = Math.max(3, (day.uniqueVisitors / max) * 100);
      return `<div class="chart-day" title="${formatDay(day.date)}: ${formatNumber(day.visits)} acessos, ${formatNumber(day.uniqueVisitors)} únicos">
        <div class="bars"><span class="bar visits-bar" style="height:${visitsHeight}%"></span><span class="bar unique-bar" style="height:${uniqueHeight}%"></span></div>
        <span class="chart-label">${formatDay(day.date)}</span>
      </div>`;
    }).join("");
  }

  function renderDevices(devices) {
    const labels = { mobile: "Celular", tablet: "Tablet", desktop: "Computador" };
    const total = Math.max(1, Object.values(devices).reduce((sum, value) => sum + value, 0));
    $("device-list").innerHTML = Object.entries(labels).map(([key, label]) => {
      const value = devices[key] || 0;
      const percentage = Math.round((value / total) * 100);
      return `<div class="device-row"><div class="device-meta"><span>${label}</span><strong>${formatNumber(value)} <small>${percentage}%</small></strong></div><div class="device-track"><span style="width:${percentage}%"></span></div></div>`;
    }).join("");
  }

  function render(data) {
    $("historical-unique").textContent = formatNumber(data.uniqueVisitors);
    $("today-unique").textContent = formatNumber(data.today.uniqueVisitors);
    $("active-now").textContent = formatNumber(data.activeNow);
    $("today-careers").textContent = formatNumber(data.today.careerStarts);
    $("total-visits").textContent = formatNumber(data.totalVisits);
    $("total-unique").textContent = formatNumber(data.uniqueVisitors);
    $("total-careers").textContent = formatNumber(data.totalCareerStarts);
    $("updated-at").textContent = `Atualizado às ${new Date(data.updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
    renderChart(data.days);
    renderDevices(data.devices);
  }

  async function loadMetrics() {
    try {
      const data = await request("/api/admin/metrics");
      showDashboard();
      render(data);
    } catch (error) {
      if (error.status === 401) {
        sessionToken = "";
        sessionStorage.removeItem(TOKEN_KEY);
        showLogin();
      }
      else showLogin(openedAsFile
        ? "Servidor local não encontrado. Execute npm start e tente novamente."
        : "Não foi possível atualizar agora");
    }
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginError.textContent = "";
    const button = loginForm.querySelector("button");
    button.disabled = true;
    try {
      const result = await request("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ password: $("admin-password").value }),
      });
      sessionToken = result.token || "";
      if (sessionToken) sessionStorage.setItem(TOKEN_KEY, sessionToken);
      $("admin-password").value = "";
      await loadMetrics();
    } catch (error) {
      loginError.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });

  $("logout-button").addEventListener("click", async () => {
    await request("/api/admin/logout", { method: "POST" }).catch(() => {});
    sessionToken = "";
    sessionStorage.removeItem(TOKEN_KEY);
    showLogin();
  });

  loadMetrics();
  window.setInterval(loadMetrics, 20 * 1000);
})();

// fx.js — camada de apresentação: acento dinâmico por time, HUD, notificações,
// diálogos, gráficos (radar / evolução), micro-interações e atalhos de teclado.
//
// Não muda regra de jogo nenhuma: envolve as funções do UI para acrescentar
// visual em cima do que já é renderizado.

const FX = (function () {
  const $ = (id) => document.getElementById(id);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------------------------------------------------------------- cores --
  // Um tom vívido por franquia, escolhido pra funcionar sobre fundo escuro.
  const TEAM_COLORS = {
    bos: "#2fbf71", bkn: "#cbd5e1", nyk: "#ff8b2c", phi: "#2f8ef7", tor: "#ef3b5a",
    chi: "#ee3a4a", cle: "#ffc734", det: "#5b8cff", ind: "#ffd23f", mil: "#35c47c",
    atl: "#f4525a", cha: "#9b8cff", mia: "#ff3d6e", orl: "#3fa9f5", was: "#5b7bff",
    den: "#fec524", min: "#4ec3f5", okc: "#ff6a4d", por: "#ff4d4d", uta: "#ffb020",
    gsw: "#ffc72c", lac: "#ff5470", lal: "#b07dff", phx: "#ff8c42", sac: "#9d5cff",
    dal: "#4f9bff", hou: "#ff4d5e", mem: "#5aa9e6", nop: "#d4af4f", sas: "#c9d3de",
  };
  const DEFAULT_ACCENT = "#ff7a1a";

  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  function lighten(hex, amount) {
    const { r, g, b } = hexToRgb(hex);
    const mix = (c) => Math.round(c + (255 - c) * amount);
    return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
  }
  function rgba(hex, a) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  function luminance(hex) {
    const { r, g, b } = hexToRgb(hex);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }

  let currentAccentTeam = null;
  function setAccent(teamId) {
    if (teamId === currentAccentTeam) return;
    currentAccentTeam = teamId;
    const hex = TEAM_COLORS[teamId] || DEFAULT_ACCENT;
    const root = document.documentElement.style;
    root.setProperty("--accent", hex);
    root.setProperty("--accent-2", lighten(hex, 0.32));
    root.setProperty("--accent-soft", rgba(hex, 0.13));
    root.setProperty("--accent-line", rgba(hex, 0.38));
    root.setProperty("--accent-ink", luminance(hex) > 0.55 ? "#140c02" : "#0b0f16");
  }

  // ----------------------------------------------------------- ondulação --
  document.addEventListener("pointerdown", (ev) => {
    const btn = ev.target.closest(".btn, .pick-card, .icon-btn");
    if (!btn || btn.disabled || reduceMotion) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const ripple = document.createElement("span");
    ripple.className = "ripple";
    ripple.style.width = ripple.style.height = size + "px";
    ripple.style.left = ev.clientX - rect.left - size / 2 + "px";
    ripple.style.top = ev.clientY - rect.top - size / 2 + "px";
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 620);
  });

  // ------------------------------------------------------------- toasts ---
  const TOAST_ICONS = { success: "✅", warn: "⚠️", error: "⛔", info: "ℹ️" };
  function toast(message, type, title) {
    const stack = $("toast-stack");
    if (!stack) return;
    const el = document.createElement("div");
    el.className = "toast " + (type || "info");
    el.innerHTML = `
      <span class="ico">${TOAST_ICONS[type] || TOAST_ICONS.info}</span>
      <span class="msg">${title ? `<b>${escapeHTML(title)}</b>` : ""}<small>${escapeHTML(message)}</small></span>
    `;
    stack.appendChild(el);
    const kill = () => {
      el.classList.add("out");
      setTimeout(() => el.remove(), 320);
    };
    el.addEventListener("click", kill);
    setTimeout(kill, 4200);
  }

  function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  // ----------------------------------------------------- diálogo confirm --
  function confirmDialog(title, text, okLabel) {
    return new Promise((resolve) => {
      const modal = $("modal-confirm");
      $("confirm-title").textContent = title;
      $("confirm-text").textContent = text;
      $("btn-confirm-ok").textContent = okLabel || "Confirmar";
      modal.classList.remove("hidden");
      const done = (value) => {
        modal.classList.add("hidden");
        resolve(value);
      };
      $("btn-confirm-ok").onclick = () => done(true);
      $("btn-confirm-cancel").onclick = () => done(false);
      modal.onclick = (ev) => { if (ev.target === modal) done(false); };
    });
  }

  // -------------------------------------------------------- tela de espera -
  function busy(on) {
    let el = $("sim-overlay");
    if (on) {
      if (el) return;
      el = document.createElement("div");
      el.id = "sim-overlay";
      el.className = "sim-overlay";
      el.innerHTML = `<div class="sim-ball"></div>`;
      document.body.appendChild(el);
    } else if (el) {
      el.remove();
    }
  }

  // ------------------------------------------------------ números animados -
  function animateNumber(el, to, decimals) {
    if (!el) return;
    const from = parseFloat(String(el.textContent).replace(/[^\d.-]/g, "")) || 0;
    const d = decimals || 0;
    if (reduceMotion || from === to) {
      el.textContent = to.toFixed(d);
      return;
    }
    const start = performance.now();
    const dur = 620;
    function step(now) {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = (from + (to - from) * eased).toFixed(d);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ------------------------------------------------------ radar de atributos
  function renderRadar(container, career) {
    if (!container) return;
    const keys = ATTR_KEYS;
    const size = 300;
    const cx = size / 2;
    const cy = size / 2 - 4;
    const radius = 96;
    const step = (Math.PI * 2) / keys.length;

    const pointAt = (i, ratio) => {
      const angle = -Math.PI / 2 + i * step;
      return [cx + Math.cos(angle) * radius * ratio, cy + Math.sin(angle) * radius * ratio];
    };

    // anéis de referência
    let rings = "";
    [0.25, 0.5, 0.75, 1].forEach((r) => {
      const pts = keys.map((_, i) => pointAt(i, r).map((n) => n.toFixed(1)).join(",")).join(" ");
      rings += `<polygon class="radar-grid-line" points="${pts}" />`;
    });

    // eixos + rótulos
    let axes = "";
    keys.forEach((k, i) => {
      const [x, y] = pointAt(i, 1);
      const [lx, ly] = pointAt(i, 1.24);
      axes += `<line class="radar-axis" x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" />`;
      // Só a sigla: o número exato (e o teto) já está na barra logo abaixo.
      axes += `<text class="radar-label" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${k}</text>`;
    });

    const ceilPts = keys
      .map((k, i) => pointAt(i, Math.min(1, ((career.ceilings && career.ceilings[k]) || 99) / 99)).map((n) => n.toFixed(1)).join(","))
      .join(" ");
    const valuePts = keys
      .map((k, i) => pointAt(i, Math.max(0.02, career.attrs[k] / 99)).map((n) => n.toFixed(1)).join(","))
      .join(" ");
    const dots = keys
      .map((k, i) => {
        const [x, y] = pointAt(i, Math.max(0.02, career.attrs[k] / 99));
        return `<circle class="radar-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" />`;
      })
      .join("");

    container.innerHTML = `
      <svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Radar de atributos">
        ${rings}${axes}
        <polygon class="radar-ceiling" points="${ceilPts}" />
        <polygon class="radar-shape" points="${valuePts}" />
        ${dots}
      </svg>
    `;
  }

  // ------------------------------------------------- curva de evolução ----
  function renderSparkline(container, careerLog) {
    if (!container) return;
    if (!careerLog || careerLog.length < 2) {
      container.innerHTML = "";
      return;
    }
    const w = 640;
    const h = 108;
    const padX = 26;
    const padY = 14;
    const n = careerLog.length;

    const series = [
      { key: "ovr", color: "var(--accent)", label: "OVR", values: careerLog.map((e) => e.ovr) },
      { key: "ppg", color: "var(--cyan)", label: "PPG", values: careerLog.map((e) => parseFloat(e.ppg)) },
    ];

    const x = (i) => padX + (i * (w - padX * 2)) / Math.max(1, n - 1);

    let paths = "";
    series.forEach((s, si) => {
      const min = Math.min.apply(null, s.values);
      const max = Math.max.apply(null, s.values);
      const span = Math.max(1, max - min);
      const y = (v) => h - padY - ((v - min) / span) * (h - padY * 2);
      const d = s.values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
      const area = `${d} L${x(n - 1).toFixed(1)},${h - padY} L${x(0).toFixed(1)},${h - padY} Z`;
      const approxLen = (w - padX * 2) * 1.6;
      paths += `<path class="spark-area" d="${area}" fill="${s.color}" />`;
      paths += `<path class="spark-line draw" style="--len:${approxLen};animation-delay:${si * 0.25}s" d="${d}" stroke="${s.color}" />`;
      paths += s.values
        .map((v, i) => `<circle class="spark-dot" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" fill="${s.color}" />`)
        .join("");
    });

    // marcas de temporada (no máximo 6 rótulos pra não poluir)
    const stepLabel = Math.ceil(n / 6);
    const ticks = careerLog
      .map((e, i) => (i % stepLabel === 0 || i === n - 1
        ? `<text class="spark-tick" x="${x(i).toFixed(1)}" y="${h - 1}" text-anchor="middle">T${e.season}</text>`
        : ""))
      .join("");

    container.innerHTML = `
      <div class="sparkline-head">
        <span>Evolução da carreira</span>
        <span class="sparkline-legend">
          <span><i style="background:var(--accent)"></i>OVR</span>
          <span><i style="background:var(--cyan)"></i>PPG</span>
        </span>
      </div>
      <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Evolução de OVR e pontos por jogo">
        <line class="spark-axis" x1="${padX}" y1="${h - padY}" x2="${w - padX}" y2="${h - padY}" />
        ${paths}${ticks}
      </svg>
    `;
  }

  // ---------------------------------------------------------------- HUD ---
  let lastHUD = {};
  function renderHUD(career) {
    const bar = $("appbar-stats");
    if (!bar) return;
    const teamNm = UI.teamName(career.team);
    const seasonLabel = career.season + (career.seasonState ? 0 : 1);
    // Só a identidade do jogador aqui — dinheiro, físico e confiança ficam no
    // card, sem repetir a mesma informação em dois lugares da tela.
    const chips = [
      { k: "season", l: "Temp", v: seasonLabel },
      { k: "team", l: "", v: teamNm, accent: true },
      { k: "ovr", l: "OVR", v: career.ovr, accent: true },
      { k: "age", l: "Idade", v: career.age },
    ];
    bar.innerHTML = chips
      .map((c) => {
        const bump = lastHUD[c.k] !== undefined && lastHUD[c.k] !== c.v ? " bump" : "";
        lastHUD[c.k] = c.v;
        return `<span class="hud-chip${c.accent ? " accent" : ""}${bump}" data-k="${c.k}">${c.l ? c.l + " " : ""}<strong>${escapeHTML(c.v)}</strong></span>`;
      })
      .join("");
  }

  // ------------------------------------------- colunas extras da tabela ---
  // Padrão enxuto; quem quiser o box score inteiro liga num clique.
  function initColumnToggle() {
    const buttons = document.querySelectorAll(".js-toggle-cols");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tables = document.querySelectorAll("#pc-log-table, #retire-log-table");
        const showingAll = !tables[0].classList.contains("table-compact");
        tables.forEach((t) => t.classList.toggle("table-compact", showingAll));
        buttons.forEach((b) => { b.textContent = showingAll ? "Estatísticas completas" : "Mostrar menos"; });
      });
    });
  }

  // -------------------------------------------------- realces pontuais ----
  let knownCeilings = null;
  function markNewCeiling(career) {
    const current = ALL_ATTR_KEYS.filter((k) => career.ceilings && career.ceilings[k]);
    if (knownCeilings) {
      const fresh = current.filter((k) => knownCeilings.indexOf(k) === -1);
      if (fresh.length) {
        const idx = ALL_ATTR_KEYS.indexOf(fresh[0]);
        const box = document.querySelectorAll("#draft-current-attrs .attr-mini")[idx];
        if (box) box.classList.add("just-stolen");
      }
    }
    knownCeilings = current;
  }

  // No celular a barra de ações vira fixa no rodapé — reserva o espaço dela
  // no fim da página pra ela nunca cobrir o último card.
  function syncActionBar() {
    const bar = document.querySelector(".career-actions");
    const app = $("app");
    if (!bar || !app) return;
    const fixed = getComputedStyle(bar).position === "fixed";
    app.style.paddingBottom = fixed ? bar.offsetHeight + 28 + "px" : "";
  }

  // --------------------------------------------------- atalhos de teclado --
  function anyModalOpen() {
    return Array.prototype.some.call(
      document.querySelectorAll(".modal-overlay"),
      (m) => !m.classList.contains("hidden")
    );
  }
  function activeScreenId() {
    const s = document.querySelector(".screen.active");
    return s ? s.id : null;
  }
  function clickIfEnabled(id) {
    const el = $(id);
    if (el && !el.disabled && !el.classList.contains("hidden")) el.click();
  }

  function initShortcuts() {
    document.addEventListener("keydown", (ev) => {
      const tag = (ev.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea") return;

      if (ev.key === "Escape") {
        const shortcuts = $("modal-shortcuts");
        const confirmM = $("modal-confirm");
        if (!shortcuts.classList.contains("hidden")) { shortcuts.classList.add("hidden"); return; }
        if (!confirmM.classList.contains("hidden")) { $("btn-confirm-cancel").click(); return; }
        if (anyModalOpen()) return;
        const backs = {
          "screen-physical": "btn-physical-back",
          "screen-frontoffice": "btn-frontoffice-back",
          "screen-roster": "btn-roster-back",
          "screen-trophyroom": "btn-trophyroom-back",
          "screen-standings": "btn-standings-back",
          "screen-leaderboard": "btn-leaderboard-back",
          "screen-create": "btn-back-menu",
        };
        const btn = backs[activeScreenId()];
        if (btn) clickIfEnabled(btn);
        return;
      }

      if (anyModalOpen() || activeScreenId() !== "screen-career") return;

      const map = {
        " ": "btn-sim-season",
        f: "btn-nav-physical",
        t: "btn-nav-frontoffice",
        e: "btn-nav-roster",
        c: "btn-standings",
        r: "btn-open-trophyroom",
      };
      const target = map[ev.key.toLowerCase()] || map[ev.key];
      if (target) {
        ev.preventDefault();
        clickIfEnabled(target);
      }
    });

    $("btn-shortcuts").addEventListener("click", () => $("modal-shortcuts").classList.remove("hidden"));
    $("btn-shortcuts-close").addEventListener("click", () => $("modal-shortcuts").classList.add("hidden"));
    $("modal-shortcuts").addEventListener("click", (ev) => {
      if (ev.target === $("modal-shortcuts")) $("modal-shortcuts").classList.add("hidden");
    });
  }

  // ------------------------------------------------- envolvendo o UI ------
  const HUD_SCREENS = ["screen-career", "screen-physical", "screen-frontoffice", "screen-roster", "screen-trophyroom", "screen-standings"];

  function wrapUI() {
    const origShowScreen = UI.showScreen;
    UI.showScreen = function (id) {
      origShowScreen(id);
      $("appbar").classList.toggle("hidden", HUD_SCREENS.indexOf(id) === -1);
      if (id === "screen-menu") setAccent(null);
    };

    const origDashboard = UI.renderCareerDashboard;
    UI.renderCareerDashboard = function (career) {
      const prevOVR = $("pc-ovr").textContent;
      const prevPot = $("pc-potential-ovr").textContent;
      origDashboard(career);
      setAccent(career.team);
      // OVR sobe contando, em vez de trocar de número seco
      $("pc-ovr").textContent = prevOVR;
      $("pc-potential-ovr").textContent = prevPot;
      animateNumber($("pc-ovr"), career.ovr);
      animateNumber($("pc-potential-ovr"), Engine.computePotentialOVR(career));
      renderRadar($("pc-radar"), career);
      renderSparkline($("pc-sparkline"), career.careerLog);
      // (os troféus já vêm marcados do ui.js)
      renderHUD(career);
      syncActionBar();
    };

    const origDraft = UI.renderDraftRound;
    UI.renderDraftRound = function (career, drill) {
      origDraft(career, drill);
      if (career.currentRoll) setAccent(career.currentRoll.teamId);
      markNewCeiling(career);
    };

    const origRetire = UI.renderRetireScreen;
    UI.renderRetireScreen = function (career) {
      origRetire(career);
      renderSparkline($("retire-sparkline"), career.careerLog);
    };

    // As animações grandes já entram na cor do time envolvido.
    const origReveal = UI.playDraftRevealAnimation;
    UI.playDraftRevealAnimation = function (reveal, onDone) {
      if (reveal && reveal.teamId) setAccent(reveal.teamId);
      origReveal(reveal, onDone);
    };

    const origTrade = UI.playTradeAnimation;
    UI.playTradeAnimation = function (pkg, onDone) {
      if (pkg && pkg.toTeamId) setAccent(pkg.toTeamId);
      origTrade(pkg, onDone);
      if (pkg) toast(`${pkg.fromTeamName} → ${pkg.toTeamName}`, "info", "Você foi trocado");
    };

    const origPhysical = UI.renderPhysicalScreen;
    UI.renderPhysicalScreen = function (career) {
      origPhysical(career);
      renderHUD(career);
    };

    const origFrontOffice = UI.renderFrontOfficeScreen;
    UI.renderFrontOfficeScreen = function (career) {
      origFrontOffice(career);
      renderHUD(career);
    };
  }

  // ------------------------------------------------------------- início ---
  document.addEventListener("DOMContentLoaded", () => {
    wrapUI();
    initShortcuts();
    initColumnToggle();
    syncActionBar();
    window.addEventListener("resize", syncActionBar);

    $("appbar-home").addEventListener("click", () => {
      if (localStorage.getItem("bl_active_career")) {
        $("btn-continue-career").classList.remove("hidden");
      }
      UI.showScreen("screen-menu");
    });

    // fechar modais informativos clicando fora
    ["modal-season", "modal-championship"].forEach((id) => {
      const m = $(id);
      m.addEventListener("click", (ev) => {
        if (ev.target !== m) return;
        const btn = m.querySelector(".btn:not(.hidden)");
        if (btn) btn.click();
      });
    });
  });

  return { toast, confirm: confirmDialog, busy, setAccent, renderRadar, renderSparkline, renderHUD, animateNumber };
})();

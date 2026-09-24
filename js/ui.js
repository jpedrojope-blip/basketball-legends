// ui.js — funções de renderização puras (recebem dados, mexem no DOM). Sem estado próprio,
// exceto o estado transitório do passo do draft (escolher jogador -> escolher atributo), que o main.js gerencia.

const UI = (function () {
  const $ = (id) => document.getElementById(id);

  // Dados vindos do localStorage podem ser adulterados pelo jogador.
  // Escapar texto antes de colocá-lo em HTML evita XSS em saves manipulados.
  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/["]/g, "&quot;")
      .replace(/[\u0027]/g, "&#39;");
  }

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    $(id).classList.add("active");
    window.scrollTo(0, 0);
  }

  function renderPositionGrid(container, onPick) {
    container.innerHTML = "";
    Object.entries(POSITIONS).forEach(([key, pos]) => {
      const btn = document.createElement("button");
      btn.className = "pick-card pos-card";
      btn.dataset.pos = key;
      btn.innerHTML = `<strong>${key}</strong><span>${pos.label}</span>`;
      btn.addEventListener("click", () => onPick(key, btn));
      container.appendChild(btn);
    });
  }

  function markSelected(container, selector, activeEl) {
    container.querySelectorAll(selector).forEach((el) => el.classList.remove("selected"));
    activeEl.classList.add("selected");
  }

  // ---------- DRAFT: uma lenda é sorteada, você escolhe o atributo ----------
  // `drill` = { step: "player"|"attr", legendId }
  function computeAutoDrill(career) {
    const roll = career.currentRoll;
    return { step: "attr", legendId: roll.legendIds[0] };
  }

  function starString(value, max) {
    max = max || 5;
    return "★".repeat(value) + "☆".repeat(Math.max(0, max - value));
  }

  function renderDraftRound(career, drill) {
    const roll = career.currentRoll;
    $("draft-round-label").textContent = `Rodada ${career.draftRound + 1} / ${ALL_ATTR_KEYS.length}`;
    $("draft-progress-fill").style.width = `${(career.draftRound / ALL_ATTR_KEYS.length) * 100}%`;
    const legend = LEGENDS.find((l) => l.id === roll.legendIds[0]);
    $("draft-roll-label").textContent = `${legend.name} · Draft ${legend.draftYear}`;
    $("draft-current-ovr").textContent = career.ovr;
    $("btn-draft-reroll").innerHTML = `Girar novamente (<span id="draft-rerolls-left">${career.rerollsLeft}</span> ${career.rerollsLeft === 1 ? "restante" : "restantes"})`;
    $("btn-draft-reroll").classList.toggle("hidden", career.rerollsLeft <= 0);

    renderBreadcrumb(drill);
    renderDraftOptions(career, roll, drill);
    renderCurrentAttrs(career);
  }

  function renderBreadcrumb(drill) {
    const el = $("draft-breadcrumb");
    el.innerHTML = "";
  }

  function playPlayerRoulette(roll, onDone) {
    const modal = $("modal-player-roulette");
    const wheelEl = $("player-roulette-wheel");
    const metaEl = $("player-roulette-meta");
    const closeBtn = $("btn-player-roulette-close");
    const winner = LEGENDS.find((legend) => legend.id === roll.legendIds[0]);
    let ticks = 0;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const totalTicks = reduceMotion ? 1 : 22;

    const previews = Array.from({ length: 8 }, (_, i) => LEGENDS[(i * 7 + roll.draftYear) % LEGENDS.length]);
    const winnerIndex = previews.findIndex((p) => p.id === winner.id);
    if (winnerIndex < 0) previews[0] = winner;
    const finalIndex = winnerIndex < 0 ? 0 : winnerIndex;
    wheelEl.innerHTML = `<small>LENDA ATUAL</small><strong>${escapeHTML(previews[0].name)}</strong><span>${escapeHTML(previews[0].pos)} · DRAFT ${escapeHTML(previews[0].draftYear)} · ${escapeHTML(teamName(previews[0].team))}</span>`;
    metaEl.textContent = "A roleta está girando";
    closeBtn.classList.add("hidden");
    modal.classList.remove("hidden");

    const interval = setInterval(() => {
      const preview = LEGENDS[(ticks * 7 + roll.draftYear) % LEGENDS.length];
    wheelEl.innerHTML = `<small>LENDA ATUAL</small><strong>${escapeHTML(preview.name)}</strong><span>${escapeHTML(preview.pos)} · DRAFT ${escapeHTML(preview.draftYear)} · ${escapeHTML(teamName(preview.team))}</span>`;
      metaEl.textContent = `${preview.pos} · Draft ${preview.draftYear}`;
      ticks++;
      if (ticks >= totalTicks) {
        clearInterval(interval);
        wheelEl.innerHTML = `<small>LENDA ATUAL</small><strong>${escapeHTML(winner.name)}</strong><span>${escapeHTML(winner.pos)} · DRAFT ${escapeHTML(winner.draftYear)} · ${escapeHTML(teamName(winner.team))}</span>`;
        wheelEl.classList.add("landed");
        metaEl.textContent = `${winner.pos} · Draft ${winner.draftYear} · ${teamName(winner.team)}`;
        closeBtn.classList.remove("hidden");
        closeBtn.focus();
      }
    }, reduceMotion ? 1 : 75);

    closeBtn.onclick = () => {
      modal.classList.add("hidden");
      onDone();
    };
  }

  function renderDraftOptions(career, roll, drill) {
    const container = $("draft-options");
    const titleEl = $("draft-step-title");
    container.innerHTML = "";

    const legend = LEGENDS.find((l) => l.id === drill.legendId);
    titleEl.textContent = `Escolha o atributo pra roubar de ${legend.name}`;
    container.className = "draft-options attr-pick-step";
    ALL_ATTR_KEYS.forEach((k) => {
      const isStar = STAR_KEYS.indexOf(k) !== -1;
      const value = isStar ? legend.stars[k] : legend.stats[k];
      const alreadyTaken = (career.ceilings[k] || 0) !== 0;
      const startPreview = isStar ? Math.max(1, Math.round(value * 0.6)) : Math.round(value * 0.6);
      const row = document.createElement("button");
      row.className = "attr-pick-row" + (alreadyTaken ? " taken" : "");
      row.disabled = alreadyTaken;
      row.innerHTML = `
        <span class="attr-pick-label">${ATTR_LABELS[k]}</span>
        <span class="attr-pick-value">${isStar ? starString(value) : value}</span>
        <span class="attr-pick-status">${alreadyTaken ? "já escolhido" : `você começaria com ${isStar ? starString(startPreview) : startPreview}`}</span>
      `;
      if (!alreadyTaken) row.addEventListener("click", () => window.__blOnDraftAttrPick(legend.id, k));
      container.appendChild(row);
    });
  }

  function renderCurrentAttrs(career) {
    const grid = $("draft-current-attrs");
    grid.innerHTML = "";
    ALL_ATTR_KEYS.forEach((k) => {
      const isStar = STAR_KEYS.indexOf(k) !== -1;
      const box = document.createElement("div");
      box.className = "attr-mini";
      const ceiling = career.ceilings[k];
      const v = isStar ? (career.attrs[k] ? starString(career.attrs[k]) : "—") : career.attrs[k];
      const ceilTxt = ceiling ? (isStar ? "teto " + starString(ceiling) : "teto " + ceiling) : "—";
      box.innerHTML = `<div class="k">${k}</div><div class="v">${v}</div><div class="ceil">${ceilTxt}</div>`;
      grid.appendChild(box);
    });
  }

  function renderAttrBars(container, career) {
    container.innerHTML = "";
    ATTR_KEYS.forEach((k) => {
      const row = document.createElement("div");
      row.className = "attr-bar-row";
      const ceiling = career.ceilings ? career.ceilings[k] || 99 : 99;
      const pct = Math.max(2, Math.min(100, (career.attrs[k] / 99) * 100));
      const ceilPct = Math.max(0, Math.min(100, (ceiling / 99) * 100));
      row.innerHTML = `
        <div class="label">${ATTR_LABELS[k]}</div>
        <div class="attr-bar-track">
          <div class="attr-bar-ceiling" style="left:${ceilPct}%"></div>
          <div class="attr-bar-fill" style="width:${pct}%"></div>
        </div>
        <div class="val">${career.attrs[k]}<small>/${ceiling}</small></div>
      `;
      container.appendChild(row);
    });
    STAR_KEYS.forEach((k) => {
      const row = document.createElement("div");
      row.className = "attr-bar-row star-row";
      const ceiling = career.ceilings ? career.ceilings[k] || 5 : 5;
      row.innerHTML = `
        <div class="label">${ATTR_LABELS[k]}</div>
        <div class="star-display">${starString(career.attrs[k] || 0)}</div>
        <div class="val">${career.attrs[k] || 0}<small>/${ceiling}</small></div>
      `;
      container.appendChild(row);
    });
  }

  const TROPHY_LABELS = {
    mvp: "MVP", dpoy: "Melhor Defensor", roy: "Novato do Ano", mip: "Mais Melhorado",
    sixthMan: "Sexto Homem", scoringTitles: "Artilheiro", allStar: "All-Star",
    allNBA: "All-NBA", allDefense: "Equipe de Defesa", champions: "Anéis", finalsMVP: "MVP das Finais",
  };

  // Só mostra o que foi conquistado — uma parede de zeros não informa nada.
  function renderTrophies(container, trophies) {
    const earned = Object.entries(TROPHY_LABELS).filter(([key]) => (trophies[key] || 0) > 0);
    if (!earned.length) {
      container.innerHTML = `<p class="empty-note">Nenhum prêmio ainda. Eles aparecem aqui conforme você conquista.</p>`;
      return;
    }
    container.innerHTML = earned
      .map(([key, label]) => `<div class="trophy-item earned"><div class="n">${trophies[key]}</div><div class="l">${label}</div></div>`)
      .join("");
  }

  function formatPlayoff(entry) {
    if (entry.champion) return "🏆 Campeão";
    if (entry.playoffPhase) return `Eliminado — ${entry.playoffPhase}`;
    return "Fora dos playoffs";
  }

  function awardsBadgesHTML(entry) {
    if (!entry.awards || !entry.awards.length) return "";
    return entry.awards
      .map((a) => `<span class="badge${a === "Campeão" ? " champ" : ""}">${escapeHTML(a)}</span>`)
      .join("");
  }

  // As colunas marcadas com `col-extra` só aparecem no modo "estatísticas completas".
  function logRowHTML(entry) {
    return `<tr>
      <td>${entry.season}</td>
      <td>${entry.age}</td>
      <td>${escapeHTML(entry.team)}</td>
      <td>${entry.ovr}</td>
      <td class="col-extra">${entry.chemistry}</td>
      <td class="col-extra">${entry.gp}</td>
      <td>${entry.ppg}</td>
      <td>${entry.rpg}</td>
      <td>${entry.apg}</td>
      <td class="col-extra">${entry.tov}</td>
      <td class="col-extra">${entry.fgPct}%</td>
      <td class="col-extra">${entry.ftPct}%</td>
      <td class="col-extra">${entry.eff}</td>
      <td>${entry.teamWins}-${entry.teamLosses}</td>
      <td>${escapeHTML(formatPlayoff(entry))}</td>
      <td>${awardsBadgesHTML(entry) || '<span class="muted">—</span>'}</td>
    </tr>`;
  }

  function renderLog(tbody, careerLog) {
    tbody.innerHTML = careerLog.map(logRowHTML).join("");
  }

  function renderLastSeason(container, entry) {
    if (!entry) {
      container.innerHTML = `<p class="muted">Ainda não concluiu nenhuma temporada.</p>`;
      return;
    }
    // Quatro números que contam a temporada, o resto em uma linha só.
    container.innerHTML = `
      <div class="mini-stats">
        <div class="mini-stat"><span class="n">${entry.ppg}</span><span class="l">PPG</span></div>
        <div class="mini-stat"><span class="n">${entry.rpg}</span><span class="l">RPG</span></div>
        <div class="mini-stat"><span class="n">${entry.apg}</span><span class="l">APG</span></div>
        <div class="mini-stat"><span class="n">${entry.eff}</span><span class="l">EFF</span></div>
      </div>
      <p class="recap-line">
        Temporada ${escapeHTML(entry.season)} · ${escapeHTML(entry.age)} anos · ${escapeHTML(entry.team)} —
        <strong>${entry.teamWins}-${entry.teamLosses}</strong>, ${formatPlayoff(entry)}
      </p>
      <div class="awards-line">${awardsBadgesHTML(entry) || '<span class="muted">Nenhum prêmio nesta temporada.</span>'}</div>
    `;
  }

  // ---------- Calendário: ritmo, progresso do mês e último jogo ----------
  function simModeSwitchHTML(career) {
    const mode = career.simMode || "month";
    return `
      <div class="seg-switch" role="group" aria-label="Ritmo da simulação">
        <button class="seg-option${mode === "game" ? " active" : ""}" data-sim-mode="game">Jogo a jogo</button>
        <button class="seg-option${mode === "month" ? " active" : ""}" data-sim-mode="month">Mês a mês</button>
      </div>
    `;
  }

  function bindSimModeButtons(container) {
    container.querySelectorAll("[data-sim-mode]").forEach((button) => {
      button.addEventListener("click", () => window.__blOnSetSimMode(button.dataset.simMode));
    });
  }

  function lastGameHTML(ss) {
    const g = ss.recentGames && ss.recentGames[ss.recentGames.length - 1];
    if (!g) return "";
    const line = g.played
      ? `${g.pts} pts · ${g.reb} reb · ${g.ast} ast`
      : g.recovering ? "em recuperação de cirurgia" : "fora por contusão";
    return `
      <div class="last-game ${g.won ? "win" : "loss"}">
        <div class="lg-result">${g.won ? "V" : "D"}</div>
        <div class="lg-body">
        <div class="lg-score">${escapeHTML(g.teamScore)} <span>x</span> ${escapeHTML(g.oppScore)} <em>vs ${escapeHTML(g.opponent)}</em></div>
          <div class="lg-line">${line}</div>
        </div>
        <div class="lg-when">${g.month} · jogo ${g.gameInMonth}/${g.gamesInMonth}</div>
      </div>
    `;
  }

  function renderCalendar(container, career) {
    const ss = career.seasonState;
    if (!ss) {
      container.innerHTML = `
        ${simModeSwitchHTML(career)}
        <div class="calendar-empty">
          <strong>Pronto para a próxima temporada</strong>
          <p class="muted">Aperte o botão principal abaixo para começar a Temporada ${career.season + 1}. Você poderá acompanhar o recorde, os jogos e suas médias aqui.</p>
        </div>
      `;
      bindSimModeButtons(container);
      return;
    }

    const chips = ss.monthNames
      .map((name, i) => {
        const done = i < ss.monthIndex;
        const current = i === ss.monthIndex && ss.phase === "regular";
        const cls = done ? "month-chip done" : current ? "month-chip current" : "month-chip pending";
        return `<div class="${cls}">${name.slice(0, 3)}</div>`;
      })
      .join("");

    const gp = Math.max(1, ss.gp);
    const ppgSoFar = (ss.statTotals.pts / gp).toFixed(1);
    const rpgSoFar = (ss.statTotals.reb / gp).toFixed(1);
    const apgSoFar = (ss.statTotals.ast / gp).toFixed(1);

    let phaseHTML = "";
    if (ss.phase === "playoffs") {
      const rn = ss.playoff.roundNames[ss.playoff.roundIndex];
      phaseHTML = `<p class="calendar-phase">🏀 Nos playoffs — próxima rodada: <strong>${rn}</strong>${ss.playoff.roundsWon ? ` (${ss.playoff.roundsWon} vencida${ss.playoff.roundsWon === 1 ? "" : "s"})` : ""}</p>`;
    } else {
      const played = ss.gameInMonth || 0;
      const total = ss.monthsSchedule[ss.monthIndex] || 0;
      phaseHTML = `
        <div class="month-progress">
          <span>${ss.monthNames[ss.monthIndex]} · jogo ${Math.min(played + 1, total)} de ${total}</span>
          <div class="progress-bar"><div class="progress-fill" style="width:${(played / total) * 100}%"></div></div>
        </div>
      `;
    }

    container.innerHTML = `
      ${simModeSwitchHTML(career)}
      <div class="month-strip">${chips}</div>
      ${phaseHTML}
      ${(career.simMode || "month") === "game" ? lastGameHTML(ss) : ""}
      <p class="calendar-help"><strong>Como funciona:</strong> ${career.simMode === "game" ? "cada clique simula um jogo e mostra o box score." : "cada clique fecha o mês inteiro."} O botão rosa abaixo avança a temporada.</p>
      <div class="calendar-stats">
        <span>Recorde <strong>${ss.wins}-${ss.losses}</strong></span>
        <span>PPG <strong>${ppgSoFar}</strong></span>
        <span>RPG <strong>${rpgSoFar}</strong></span>
        <span>APG <strong>${apgSoFar}</strong></span>
        <span>Química <strong>${ss.chemistry.label}</strong></span>
      </div>
    `;
    bindSimModeButtons(container);
  }

  function renderCareerDashboard(career) {
    $("pc-name").textContent = career.name;
    $("pc-meta").textContent = `${POSITIONS[career.position].label} · ${career.age} anos · Temporada ${career.season + (career.seasonState ? 0 : 1)} · ${teamName(career.team)}`;
    $("pc-ovr").textContent = career.ovr;
    $("pc-potential-ovr").textContent = Engine.computePotentialOVR(career);
    renderStatusStrip($("pc-status-strip"), career);
    renderAttrBars($("pc-attrs"), career);
    renderTrophies($("pc-trophies"), career.trophies);
    renderCalendar($("pc-calendar"), career);
    renderLastSeason($("pc-last-season"), career.careerLog[career.careerLog.length - 1]);
    renderLog($("pc-log-body"), career.careerLog);
    updateMainActionButton(career);
    updateSideButtons(career);
  }

  function updateMainActionButton(career) {
    const btn = $("btn-sim-season");
    const ss = career.seasonState;
    const byGame = (career.simMode || "month") === "game";

    if (!ss) {
      btn.textContent = `Começar Temporada ${career.season + 1}`;
      return;
    }
    if (ss.phase === "playoffs") {
      btn.textContent = `Simular ${ss.playoff.roundNames[ss.playoff.roundIndex]}`;
      return;
    }
    if (byGame) {
      const total = ss.monthsSchedule[ss.monthIndex];
      btn.textContent = `Simular Jogo ${Math.min(ss.gameInMonth + 1, total)}/${total}`;
    } else {
      btn.textContent = `Simular ${ss.monthNames[ss.monthIndex]}`;
    }
  }

  function updateSideButtons(career) {
    const midSeason = !!career.seasonState;
    $("btn-request-trade").disabled = midSeason || career.tradeRequestedThisOffseason;
    $("btn-request-trade").title = midSeason ? "Só é possível pedir troca entre temporadas." : (career.tradeRequestedThisOffseason ? "Você já pediu troca nesta entressafra." : "");
    $("btn-retire").disabled = midSeason;
    $("btn-retire").title = midSeason ? "Só é possível se aposentar entre temporadas." : "";
  }

  function teamName(teamId) {
    const t = TEAMS.find((x) => x.id === teamId);
    return t ? t.name : "—";
  }

  function renderStatusStrip(container, career) {
    const durClass = career.durability < 40 ? "low" : career.durability < 65 ? "" : "";
    container.innerHTML = `
      <div class="status-chip">
        <div class="l">💰 Dinheiro</div>
        <div class="v">$${(career.money || 0).toFixed(1)}M</div>
      </div>
      <div class="status-chip ${career.durability < 40 ? "warn" : ""}">
        <div class="l">❤️ Durabilidade ${career.chronicInjury ? "(lesão crônica)" : ""}</div>
        <div class="v">${career.durability}/100</div>
        <div class="bar-mini"><div class="bar-mini-fill durability ${durClass}" style="width:${career.durability}%"></div></div>
      </div>
      <div class="status-chip">
        <div class="l">🤝 Confiança — ${teamName(career.team)}</div>
        <div class="v">${career.teamTrust}/100</div>
        <div class="bar-mini"><div class="bar-mini-fill trust" style="width:${career.teamTrust}%"></div></div>
      </div>
    `;
  }

  // ---------- Físico ----------
  function renderPhysicalScreen(career) {
    renderStatusStrip($("physical-status"), career);

    const regimeGrid = $("regime-grid");
    regimeGrid.innerHTML = "";
    Object.entries(Engine.TRAINING_REGIMES).forEach(([key, regime]) => {
      const btn = document.createElement("button");
      btn.className = "pick-card" + (career.trainingRegime === key ? " selected" : "");
      btn.innerHTML = `<strong>${regime.label}</strong><span>${regime.desc}</span>`;
      btn.title = "Pode trocar o regime a qualquer momento; o efeito vale para o desenvolvimento e desgaste.";
      btn.addEventListener("click", () => window.__blOnSetRegime(key));
      regimeGrid.appendChild(btn);
    });

    const upgrades = $("physical-upgrades");
    upgrades.innerHTML = `
      <div class="upgrade-card">
        <h4>Preparador Físico Pessoal</h4>
        <p>+15% na velocidade de evolução dos atributos e reduz o desgaste de durabilidade.</p>
        ${career.hasTrainer
          ? `<span class="owned">✓ Contratado</span>`
          : `<button id="btn-hire-trainer" class="btn btn-primary btn-sm" ${career.money < Engine.TRAINER_COST ? "disabled" : ""}>Contratar — $${Engine.TRAINER_COST}M</button>`}
      </div>
      <div class="upgrade-card">
        <h4>Instalações de Treino Pessoais</h4>
        <p>+15% adicional na evolução dos atributos e reduz ainda mais o desgaste (precisa do preparador antes).</p>
        ${career.hasFacility
          ? `<span class="owned">✓ Construído</span>`
          : `<button id="btn-build-facility" class="btn btn-primary btn-sm" ${(!career.hasTrainer || career.money < Engine.FACILITY_COST) ? "disabled" : ""}>Construir — $${Engine.FACILITY_COST}M</button>`}
      </div>
    `;
    const trainerBtn = $("btn-hire-trainer");
    const facilityBtn = $("btn-build-facility");
    if (trainerBtn) trainerBtn.addEventListener("click", window.__blOnHireTrainer);
    if (facilityBtn) facilityBtn.addEventListener("click", window.__blOnBuildFacility);

    const canSurgery = career.durability < 70 || career.chronicInjury;
    $("physical-surgery").innerHTML = `
      <div class="surgery-card">
        <p>${canSurgery
          ? `Sua durabilidade está baixa${career.chronicInjury ? " e você está com lesão crônica" : ""}. Cirurgia custa $${Engine.SURGERY_COST}M e te tira dos primeiros meses da próxima temporada, mas restaura boa parte da sua durabilidade.`
          : "Você não precisa de cirurgia agora — sua durabilidade está saudável."}</p>
        <button id="btn-surgery" class="btn btn-danger" ${(!canSurgery || career.money < Engine.SURGERY_COST || career.seasonState) ? "disabled" : ""}>Fazer Cirurgia — $${Engine.SURGERY_COST}M</button>
      </div>
    `;
    const surgeryBtn = $("btn-surgery");
    if (surgeryBtn) surgeryBtn.addEventListener("click", window.__blOnSurgery);
  }

  // ---------- Time / Front Office ----------
  function renderFrontOfficeScreen(career) {
    renderStatusStrip($("frontoffice-status"), career);
    const atCap = (career.requestsThisOffseason || 0) >= Engine.MAX_REQUESTS_PER_OFFSEASON;
    const disabledNote = atCap ? "Limite de 2 pedidos atingido nesta temporada. Você poderá pedir novamente na próxima." : "Até 2 pedidos por temporada — disponíveis durante a temporada e no intervalo.";
    const dis = atCap;

    const grid = $("frontoffice-requests");
    grid.innerHTML = `
      <div class="request-card">
        <h4>Pedir pro Esquema Jogar pra Você</h4>
        <p>O técnico monta o ataque em torno de uma faceta do seu jogo.</p>
        <select id="req-usage-attr">
          ${ATTR_KEYS.map((k) => `<option value="${k}">${ATTR_LABELS[k]}</option>`).join("")}
        </select>
        <button class="btn btn-secondary btn-sm" data-team-request="usage" ${dis || career.schemeFocus ? "disabled" : ""}>Pedir</button>
        ${career.schemeFocus ? `<span class="status-note">Esquema atual: ${ATTR_LABELS[career.schemeFocus]}</span>` : ""}
      </div>

      <div class="request-card">
        <h4>Número da Camisa</h4>
        <p>Pede um número específico pro clube.</p>
        <input type="number" id="req-jersey-num" min="0" max="99" value="${career.jerseyNumber || 23}">
        <button class="btn btn-secondary btn-sm" data-team-request="jersey" ${dis ? "disabled" : ""}>Pedir</button>
        ${career.jerseyNumber ? `<span class="status-note">Sua camisa: #${career.jerseyNumber}</span>` : ""}
      </div>

      <div class="request-card">
        <h4>Ser o Franchise Player</h4>
        <p>Pede pra ser oficialmente o rosto da franquia (precisa de OVR 72+).</p>
        <button class="btn btn-secondary btn-sm" data-team-request="franchise" ${dis || career.isFranchisePlayer ? "disabled" : ""}>Pedir</button>
        ${career.isFranchisePlayer ? `<span class="status-note">✓ Franchise Player do(a) ${teamName(career.franchisePlayerTeamId)}</span>` : ""}
      </div>

      <div class="request-card">
        <h4>Aposentar sua Camisa</h4>
        <p>Só faz sentido depois de anos de casa e legado construído com o time atual.</p>
        <button class="btn btn-secondary btn-sm" data-team-request="retire-number" ${dis || career.numberRetired ? "disabled" : ""}>Pedir</button>
        ${career.numberRetired ? `<span class="status-note">✓ Camisa aposentada pelo(a) ${teamName(career.numberRetiredTeamId)}</span>` : ""}
      </div>

      <div class="request-card">
        <h4>Trocar de Posição</h4>
        <p>Conversa com o técnico pra jogar em outra posição — recalcula seu OVR.</p>
        <select id="req-position-val">
          ${Object.keys(POSITIONS).filter((p) => p !== career.position).map((p) => `<option value="${p}">${p} — ${POSITIONS[p].label}</option>`).join("")}
        </select>
        <button class="btn btn-secondary btn-sm" data-team-request="position" ${dis ? "disabled" : ""}>Pedir</button>
      </div>

      <div class="request-card">
        <h4>Renegociar Salário (aumento)</h4>
        <p>Pede um reajuste salarial baseado no seu desempenho.</p>
        <button class="btn btn-secondary btn-sm" data-team-request="salary-raise" ${dis ? "disabled" : ""}>Pedir aumento</button>
      </div>

      <div class="request-card">
        <h4>Abrir Mão de Salário</h4>
        <p>Aceita ganhar menos pra liberar orçamento — o clube usa isso pra reforçar o time. Sempre aceito.</p>
        <button class="btn btn-secondary btn-sm" data-team-request="salary-cut" ${dis ? "disabled" : ""}>Abrir mão</button>
      </div>

      <div class="request-card">
        <h4>Pedir Reforços</h4>
        <p>Pressiona a diretoria a trazer peças novas pro elenco.</p>
        <button class="btn btn-secondary btn-sm" data-team-request="reinforcements" ${dis ? "disabled" : ""}>Pedir</button>
      </div>

      <div class="request-card">
        <h4>Cláusula de Não-Negociação</h4>
        <p>Impede que o clube te troque sem sua autorização (não afeta pedidos seus de troca).</p>
        <button class="btn btn-secondary btn-sm" data-team-request="no-trade" ${dis || career.noTradeClause ? "disabled" : ""}>Pedir</button>
        ${career.noTradeClause ? `<span class="status-note">✓ Ativa</span>` : ""}
      </div>
    `;
    grid.querySelectorAll("[data-team-request]").forEach((button) => button.addEventListener("click", () => {
      const type = button.dataset.teamRequest;
      const param = type === "usage" ? $("req-usage-attr").value : type === "jersey" ? $("req-jersey-num").value : type === "position" ? $("req-position-val").value : null;
      window.__blOnRequest(type, param);
    }));
    if (disabledNote) {
      const note = document.createElement("p");
      note.className = "muted";
      note.textContent = disabledNote;
      grid.appendChild(note);
    }
  }

  // ---------- Elenco atual ----------
  function renderRosterScreen(career) {
    const roster = Engine.getCurrentRoster(career);
    $("roster-subtitle").textContent = `Elenco do(a) ${roster.teamName} — Temporada ${career.season + (career.seasonState ? 0 : 1)}`;
    $("roster-body").innerHTML = roster.players
      .map((p) => `<tr><td>${escapeHTML(p.name)}</td><td>${escapeHTML(p.role)}</td><td>${escapeHTML(p.ppg)}</td><td>${escapeHTML(p.rpg)}</td><td>${escapeHTML(p.apg)}</td></tr>`)
      .join("");
  }

  // ---------- Sala de troféus ----------
  function renderTrophyRoom(career) {
    const byAward = {};
    career.careerLog.forEach((entry) => {
      (entry.awards || []).forEach((a) => {
        if (!byAward[a]) byAward[a] = [];
        byAward[a].push(entry);
      });
    });
    const order = [
      "MVP", "MVP das Finais", "Melhor Defensor", "Novato do Ano", "Jogador Mais Melhorado",
      "Sexto Homem do Ano", "Artilheiro da Liga", "All-NBA (1ª Equipe)", "All-NBA (2ª Equipe)", "All-NBA (3ª Equipe)",
      "Equipe de Defesa", "All-Star", "Campeão",
    ];
    const seen = new Set();
    let html = "";
    const renderSection = (name, entries) => {
      seen.add(name);
      html += `<div class="trophy-section"><h3>${escapeHTML(name)} (${entries.length})</h3>`;
      if (!entries.length) {
        html += `<p class="trophy-empty">Nunca conquistado.</p>`;
      } else {
        html += `<div class="trophy-season-list">${entries.map((e) => `<span class="trophy-season-chip">Temp ${escapeHTML(e.season)} (${escapeHTML(e.age)} anos) — ${escapeHTML(e.team)}</span>`).join("")}</div>`;
      }
      html += `</div>`;
    };
    order.forEach((name) => renderSection(name, byAward[name] || []));
    Object.keys(byAward).forEach((name) => { if (!seen.has(name)) renderSection(name, byAward[name]); });

    let extra = `<div class="trophy-section"><h3>Legado com o Clube</h3><div class="trophy-season-list">`;
    extra += career.isFranchisePlayer ? `<span class="trophy-season-chip">Franchise Player — ${teamName(career.franchisePlayerTeamId)}</span>` : "";
    extra += career.numberRetired ? `<span class="trophy-season-chip">Camisa Aposentada — ${teamName(career.numberRetiredTeamId)}</span>` : "";
    extra += career.jerseyNumber ? `<span class="trophy-season-chip">Camisa #${career.jerseyNumber}</span>` : "";
    if (!career.isFranchisePlayer && !career.numberRetired && !career.jerseyNumber) extra += `<span class="trophy-empty">Nada ainda.</span>`;
    extra += `</div></div>`;

    $("trophyroom-body").innerHTML = html + extra;
  }

  function renderClosestLegend(container, career) {
    const legend = career.legacy.closestLegend;
    const peak = career.peakAttrs || career.attrs;
    container.innerHTML = `
      <h3>Comparação com a Lenda mais parecida</h3>
      <div class="closest-legend-body">
        <div class="closest-legend-name">${escapeHTML(legend.name)}</div>
        <div class="muted">${escapeHTML(legend.pos)} · ${escapeHTML(legend.era)} · ${escapeHTML(teamName(legend.team))} — ${escapeHTML(legend.tag)}</div>
        <div class="attr-compare-grid">
          ${ATTR_KEYS.map((k) => `
            <div class="attr-compare-row">
              <span class="k">${ATTR_LABELS[k]}</span>
              <span class="v">Você: <strong>${peak[k]}</strong> · ${legend.name.split(" ")[0]}: <strong>${legend.stats[k]}</strong></span>
            </div>
          `).join("")}
          ${STAR_KEYS.map((k) => `
            <div class="attr-compare-row">
              <span class="k">${ATTR_LABELS[k]}</span>
              <span class="v">Você: <strong>${starString(peak[k] || 0)}</strong> · ${legend.name.split(" ")[0]}: <strong>${starString(legend.stars[k])}</strong></span>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  function renderRetireScreen(career) {
    const legacy = career.legacy;
    $("retire-tier-name").textContent = legacy.tier.name;
    $("retire-tier-desc").textContent = legacy.tier.desc;
    $("retire-score").textContent = `Pontuação de legado: ${legacy.score}`;
    $("retire-summary").innerHTML = `
      <div class="stat-box"><div class="n">${legacy.careerPPG}</div><div class="l">PPG de Carreira</div></div>
      <div class="stat-box"><div class="n">${career.peakOVR}</div><div class="l">Pico de OVR</div></div>
      <div class="stat-box"><div class="n">${career.trophies.champions}</div><div class="l">Anéis</div></div>
      <div class="stat-box"><div class="n">${legacy.gamesPlayed}</div><div class="l">Jogos na Carreira</div></div>
    `;
    renderClosestLegend($("retire-closest"), career);
    renderLog($("retire-log-body"), career.careerLog);
  }

  function renderLeaderboard(tbody, entries) {
    if (!entries.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="muted">Nenhuma carreira concluída ainda.</td></tr>`;
      return;
    }
    const sorted = entries.slice().sort((a, b) => b.score - a.score);
    tbody.innerHTML = sorted
      .map(
        (e, i) => `<tr>
        <td>${i + 1}</td><td>${escapeHTML(e.name)}</td><td>${escapeHTML(e.position)}</td><td>${escapeHTML(e.tierName)}</td>
        <td>${e.score}</td><td>${e.careerPPG}</td><td>${e.champions}</td><td>${e.mvp}</td>
      </tr>`
      )
      .join("");
  }

  // ---------- Classificação das conferências ----------
  function renderStandings(career) {
    const rows = Engine.getStandingsSnapshot(career);
    const east = rows.filter((r) => r.conf === "Leste");
    const west = rows.filter((r) => r.conf === "Oeste");
    const rowHTML = (list) =>
      list
        .map(
          (r, i) => `<tr class="${r.isPlayer ? "standings-you" : ""}">
        <td>${i + 1}</td><td>${escapeHTML(r.name)}${r.isPlayer ? " (você)" : ""}</td><td>${escapeHTML(r.wins)}</td><td>${escapeHTML(r.losses)}</td>
      </tr>`
        )
        .join("");
    $("standings-east-body").innerHTML = rowHTML(east);
    $("standings-west-body").innerHTML = rowHTML(west);
    $("standings-subtitle").textContent = career.seasonState
      ? `Andamento da Temporada ${career.season}`
      : career.careerLog.length
      ? `Classificação final da Temporada ${career.season}`
      : "A temporada ainda não começou.";
  }

  // Anima a série de playoffs (qualquer rodada — não só a final).
  // Espera `playoffs` = { lastSeriesRound, lastSeries: {games, won, wins, losses} }
  // ---------- Animação: roleta do draft ----------
  function playDraftRevealAnimation(reveal, onDone) {
    const modal = $("modal-draft-reveal");
    const posEl = $("draft-reveal-position");
    const wheelEl = $("draft-reveal-roulette");
    const closeBtn = $("btn-draft-reveal-close");
    posEl.textContent = `Posição: ${reveal.position}`;
    wheelEl.textContent = "Sorteando...";
    wheelEl.className = "draft-reveal-roulette spinning";
    closeBtn.classList.add("hidden");
    modal.classList.remove("hidden");

    const names = TEAMS.map((t) => t.name);
    let i = 0;
    let ticks = 0;
    const totalTicks = 16;
    const interval = setInterval(() => {
      wheelEl.textContent = names[i % names.length];
      i++;
      ticks++;
      if (ticks >= totalTicks) {
        clearInterval(interval);
        wheelEl.textContent = reveal.teamName;
        wheelEl.className = "draft-reveal-roulette landed";
        closeBtn.classList.remove("hidden");
        closeBtn.onclick = () => {
          modal.classList.add("hidden");
          onDone();
        };
      }
    }, 90);
  }

  // ---------- Animação: troca ----------
  function playTradeAnimation(pkg, onDone) {
    const modal = $("modal-trade-anim");
    $("trade-anim-from-team").textContent = pkg.fromTeamName;
    $("trade-anim-to-team").textContent = pkg.toTeamName;
    $("trade-anim-incoming").innerHTML = pkg.incoming.map((p) => `<div class="trade-piece">${escapeHTML(p)}</div>`).join("");
    modal.classList.remove("hidden");
    const closeBtn = $("btn-trade-anim-close");
    closeBtn.classList.add("hidden");
    setTimeout(() => {
      closeBtn.classList.remove("hidden");
      closeBtn.onclick = () => {
        modal.classList.add("hidden");
        onDone();
      };
    }, 900);
  }

  // ---------- Animação: campeão ----------
  function playChampionshipAnimation(subtitle, onDone) {
    const modal = $("modal-championship");
    $("championship-sub").textContent = subtitle;
    const confettiWrap = $("confetti-wrap");
    confettiWrap.innerHTML = "";
    const colors = ["#ff7a1a", "#f2c94c", "#2fbf71", "#3b82f6", "#e5484d"];
    for (let i = 0; i < 60; i++) {
      const piece = document.createElement("span");
      piece.style.left = Math.random() * 100 + "%";
      piece.style.background = colors[i % colors.length];
      piece.style.animationDuration = 1.2 + Math.random() * 1.2 + "s";
      piece.style.animationDelay = Math.random() * 0.6 + "s";
      confettiWrap.appendChild(piece);
    }
    modal.classList.remove("hidden");
    $("btn-championship-close").onclick = () => {
      modal.classList.add("hidden");
      onDone();
    };
  }

  function playSeriesAnimation(playoffs, onDone) {
    const modal = $("modal-series");
    const gamesEl = $("series-games");
    const closeBtn = $("btn-modal-series-close");
    const titleEl = $("modal-series-title");
    const won = playoffs.lastSeries.won;
    titleEl.textContent = `${playoffs.lastSeriesRound.toUpperCase()} — AO VIVO`;
    gamesEl.innerHTML = "";
    closeBtn.classList.add("hidden");
    modal.classList.remove("hidden");

    const games = playoffs.lastSeries.games;
    let i = 0;
    function next() {
      if (i >= games.length) {
        const resultLine = document.createElement("p");
        resultLine.className = won ? "series-result win" : "series-result loss";
        resultLine.textContent = won
          ? `Série vencida ${playoffs.lastSeries.wins}-${playoffs.lastSeries.losses}!`
          : `Eliminado — série perdida ${playoffs.lastSeries.losses}-${playoffs.lastSeries.wins}.`;
        gamesEl.appendChild(resultLine);
        closeBtn.classList.remove("hidden");
        closeBtn.onclick = () => {
          modal.classList.add("hidden");
          onDone();
        };
        return;
      }
      const g = games[i];
      const row = document.createElement("div");
      row.className = "finals-game-row " + (g.teamWon ? "win" : "loss");
      row.textContent = `Jogo ${g.game}: Você ${g.teamScore} x ${g.oppScore} Adversário — ${g.teamWon ? "VITÓRIA" : "derrota"}`;
      gamesEl.appendChild(row);
      i++;
      setTimeout(next, 480);
    }
    setTimeout(next, 250);
  }

  function showSeasonModal(title, bodyHTML, onClose) {
    $("modal-season-title").textContent = title;
    $("modal-season-body").innerHTML = bodyHTML;
    const modal = $("modal-season");
    modal.classList.remove("hidden");
    $("btn-modal-season-close").onclick = () => {
      modal.classList.add("hidden");
      if (onClose) onClose();
    };
  }

  return {
    $, showScreen, renderPositionGrid, markSelected,
    computeAutoDrill, renderDraftRound, playPlayerRoulette,
    renderAttrBars, renderTrophies, renderCareerDashboard, renderRetireScreen, renderLeaderboard,
    renderStandings, renderStatusStrip, renderPhysicalScreen, renderFrontOfficeScreen, renderRosterScreen, renderTrophyRoom,
    playSeriesAnimation, playDraftRevealAnimation, playTradeAnimation, playChampionshipAnimation,
    showSeasonModal, formatPlayoff, awardsBadgesHTML, teamName,
  };
})();

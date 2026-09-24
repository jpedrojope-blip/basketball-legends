// main.js — orquestra o estado do jogo, persistência (localStorage) e liga UI <-> Engine.

(function () {
  const STORAGE_ACTIVE = "bl_active_career";
  const STORAGE_LEADERBOARD = "bl_leaderboard";

  const Game = {
    career: null,
    createChoice: { position: null, difficulty: null },
    draftDrill: { step: "attr", legendId: null },
  };

  // ---------- Persistência ----------
  function saveActiveCareer() {
    if (Game.career && (Game.career.status === "draft" || Game.career.status === "active")) {
      localStorage.setItem(STORAGE_ACTIVE, JSON.stringify(Game.career));
    }
  }
  function clearActiveCareer() {
    localStorage.removeItem(STORAGE_ACTIVE);
  }
  function loadActiveCareer() {
    const raw = localStorage.getItem(STORAGE_ACTIVE);
    if (!raw) return null;
    let parsed;
    try { parsed = JSON.parse(raw); } catch (e) { return null; }
    // Save de uma versão antiga e incompatível do jogo — descarta em vez de quebrar a tela.
    if (!parsed || parsed.schemaVersion !== Engine.SCHEMA_VERSION) {
      clearActiveCareer();
      return null;
    }
    if (!parsed.startingCashGranted) {
      parsed.money = +(parsed.money || 0) + 8;
      parsed.startingCashGranted = true;
      localStorage.setItem(STORAGE_ACTIVE, JSON.stringify(parsed));
    }
    return parsed;
  }
  function pushLeaderboard(career) {
    const raw = localStorage.getItem(STORAGE_LEADERBOARD);
    const list = raw ? JSON.parse(raw) : [];
    list.push({
      name: career.name, position: career.position, tierName: career.legacy.tier.name,
      score: career.legacy.score, careerPPG: career.legacy.careerPPG,
      champions: career.trophies.champions, mvp: career.trophies.mvp,
      date: new Date().toISOString(),
    });
    localStorage.setItem(STORAGE_LEADERBOARD, JSON.stringify(list));
  }
  function readLeaderboard() {
    const raw = localStorage.getItem(STORAGE_LEADERBOARD);
    return raw ? JSON.parse(raw) : [];
  }

  // ---------- Menu ----------
  function initMenu() {
    const saved = loadActiveCareer();
    if (saved) UI.$("btn-continue-career").classList.remove("hidden");

    UI.$("btn-new-career").addEventListener("click", startNewCareerFlow);
    UI.$("btn-continue-career").addEventListener("click", () => {
      Game.career = loadActiveCareer();
      if (!Game.career) return;
      if (Game.career.status === "draft") {
        resetDraftDrill();
        UI.showScreen("screen-draft");
        UI.renderDraftRound(Game.career, Game.draftDrill);
      } else {
        UI.showScreen("screen-career");
        UI.renderCareerDashboard(Game.career);
      }
    });
    UI.$("btn-leaderboard").addEventListener("click", () => {
      UI.renderLeaderboard(UI.$("leaderboard-body"), readLeaderboard());
      UI.showScreen("screen-leaderboard");
    });
  }

  // ---------- Criação de personagem ----------
  function startNewCareerFlow() {
    Game.createChoice = { position: null, difficulty: null };
    UI.$("input-name").value = "";
    UI.$("btn-start-draft").disabled = true;
    UI.renderPositionGrid(UI.$("position-grid"), (posKey, el) => {
      Game.createChoice.position = posKey;
      UI.markSelected(UI.$("position-grid"), ".pos-card", el);
      checkCreateReady();
    });
    UI.showScreen("screen-create");
  }

  function checkCreateReady() {
    UI.$("btn-start-draft").disabled = !(Game.createChoice.position && Game.createChoice.difficulty);
  }

  function initCreateScreen() {
    document.querySelectorAll(".diff-card").forEach((el) => {
      el.addEventListener("click", () => {
        Game.createChoice.difficulty = el.dataset.diff;
        UI.markSelected(document, ".diff-card", el);
        checkCreateReady();
      });
    });
    UI.$("btn-back-menu").addEventListener("click", () => UI.showScreen("screen-menu"));
    UI.$("btn-start-draft").addEventListener("click", () => {
      const name = UI.$("input-name").value.trim() || "Jogador Anônimo";
      const seed = name + "-" + Date.now() + "-" + Math.random();
      Game.career = Engine.newCareer({
        name, position: Game.createChoice.position, difficulty: Game.createChoice.difficulty, seed,
      });
      saveActiveCareer();
      enterDraftRound(true);
    });
  }

  // ---------- Draft (jogador sorteado -> escolhe atributo) ----------
  function resetDraftDrill() {
    if (Game.career.status !== "draft") return;
    Game.draftDrill = UI.computeAutoDrill(Game.career);
  }

  function enterDraftRound(withRoulette) {
    resetDraftDrill();
    UI.showScreen("screen-draft");
    const render = () => UI.renderDraftRound(Game.career, Game.draftDrill);
    if (withRoulette) UI.playPlayerRoulette(Game.career.currentRoll, render);
    else render();
  }

  window.__blOnDraftAttrPick = function (legendId, attrKey) {
    Engine.draftPick(Game.career, legendId, attrKey);
    saveActiveCareer();
    if (Game.career.status === "active") {
      const reveal = Game.career.pendingDraftReveal;
      Game.career.pendingDraftReveal = null;
      UI.playDraftRevealAnimation(reveal, () => {
        saveActiveCareer();
        UI.showScreen("screen-career");
        UI.renderCareerDashboard(Game.career);
      });
    } else {
      enterDraftRound(true);
    }
  };

  function initDraftScreen() {
    UI.$("btn-draft-home").addEventListener("click", () => UI.showScreen("screen-menu"));
    UI.$("btn-draft-reroll").addEventListener("click", () => {
      Engine.rerollRound(Game.career);
      saveActiveCareer();
      enterDraftRound(true);
    });
  }

  // ---------- Dashboard da carreira ----------
  function initCareerScreen() {
    UI.$("btn-sim-season").addEventListener("click", handleMainSeasonAction);
    UI.$("btn-fast-forward").addEventListener("click", handleFastForward);
    UI.$("btn-retire").addEventListener("click", handleManualRetire);
    UI.$("btn-request-trade").addEventListener("click", handleRequestTrade);
    UI.$("btn-standings").addEventListener("click", () => {
      UI.renderStandings(Game.career);
      UI.showScreen("screen-standings");
    });
    UI.$("btn-nav-physical").addEventListener("click", () => {
      UI.renderPhysicalScreen(Game.career);
      UI.showScreen("screen-physical");
    });
    UI.$("btn-nav-frontoffice").addEventListener("click", () => {
      UI.renderFrontOfficeScreen(Game.career);
      UI.showScreen("screen-frontoffice");
    });
    UI.$("btn-nav-roster").addEventListener("click", () => {
      UI.renderRosterScreen(Game.career);
      UI.showScreen("screen-roster");
    });
    UI.$("btn-open-trophyroom").addEventListener("click", () => {
      UI.renderTrophyRoom(Game.career);
      UI.showScreen("screen-trophyroom");
    });
  }

  function initPhysicalScreen() {
    UI.$("btn-physical-back").addEventListener("click", () => {
      UI.renderCareerDashboard(Game.career);
      UI.showScreen("screen-career");
    });
  }

  function initFrontOfficeScreen() {
    UI.$("btn-frontoffice-back").addEventListener("click", () => {
      UI.renderCareerDashboard(Game.career);
      UI.showScreen("screen-career");
    });
  }

  function initRosterScreen() {
    UI.$("btn-roster-back").addEventListener("click", () => UI.showScreen("screen-career"));
  }

  function initTrophyRoomScreen() {
    UI.$("btn-trophyroom-back").addEventListener("click", () => UI.showScreen("screen-career"));
  }

  // ---------- Ações do Físico ----------
  window.__blOnSetRegime = function (regimeKey) {
    try {
      Engine.setTrainingRegime(Game.career, regimeKey);
      saveActiveCareer();
      UI.renderPhysicalScreen(Game.career);
      FX.toast("O novo regime já está valendo para seu desenvolvimento e desgaste.", "success", "Treino atualizado");
    } catch (e) { FX.toast(e.message, "error", "Regime indisponível"); }
  };

  window.__blOnHireTrainer = function () {
    try {
      Engine.hireTrainer(Game.career);
      saveActiveCareer();
      FX.toast("Ele acompanha você em todas as temporadas daqui pra frente.", "success", "Preparador físico contratado");
    } catch (e) { FX.toast(e.message, "error"); }
    UI.renderPhysicalScreen(Game.career);
  };

  window.__blOnBuildFacility = function () {
    try {
      Engine.buildFacility(Game.career);
      saveActiveCareer();
      FX.toast("Sua evolução fica mais rápida pro resto da carreira.", "success", "Instalações construídas");
    } catch (e) { FX.toast(e.message, "error"); }
    UI.renderPhysicalScreen(Game.career);
  };

  window.__blOnSurgery = function () {
    try {
      Engine.scheduleSurgery(Game.career);
      saveActiveCareer();
      FX.toast("Você fica de fora alguns meses, mas volta inteiro.", "success", "Cirurgia agendada");
    } catch (e) { FX.toast(e.message, "error"); }
    UI.renderPhysicalScreen(Game.career);
  };

  // ---------- Pedidos ao time ----------
  window.__blOnRequest = function (type, param) {
    try {
      const result = Engine.makeTeamRequest(Game.career, type, param);
      saveActiveCareer();
      UI.showSeasonModal(result.success ? "Pedido Aceito" : "Pedido Recusado", `<p>${result.message}</p>`, () => {
        UI.renderFrontOfficeScreen(Game.career);
      });
    } catch (e) {
      UI.showSeasonModal("Pedido ao Time", `<p>${e.message}</p>`, () => UI.renderFrontOfficeScreen(Game.career));
    }
  };

  window.__blOnSetSimMode = function (mode) {
    Engine.setSimMode(Game.career, mode);
    saveActiveCareer();
    UI.renderCareerDashboard(Game.career);
  };

  function handleMainSeasonAction() {
    const ss = Game.career.seasonState;
    if (ss && ss.phase === "playoffs") { handleSimPlayoffRound(); return; }
    if ((Game.career.simMode || "month") === "game") handleSimGame();
    else handleSimMonth();
  }

  // Jogo a jogo: sem modal e sem aviso a cada partida — o placar aparece no
  // card da temporada. Só interrompe quando algo realmente muda o rumo.
  function handleSimGame() {
    const btn = UI.$("btn-sim-season");
    btn.disabled = true;
    const res = Engine.simulateGame(Game.career);
    saveActiveCareer();

    if (res.game.newInjury) {
      FX.toast(`Você desfalca o time nos próximos ${res.game.newInjury} jogos.`, "warn", "Contusão");
    }

    if (!res.regularSeasonDone) {
      btn.disabled = false;
      UI.renderCareerDashboard(Game.career);
      if (res.monthDone) reportMonth(res.monthEntry);
      return;
    }
    finishRegularSeason(res.qualifiedForPlayoffs);
  }

  function handleSimMonth() {
    UI.$("btn-sim-season").disabled = true;
    const res = Engine.simulateMonth(Game.career);
    saveActiveCareer();
    reportMonth(res.monthEntry);

    if (!res.regularSeasonDone) {
      UI.$("btn-sim-season").disabled = false;
      UI.renderCareerDashboard(Game.career);
      return;
    }
    finishRegularSeason(res.qualifiedForPlayoffs);
  }

  function finishRegularSeason(qualifiedForPlayoffs) {
    if (!qualifiedForPlayoffs) { finalizeCurrentSeason(); return; }
    const ss = Game.career.seasonState;
    UI.showSeasonModal(
      "Classificado para os Playoffs!",
      `<p>Seu time terminou a temporada regular com <strong>${ss.wins}-${ss.losses}</strong> e garantiu vaga nos playoffs.</p>`,
      () => {
        UI.$("btn-sim-season").disabled = false;
        UI.renderCareerDashboard(Game.career);
      }
    );
  }

  // Um aviso por mês fechado — o detalhe fica no card da temporada.
  function reportMonth(m) {
    if (!m) return;
    const detail = m.recovering
      ? "você estava em recuperação"
      : m.missed
        ? `${m.missed} jogos perdidos por contusão`
        : `${m.ppgMonth} PPG em ${m.gp} jogos`;
    FX.toast(`${m.wins}-${m.losses} no mês · ${detail}.`, m.wins > m.losses ? "success" : "info", m.name);
  }

  function handleSimPlayoffRound() {
    UI.$("btn-sim-season").disabled = true;
    const res = Engine.simulatePlayoffRound(Game.career);
    saveActiveCareer();
    UI.playSeriesAnimation({ lastSeriesRound: res.roundName, lastSeries: res.series }, () => {
      if (res.seasonOver) {
        finalizeCurrentSeason();
      } else {
        UI.$("btn-sim-season").disabled = false;
        UI.renderCareerDashboard(Game.career);
      }
    });
  }

  function finalizeCurrentSeason() {
    const result = Engine.finalizeSeason(Game.career);
    saveActiveCareer();

    const afterAnimations = () => {
      showSeasonRecap(result, () => {
        UI.$("btn-sim-season").disabled = false;
        UI.renderCareerDashboard(Game.career);
        if (result.forcedRetirement) finalizeRetirement();
      });
    };

    const maybeTrade = () => {
      if (Game.career.pendingTrade) {
        const pkg = Game.career.pendingTrade;
        Game.career.pendingTrade = null;
        saveActiveCareer();
        UI.playTradeAnimation(pkg, afterAnimations);
      } else {
        afterAnimations();
      }
    };

    if (Game.career.pendingChampionship) {
      Game.career.pendingChampionship = false;
      saveActiveCareer();
      UI.playChampionshipAnimation(`Temporada ${result.entry.season} — ${result.entry.team}`, maybeTrade);
    } else {
      maybeTrade();
    }
  }

  function showSeasonRecap(result, onClose) {
    const e = result.entry;
    let html = `
      <div class="stat-row"><span>Time</span><strong>${e.team}</strong></div>
      <div class="stat-row"><span>Idade</span><strong>${e.age}</strong></div>
      <div class="stat-row"><span>Estatísticas</span><strong>${e.ppg} PPG · ${e.rpg} RPG · ${e.apg} APG · ${e.eff} EFF</strong></div>
      <div class="stat-row"><span>Recorde do time</span><strong>${e.teamWins}-${e.teamLosses}</strong></div>
      <div class="stat-row"><span>Playoffs</span><strong>${UI.formatPlayoff(e)}</strong></div>
    `;
    if (result.event) {
      html += `<p style="margin-top:12px;"><em>${escapeHTML(lastEventText(Game.career))}</em></p>`;
    }
    html += `<div class="awards-line">${UI.awardsBadgesHTML(e) || '<span class="muted">Nenhum prêmio nesta temporada.</span>'}</div>`;
    UI.showSeasonModal(`Temporada ${e.season} — ${e.age} anos`, html, onClose);
  }

  function lastEventText(career) {
    const last = career.events[career.events.length - 1];
    return last ? last.text : "";
  }

  function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function handleRequestTrade() {
    try {
      const result = Engine.requestTrade(Game.career);
      Game.career.pendingTrade = null; // já vamos animar aqui, não deixa isso disparar de novo no fim da temporada
      saveActiveCareer();
      if (result.success && result.package) {
        UI.playTradeAnimation(result.package, () => UI.renderCareerDashboard(Game.career));
      } else {
        UI.showSeasonModal("Pedido de Troca", `<p>${result.message}</p>`, () => UI.renderCareerDashboard(Game.career));
      }
    } catch (e) {
      UI.showSeasonModal("Pedido de Troca", `<p>${e.message}</p>`, () => UI.renderCareerDashboard(Game.career));
    }
  }

  function handleFastForward() {
    FX.confirm(
      "Carreira Relâmpago",
      "Isso simula o resto da carreira de uma vez, até a aposentadoria. Não dá pra voltar atrás.",
      "Simular tudo"
    ).then((ok) => {
      if (!ok) return;
      FX.busy(true);
      // Um respiro antes de travar a thread, pra animação de carregamento aparecer.
      setTimeout(() => {
        Engine.fastForward(Game.career, 25);
        FX.busy(false);
        finalizeRetirement();
      }, 420);
    });
  }

  function handleManualRetire() {
    if (Game.career.seasonState) return;
    FX.confirm(
      "Pendurar as chuteiras",
      "Sua carreira termina aqui e o legado é calculado agora. Tem certeza?",
      "Aposentar"
    ).then((ok) => {
      if (!ok) return;
      Engine.retire(Game.career);
      finalizeRetirement();
    });
  }

  function finalizeRetirement() {
    if (Game.career.status !== "retired") Engine.retire(Game.career);
    pushLeaderboard(Game.career);
    clearActiveCareer();
    UI.renderRetireScreen(Game.career);
    UI.showScreen("screen-retire");
  }

  // ---------- Classificação ----------
  function initStandingsScreen() {
    UI.$("btn-standings-back").addEventListener("click", () => UI.showScreen("screen-career"));
  }

  // ---------- Tela de retiro ----------
  function initRetireScreen() {
    UI.$("btn-retire-newcareer").addEventListener("click", startNewCareerFlow);
    UI.$("btn-retire-leaderboard").addEventListener("click", () => {
      UI.renderLeaderboard(UI.$("leaderboard-body"), readLeaderboard());
      UI.showScreen("screen-leaderboard");
    });
  }

  // ---------- Ranking ----------
  function initLeaderboardScreen() {
    UI.$("btn-leaderboard-back").addEventListener("click", () => UI.showScreen("screen-menu"));
  }

  // ---------- Boot ----------
  document.addEventListener("DOMContentLoaded", () => {
    initMenu();
    initCreateScreen();
    initDraftScreen();
    initCareerScreen();
    initStandingsScreen();
    initPhysicalScreen();
    initFrontOfficeScreen();
    initRosterScreen();
    initTrophyRoomScreen();
    initRetireScreen();
    initLeaderboardScreen();
    UI.showScreen("screen-menu");
  });
})();

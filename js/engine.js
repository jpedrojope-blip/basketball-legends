// engine.js — motor puro de simulação de carreira. Sem DOM, sem I/O.
// Roda igual no navegador (via <script>) e no Node (útil pra testes de balanceamento via `require`).

(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("./rng.js"), require("./data.js"));
  } else {
    root.Engine = factory(root.RNG, root);
  }
})(typeof self !== "undefined" ? self : this, function (RNG, DATA) {
  const { ATTR_KEYS, STAR_KEYS, ALL_ATTR_KEYS, POSITIONS, LEGENDS, TEAMS, LEGACY_TIERS, ROSTER_FIRST_NAMES, ROSTER_LAST_NAMES } = DATA;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const isStarAttr = (k) => STAR_KEYS.indexOf(k) !== -1;
  const REROLLS_ALLOWED = 2;
  const START_PCT = 0.6; // você começa com 60% do teto escolhido
  const MONTHS_SCHEDULE = [14, 14, 14, 14, 13, 13]; // 82 jogos espalhados em 6 meses
  const MONTH_NAMES = ["Outubro", "Novembro", "Dezembro", "Janeiro", "Fevereiro", "Março"];
  const PLAYOFF_ROUND_NAMES = ["1ª Rodada", "Semifinal de Conferência", "Final de Conferência", "Finais da Liga"];
  const SCHEMA_VERSION = 7; // sobe sempre que o formato salvo da carreira muda de forma incompatível

  // ---------- FÍSICO / PREPARAÇÃO ----------
  const TRAINING_REGIMES = {
    padrao: { label: "Treino Padrão", desc: "Rotina equilibrada, sem riscos nem bônus extras.", growthMult: 1.0, injuryMult: 1.0, decayMult: 1.0, minutesMult: 1.0 },
    mamba: { label: "Mentalidade Mamba", desc: "Treino extremo, evolução mais rápida — mas o corpo cobra o preço.", growthMult: 1.6, injuryMult: 1.7, decayMult: 1.35, minutesMult: 1.0 },
    cauteloso: { label: "Foco em Prevenção", desc: "Evolui mais devagar, mas cuida do corpo.", growthMult: 0.7, injuryMult: 0.55, decayMult: 0.7, minutesMult: 1.0 },
    descanso: { label: "Pedir Descanso / Menos Minutos", desc: "Reduz sua carga de jogo pra preservar o corpo, custa desempenho na temporada.", growthMult: 0.5, injuryMult: 0.35, decayMult: 0.6, minutesMult: 0.8 },
  };
  const TRAINER_COST = 8;
  const FACILITY_COST = 18;
  const SURGERY_COST = 4;
  const SURGERY_RECOVERY_MONTHS = 2;
  const CHRONIC_INJURY_THRESHOLD = 40;

  function computeOVR(attrs, position) {
    const weights = POSITIONS[position].weights;
    let sum = 0;
    for (const k of ATTR_KEYS) sum += (attrs[k] || 0) * weights[k];
    return clamp(Math.round(sum), 0, 99);
  }

  function computePotentialOVR(career) {
    return computeOVR(career.ceilings, career.position);
  }

  function getLegendAttrValue(legend, key) {
    return isStarAttr(key) ? legend.stars[key] : legend.stats[key];
  }

  // ---------- DRAFT: sorteia uma LENDA, depois você escolhe o ATRIBUTO ----------

  function attrEligible(career, key) {
    return (career.ceilings[key] || 0) === 0;
  }

  // (Re)sorteia a lenda da rodada atual. No giro extra, remove o resultado anterior do pool.
  function beginDraftRound(career) {
    if (career.draftRound >= ALL_ATTR_KEYS.length) return null;
    const previousId = career.currentRoll && career.currentRoll.legendIds
      ? career.currentRoll.legendIds[0]
      : null;
    const usedRerolls = REROLLS_ALLOWED - career.rerollsLeft;
    const rng = new RNG(career.seed + "::draftroll::" + career.draftRound + "::" + usedRerolls);
    const pool = previousId ? LEGENDS.filter((legend) => legend.id !== previousId) : LEGENDS;
    const legend = rng.pick(pool);
    career.currentRoll = {
      legendIds: [legend.id],
      legendId: legend.id,
      draftYear: legend.draftYear,
      teamId: legend.team,
      era: legend.era,
    };
    return career.currentRoll;
  }

  function rerollRound(career) {
    if (career.status !== "draft") throw new Error("Só é possível sortear durante o draft.");
    if (career.rerollsLeft <= 0) throw new Error("Sem sorteios extras disponíveis.");
    career.rerollsLeft--;
    beginDraftRound(career);
    return career;
  }

  function newCareer({ name, position, difficulty, seed }) {
    const rng = new RNG(seed);
    const attrs = {}, ceilings = {};
    for (const k of ALL_ATTR_KEYS) { attrs[k] = 0; ceilings[k] = 0; }
    const career = {
      schemaVersion: SCHEMA_VERSION,
      seed: rng.seedStr,
      name: name || "Jogador",
      position,
      difficulty,
      attrs,
      ceilings,
      draftRound: 0,
      currentRoll: null,
      stolenFrom: [],
      rerollsLeft: REROLLS_ALLOWED,
      status: "draft",
      age: 19,
      season: 0,
      team: null,
      teamStrengthMap: Object.fromEntries(TEAMS.map((t) => [t.id, t.strength])),
      careerLog: [],
      leagueStandings: null,
      seasonState: null,
      tradeRequestedThisOffseason: false,
      tradeRequestCount: 0,
      trophies: {
        mvp: 0, dpoy: 0, roy: 0, sixthMan: 0, mip: 0, scoringTitles: 0,
        allStar: 0, allNBA: 0, allDefense: 0, champions: 0, finalsMVP: 0,
      },
      peakOVR: 0,
      peakAttrs: null,
      ovr: computeOVR(attrs, position),
      events: [],

      // Físico / preparação
      durability: 90,
      chronicInjury: false,
      hasTrainer: false,
      hasFacility: false,
      trainingRegime: "padrao",
      recoveringMonths: 0,
      injuryGamesLeft: 0,
      simMode: "month", // "game" = jogo a jogo, "month" = mês a mês
      money: 8,
      salary: 0,
      startingCashGranted: true,

      // Relação com o clube / franquia
      teamTrust: 55,
      yearsWithCurrentTeam: 0,
      isFranchisePlayer: false,
      franchisePlayerTeamId: null,
      jerseyNumber: null,
      numberRetired: false,
      numberRetiredTeamId: null,
      noTradeClause: false,
      schemeFocus: null,
      requestsThisOffseason: 0,

      // Animações pendentes (consumidas pela UI e limpas depois de mostradas)
      pendingDraftReveal: null,
      pendingTrade: null,
      pendingChampionship: false,
    };
    beginDraftRound(career);
    return career;
  }

  // Escolhe `legendId` (tem que estar no sorteio atual) e rouba o atributo `attrKey` dele
  // (tem que ainda não ter sido escolhido em nenhuma rodada anterior).
  function draftPick(career, legendId, attrKey) {
    if (career.status !== "draft") throw new Error("Carreira não está em fase de draft.");
    if (!career.currentRoll || career.currentRoll.legendIds.indexOf(legendId) === -1) {
      throw new Error("Esse jogador não está disponível nesse sorteio.");
    }
    if (!attrEligible(career, attrKey)) throw new Error("Esse atributo já foi escolhido em outra rodada.");
    const legend = LEGENDS.find((l) => l.id === legendId);
    const value = getLegendAttrValue(legend, attrKey);
    career.ceilings[attrKey] = value;
    const startVal = isStarAttr(attrKey)
      ? clamp(Math.round(value * START_PCT), 1, 5)
      : clamp(Math.round(value * START_PCT), 1, 99);
    career.attrs[attrKey] = startVal;
    career.stolenFrom.push({ round: career.draftRound, attr: attrKey, legendId, legendName: legend.name, ceiling: value });
    career.draftRound++;
    career.ovr = computeOVR(career.attrs, career.position);
    if (career.draftRound >= ALL_ATTR_KEYS.length) {
      finishDraft(career);
    } else {
      beginDraftRound(career);
    }
    return career;
  }

  function finishDraft(career) {
    const rng = new RNG(career.seed + "::rookie-draft");
    const weighted = TEAMS.map((t) => ({ t, w: 1 / (t.strength + 10) }));
    const totalW = weighted.reduce((s, x) => s + x.w, 0);
    let roll = rng.float(0, totalW);
    let picked = weighted[0].t;
    for (const x of weighted) {
      if (roll <= x.w) { picked = x.t; break; }
      roll -= x.w;
    }
    career.team = picked.id;
    career.status = "active";
    career.currentRoll = null;
    career.peakOVR = career.ovr;
    career.peakAttrs = { ...career.attrs };
    career.events.push({ season: 0, text: `Você foi draftado pelo(a) ${picked.name}!` });
    career.pendingDraftReveal = { teamId: picked.id, teamName: picked.name, position: career.position };
  }

  // ---------- CURVA DE IDADE (evolui em direção ao teto de cada atributo) ----------
  function growthMultiplier(career) {
    const regime = TRAINING_REGIMES[career.trainingRegime] || TRAINING_REGIMES.padrao;
    let mult = regime.growthMult;
    if (career.hasTrainer) mult *= 1.15;
    if (career.hasFacility) mult *= 1.15;
    if (career.chronicInjury) mult *= 0.5;
    return mult;
  }

  function ageAttrs(career, rng) {
    const age = career.age;
    const growthPhase = age <= 23 ? "growth" : age <= 29 ? "peak" : "decline";
    const gMult = growthMultiplier(career);
    const rate = growthPhase === "growth"
      ? (career.difficulty === "pro" ? 0.17 : 0.25) * gMult
      : growthPhase === "peak"
      ? (career.difficulty === "pro" ? 0.05 : 0.08) * gMult
      : 0;

    for (const k of ATTR_KEYS) {
      const ceiling = career.ceilings[k] || 0;
      if (growthPhase !== "decline") {
        const gap = Math.max(0, ceiling - career.attrs[k]);
        const delta = Math.round(gap * rate * rng.float(0.6, 1.4));
        career.attrs[k] = clamp(career.attrs[k] + delta, 0, ceiling);
      } else {
        let delta;
        if (k === "ATL" || k === "FIS") delta = -rng.int(2, 6);
        else if (k === "IQ") delta = rng.int(-1, 2);
        else delta = -rng.int(1, 4);
        career.attrs[k] = clamp(career.attrs[k] + delta, 5, ceiling || 99);
      }
    }

    for (const k of STAR_KEYS) {
      const ceiling = career.ceilings[k] || 1;
      if (growthPhase !== "decline") {
        if (career.attrs[k] < ceiling && rng.chance(rate)) career.attrs[k] = clamp(career.attrs[k] + 1, 1, ceiling);
      } else if (rng.chance(0.12)) {
        career.attrs[k] = clamp(career.attrs[k] - 1, 1, ceiling);
      }
    }

    career.ovr = computeOVR(career.attrs, career.position);
    if (career.ovr >= career.peakOVR) {
      career.peakOVR = career.ovr;
      career.peakAttrs = { ...career.attrs };
    }
  }

  // ---------- QUÍMICA DE TIME ----------
  function computeChemistry(career, rng) {
    const val = clamp(50 + (career.attrs.IQ - 60) * 0.3 + rng.gaussian(0, 14), 5, 98);
    const label = val >= 75 ? "Alta" : val >= 45 ? "Média" : "Baixa";
    return { value: Math.round(val), label };
  }

  // ---------- TAXAS POR JOGO (fixas durante a temporada, recalculadas na próxima) ----------
  function computeMinutes(ovr, age, rng) {
    let base = 9 + (ovr - 35) * 0.5;
    if (age <= 20) base -= 4;
    if (age >= 34) base -= rng.int(0, 6);
    return clamp(Math.round(base + rng.gaussian(0, 2)), 6, 38);
  }

  function computeRates(attrs, position, minutes, rng, schemeFocus) {
    const min36 = minutes / 36;
    // Mão Ruim (1-5): quanto maior, menos turnovers (segurança de bola nas duas mãos).
    // Finta (1-5): quanto maior, mais eficiência de arremesso (cria espaço, tira o defensor do chão).
    const mruimBonus = ((attrs.MRUIM || 1) - 1) / 4; // 0 a 1
    const fintaBonus = ((attrs.FINTA || 1) - 1) / 4; // 0 a 1
    // Esquema tático pedido ao técnico: reforça uma faceta específica do seu jogo.
    const schemeBonus = (key) => (schemeFocus === key ? 1.12 : 1.0);

    const scoringSkill = ((attrs.FIN * 0.55 + attrs.ARM * 0.35 + attrs.IQ * 0.10) / 99) * (1 + fintaBonus * 0.08) * schemeBonus("FIN") * schemeBonus("ARM");
    const ppg = clamp(scoringSkill * 38 * min36 + rng.gaussian(0, 1.2), 0, 42);

    const rebSkill = ((attrs.REB * 0.65 + attrs.FIS * 0.25 + attrs.ATL * 0.10) / 99) * schemeBonus("REB");
    const posBonusR = position === "C" ? 1.35 : position === "PF" ? 1.15 : position === "PG" ? 0.55 : 0.85;
    const rpg = clamp(rebSkill * 13 * posBonusR * min36 + rng.gaussian(0, 0.6), 0, 18);

    const pasSkill = ((attrs.PAS * 0.75 + attrs.IQ * 0.25) / 99) * schemeBonus("PAS");
    const posBonusA = position === "PG" ? 1.5 : position === "SG" ? 1.05 : position === "SF" ? 0.85 : 0.55;
    const apg = clamp(pasSkill * 9 * posBonusA * min36 + rng.gaussian(0, 0.5), 0, 14);

    const defSkill = (attrs.DEF * 0.7 + attrs.ATL * 0.3) / 99;
    const spg = clamp(defSkill * 2.6 * min36 + rng.gaussian(0, 0.25), 0, 4);
    const bpgPosBonus = position === "C" ? 1.6 : position === "PF" ? 1.15 : 0.4;
    const bpg = clamp(((attrs.DEF * 0.5 + attrs.FIS * 0.5) / 99) * 2 * bpgPosBonus * min36 + rng.gaussian(0, 0.2), 0, 5);

    const ballSecurity = (attrs.IQ * 0.6 + attrs.PAS * 0.4) / 99;
    const usage = (attrs.FIN * 0.5 + attrs.ARM * 0.3 + attrs.PAS * 0.2) / 99;
    const tovRaw = (0.6 + usage * 3.2 - ballSecurity * 2.2) * min36 * 1.4 + rng.gaussian(0, 0.3);
    const tov = clamp(tovRaw * (1 - mruimBonus * 0.22), 0.3, 6.5);

    const fgSkill = (attrs.FIN * 0.5 + attrs.ARM * 0.3 + attrs.IQ * 0.2) / 99;
    const fgPct = clamp(0.36 + fgSkill * 0.24 + fintaBonus * 0.05 + rng.gaussian(0, 0.02), 0.30, 0.70);

    const ftSkill = (attrs.IQ * 0.5 + attrs.FIN * 0.3 + attrs.ARM * 0.2) / 99;
    const ftPct = clamp(0.55 + ftSkill * 0.35 + rng.gaussian(0, 0.03), 0.45, 0.96);

    return {
      ppg: +ppg.toFixed(2), rpg: +rpg.toFixed(2), apg: +apg.toFixed(2),
      spg: +spg.toFixed(2), bpg: +bpg.toFixed(2), tov: +tov.toFixed(2),
      fgPct: +(fgPct * 100).toFixed(1), ftPct: +(ftPct * 100).toFixed(1),
    };
  }

  // ---------- PLAYOFFS: série real de melhor-de-7 ----------
  function generateOpponentPower(roundIndex, rng) {
    const base = 48 + roundIndex * 9;
    return clamp(base + rng.gaussian(0, 12), 25, 96);
  }

  function simulateSeries(power, oppPower, rng) {
    const games = [];
    let wins = 0, losses = 0;
    for (let g = 0; g < 7 && wins < 4 && losses < 4; g++) {
      let teamScore = Math.round(104 + (power - 58) * 0.32 + rng.gaussian(0, 9));
      let oppScore = Math.round(104 + (oppPower - 58) * 0.32 + rng.gaussian(0, 9));
      if (teamScore === oppScore) teamScore += rng.chance(0.5) ? 1 : -1;
      const teamWon = teamScore > oppScore;
      if (teamWon) wins++; else losses++;
      games.push({ game: g + 1, teamScore, oppScore, teamWon });
    }
    return { games, won: wins > losses, wins, losses };
  }

  // ---------- PRÊMIOS ----------
  function evaluateAwards(career, statline, teamRecord, playoffs, isRookieSeason, rng) {
    const awards = [];
    const ovr = career.ovr;

    if (isRookieSeason && ovr >= 50 && rng.chance(clamp((ovr - 45) / 35, 0, 0.6))) {
      awards.push("Novato do Ano"); career.trophies.roy++;
    }

    const lastEntry = career.careerLog[career.careerLog.length - 1];
    if (lastEntry && ovr - lastEntry.ovr >= 5 && ovr >= 55 && rng.chance(0.5)) {
      awards.push("Jogador Mais Melhorado"); career.trophies.mip++;
    }

    if (statline.mpg < 24 && statline.ppg >= 12 && ovr >= 58 && rng.chance(0.3)) {
      awards.push("Sexto Homem do Ano"); career.trophies.sixthMan++;
    }

    if (ovr >= 63 && statline.ppg >= 13 && rng.chance(clamp((ovr - 60) / 35, 0, 0.7))) {
      awards.push("All-Star"); career.trophies.allStar++;
    }

    if (ovr >= 70 && teamRecord.wins >= 40 && rng.chance(clamp((ovr - 65) / 28, 0, 0.6))) {
      const tier = ovr >= 88 ? "1ª Equipe" : ovr >= 80 ? "2ª Equipe" : "3ª Equipe";
      awards.push(`All-NBA (${tier})`); career.trophies.allNBA++;
    }

    if (career.attrs.DEF >= 68 && ovr >= 58 && rng.chance(clamp((career.attrs.DEF - 63) / 40, 0, 0.4))) {
      awards.push("Equipe de Defesa"); career.trophies.allDefense++;
    }

    if (ovr >= 78 && teamRecord.wins >= 44 && rng.chance(clamp((ovr - 74) / 22, 0, 0.4))) {
      awards.push("MVP"); career.trophies.mvp++;
    }

    if (career.attrs.DEF >= 72 && ovr >= 60 && rng.chance(clamp((career.attrs.DEF - 68) / 55, 0, 0.2))) {
      awards.push("Melhor Defensor"); career.trophies.dpoy++;
    }

    if (statline.ppg >= 22 && rng.chance(0.22)) {
      awards.push("Artilheiro da Liga"); career.trophies.scoringTitles++;
    }

    if (playoffs.champion) {
      awards.push("Campeão");
      career.trophies.champions++;
      if (ovr >= 66 && rng.chance(0.4)) { awards.push("MVP das Finais"); career.trophies.finalsMVP++; }
    }

    return awards;
  }

  function randomRosterName(rng) {
    return `${rng.pick(ROSTER_FIRST_NAMES)} ${rng.pick(ROSTER_LAST_NAMES)}`;
  }

  // Pacote fictício de "quem vai e quem vem" — só pra flavor/animação, não afeta a simulação.
  function generateTradePackage(career, oldTeam, newTeam, rng) {
    const yourValue = career.ovr;
    const piecesFromNewTeam = [];
    if (yourValue >= 82) {
      piecesFromNewTeam.push(`${randomRosterName(rng)} (titular)`);
      piecesFromNewTeam.push("2 escolhas de 1ª rodada de draft");
    } else if (yourValue >= 68) {
      piecesFromNewTeam.push(`${randomRosterName(rng)} (rotação)`);
      piecesFromNewTeam.push("1 escolha de 1ª rodada de draft");
    } else {
      piecesFromNewTeam.push(`${randomRosterName(rng)} (banco)`);
      piecesFromNewTeam.push("1 escolha de 2ª rodada de draft");
    }
    return {
      fromTeamId: oldTeam.id, fromTeamName: oldTeam.name,
      toTeamId: newTeam.id, toTeamName: newTeam.name,
      outgoing: [career.name], incoming: piecesFromNewTeam,
    };
  }

  function applyTradeToTeam(career, newTeamId) {
    career.team = newTeamId;
    career.teamTrust = 55;
    career.yearsWithCurrentTeam = 0;
    career.isFranchisePlayer = false;
    career.franchisePlayerTeamId = null;
    career.jerseyNumber = null;
    career.schemeFocus = null;
  }

  function rollSeasonEvent(career, rng, statline) {
    const roll = rng.next();
    if (roll < 0.10 && !career.noTradeClause) {
      const currentTeam = TEAMS.find((t) => t.id === career.team);
      const options = TEAMS.filter((t) => t.id !== career.team);
      const newTeam = rng.pick(options);
      const pkg = generateTradePackage(career, currentTeam, newTeam, rng);
      applyTradeToTeam(career, newTeam.id);
      const upgrade = newTeam.strength > currentTeam.strength;
      career.events.push({
        season: career.season,
        text: `Troca: você foi negociado do(a) ${currentTeam.name} para o(a) ${newTeam.name}${upgrade ? " — um time mais forte!" : "."}`,
      });
      career.pendingTrade = pkg;
      return { type: "trade", team: newTeam.id, package: pkg };
    }
    if (roll < 0.18 && statline.ppg >= 22) {
      career.events.push({ season: career.season, text: `Temporada de destaque: sua reputação na liga disparou.` });
      return { type: "breakout" };
    }
    return null;
  }

  // ---------- PEDIDO DE TROCA (iniciado pelo jogador, só entre temporadas) ----------
  function requestTrade(career) {
    if (career.status !== "active") throw new Error("Só é possível pedir troca durante a carreira ativa.");
    if (career.seasonState) throw new Error("Só é possível pedir troca entre temporadas.");
    if (career.tradeRequestedThisOffseason) throw new Error("Você já pediu troca nesta entressafra.");
    career.tradeRequestCount = (career.tradeRequestCount || 0) + 1;
    career.tradeRequestedThisOffseason = true;
    const rng = new RNG(career.seed + "::traderequest::" + career.season + "::" + career.tradeRequestCount);
    const currentTeam = TEAMS.find((t) => t.id === career.team);
    const successChance = clamp(0.3 + (career.ovr - 55) * 0.012, 0.12, 0.85);
    if (!rng.chance(successChance)) {
      career.events.push({ season: career.season, text: `Você pediu troca, mas o(a) ${currentTeam.name} recusou negociar você.` });
      return { success: false, message: `O(a) ${currentTeam.name} recusou seu pedido de troca.` };
    }
    const options = TEAMS.filter((t) => t.id !== career.team);
    const newTeam = rng.pick(options);
    const pkg = generateTradePackage(career, currentTeam, newTeam, rng);
    applyTradeToTeam(career, newTeam.id);
    career.events.push({ season: career.season, text: `Pedido de troca aceito: você foi negociado do(a) ${currentTeam.name} para o(a) ${newTeam.name}.` });
    career.pendingTrade = pkg;
    return { success: true, team: newTeam, message: `Troca concluída! Agora você joga pelo(a) ${newTeam.name}.`, package: pkg };
  }

  // ---------- FÍSICO: contratações, cirurgia, regime de treino ----------
  function setTrainingRegime(career, regimeKey) {
    if (!TRAINING_REGIMES[regimeKey]) throw new Error("Regime de treino inválido.");
    career.trainingRegime = regimeKey;
    return career;
  }

  function hireTrainer(career) {
    if (career.hasTrainer) throw new Error("Você já tem um preparador físico.");
    if (career.money < TRAINER_COST) throw new Error(`Você precisa de $${TRAINER_COST}M pra contratar um preparador físico.`);
    career.money -= TRAINER_COST;
    career.hasTrainer = true;
    career.events.push({ season: career.season, text: `Você contratou um preparador físico pessoal.` });
    return career;
  }

  function buildFacility(career) {
    if (!career.hasTrainer) throw new Error("Contrate um preparador físico primeiro.");
    if (career.hasFacility) throw new Error("Você já tem instalações de treino pessoais.");
    if (career.money < FACILITY_COST) throw new Error(`Você precisa de $${FACILITY_COST}M pra construir instalações de treino.`);
    career.money -= FACILITY_COST;
    career.hasFacility = true;
    career.events.push({ season: career.season, text: `Você investiu em instalações de treino pessoais.` });
    return career;
  }

  function scheduleSurgery(career) {
    if (career.seasonState) throw new Error("Só é possível fazer cirurgia entre temporadas.");
    if (career.money < SURGERY_COST) throw new Error(`Você precisa de $${SURGERY_COST}M pra pagar a cirurgia.`);
    if (career.durability >= 70 && !career.chronicInjury) throw new Error("Você não precisa de cirurgia agora.");
    career.money -= SURGERY_COST;
    career.recoveringMonths = SURGERY_RECOVERY_MONTHS;
    career.injuryGamesLeft = 0;
    career.durability = clamp(career.durability + 15, 0, 100);
    career.chronicInjury = false;
    career.events.push({ season: career.season, text: `Cirurgia realizada — você vai desfalcar o time no início da próxima temporada durante a recuperação.` });
    return career;
  }

  // ---------- PEDIDOS AO TIME (franchise player, camisa, posição, esquema, salário, reforços) ----------
  const MAX_REQUESTS_PER_OFFSEASON = 2;

  function makeTeamRequest(career, type, param) {
    if (career.status !== "active") throw new Error("Só é possível fazer pedidos durante a carreira ativa.");
    if ((career.requestsThisOffseason || 0) >= MAX_REQUESTS_PER_OFFSEASON) {
      return { success: false, message: "A diretoria já ouviu pedidos demais de você essa entressafra. Espere a próxima temporada." };
    }
    const currentTeam = TEAMS.find((t) => t.id === career.team);
    const rng = new RNG(career.seed + "::teamrequest::" + career.season + "::" + type + "::" + (career.tradeRequestCount || 0) + "::" + career.requestsThisOffseason);
    career.requestsThisOffseason = (career.requestsThisOffseason || 0) + 1;
    const trust = career.teamTrust;

    function resolve(chance, onSuccess, onFail, denyMsg) {
      if (rng.chance(clamp(chance, 0.03, 0.97))) {
        career.teamTrust = clamp(career.teamTrust - 3, 0, 100);
        const msg = onSuccess();
        career.events.push({ season: career.season, text: msg });
        return { success: true, message: msg };
      }
      career.events.push({ season: career.season, text: denyMsg });
      if (onFail) onFail();
      return { success: false, message: denyMsg };
    }

    switch (type) {
      case "usage": {
        if (career.schemeFocus) return { success: false, message: "Você já tem um pedido de esquema ativo. Não dá pra empilhar." };
        return resolve(
          clamp((trust - 30) / 70, 0, 0.9),
          () => { career.schemeFocus = param; return `O técnico aceitou montar o ataque em cima de ${ATTR_LABELS_INTERNAL[param] || param}.`; },
          null,
          `O técnico ouviu, mas preferiu manter o esquema atual do(a) ${currentTeam.name}.`
        );
      }
      case "jersey": {
        return resolve(
          clamp((trust - 10) / 90, 0.25, 0.97),
          () => { career.jerseyNumber = param; return `Camisa ${param} aprovada — agora é sua no(a) ${currentTeam.name}.`; },
          null,
          `A camisa ${param} já está comprometida no elenco do(a) ${currentTeam.name}.`
        );
      }
      case "franchise": {
        if (career.ovr < 72) return { success: false, message: "Seu nível ainda não impressiona o suficiente pra pedir isso." };
        return resolve(
          clamp((trust - 60) / 60, 0, 0.85),
          () => { career.isFranchisePlayer = true; career.franchisePlayerTeamId = currentTeam.id; return `O(a) ${currentTeam.name} te oficializou como o Franchise Player!`; },
          null,
          `A diretoria do(a) ${currentTeam.name} ainda não está pronta pra construir o time em volta de você.`
        );
      }
      case "retire-number": {
        const champsOk = career.trophies.champions >= 1;
        if ((career.yearsWithCurrentTeam || 0) < 5 || !(champsOk || career.peakOVR >= 85)) {
          return { success: false, message: "Você ainda não construiu legado suficiente com esse time pra pedir isso." };
        }
        return resolve(
          clamp((trust - 75) / 50, 0, 0.7),
          () => { career.numberRetired = true; career.numberRetiredTeamId = currentTeam.id; return `Histórico: o(a) ${currentTeam.name} vai aposentar sua camisa!`; },
          null,
          `Pedido negado por enquanto — o(a) ${currentTeam.name} disse que ainda é cedo.`
        );
      }
      case "position": {
        return resolve(
          clamp((trust - 25) / 75, 0.1, 0.9),
          () => {
            career.position = param;
            career.ovr = computeOVR(career.attrs, career.position);
            return `O técnico aceitou te reposicionar como ${POSITIONS[param].label}.`;
          },
          null,
          `O técnico preferiu te manter na posição atual.`
        );
      }
      case "salary-raise": {
        return resolve(
          clamp((trust - 40) / 70, 0.05, 0.8),
          () => { career.salary = +(career.salary * 1.25).toFixed(1); return `Salário renegociado pra cima: agora $${career.salary}M/temporada.`; },
          null,
          `A diretoria não topou aumentar seu salário agora.`
        );
      }
      case "salary-cut": {
        career.salary = +(career.salary * 0.85).toFixed(1);
        career.teamTrust = clamp(career.teamTrust + 12, 0, 100);
        career.teamStrengthMap[currentTeam.id] = clamp(career.teamStrengthMap[currentTeam.id] + rng.int(4, 8), 35, 95);
        const msg = `Você abriu mão de parte do salário (agora $${career.salary}M) pra liberar espaço no orçamento — o(a) ${currentTeam.name} usou isso pra reforçar o elenco.`;
        career.events.push({ season: career.season, text: msg });
        return { success: true, message: msg };
      }
      case "reinforcements": {
        return resolve(
          clamp((trust - 45) / 65, 0.05, 0.75),
          () => {
            career.teamStrengthMap[currentTeam.id] = clamp(career.teamStrengthMap[currentTeam.id] + rng.int(5, 10), 35, 95);
            return `A diretoria do(a) ${currentTeam.name} trouxe reforços a pedido seu.`;
          },
          null,
          `A diretoria disse que não tem margem no orçamento pra trazer reforços agora.`
        );
      }
      case "no-trade": {
        if (career.noTradeClause) return { success: false, message: "Você já tem cláusula de não-negociação." };
        return resolve(
          clamp((trust - 65) / 55, 0, 0.75),
          () => { career.noTradeClause = true; return `Cláusula de não-negociação aprovada — você só sai do(a) ${currentTeam.name} se quiser.`; },
          null,
          `A diretoria não quer abrir mão do poder de negociar você.`
        );
      }
      default:
        throw new Error("Tipo de pedido desconhecido: " + type);
    }
  }

  const ATTR_LABELS_INTERNAL = {
    FIN: "finalizações", ARM: "arremessos de três", PAS: "passes", REB: "rebotes",
    DEF: "defesa", ATL: "transição", FIS: "jogo de poste", IQ: "leitura de jogo",
  };

  // ---------- ELENCO ATUAL (companheiros de time fictícios, só pra flavor) ----------
  function getCurrentRoster(career) {
    const team = TEAMS.find((t) => t.id === career.team);
    const rng = new RNG(career.seed + "::roster::" + career.team + "::" + career.season);
    const strength = career.teamStrengthMap[team.id] || 55;
    const roles = ["Armador Titular", "Ala-armador Titular", "Ala Titular", "Ala-pivô Titular", "Pivô Titular", "6º Homem", "Reserva", "Reserva"];
    const roster = roles.map((role) => {
      const base = clamp(strength / 100 * 28 + rng.gaussian(0, 6), 3, 30);
      return {
        name: randomRosterName(rng),
        role,
        ppg: +Math.max(1, base * rng.float(0.7, 1.1)).toFixed(1),
        rpg: +Math.max(0.5, base * 0.3 * rng.float(0.6, 1.2)).toFixed(1),
        apg: +Math.max(0.3, base * 0.22 * rng.float(0.6, 1.3)).toFixed(1),
      };
    });
    return { teamName: team.name, players: roster };
  }

  // ---------- TEMPORADA: começa, simula mês a mês, playoffs rodada por rodada, finaliza ----------
  function beginSeason(career) {
    if (career.seasonState) return career.seasonState;
    career.season++;
    const rng = new RNG(career.seed + "::season::" + career.season);
    const isRookieSeason = career.season === 1;
    const team = TEAMS.find((t) => t.id === career.team);
    const teamStrength = career.teamStrengthMap[team.id];
    const chemistry = computeChemistry(career, rng);
    const regime = TRAINING_REGIMES[career.trainingRegime] || TRAINING_REGIMES.padrao;
    const minutes = clamp(Math.round(computeMinutes(career.ovr, career.age, rng) * regime.minutesMult), 4, 38);
    const rates = computeRates(career.attrs, career.position, minutes, rng, career.schemeFocus);
    const contrib = clamp((career.ovr - 55) * 0.55, -15, 25);
    const winPct = clamp((teamStrength + contrib + (chemistry.value - 50) * 0.07) / 100, 0.10, 0.90);

    const otherTeamsFinalWins = {};
    for (const t of TEAMS) {
      if (t.id === team.id) continue;
      const otherWinPct = clamp(career.teamStrengthMap[t.id] / 100, 0.12, 0.88);
      let w = 0;
      for (let i = 0; i < 82; i++) if (rng.chance(otherWinPct)) w++;
      otherTeamsFinalWins[t.id] = w;
    }

    career.seasonState = {
      monthIndex: 0,
      gameInMonth: 0,
      monthsSchedule: MONTHS_SCHEDULE,
      monthNames: MONTH_NAMES,
      gp: 0, wins: 0, losses: 0,
      statTotals: { pts: 0, reb: 0, ast: 0, tov: 0 },
      chemistry, minutes, rates, winPct,
      monthAccum: newMonthAccum(MONTH_NAMES[0]),
      monthLog: [],
      recentGames: [], // só os últimos jogos, pra não inflar o save
      otherTeamsFinalWins,
      teamId: team.id,
      isRookieSeason,
      phase: "regular",
      playoff: null,
    };
    career.tradeRequestedThisOffseason = false;
    return career.seasonState;
  }

  function newMonthAccum(name) {
    return { name, gp: 0, wins: 0, losses: 0, pts: 0, missed: 0, recovering: false };
  }

  // ---------- TEMPORADA REGULAR: uma única partida é a unidade de simulação ----------
  // Simular um mês é só rodar esta função até fechar o calendário do mês, então os
  // dois ritmos (jogo a jogo e mês a mês) usam exatamente o mesmo modelo.
  const RECENT_GAMES_KEPT = 8;

  function simulateGame(career) {
    if (career.status !== "active") throw new Error("Carreira não está ativa.");
    if (!career.seasonState) beginSeason(career);
    const ss = career.seasonState;
    if (ss.phase !== "regular") throw new Error("Não há jogo de temporada regular pra simular agora.");

    const gamesScheduled = ss.monthsSchedule[ss.monthIndex];
    const rng = new RNG(
      career.seed + "::season::" + career.season + "::month::" + ss.monthIndex + "::game::" + ss.gameInMonth
    );
    const regime = TRAINING_REGIMES[career.trainingRegime] || TRAINING_REGIMES.padrao;
    const monthName = ss.monthNames[ss.monthIndex];
    const recovering = career.recoveringMonths > 0;

    // Contusão: a chance que antes era sorteada uma vez por mês, agora diluída por
    // partida — a frequência esperada continua a mesma.
    let newInjury = 0;
    if (!recovering && !career.injuryGamesLeft && career.age > 20) {
      const monthChance = clamp(0.06 * regime.injuryMult * (1 + (100 - career.durability) / 100), 0.01, 0.5);
      if (rng.chance(monthChance / gamesScheduled)) {
        newInjury = rng.int(2, 8);
        career.injuryGamesLeft = newInjury;
        career.durability = clamp(career.durability - rng.int(4, 10), 0, 100);
        career.events.push({ season: career.season, text: `Contusão em ${monthName}: você desfalcou o time em ${newInjury} jogos.` });
        if (career.durability < CHRONIC_INJURY_THRESHOLD && !career.chronicInjury) {
          career.chronicInjury = true;
          career.events.push({ season: career.season, text: `Sua durabilidade caiu demais — virou uma lesão crônica. Considere fazer cirurgia na entressafra.` });
        }
      }
    }

    const played = !recovering && !career.injuryGamesLeft;
    if (!played && career.injuryGamesLeft > 0) career.injuryGamesLeft--;

    // Resultado: sem você em quadra, o time perde um pouco de força.
    const teamWon = rng.chance(played ? ss.winPct : ss.winPct * 0.92);
    const opponent = pickOpponent(ss.teamId, rng);
    let teamScore = Math.round(104 + (ss.winPct - 0.5) * 16 + rng.gaussian(0, 9));
    let oppScore = Math.round(104 + rng.gaussian(0, 9));
    if (teamWon !== teamScore > oppScore) { const tmp = teamScore; teamScore = oppScore; oppScore = tmp; }
    if (teamScore === oppScore) teamScore += teamWon ? 2 : -2;

    // Linha do jogo: o mesmo ruído que antes era mensal, agora por partida.
    // O arredondamento é estocástico (2.4 vira 2 em 60% dos jogos e 3 nos outros
    // 40%) — assim o box score é inteiro sem puxar as médias da temporada pra baixo.
    const r = ss.rates;
    const noise = rng.gaussian(0, 0.26);
    const stat = (v) => {
      const x = Math.max(0, v);
      const base = Math.floor(x);
      return base + (rng.chance(x - base) ? 1 : 0);
    };
    const pts = played ? stat(r.ppg * (1 + noise)) : 0;
    const reb = played ? stat(r.rpg * (1 + noise * 0.7)) : 0;
    const ast = played ? stat(r.apg * (1 + noise * 0.7)) : 0;
    const tov = played ? stat(r.tov * (1 + rng.gaussian(0, 0.3))) : 0;

    if (played) {
      ss.statTotals.pts += pts;
      ss.statTotals.reb += reb;
      ss.statTotals.ast += ast;
      ss.statTotals.tov += tov;
      ss.gp++;
    }
    if (teamWon) ss.wins++; else ss.losses++;

    const acc = ss.monthAccum;
    acc.name = monthName;
    if (played) { acc.gp++; acc.pts += pts; } else { acc.missed++; }
    if (recovering) acc.recovering = true;
    if (teamWon) acc.wins++; else acc.losses++;

    const game = {
      season: career.season, month: monthName, monthIndex: ss.monthIndex,
      gameInMonth: ss.gameInMonth + 1, gamesInMonth: gamesScheduled,
      gameOfSeason: ss.wins + ss.losses,
      opponent, teamScore, oppScore, won: teamWon,
      played, recovering, newInjury,
      pts, reb, ast, tov,
    };
    ss.recentGames.push(game);
    if (ss.recentGames.length > RECENT_GAMES_KEPT) ss.recentGames.shift();

    ss.gameInMonth++;
    const monthDone = ss.gameInMonth >= gamesScheduled;
    let monthEntry = null;
    let regularSeasonDone = false;
    let qualifiedForPlayoffs = false;

    if (monthDone) {
      if (recovering) {
        career.recoveringMonths--;
        career.durability = clamp(career.durability + 10, 0, 100);
      }
      monthEntry = {
        name: acc.name, gp: acc.gp, wins: acc.wins, losses: acc.losses,
        ppgMonth: +(acc.pts / (acc.gp || 1)).toFixed(1), missed: acc.missed, recovering: acc.recovering,
      };
      ss.monthLog.push(monthEntry);
      ss.monthIndex++;
      ss.gameInMonth = 0;
      ss.monthAccum = newMonthAccum(ss.monthNames[ss.monthIndex] || acc.name);

      regularSeasonDone = ss.monthIndex >= ss.monthsSchedule.length;
      if (regularSeasonDone) {
        qualifiedForPlayoffs = ss.wins >= 40;
        if (qualifiedForPlayoffs) {
          ss.phase = "playoffs";
          ss.playoff = { roundIndex: 0, roundNames: PLAYOFF_ROUND_NAMES, roundsWon: 0, champion: false, lastSeries: null, lastSeriesRound: null };
        } else {
          ss.phase = "done";
        }
      }
    }

    return { game, monthDone, monthEntry, regularSeasonDone, qualifiedForPlayoffs };
  }

  // Ritmo da simulação: "game" (jogo a jogo) ou "month" (mês fechado).
  function setSimMode(career, mode) {
    if (mode !== "game" && mode !== "month") throw new Error("Ritmo de simulação inválido.");
    career.simMode = mode;
    return career;
  }

  function pickOpponent(teamId, rng) {
    const pool = TEAMS.filter((t) => t.id !== teamId);
    return pool[rng.int(0, pool.length - 1)].name;
  }

  function simulateMonth(career) {
    if (career.status !== "active") throw new Error("Carreira não está ativa.");
    if (!career.seasonState) beginSeason(career);
    if (career.seasonState.phase !== "regular") throw new Error("Não há mês de temporada regular pra simular agora.");
    let res;
    do { res = simulateGame(career); } while (!res.monthDone);
    return {
      monthEntry: res.monthEntry,
      games: career.seasonState.recentGames.slice(),
      regularSeasonDone: res.regularSeasonDone,
      qualifiedForPlayoffs: res.qualifiedForPlayoffs,
    };
  }

  function simulatePlayoffRound(career) {
    const ss = career.seasonState;
    if (!ss || ss.phase !== "playoffs") throw new Error("Não há rodada de playoff pra simular agora.");
    const rng = new RNG(career.seed + "::season::" + career.season + "::playoff::" + ss.playoff.roundIndex);
    const teamStrength = career.teamStrengthMap[ss.teamId];
    const power = clamp(teamStrength * 0.5 + career.ovr * 0.5 + (ss.chemistry.value - 50) * 0.08, 20, 99);
    const oppPower = generateOpponentPower(ss.playoff.roundIndex, rng);
    const series = simulateSeries(power, oppPower, rng);
    const roundName = ss.playoff.roundNames[ss.playoff.roundIndex];
    ss.playoff.lastSeries = series;
    ss.playoff.lastSeriesRound = roundName;

    let champion = false;
    const eliminated = !series.won;
    if (series.won) {
      ss.playoff.roundsWon = ss.playoff.roundIndex + 1;
      if (ss.playoff.roundIndex === ss.playoff.roundNames.length - 1) { champion = true; ss.playoff.champion = true; }
      ss.playoff.roundIndex++;
    }
    const seasonOver = eliminated || champion;
    if (seasonOver) ss.phase = "done";
    return {
      series, roundName, won: series.won, champion, eliminated, seasonOver,
      nextRoundName: !seasonOver ? ss.playoff.roundNames[ss.playoff.roundIndex] : null,
    };
  }

  function finalizeSeason(career) {
    const ss = career.seasonState;
    if (!ss || ss.phase !== "done") throw new Error("A temporada ainda não terminou.");
    const rng = new RNG(career.seed + "::season::" + career.season + "::finalize");

    const gp = Math.max(1, ss.gp);
    const ppg = +(ss.statTotals.pts / gp).toFixed(1);
    const rpg = +(ss.statTotals.reb / gp).toFixed(1);
    const apg = +(ss.statTotals.ast / gp).toFixed(1);
    const tov = +(ss.statTotals.tov / gp).toFixed(1);
    const spg = +ss.rates.spg.toFixed(1);
    const bpg = +ss.rates.bpg.toFixed(1);
    const fgPct = ss.rates.fgPct;
    const ftPct = ss.rates.ftPct;
    const eff = +(ppg + rpg + apg + spg + bpg - tov).toFixed(1);

    const teamWins = ss.wins, teamLosses = ss.losses;
    const playoffs = ss.playoff
      ? {
          roundsWon: ss.playoff.roundsWon, champion: ss.playoff.champion, madeFinals: ss.playoff.roundsWon >= 4,
          phaseName: ss.playoff.roundsWon > 0 ? ss.playoff.roundNames[ss.playoff.roundsWon - 1] : ss.playoff.lastSeriesRound,
          lastSeriesRound: ss.playoff.lastSeriesRound, lastSeries: ss.playoff.lastSeries,
        }
      : { roundsWon: 0, champion: false, madeFinals: false, phaseName: null, lastSeriesRound: null, lastSeries: null };

    const statline = { gp, mpg: ss.minutes, ppg, rpg, apg, spg, bpg, tov, fgPct, ftPct, eff };
    const awards = evaluateAwards(career, statline, { wins: teamWins, losses: teamLosses }, playoffs, ss.isRookieSeason, rng);
    const event = rollSeasonEvent(career, rng, statline);
    if (playoffs.champion) career.pendingChampionship = true;

    // Salário: pago no fim da temporada, escala com o OVR daquela temporada.
    career.salary = clamp(Math.round((2 + (career.ovr - 40) * 0.6) * 10) / 10, 1, 55);
    career.money = +(career.money + career.salary).toFixed(1);

    // Durabilidade: desgasta com a idade e o regime de treino escolhido; recupera um pouco se descansou.
    const regime = TRAINING_REGIMES[career.trainingRegime] || TRAINING_REGIMES.padrao;
    const baseDecay = career.age >= 31 ? rng.int(3, 7) : rng.int(0, 3);
    career.durability = clamp(career.durability - Math.round(baseDecay * regime.decayMult) + (career.trainingRegime === "descanso" ? 5 : 0), 0, 100);
    if (career.durability < CHRONIC_INJURY_THRESHOLD) career.chronicInjury = true;

    // Confiança com o time: sobe com temporada boa/títulos, cai com temporada ruim.
    let trustDelta = 0;
    if (playoffs.champion) trustDelta += 10;
    else if (playoffs.madeFinals) trustDelta += 6;
    else if (teamWins >= 44) trustDelta += 4;
    else if (teamWins < 30) trustDelta -= 5;
    if (awards.length > 0) trustDelta += 2;
    career.teamTrust = clamp(career.teamTrust + trustDelta, 0, 100);
    career.yearsWithCurrentTeam = (career.yearsWithCurrentTeam || 0) + 1;
    career.requestsThisOffseason = 0;

    const entry = {
      season: career.season, age: career.age, team: TEAMS.find((t) => t.id === ss.teamId).name, teamId: ss.teamId,
      ovr: career.ovr, chemistry: ss.chemistry.label, ...statline,
      teamWins, teamLosses, playoffPhase: playoffs.phaseName, champion: playoffs.champion, awards,
      monthLog: ss.monthLog, salary: career.salary, durability: career.durability,
    };
    career.careerLog.push(entry);
    career.leagueStandings = buildStandingsSnapshot(career, ss, 1);

    for (const t of TEAMS) {
      career.teamStrengthMap[t.id] = clamp(career.teamStrengthMap[t.id] + rng.gaussian(0, 2.5), 35, 92);
    }

    ageAttrs(career, rng);
    career.age++;
    career.seasonState = null;
    career.injuryGamesLeft = 0;
    // O histórico de eventos só é lido de trás pra frente — não vale carregar
    // a carreira inteira dentro do save.
    if (career.events.length > 40) career.events = career.events.slice(-40);

    const forcedRetirement = career.age >= 41 || career.ovr < 42;
    return { entry, event, playoffs, forcedRetirement };
  }

  function simulateFullSeason(career) {
    if (!career.seasonState) beginSeason(career);
    while (career.seasonState.phase === "regular") simulateMonth(career);
    while (career.seasonState.phase === "playoffs") simulatePlayoffRound(career);
    return finalizeSeason(career);
  }

  // ---------- CLASSIFICAÇÃO DAS CONFERÊNCIAS ----------
  function buildStandingsSnapshot(career, ss, fraction) {
    const rows = TEAMS.map((t) => {
      if (t.id === ss.teamId) {
        return { teamId: t.id, name: t.name, conf: t.conf, wins: ss.wins, losses: ss.losses, isPlayer: true };
      }
      const finalWins = ss.otherTeamsFinalWins[t.id] != null ? ss.otherTeamsFinalWins[t.id] : 41;
      const gamesElapsed = Math.round(82 * fraction);
      const wins = Math.round(finalWins * fraction);
      return { teamId: t.id, name: t.name, conf: t.conf, wins, losses: gamesElapsed - wins, isPlayer: false };
    });
    rows.sort((a, b) => b.wins - a.wins);
    return rows;
  }

  function getStandingsSnapshot(career) {
    const ss = career.seasonState;
    if (!ss) {
      if (career.leagueStandings) return career.leagueStandings;
      return TEAMS.map((t) => ({ teamId: t.id, name: t.name, conf: t.conf, wins: 0, losses: 0, isPlayer: t.id === career.team }))
        .sort((a, b) => b.wins - a.wins);
    }
    const fraction = clamp((ss.wins + ss.losses) / 82, 0.05, 1);
    return buildStandingsSnapshot(career, ss, fraction);
  }

  // ---------- LEGADO ----------
  function computeLegacyScore(career) {
    const t = career.trophies;
    const gp = career.careerLog.reduce((s, e) => s + e.gp, 0);
    const totalPts = career.careerLog.reduce((s, e) => s + e.ppg * e.gp, 0);
    const careerPPG = gp > 0 ? totalPts / gp : 0;
    const score =
      t.champions * 25 + t.finalsMVP * 15 + t.mvp * 20 + t.dpoy * 10 + t.roy * 8 + t.mip * 5 +
      t.allNBA * 6 + t.allDefense * 3 + t.allStar * 4 + t.sixthMan * 4 + t.scoringTitles * 8 +
      Math.round(careerPPG) + Math.round(career.peakOVR / 2) + Math.round(gp / 100);
    return { score, careerPPG: +careerPPG.toFixed(1), gp };
  }

  function getLegacyTier(score) {
    let tier = LEGACY_TIERS[0];
    for (const t of LEGACY_TIERS) if (score >= t.min) tier = t;
    return tier;
  }

  function findClosestLegend(career) {
    const attrs = career.peakAttrs || career.attrs;
    let best = null, bestDist = Infinity;
    for (const legend of LEGENDS) {
      let dist = 0;
      for (const k of ATTR_KEYS) { const d = (attrs[k] || 0) - (legend.stats[k] || 0); dist += d * d; }
      if (dist < bestDist) { bestDist = dist; best = legend; }
    }
    return best;
  }

  function retire(career) {
    career.status = "retired";
    const { score, careerPPG, gp } = computeLegacyScore(career);
    const tier = getLegacyTier(score);
    const closestLegend = findClosestLegend(career);
    career.legacy = { score, careerPPG, gamesPlayed: gp, tier, closestLegend };
    return career.legacy;
  }

  function fastForward(career, maxSeasons = 25) {
    const summaries = [];
    let i = 0;
    while (career.status === "active" && i < maxSeasons) {
      const res = simulateFullSeason(career);
      summaries.push(res);
      i++;
      if (res.forcedRetirement) break;
    }
    const legacy = retire(career);
    return { summaries, legacy };
  }

  return {
    SCHEMA_VERSION,
    TRAINING_REGIMES, TRAINER_COST, FACILITY_COST, SURGERY_COST, CHRONIC_INJURY_THRESHOLD, MAX_REQUESTS_PER_OFFSEASON,
    computeOVR, computePotentialOVR,
    newCareer, draftPick, rerollRound,
    beginSeason, simulateGame, simulateMonth, simulatePlayoffRound, finalizeSeason, simulateFullSeason,
    setSimMode,
    requestTrade, getStandingsSnapshot,
    setTrainingRegime, hireTrainer, buildFacility, scheduleSurgery,
    makeTeamRequest, getCurrentRoster,
    retire, fastForward,
    computeLegacyScore, getLegacyTier, findClosestLegend,
  };
});

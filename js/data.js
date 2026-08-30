// data.js — conteúdo estático do jogo: lendas (jogadores reais, de eras diferentes), times reais da NBA,
// posições e tiers de legado.
//
// As lendas usam nomes e características reais de domínio público (estilo de jogo, posição, época,
// time principal). Os atributos de 0-99 (`stats`) e as duas habilidades especiais de 1-5 estrelas
// (`stars`: Mão Ruim e Finta) são uma estimativa de game design baseada na reputação/estilo real de
// cada jogador — não são dados oficiais de nenhuma base estatística. É um jogo de simulação/fã-feito.

const ATTR_KEYS = ["FIN", "ARM", "PAS", "REB", "DEF", "ATL", "FIS", "IQ"]; // escala 0-99, conta pro OVR
const STAR_KEYS = ["MRUIM", "FINTA"]; // escala 1-5 estrelas, são modificadores (não entram no OVR)
const ALL_ATTR_KEYS = ATTR_KEYS.concat(STAR_KEYS);

const ATTR_LABELS = {
  FIN: "Finalização",
  ARM: "Arremesso de 3",
  PAS: "Passe",
  REB: "Rebote",
  DEF: "Defesa",
  ATL: "Atletismo",
  FIS: "Físico",
  IQ: "QI de Jogo / Clutch",
  MRUIM: "Mão Ruim",
  FINTA: "Finta",
};

const POSITIONS = {
  PG: {
    label: "Armador",
    weights: { PAS: 0.25, ATL: 0.15, ARM: 0.15, FIN: 0.10, DEF: 0.10, IQ: 0.15, REB: 0.05, FIS: 0.05 },
  },
  SG: {
    label: "Ala-armador",
    weights: { ARM: 0.22, FIN: 0.18, ATL: 0.15, DEF: 0.12, IQ: 0.13, PAS: 0.10, REB: 0.05, FIS: 0.05 },
  },
  SF: {
    label: "Ala",
    weights: { FIN: 0.16, DEF: 0.15, ATL: 0.14, ARM: 0.14, PAS: 0.10, IQ: 0.12, REB: 0.10, FIS: 0.09 },
  },
  PF: {
    label: "Ala-pivô",
    weights: { REB: 0.20, FIS: 0.18, FIN: 0.15, DEF: 0.15, ATL: 0.10, IQ: 0.10, PAS: 0.07, ARM: 0.05 },
  },
  C: {
    label: "Pivô",
    weights: { REB: 0.24, FIS: 0.22, DEF: 0.18, FIN: 0.14, ATL: 0.08, IQ: 0.08, PAS: 0.04, ARM: 0.02 },
  },
};

// Ordem cronológica das eras (só usada pra exibição/ordenação, não pro sorteio).
const ERA_ORDER = ["anos 60", "anos 70/80", "anos 80", "anos 90", "anos 90/2000", "anos 2000", "anos 2010", "anos 2020"];

// 55 lendas reais (misturando eras 1960-2020), cada uma com o time principal em que ficou famosa.
// O sorteio do draft escolhe uma dupla (era, time) real dentre as combinações que têm pelo menos uma
// lenda — depois você escolhe o jogador daquele elenco, e dentro do jogador, o atributo que quer roubar.
const LEGENDS = [
  { id: "wilt", name: "Wilt Chamberlain", pos: "C", era: "anos 60", team: "phi", tag: "Pivô dos anos 60 que marcou 100 pontos em um único jogo.", stats: { FIN: 95, ARM: 10, PAS: 55, REB: 99, DEF: 80, ATL: 75, FIS: 99, IQ: 60 }, stars: { MRUIM: 2, FINTA: 2 } },
  { id: "russell", name: "Bill Russell", pos: "C", era: "anos 60", team: "bos", tag: "Pivô dos anos 60, o maior campeão defensivo da história da liga.", stats: { FIN: 55, ARM: 10, PAS: 45, REB: 97, DEF: 99, ATL: 70, FIS: 85, IQ: 85 }, stars: { MRUIM: 2, FINTA: 2 } },
  { id: "kareem", name: "Kareem Abdul-Jabbar", pos: "C", era: "anos 70/80", team: "lal", tag: "Pivô dos anos 70/80, dono do arremesso 'gancho' mais indefensável do basquete.", stats: { FIN: 92, ARM: 20, PAS: 55, REB: 88, DEF: 80, ATL: 65, FIS: 82, IQ: 88 }, stars: { MRUIM: 2, FINTA: 4 } },
  { id: "oscar", name: "Oscar Robertson", pos: "PG", era: "anos 60", team: "mil", tag: "Armador dos anos 60, primeiro a fechar uma temporada com média de triplo-duplo.", stats: { FIN: 80, ARM: 35, PAS: 90, REB: 75, DEF: 65, ATL: 70, FIS: 60, IQ: 88 }, stars: { MRUIM: 3, FINTA: 4 } },
  { id: "west", name: "Jerry West", pos: "SG", era: "anos 60", team: "lal", tag: "Ala-armador dos anos 60, a silhueta que virou o logo da liga.", stats: { FIN: 85, ARM: 55, PAS: 70, REB: 45, DEF: 70, ATL: 75, FIS: 50, IQ: 85 }, stars: { MRUIM: 3, FINTA: 4 } },
  { id: "magic", name: "Magic Johnson", pos: "PG", era: "anos 80", team: "lal", tag: "Armador dos anos 80, redefiniu o que um jogador de 2,06m podia fazer com a bola na mão.", stats: { FIN: 75, ARM: 40, PAS: 99, REB: 65, DEF: 60, ATL: 75, FIS: 60, IQ: 96 }, stars: { MRUIM: 4, FINTA: 4 } },
  { id: "bird", name: "Larry Bird", pos: "SF", era: "anos 80", team: "bos", tag: "Ala dos anos 80, frieza total nos momentos decisivos.", stats: { FIN: 82, ARM: 88, PAS: 85, REB: 68, DEF: 60, ATL: 55, FIS: 55, IQ: 97 }, stars: { MRUIM: 3, FINTA: 5 } },
  { id: "erving", name: "Julius Erving", pos: "SF", era: "anos 80", team: "phi", tag: "Ala dos anos 80, trouxe o voo pro jogo antes de qualquer um.", stats: { FIN: 90, ARM: 35, PAS: 55, REB: 55, DEF: 60, ATL: 92, FIS: 60, IQ: 75 }, stars: { MRUIM: 4, FINTA: 4 } },
  { id: "moses", name: "Moses Malone", pos: "PF", era: "anos 80", team: "phi", tag: "Ala-pivô dos anos 80, rebote ofensivo era religião pra ele.", stats: { FIN: 80, ARM: 15, PAS: 30, REB: 96, DEF: 60, ATL: 65, FIS: 88, IQ: 65 }, stars: { MRUIM: 2, FINTA: 3 } },
  { id: "isiah", name: "Isiah Thomas", pos: "PG", era: "anos 80", team: "det", tag: "Armador dos anos 80, liderou os 'Bad Boys' de Detroit.", stats: { FIN: 78, ARM: 55, PAS: 88, REB: 40, DEF: 65, ATL: 80, FIS: 50, IQ: 88 }, stars: { MRUIM: 4, FINTA: 4 } },
  { id: "jordan", name: "Michael Jordan", pos: "SG", era: "anos 90", team: "chi", tag: "Ala-armador dos anos 90, o padrão-ouro de tudo que veio depois.", stats: { FIN: 97, ARM: 75, PAS: 65, REB: 60, DEF: 92, ATL: 96, FIS: 70, IQ: 96 }, stars: { MRUIM: 4, FINTA: 5 } },
  { id: "hakeem", name: "Hakeem Olajuwon", pos: "C", era: "anos 90", team: "hou", tag: "Pivô dos anos 90, o 'Dream Shake' ainda ensina defensores até hoje.", stats: { FIN: 92, ARM: 25, PAS: 55, REB: 85, DEF: 96, ATL: 88, FIS: 75, IQ: 88 }, stars: { MRUIM: 3, FINTA: 5 } },
  { id: "robinson", name: "David Robinson", pos: "C", era: "anos 90", team: "sas", tag: "Pivô dos anos 90, o 'Almirante' que fazia de tudo em quadra.", stats: { FIN: 82, ARM: 20, PAS: 50, REB: 85, DEF: 90, ATL: 82, FIS: 80, IQ: 82 }, stars: { MRUIM: 2, FINTA: 3 } },
  { id: "malone", name: "Karl Malone", pos: "PF", era: "anos 90", team: "uta", tag: "Ala-pivô dos anos 90, o 'Carteiro' sempre entregava.", stats: { FIN: 88, ARM: 25, PAS: 45, REB: 85, DEF: 70, ATL: 75, FIS: 90, IQ: 78 }, stars: { MRUIM: 2, FINTA: 3 } },
  { id: "stockton", name: "John Stockton", pos: "PG", era: "anos 90", team: "uta", tag: "Armador dos anos 90, dono histórico de assistências e roubos de bola.", stats: { FIN: 55, ARM: 55, PAS: 97, REB: 35, DEF: 82, ATL: 65, FIS: 45, IQ: 92 }, stars: { MRUIM: 4, FINTA: 3 } },
  { id: "barkley", name: "Charles Barkley", pos: "PF", era: "anos 90", team: "phx", tag: "Ala-pivô dos anos 90, pegava rebote como se fosse 20cm mais alto.", stats: { FIN: 82, ARM: 35, PAS: 55, REB: 92, DEF: 60, ATL: 78, FIS: 88, IQ: 82 }, stars: { MRUIM: 3, FINTA: 3 } },
  { id: "pippen", name: "Scottie Pippen", pos: "SF", era: "anos 90", team: "chi", tag: "Ala dos anos 90, o parceiro perfeito pra qualquer sistema defensivo.", stats: { FIN: 75, ARM: 55, PAS: 75, REB: 65, DEF: 92, ATL: 85, FIS: 60, IQ: 88 }, stars: { MRUIM: 4, FINTA: 4 } },
  { id: "ewing", name: "Patrick Ewing", pos: "C", era: "anos 90", team: "nyk", tag: "Pivô dos anos 90, o coração do garrafão de Nova Iorque.", stats: { FIN: 85, ARM: 20, PAS: 35, REB: 82, DEF: 85, ATL: 65, FIS: 82, IQ: 72 }, stars: { MRUIM: 2, FINTA: 3 } },
  { id: "payton", name: "Gary Payton", pos: "PG", era: "anos 90", team: "okc", tag: "Armador dos anos 90, apelidado de 'A Luva' pela marcação sufocante.", stats: { FIN: 65, ARM: 50, PAS: 78, REB: 40, DEF: 96, ATL: 80, FIS: 60, IQ: 82 }, stars: { MRUIM: 4, FINTA: 4 } },
  { id: "miller", name: "Reggie Miller", pos: "SG", era: "anos 90", team: "ind", tag: "Ala-armador dos anos 90, nasceu pra acertar arremessos nos segundos finais.", stats: { FIN: 55, ARM: 96, PAS: 45, REB: 30, DEF: 55, ATL: 65, FIS: 40, IQ: 80 }, stars: { MRUIM: 3, FINTA: 5 } },
  { id: "rodman", name: "Dennis Rodman", pos: "PF", era: "anos 90", team: "chi", tag: "Ala-pivô dos anos 90, obcecado por rebote e nada mais.", stats: { FIN: 45, ARM: 10, PAS: 40, REB: 99, DEF: 92, ATL: 80, FIS: 78, IQ: 70 }, stars: { MRUIM: 2, FINTA: 2 } },
  { id: "shaq", name: "Shaquille O'Neal", pos: "C", era: "anos 90/2000", team: "lal", tag: "Pivô dos anos 90/2000, força física que quebrava tabelas.", stats: { FIN: 95, ARM: 10, PAS: 50, REB: 90, DEF: 78, ATL: 78, FIS: 99, IQ: 68 }, stars: { MRUIM: 1, FINTA: 2 } },
  { id: "drexler", name: "Clyde Drexler", pos: "SG", era: "anos 90", team: "por", tag: "Ala-armador dos anos 90, voava pela quadra em Portland.", stats: { FIN: 80, ARM: 45, PAS: 60, REB: 55, DEF: 68, ATL: 88, FIS: 55, IQ: 75 }, stars: { MRUIM: 4, FINTA: 3 } },
  { id: "kobe", name: "Kobe Bryant", pos: "SG", era: "anos 2000", team: "lal", tag: "Ala-armador dos anos 2000, mentalidade obsessiva por vencer.", stats: { FIN: 93, ARM: 78, PAS: 62, REB: 50, DEF: 85, ATL: 88, FIS: 60, IQ: 92 }, stars: { MRUIM: 4, FINTA: 5 } },
  { id: "duncan", name: "Tim Duncan", pos: "PF", era: "anos 2000", team: "sas", tag: "Ala-pivô dos anos 2000, o fundamento feito jogador.", stats: { FIN: 85, ARM: 30, PAS: 60, REB: 90, DEF: 92, ATL: 65, FIS: 78, IQ: 93 }, stars: { MRUIM: 2, FINTA: 4 } },
  { id: "garnett", name: "Kevin Garnett", pos: "PF", era: "anos 2000", team: "min", tag: "Ala-pivô dos anos 2000, intensidade defensiva contagiante.", stats: { FIN: 78, ARM: 45, PAS: 65, REB: 88, DEF: 93, ATL: 80, FIS: 65, IQ: 85 }, stars: { MRUIM: 3, FINTA: 4 } },
  { id: "iverson", name: "Allen Iverson", pos: "PG", era: "anos 2000", team: "phi", tag: "Armador dos anos 2000, pequeno de estatura, gigante de coragem.", stats: { FIN: 85, ARM: 55, PAS: 60, REB: 30, DEF: 55, ATL: 92, FIS: 35, IQ: 75 }, stars: { MRUIM: 5, FINTA: 5 } },
  { id: "nash", name: "Steve Nash", pos: "PG", era: "anos 2000", team: "phx", tag: "Armador dos anos 2000, regia o ataque como ninguém.", stats: { FIN: 65, ARM: 85, PAS: 95, REB: 30, DEF: 45, ATL: 65, FIS: 40, IQ: 92 }, stars: { MRUIM: 5, FINTA: 4 } },
  { id: "dirk", name: "Dirk Nowitzki", pos: "PF", era: "anos 2000", team: "dal", tag: "Ala-pivô dos anos 2000, o arremesso de um pé só impossível de bloquear.", stats: { FIN: 82, ARM: 88, PAS: 55, REB: 70, DEF: 55, ATL: 55, FIS: 60, IQ: 88 }, stars: { MRUIM: 3, FINTA: 5 } },
  { id: "rayallen", name: "Ray Allen", pos: "SG", era: "anos 2000", team: "bos", tag: "Ala-armador dos anos 2000, mecânica de arremesso perfeita.", stats: { FIN: 65, ARM: 95, PAS: 55, REB: 35, DEF: 60, ATL: 70, FIS: 45, IQ: 82 }, stars: { MRUIM: 3, FINTA: 4 } },
  { id: "vince", name: "Vince Carter", pos: "SG", era: "anos 2000", team: "tor", tag: "Ala-armador dos anos 2000, enterradas que pareciam desafiar a física.", stats: { FIN: 82, ARM: 60, PAS: 45, REB: 45, DEF: 55, ATL: 96, FIS: 55, IQ: 68 }, stars: { MRUIM: 4, FINTA: 4 } },
  { id: "tmac", name: "Tracy McGrady", pos: "SF", era: "anos 2000", team: "orl", tag: "Ala dos anos 2000, capaz de decidir um jogo sozinho em segundos.", stats: { FIN: 85, ARM: 65, PAS: 55, REB: 55, DEF: 60, ATL: 88, FIS: 55, IQ: 75 }, stars: { MRUIM: 4, FINTA: 4 } },
  { id: "yao", name: "Yao Ming", pos: "C", era: "anos 2000", team: "hou", tag: "Pivô dos anos 2000, gigante chinês com toque de perímetro.", stats: { FIN: 78, ARM: 30, PAS: 50, REB: 78, DEF: 78, ATL: 50, FIS: 82, IQ: 78 }, stars: { MRUIM: 2, FINTA: 3 } },
  { id: "manu", name: "Manu Ginóbili", pos: "SG", era: "anos 2000", team: "sas", tag: "Ala-armador dos anos 2000, o sexto homem mais perigoso da história.", stats: { FIN: 72, ARM: 68, PAS: 68, REB: 40, DEF: 65, ATL: 75, FIS: 45, IQ: 88 }, stars: { MRUIM: 5, FINTA: 5 } },
  { id: "wade", name: "Dwyane Wade", pos: "SG", era: "anos 2000", team: "mia", tag: "Ala-armador dos anos 2000, ataque implacável ao aro.", stats: { FIN: 88, ARM: 45, PAS: 65, REB: 50, DEF: 80, ATL: 90, FIS: 55, IQ: 85 }, stars: { MRUIM: 4, FINTA: 4 } },
  { id: "lebron", name: "LeBron James", pos: "SF", era: "anos 2010", team: "cle", tag: "Ala dos anos 2010, corpo e visão de jogo entre os mais completos da história.", stats: { FIN: 92, ARM: 65, PAS: 90, REB: 75, DEF: 82, ATL: 92, FIS: 85, IQ: 95 }, stars: { MRUIM: 5, FINTA: 4 } },
  { id: "cp3", name: "Chris Paul", pos: "PG", era: "anos 2010", team: "lac", tag: "Armador dos anos 2010, controla o ritmo do jogo como um metrônomo.", stats: { FIN: 65, ARM: 68, PAS: 92, REB: 35, DEF: 78, ATL: 65, FIS: 45, IQ: 94 }, stars: { MRUIM: 5, FINTA: 5 } },
  { id: "durant", name: "Kevin Durant", pos: "SF", era: "anos 2010", team: "gsw", tag: "Ala dos anos 2010, 2,08m de altura arremessando como um armador.", stats: { FIN: 88, ARM: 85, PAS: 60, REB: 60, DEF: 65, ATL: 78, FIS: 55, IQ: 88 }, stars: { MRUIM: 4, FINTA: 4 } },
  { id: "curry", name: "Stephen Curry", pos: "PG", era: "anos 2010", team: "gsw", tag: "Armador dos anos 2010, redefiniu até onde um arremesso de três pode chegar.", stats: { FIN: 65, ARM: 99, PAS: 78, REB: 35, DEF: 50, ATL: 75, FIS: 40, IQ: 90 }, stars: { MRUIM: 5, FINTA: 4 } },
  { id: "harden", name: "James Harden", pos: "SG", era: "anos 2010", team: "hou", tag: "Ala-armador dos anos 2010, mestre do passo atrás e da linha de lance livre.", stats: { FIN: 80, ARM: 80, PAS: 85, REB: 45, DEF: 45, ATL: 65, FIS: 55, IQ: 85 }, stars: { MRUIM: 5, FINTA: 5 } },
  { id: "westbrook", name: "Russell Westbrook", pos: "PG", era: "anos 2010", team: "okc", tag: "Armador dos anos 2010, motor nunca desligava — triplo-duplo era rotina.", stats: { FIN: 78, ARM: 45, PAS: 78, REB: 70, DEF: 60, ATL: 96, FIS: 60, IQ: 72 }, stars: { MRUIM: 4, FINTA: 3 } },
  { id: "kawhi", name: "Kawhi Leonard", pos: "SF", era: "anos 2010", team: "tor", tag: "Ala dos anos 2010, mãos gigantes e defesa implacável.", stats: { FIN: 78, ARM: 65, PAS: 50, REB: 60, DEF: 94, ATL: 78, FIS: 65, IQ: 82 }, stars: { MRUIM: 3, FINTA: 3 } },
  { id: "giannis", name: "Giannis Antetokounmpo", pos: "PF", era: "anos 2010", team: "mil", tag: "Ala-pivô dos anos 2010, o 'Monstro Grego' com corpo de pivô e ritmo de armador.", stats: { FIN: 90, ARM: 35, PAS: 60, REB: 82, DEF: 82, ATL: 92, FIS: 88, IQ: 78 }, stars: { MRUIM: 3, FINTA: 3 } },
  { id: "dame", name: "Damian Lillard", pos: "PG", era: "anos 2010", team: "por", tag: "Armador dos anos 2010, arremessos de logo em momentos decisivos.", stats: { FIN: 68, ARM: 90, PAS: 72, REB: 30, DEF: 45, ATL: 65, FIS: 45, IQ: 85 }, stars: { MRUIM: 4, FINTA: 4 } },
  { id: "klay", name: "Klay Thompson", pos: "SG", era: "anos 2010", team: "gsw", tag: "Ala-armador dos anos 2010, catch-and-shoot mais puro da liga.", stats: { FIN: 60, ARM: 93, PAS: 40, REB: 35, DEF: 78, ATL: 60, FIS: 50, IQ: 75 }, stars: { MRUIM: 2, FINTA: 2 } },
  { id: "draymond", name: "Draymond Green", pos: "PF", era: "anos 2010", team: "gsw", tag: "Ala-pivô dos anos 2010, QI de jogo acima de qualquer estatística.", stats: { FIN: 45, ARM: 35, PAS: 82, REB: 75, DEF: 92, ATL: 65, FIS: 65, IQ: 92 }, stars: { MRUIM: 3, FINTA: 3 } },
  { id: "ad", name: "Anthony Davis", pos: "PF", era: "anos 2010", team: "lal", tag: "Ala-pivô dos anos 2010, envergadura que apaga arremessos no garrafão.", stats: { FIN: 82, ARM: 40, PAS: 45, REB: 85, DEF: 90, ATL: 82, FIS: 70, IQ: 78 }, stars: { MRUIM: 2, FINTA: 3 } },
  { id: "pg13", name: "Paul George", pos: "SF", era: "anos 2010", team: "ind", tag: "Ala dos anos 2010, ataca e defende nas duas pontas da quadra.", stats: { FIN: 75, ARM: 78, PAS: 55, REB: 55, DEF: 82, ATL: 78, FIS: 55, IQ: 80 }, stars: { MRUIM: 3, FINTA: 3 } },
  { id: "jokic", name: "Nikola Jokić", pos: "C", era: "anos 2020", team: "den", tag: "Pivô dos anos 2020, visão de armador dentro de um corpo de pivô.", stats: { FIN: 82, ARM: 55, PAS: 92, REB: 88, DEF: 60, ATL: 45, FIS: 70, IQ: 97 }, stars: { MRUIM: 4, FINTA: 5 } },
  { id: "luka", name: "Luka Dončić", pos: "PG", era: "anos 2020", team: "dal", tag: "Armador dos anos 2020, maturidade de veterano desde os 19 anos.", stats: { FIN: 85, ARM: 72, PAS: 88, REB: 60, DEF: 45, ATL: 55, FIS: 55, IQ: 90 }, stars: { MRUIM: 5, FINTA: 5 } },
  { id: "embiid", name: "Joel Embiid", pos: "C", era: "anos 2020", team: "phi", tag: "Pivô dos anos 2020, junta finalização, arremesso de três e físico.", stats: { FIN: 90, ARM: 62, PAS: 55, REB: 82, DEF: 78, ATL: 65, FIS: 82, IQ: 82 }, stars: { MRUIM: 3, FINTA: 4 } },
  { id: "tatum", name: "Jayson Tatum", pos: "SF", era: "anos 2020", team: "bos", tag: "Ala dos anos 2020, arsenal ofensivo completo.", stats: { FIN: 82, ARM: 75, PAS: 55, REB: 60, DEF: 68, ATL: 72, FIS: 60, IQ: 80 }, stars: { MRUIM: 4, FINTA: 4 } },
  { id: "sga", name: "Shai Gilgeous-Alexander", pos: "PG", era: "anos 2020", team: "okc", tag: "Armador dos anos 2020, frieza cirúrgica pra converter em qualquer ângulo.", stats: { FIN: 88, ARM: 62, PAS: 65, REB: 40, DEF: 72, ATL: 78, FIS: 55, IQ: 85 }, stars: { MRUIM: 5, FINTA: 5 } },
  { id: "morant", name: "Ja Morant", pos: "PG", era: "anos 2020", team: "mem", tag: "Armador dos anos 2020, explosão atlética que gera highlight toda semana.", stats: { FIN: 80, ARM: 50, PAS: 75, REB: 40, DEF: 55, ATL: 97, FIS: 50, IQ: 72 }, stars: { MRUIM: 4, FINTA: 3 } },
  { id: "wemby", name: "Victor Wembanyama", pos: "C", era: "anos 2020", team: "sas", tag: "Pivô dos anos 2020, envergadura de pivô com habilidades de ala.", stats: { FIN: 78, ARM: 60, PAS: 55, REB: 78, DEF: 90, ATL: 78, FIS: 55, IQ: 75 }, stars: { MRUIM: 3, FINTA: 3 } },
];

// Ano em que cada lenda entrou no draft (ou no draft da liga em que iniciou a carreira).
const LEGEND_DRAFT_YEARS = {
  wilt: 1959, russell: 1956, kareem: 1969, oscar: 1960, west: 1960,
  magic: 1979, bird: 1978, erving: 1972, moses: 1974, isiah: 1981,
  jordan: 1984, hakeem: 1984, robinson: 1987, malone: 1985, stockton: 1984,
  barkley: 1984, pippen: 1987, ewing: 1985, payton: 1990, miller: 1987,
  rodman: 1986, shaq: 1992, drexler: 1983, kobe: 1996, duncan: 1997,
  garnett: 1995, iverson: 1996, nash: 1996, dirk: 1998, rayallen: 1996,
  vince: 1998, tmac: 1997, yao: 2002, manu: 1999, wade: 2003,
  lebron: 2003, cp3: 2005, durant: 2007, curry: 2009, harden: 2009,
  westbrook: 2008, kawhi: 2011, giannis: 2013, dame: 2012, klay: 2011,
  draymond: 2012, ad: 2012, pg13: 2010, jokic: 2014, luka: 2018,
  embiid: 2014, tatum: 2017, sga: 2018, morant: 2019, wemby: 2023,
};
LEGENDS.forEach((legend) => { legend.draftYear = LEGEND_DRAFT_YEARS[legend.id]; });

// 30 times reais da NBA. "strength" é uma força-base fictícia só pra abstração de jogo (não é rating oficial).
const TEAMS = [
  { id: "bos", name: "Boston Celtics", conf: "Leste", strength: 80 },
  { id: "bkn", name: "Brooklyn Nets", conf: "Leste", strength: 54 },
  { id: "nyk", name: "New York Knicks", conf: "Leste", strength: 64 },
  { id: "phi", name: "Philadelphia 76ers", conf: "Leste", strength: 66 },
  { id: "tor", name: "Toronto Raptors", conf: "Leste", strength: 56 },
  { id: "chi", name: "Chicago Bulls", conf: "Leste", strength: 58 },
  { id: "cle", name: "Cleveland Cavaliers", conf: "Leste", strength: 62 },
  { id: "det", name: "Detroit Pistons", conf: "Leste", strength: 48 },
  { id: "ind", name: "Indiana Pacers", conf: "Leste", strength: 60 },
  { id: "mil", name: "Milwaukee Bucks", conf: "Leste", strength: 72 },
  { id: "atl", name: "Atlanta Hawks", conf: "Leste", strength: 54 },
  { id: "cha", name: "Charlotte Hornets", conf: "Leste", strength: 44 },
  { id: "mia", name: "Miami Heat", conf: "Leste", strength: 68 },
  { id: "orl", name: "Orlando Magic", conf: "Leste", strength: 56 },
  { id: "was", name: "Washington Wizards", conf: "Leste", strength: 42 },
  { id: "den", name: "Denver Nuggets", conf: "Oeste", strength: 76 },
  { id: "min", name: "Minnesota Timberwolves", conf: "Oeste", strength: 62 },
  { id: "okc", name: "Oklahoma City Thunder", conf: "Oeste", strength: 70 },
  { id: "por", name: "Portland Trail Blazers", conf: "Oeste", strength: 46 },
  { id: "uta", name: "Utah Jazz", conf: "Oeste", strength: 48 },
  { id: "gsw", name: "Golden State Warriors", conf: "Oeste", strength: 74 },
  { id: "lac", name: "LA Clippers", conf: "Oeste", strength: 64 },
  { id: "lal", name: "Los Angeles Lakers", conf: "Oeste", strength: 78 },
  { id: "phx", name: "Phoenix Suns", conf: "Oeste", strength: 66 },
  { id: "sac", name: "Sacramento Kings", conf: "Oeste", strength: 54 },
  { id: "dal", name: "Dallas Mavericks", conf: "Oeste", strength: 68 },
  { id: "hou", name: "Houston Rockets", conf: "Oeste", strength: 58 },
  { id: "mem", name: "Memphis Grizzlies", conf: "Oeste", strength: 60 },
  { id: "nop", name: "New Orleans Pelicans", conf: "Oeste", strength: 52 },
  { id: "sas", name: "San Antonio Spurs", conf: "Oeste", strength: 58 },
];

// 11 tiers de legado, do pior ao lendário.
const LEGACY_TIERS = [
  { min: -999, name: "Sonhador de Fundo de Banco", desc: "A carreira nunca engrenou. Mas você vestiu o uniforme." },
  { min: 20, name: "Contrato Two-Way", desc: "Entrando e saindo da liga, sempre lutando por um lugar." },
  { min: 40, name: "Reserva de Rotação", desc: "Um nome confiável no banco, minutos garantidos." },
  { min: 65, name: "Sexto Homem", desc: "O primeiro a entrar, decisivo fora do quinteto titular." },
  { min: 100, name: "Titular Sólido", desc: "Peça regular de um time competitivo." },
  { min: 140, name: "Estrela Emergente", desc: "Nome que a liga já respeita." },
  { min: 190, name: "All-Star", desc: "Reconhecido entre os melhores da sua posição." },
  { min: 250, name: "All-NBA", desc: "Uma das faces do basquete na sua era." },
  { min: 320, name: "Ícone de Franquia", desc: "O time foi construído ao seu redor." },
  { min: 420, name: "Hall da Fama", desc: "Nome gravado na história do esporte." },
  { min: 520, name: "A LENDA DA QUADRA", desc: "Praticamente impossível. Você virou a próxima lenda pra outros roubarem atributos." },
];

// Nomes fictícios pra gerar o "elenco atual" do seu time (companheiros de equipe) e pacotes de troca.
// Propositalmente não são nomes de jogadores reais — não temos uma base confiável de elencos atuais
// completos, e inventar estatísticas em cima de nomes de atletas de verdade seria enganoso.
const ROSTER_FIRST_NAMES = [
  "Marcus", "Deion", "Trey", "Malik", "Xavier", "Cole", "Bryce", "Jaylen", "Devon", "Isaiah",
  "Lucas", "Rafael", "Théo", "Nikola", "Luka", "Dario", "Kenji", "Andre", "Miles", "Cody",
];
const ROSTER_LAST_NAMES = [
  "Whitfield", "Marsh", "Okafor", "Delgado", "Bellamy", "Souza", "Kowalski", "Petrov", "Nakamura", "Cross",
  "Ellison", "Reyes", "Holloway", "Brandt", "Vasquez", "Sato", "Coleman", "Duarte", "Fischer", "Novak",
];

(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else Object.assign(root, factory());
})(typeof self !== "undefined" ? self : this, function () {
  return {
    ATTR_KEYS, STAR_KEYS, ALL_ATTR_KEYS, ATTR_LABELS, POSITIONS, ERA_ORDER, LEGENDS, TEAMS, LEGACY_TIERS,
    ROSTER_FIRST_NAMES, ROSTER_LAST_NAMES,
  };
});

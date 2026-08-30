# LENDA DA QUADRA

Simulador de carreira de basquete no navegador. Jogável do início ao fim, sem instalar nada.

## Como abrir

Dê duplo clique em `index.html` (ou clique com o botão direito → Abrir com → seu navegador).

## Inspiração

- **Motor de carreira** (temporada a temporada, eventos, prêmios, tiers de legado, modo relâmpago) — inspirado em [thefenomeno.com](https://www.thefenomeno.com/).
- **Draft por era/time/jogador e o conceito de teto de atributo** — inspirado em [82-0.com](https://www.82-0.com/), que te faz sortear um time+época e escolher um jogador daquele elenco.

## Jogadores e times reais

Lendas e times agora são **reais**: 55 jogadores de eras diferentes (de Wilt Chamberlain e Bill Russell nos anos 60 até Wembanyama nos anos 2020), cada um com seu time principal de verdade, e os 30 times atuais da NBA. Os atributos (0-99) e as duas habilidades especiais de 1-5 estrelas (Mão Ruim e Finta) são uma estimativa de game design baseada no estilo real de jogo de cada um — não são dados oficiais de nenhuma base estatística, é um jogo de simulação feito por fã. Tudo em `js/data.js`.

## Como jogar

1. **Nova Carreira** → escolha posição e dificuldade.
2. **Draft — o coração do jogo**: 10 rodadas (8 atributos principais + Mão Ruim + Finta). Antes de cada rodada, uma roleta sorteia uma lenda e mostra o ano em que ela foi draftada. Você então escolhe **qual atributo daquele jogador** quer roubar. O valor vira o seu **teto** (o máximo que pode alcançar evoluindo) e você começa a carreira com 60% dele. Mão Ruim e Finta usam uma escala de 1 a 5 estrelas. Há 2 giros extras para trocar a lenda sorteada.
3. **Carreira no seu ritmo**: escolha entre **jogo a jogo** (82 partidas, cada clique é um jogo com placar, adversário e sua linha do jogo) ou **mês a mês** (a temporada regular em 6 cliques). Dá pra trocar de ritmo a qualquer momento, inclusive no meio de um mês — o mês continua de onde parou. Os dois usam o mesmo motor: um mês é só o restante dos jogos daquele mês simulados de uma vez. Se classificar (40+ vitórias), os **playoffs são jogados rodada por rodada**, cada série em melhor-de-7 com uma animação "ao vivo" jogo a jogo — mesmo que você seja eliminado, não só quando é campeão.
4. **Classificação**: botão "Ver Classificação" mostra as duas conferências (Leste/Oeste) atualizadas, com seu time destacado.
5. **Pedir Troca**: entre temporadas, você pode pedir pra ser negociado — a diretoria pode aceitar ou recusar, dependendo do seu nível.
6. **Carreira Relâmpago**: simula o resto da carreira inteira de uma vez (tipo o "Speed Career" do Fenômeno) — funciona mesmo no meio de uma temporada em andamento.
7. **Aposentar** (só entre temporadas): revela seu tier de legado (de "Sonhador de Fundo de Banco" até "A LENDA DA QUADRA") e qual lenda real seu auge de carreira mais se pareceu.
8. **Ranking Local**: guarda todas as carreiras concluídas neste navegador.

Seu progresso é salvo automaticamente (`localStorage`) — pode fechar a aba e continuar depois, inclusive no meio de uma temporada.

## Físico, clube e animações

- **🩺 Físico**: você tem uma barra de **durabilidade** (0-100) que desgasta com contusões e idade. Se cair demais, vira **lesão crônica** (evolução pela metade). Escolha um **regime de treino** por temporada (Padrão, Mentalidade Mamba — evolui mais rápido mas machuca mais —, Foco em Prevenção, ou Descanso/Menos Minutos), contrate um **preparador físico** e depois **instalações de treino pessoais** (aceleram a evolução pra sempre), e pague uma **cirurgia** quando a durabilidade estiver baixa (custa dinheiro e alguns meses de recuperação). Tudo pago com o dinheiro que você ganha de salário a cada temporada.
- **🏛️ Time**: pedidos ao clube, limitados a 2 por entressafra, cada um com uma chance de aceitação baseada no seu **nível de confiança** com o time atual (sobe com temporadas boas e títulos, reseta quando você é trocado). Dá pra pedir esquema tático focado num atributo seu, número de camisa, ser o Franchise Player, aposentar sua camisa (precisa de anos de casa + legado), trocar de posição, aumentar ou abrir mão de salário, pedir reforços, ou uma cláusula de não-negociação.
- **👥 Elenco**: mostra os companheiros de time atuais — gerados proceduralmente (nomes fictícios, não é uma base de elenco real).
- **🏆 Sala de Troféus**: detalha cada prêmio da carreira, temporada por temporada.
- **Animações**: roleta girando revelando o time que te draftou (com sua posição), animação de troca mostrando os dois lados do negócio (seu time novo recebe você, o antigo recebe um pacote de compensação), e confete + troféu quando você é campeão.

## Interface

A camada visual é um design system próprio (`css/style.css`) com tokens de cor, superfície, elevação e movimento — nada de framework, continua sendo três arquivos abertos no navegador.

- **Cor que segue o seu time**: o acento da interface inteira (botões, barras, brilhos do fundo, gráficos) muda pro tom da franquia em que você está. Trocou de time, a cara do jogo troca junto. No draft, a cor acompanha o time sorteado da rodada.
- **HUD fixo no topo**: temporada, time, OVR, idade, dinheiro e durabilidade sempre à vista, com o número dando um "pulo" quando muda.
- **Radar de atributos**: octógono com os 8 atributos e o contorno pontilhado do seu teto — dá pra ver de relance o formato do jogador, sem ler número por número.
- **Curva da carreira**: gráfico de OVR e PPG temporada a temporada, no painel de histórico e no retrospecto final.
- **Avisos e diálogos próprios**: cada mês simulado devolve um card de notificação com o recorde e a média; confirmações (aposentar, carreira relâmpago) usam diálogo do jogo em vez do popup do navegador.
- **Atalhos de teclado**: `Espaço` simula o próximo mês/rodada, `F` Físico, `T` Time, `E` Elenco, `C` Classificação, `R` Sala de Troféus, `Esc` volta. A lista fica no botão `⌘` do topo.
- **Celular**: layout de coluna única e barra de ações fixa no rodapé, sempre ao alcance do polegar.
- **Movimento com freio**: quem usa "reduzir movimento" no sistema recebe a interface sem animação nenhuma.

### Informação na medida

A tela mostra o que muda a sua decisão; o resto fica a um clique de distância.

- **Sem repetição**: a barra do topo cuida da identidade (temporada, time, OVR, idade) e o card do jogador cuida do estado (dinheiro, durabilidade, confiança) — cada número aparece uma vez só.
- **Histórico enxuto**: a tabela abre com 10 colunas; "Estatísticas completas" revela química, jogos, turnovers, FG%, FT% e EFF quando você quiser.
- **Troféus**: só os conquistados. Nada de parede de zeros.
- **Resumo da temporada**: quatro números grandes (PPG, RPG, APG, EFF) e uma linha de contexto, em vez de dez linhas de tabela.
- **Radar sem ruído**: o octógono mostra o formato do jogador; o valor exato e o teto ficam nas barras logo abaixo.
- **Avisos com parcimônia**: no modo jogo a jogo nada interrompe — o placar aparece no card da temporada, e só contusão e fim de mês geram notificação.
- **Save leve**: a carreira guarda os últimos 8 jogos e os últimos 40 eventos, não a temporada inteira jogada a jogada.

## Estrutura do projeto

```
basketball-legends/
├── index.html
├── css/style.css     # design system (tokens, componentes, responsivo)
└── js/
    ├── rng.js       # RNG com seed (determinístico)
    ├── data.js      # lendas, times, posições, tiers de legado
    ├── engine.js    # motor puro de simulação (sem DOM — testável isolado com Node)
    │                # a unidade de simulação é UMA partida; mês/temporada são laços em cima dela
    ├── ui.js / main.js   # renderização e orquestração de estado
    └── fx.js        # camada visual: acento por time, HUD, gráficos, avisos, atalhos
```

`fx.js` envolve as funções de `ui.js` em vez de reescrevê-las — o motor e as regras do jogo seguem intocados.

## Roadmap (próximos passos possíveis)

- Simular os outros times mês a mês de verdade (hoje a classificação da liga é projetada, não jogo a jogo, pra manter a performance leve)
- Mais eventos de calendário (rivalidades, prêmios de meio de temporada)
- Comparar carreiras do ranking local lado a lado
- Exportar o retrospecto da carreira como imagem

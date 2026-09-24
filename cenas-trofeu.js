// =====================================================================
// Cenas especiais de comemoração — pra troféus que merecem mais do que o
// próprio ícone passeando pela tela — e as vitrines: o objeto do troféu
// em 3D, pra girar arrastando na estante.
//
// Cada cena é uma função que monta e devolve o elemento da animação.
// trofeus.js procura aqui pelo nome do campo "animacao" do troféu (e pelo
// campo "vitrine", pra vitrine). As três cenas são 3D: a muralha (século
// III) mora em muralha-3d.js, a flechada (século XVI) em flechada-3d.js e
// a caravela (século XV) em barco-3d.js; aqui ficam só os números de cada
// uma.
// =====================================================================
const CenasTrofeu = (function () {
  // A cena 3D vai dentro de uma caixa que cobre a tela. A caixa some quando o tempo de vida dela
  // acaba (ver comemorar, em trofeus.js), e esse tempo acompanha a animação, senão aumentar uma
  // duração cortaria o fim no meio. "folga" = um tempinho a mais depois que a animação termina.
  function emCaixa(classe, cena3d, folga = 0) {
    const cena = document.createElement('div');
    cena.className = 'trofeu-cena ' + classe;
    if (cena3d) {
      cena.append(cena3d);
      cena.style.animationDuration = (cena3d.duracaoTotal + folga) + 's';
    }
    return cena;
  }

  // ---- muralha romana (século III) ----
  // A muralha sobe, um soldado espia por trás dela, olha pros dois lados, se esconde e ela desce.
  // O que cada número significa está em muralha-3d.js.
  const MURALHA = {
    muroAltura: 2.2,
    muroBase: -1.4,
    muroDistancia: 6.1,
    espessura: 0.75,
    ameiaAltura: 0.7,
    ameiaLargura: 0.7,
    vao: 1.15,
    vaoCentral: 1.1,
    pedraTamanho: 3.5,
    pedraFrio: 1,
    tamanho: 2.05,
    espiada: -0.18,
    olhar: 27,
    olharOlhos: 9,
    sobeMuro: 0.6,
    antesDeEspiar: 0.3,
    espiar: 0.45,
    olhaEsquerda: 0.7,
    olhaDireita: 0.75,
    voltaFrente: 0.4,
    esconder: 0.7,
    antesDeDescer: 0.3,
    desceMuro: 0.6,
    brilho: 1.1,
    contorno: 1,
    pixel: 1
  };

  // a folga cobre o primeiro quadro, que demora um pouquinho a sair (a muralha já saiu de cena
  // quando a animação acaba, então o tempo a mais não aparece)
  function muralha() {
    return emCaixa('muralha', Muralha3D.criar(MURALHA), 0.3);
  }

  // ---- flechada da paliçada (século XVI) ----
  // O texto fala de aldeias protegidas por paliçadas de tronco e de flechas envenenadas: a cerca
  // de troncos sobe e uma saraivada vem de trás dela na direção de quem está olhando. A cena
  // inteira é 3D, montada em flechada-3d.js; aqui ficam só os números do voo — o que cada um
  // significa está lá.
  const VOO = {
    quantidade: 5,
    duracao: 2.2,
    atraso: 0,
    distancia: 11,
    altura: -1.6,
    origemX: 0,
    espalhamento: 16.6,
    destinoX: 0,
    espalhamentoFim: 4.8,
    encontro: 0.7,
    alvoAltura: 1.5,
    gravidade: -4.1,
    tamanho: 0.9,
    rodopio: 1,
    pixel: 1,
    muroAltura: 1.9,
    muroDistancia: 4,
    muroBase: -0.9,
    muroEspera: 0.5,
    brilho: 1.05,
    contorno: 1
  };

  function flechada() {
    return emCaixa('flechada', Flechada3D.criar(VOO));
  }

  // ---- a caravela (século XV) ----
  // O texto fala de Gutenberg e das caravelas portuguesas nas Grandes Navegações: o barco passa
  // de um lado a outro da tela, baixo — no mesmo lugar onde ficaria a muralha do século III —
  // balançando como quem enfrenta onda. Sem mar, sem chão, só ele. A cena inteira é 3D, montada
  // em barco-3d.js; aqui ficam só os números — o que cada um significa está lá.
  const VOO_BARCO = {
    escala: 0.46,
    distancia: 16,
    origemX: -19.5,
    destinoX: 19.5,
    altura: -2,
    anguloExtra: -3,
    balancoAltura: 0.055,
    balancoGiro: 6,
    balancoVelocidade: 0.9,
    duracao: 5,
    brilho: 0.65,
    pixel: 1
  };

  function barco() {
    return emCaixa('barco', Barco3D.criar(VOO_BARCO));
  }

  // ---- o pergaminho (século VI) ----
  // O texto fala das leis de Roma sendo reunidas e reescritas em papiro e pergaminho: um
  // pergaminho se desenrola no meio da tela, mostrando o que foi escrito nele. A cena inteira é
  // 3D, montada em pergaminho-3d.js; aqui ficam só os números — o que cada um significa está lá.
  const PERGAMINHO = {
    distancia: 4.2,
    alturaNaTela: 0,
    escala: 1,
    origemX: -5,
    entrada: 0.75,
    duracao: 1.1,
    mostra: 0.9,
    fechar: 0.45,
    saida: 0.5,
    aberturaMaxima: 0.7,
    balanco: 2.5,
    brilho: 1.3,
    pixel: 1
  };

  function pergaminho() {
    return emCaixa('pergaminho', Pergaminho3D.criar(PERGAMINHO));
  }

  const CENAS = { muralha, flechada, barco, pergaminho };

  // ---- vitrines: o objeto do troféu em 3D, pra girar arrastando na estante ----
  const VITRINES = {
    elmo: () => Muralha3D.criarVitrineDoElmo(MURALHA),      // o elmo do soldado da muralha, sozinho
    caravela: () => Barco3D.criarVitrineDoBarco(VOO_BARCO), // o barco do século XV, sozinho
    pergaminho: () => Pergaminho3D.criarVitrine(PERGAMINHO) // o pergaminho do século VI, sozinho
  };

  return {
    // devolve o elemento pronto da cena, ou null se esse nome não for uma cena especial.
    // premio = o troféu que está sendo comemorado.
    criar(nome, premio) {
      return CENAS[nome] ? CENAS[nome](premio) : null;
    },
    // devolve a vitrine (uma caixa com o objeto 3D, que tem .parar()), ou null se não houver
    vitrine(nome, premio) {
      return VITRINES[nome] ? VITRINES[nome](premio) : null;
    }
  };
})();

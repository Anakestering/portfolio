// =====================================================================
// Ícones dos troféus em pixel art — mesma linguagem visual do livro (nada
// de emoji, que destoa do desenho das páginas).
//
// Cada troféu aponta pra um arquivo de imagem no campo "imagem" (em
// jogo-romanos.js), com fundo transparente. IconesTrofeu.criar() devolve
// um <canvas> pronto; com { silhueta: true } tudo é pintado de uma cor
// escura só, então dá pra ver a forma sem entender o que é.
// =====================================================================
const IconesTrofeu = (function () {
  const COR_SILHUETA = '#2a211a'; // escuro o bastante pra não entregar nada, claro o bastante pra ver

  // Na silhueta, os vazios de DENTRO do desenho (a janela da mesquita, o miolo da taça, o vão
  // entre as espadas) são tapados: eles é que entregavam o que era. O truque é achar o que é "fora" espalhando a
  // partir das bordas do quadro pelos pixels transparentes — todo vazio que a espalhada não
  // alcança está cercado pelo desenho, e vira breu também.
  function taparVaziosInternos(ctx, lado) {
    const dados = ctx.getImageData(0, 0, lado, lado);
    const p = dados.data;
    const fora = new Uint8Array(lado * lado);
    const fila = [];
    const vazio = i => p[i * 4 + 3] <= 20;
    const visitar = i => { if (!fora[i] && vazio(i)) { fora[i] = 1; fila.push(i); } };
    for (let x = 0; x < lado; x++) { visitar(x); visitar((lado - 1) * lado + x); }
    for (let y = 0; y < lado; y++) { visitar(y * lado); visitar(y * lado + lado - 1); }
    while (fila.length) {
      const i = fila.pop(), x = i % lado, y = (i / lado) | 0;
      if (x > 0) visitar(i - 1);
      if (x < lado - 1) visitar(i + 1);
      if (y > 0) visitar(i - lado);
      if (y < lado - 1) visitar(i + lado);
    }
    const [r, g, b] = corSilhuetaRGB();
    for (let i = 0; i < lado * lado; i++) {
      if (vazio(i) && !fora[i]) { p[i * 4] = r; p[i * 4 + 1] = g; p[i * 4 + 2] = b; p[i * 4 + 3] = 255; }
    }
    ctx.putImageData(dados, 0, 0);
  }

  function corSilhuetaRGB() {
    const n = parseInt(COR_SILHUETA.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // menor retângulo que cabe todo o desenho, ignorando a borda transparente do arquivo
  function caixaDoDesenho(img) {
    const largura = img.naturalWidth, altura = img.naturalHeight;
    const medida = document.createElement('canvas');
    medida.width = largura; medida.height = altura;
    const mctx = medida.getContext('2d', { willReadFrequently: true });
    mctx.drawImage(img, 0, 0);
    const p = mctx.getImageData(0, 0, largura, altura).data;
    let x0 = largura, x1 = -1, y0 = altura, y1 = -1;
    for (let y = 0; y < altura; y++) {
      for (let x = 0; x < largura; x++) {
        if (p[(y * largura + x) * 4 + 3] <= 20) continue;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    if (x1 < 0) return { x: 0, y: 0, largura, altura }; // imagem vazia: usa o quadro inteiro
    return { x: x0, y: y0, largura: x1 - x0 + 1, altura: y1 - y0 + 1 };
  }

  // ícone vindo de um arquivo de imagem (PNG com fundo transparente, feito em qualquer editor de
  // pixel art). A silhueta é gerada na hora: mantém o recorte e pinta tudo de escuro.
  function deImagem(src, silhueta, lado) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = lado;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const img = new Image();
    img.onload = () => {
      ctx.imageSmoothingEnabled = false; // mantém o pixel quadrado ao redimensionar
      // O arquivo quase sempre tem folga transparente em volta do desenho, e desenhar o quadro
      // inteiro deixaria o ícone pequeno dentro do quadradinho. Então recorta no desenho e encaixa
      // ele no espaço todo, mantendo a proporção — assim vale pra imagem de qualquer formato.
      const c = caixaDoDesenho(img);
      const escala = Math.min(lado / c.largura, lado / c.altura);
      const w = Math.round(c.largura * escala), h = Math.round(c.altura * escala);
      ctx.drawImage(img, c.x, c.y, c.largura, c.altura,
        Math.round((lado - w) / 2), Math.round((lado - h) / 2), w, h);
      if (!silhueta) return;
      const [r, g, b] = corSilhuetaRGB();
      const dados = ctx.getImageData(0, 0, lado, lado);
      const p = dados.data;
      for (let i = 0; i < p.length; i += 4) {
        if (p[i + 3] > 20) { p[i] = r; p[i + 1] = g; p[i + 2] = b; p[i + 3] = 255; }
      }
      ctx.putImageData(dados, 0, 0);
      taparVaziosInternos(ctx, lado);
    };
    img.onerror = () => console.error('[troféus] não consegui carregar o ícone', src);
    img.src = src;
    return canvas;
  }

  return {
    // trofeu = o objeto do prêmio, com o campo "imagem". Devolve um <canvas> pronto (a imagem
    // entra nele quando terminar de carregar), ou null se o troféu não tiver imagem.
    // tamanho x 10 = lado do quadradinho, em pixels.
    criar(trofeu, { tamanho = 4, silhueta = false } = {}) {
      if (!trofeu || !trofeu.imagem) return null;
      return deImagem(trofeu.imagem, silhueta, tamanho * 10);
    }
  };
})();

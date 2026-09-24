// =====================================================================
// PixelArt — componente responsável por desenhar as texturas das
// páginas em canvas 2D, no estilo pixel art (baixa resolução, sem
// suavização, texto "cristalizado"). Não sabe nada sobre Three.js nem
// sobre o livro em si — só recebe dados de uma página e devolve uma
// textura pronta. Por isso dá pra reaproveitar em qualquer projeto.
// =====================================================================
const PixelArt = {
  // tamanho fixo do canvas de cada face — exposto porque book.js precisa dos mesmos números
  // pra calcular onde cada linha do sumário cai na tela (ver tocLayout).
  PAGE_W: 192,
  PAGE_H: 256,
  // o canvas de cada página é criado com PAGE_W/H × este fator de pixels reais (e um
  // ctx.scale(RENDER_SCALE,...) aplicado uma vez em makeFaceTexture) — todo o resto do código
  // continua desenhando nos mesmos números de sempre (192×256 "lógicos"), só que agora com mais
  // pixels de verdade por trás, o que deixa texto e ilustrações mais nítidos na textura final.
  RENDER_SCALE: 3,

  // cache de gifs já baixados/decodificados — cada arquivo só é buscado e processado uma vez,
  // mesmo que a página seja visitada várias vezes (guarda a Promise, não só o resultado, pra
  // duas visitas rápidas em sequência não disparar dois fetch/parse em paralelo à toa).
  _gifCache: {},
  loadGifFrames(src) {
    if (!PixelArt._gifCache[src]) {
      PixelArt._gifCache[src] = fetch(src)
        .then(r => r.arrayBuffer())
        .then(buf => {
          const gif = GifuctJS.parseGIF(buf);
          const frames = GifuctJS.decompressFrames(gif, true); // true = já devolve patch em RGBA pronto
          return { frames, width: gif.lsd.width, height: gif.lsd.height };
        });
    }
    return PixelArt._gifCache[src];
  },

  // toca um GIF do primeiro ao último quadro, UMA VEZ, e chama onFrame(canvas) a cada quadro já
  // composto (pronto pra desenhar com drawImage). Decodifica os quadros à mão (gifuct-js, via
  // window.GifuctJS carregado em index.html) em vez de deixar um <img> "animar sozinho" — depender
  // da decodificação nativa do navegador se mostrou pouco confiável (trava no 1º quadro conforme
  // fatores de visibilidade do elemento) e não dava nenhum controle real sobre o tempo de cada
  // quadro nem sobre quando exatamente termina; decodificando os bytes do arquivo a gente sabe
  // exatamente quantos quadros existem e o delay real de cada um (sem precisar chutar uma
  // duração total), e "tocar uma vez e congelar no fim" vira só "parar de chamar onFrame".
  playGifOnce(src, onFrame, onDone) {
    let stopped = false;
    (async () => {
      try {
        const { frames, width, height } = await PixelArt.loadGifFrames(src);
        if (stopped || !frames.length) return;

        // canvas de composição — persiste entre quadros porque um GIF não redesenha a imagem
        // inteira a cada quadro, só a região que mudou (por isso "disposalType" existe: diz o
        // que fazer com essa região DEPOIS de mostrar o quadro, antes do próximo ser composto).
        const composite = document.createElement('canvas');
        composite.width = width; composite.height = height;
        const cctx = composite.getContext('2d');
        let prevDims = null, prevDisposal = 0, savedSnapshot = null;

        for (let i = 0; i < frames.length; i++) {
          if (stopped) return;
          const frame = frames[i];
          // aplica o disposal do quadro ANTERIOR antes de compor este (spec do GIF89a):
          // 2 = restaura o fundo (limpa a área); 3 = restaura o que tinha antes daquele quadro.
          if (prevDisposal === 2 && prevDims) {
            cctx.clearRect(prevDims.left, prevDims.top, prevDims.width, prevDims.height);
          } else if (prevDisposal === 3 && savedSnapshot) {
            cctx.putImageData(savedSnapshot, 0, 0);
          }
          if (frame.disposalType === 3) {
            savedSnapshot = cctx.getImageData(0, 0, width, height);
          }
          const patchCanvas = document.createElement('canvas');
          patchCanvas.width = frame.dims.width; patchCanvas.height = frame.dims.height;
          patchCanvas.getContext('2d').putImageData(
            new ImageData(frame.patch, frame.dims.width, frame.dims.height), 0, 0
          );
          cctx.drawImage(patchCanvas, frame.dims.left, frame.dims.top);
          prevDims = frame.dims; prevDisposal = frame.disposalType;

          onFrame(composite);

          if (i < frames.length - 1) {
            await new Promise(r => setTimeout(r, Math.max(frame.delay || 20, 20)));
          }
        }
        if (onDone) onDone();
      } catch (e) {
        console.error('[gif] falha ao tocar', src, e);
      }
    })();
    return function stop() { stopped = true; };
  },

  // toca um VÍDEO do início ao fim, UMA VEZ, e chama onFrame(video) a cada quadro (via
  // requestAnimationFrame) — pra quem chamou desenhar o quadro atual num canvas com drawImage.
  // Diferente de GIF, um <video> tem controle nativo de verdade (play/pause/currentTime/'ended')
  // e decodifica normalmente mesmo sem nunca entrar no DOM — não tem a pegadinha de visibilidade
  // que travava o GIF, então não precisa de nenhum truque aqui.
  playVideoOnce(src, onFrame, onDone) {
    const video = document.createElement('video');
    video.src = src;
    video.muted = true; // autoplay via JS só é permitido com som desligado
    video.playsInline = true;
    video.loop = false;
    let stopped = false, raf = null;
    function step() {
      if (stopped) return;
      onFrame(video);
      if (!video.ended) raf = requestAnimationFrame(step);
      else if (onDone) onDone();
    }
    video.addEventListener('loadeddata', () => {
      if (stopped) return;
      video.play().then(() => { raf = requestAnimationFrame(step); })
        .catch(e => console.error('[video] falha ao tocar', src, e));
    });
    video.addEventListener('error', (e) => console.error('[video] falha ao carregar', src, e));
    return function stop() { stopped = true; if (raf) cancelAnimationFrame(raf); video.pause(); };
  },

  // carrega uma lista de imagens estáticas (prints de tela, por ex.) — usada pelo slideshow em
  // loop. Uma imagem que falha vira null na lista em vez de travar as outras.
  loadImages(paths) {
    return Promise.all(paths.map(src => new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => { console.error('[slideshow] falha ao carregar', src); resolve(null); };
      img.src = src;
    })));
  },

  // ao contrário de playGifOnce/playVideoOnce (que tocam uma vez e param), este fica em LOOP
  // contínuo trocando de imagem a cada intervalMs, enquanto quem chamou não mandar parar — feito
  // pra prints de tela em sequência (ex: passo a passo de um sistema), sem precisar de vídeo/gif.
  playSlideshowLoop(images, intervalMs, onFrame) {
    let stopped = false, idx = 0, timer = null;
    const valid = images.filter(Boolean);
    function tick() {
      if (stopped || !valid.length) return;
      onFrame(valid[idx % valid.length]);
      idx++;
      timer = setTimeout(tick, intervalMs);
    }
    tick();
    return function stop() { stopped = true; if (timer) clearTimeout(timer); };
  },

  ICONS: {
    sword: [
      '....#....', '....#....', '....#....', '....#....',
      '...###...', '....#....', '..#####..', '...#.#...', '...#.#...', '...###...'
    ],
    rune: ['...#....', '..###...', '.#####..', '..###...', '...#....'],
    frame: ['#######', '#.....#', '#.###.#', '#.###.#', '#.###.#', '#.....#', '#######'],
    arrow: ['#....', '##...', '###..', '####.', '###..', '##...', '#....']
  },

  hexToRgb(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  },

  // texto "cristalizado" — o canvas sempre desenha fonte com anti-aliasing suave (borrado),
  // então depois de desenhar comparamos cada pixel com a cor pura do texto vs a cor pura do
  // fundo (capturada antes) e forçamos 100% um ou 100% outro — sem mistura parcial = sem borrão.
  crispFillText(ctx, text, x, y) {
    const [tr, tg, tb] = PixelArt.hexToRgb(ctx.fillStyle);
    const fs = parseInt(/(\d+)px/.exec(ctx.font)?.[1], 10) || 12;
    const width = Math.ceil(ctx.measureText(text).width) + 2;
    let boxX = Math.floor((ctx.textAlign === 'center' ? x - width / 2 : x) - 1);
    let boxY = Math.floor(y - fs * 1.2);
    let boxW = width + 2, boxH = Math.ceil(fs * 1.7);
    boxX = Math.max(0, boxX); boxY = Math.max(0, boxY);
    // as coordenadas acima estão em unidades "lógicas" (as mesmas de sempre, w/h=PAGE_W/PAGE_H) —
    // measureText/fillText respeitam o ctx.scale() aplicado em makeFaceTexture automaticamente,
    // mas getImageData/putImageData SEMPRE trabalham em pixel de verdade do canvas, ignorando
    // esse transform. Por isso a caixa precisa ser convertida pra pixel real (×RENDER_SCALE) só
    // nessas duas chamadas — o resto (fillText, medidas) continua igual, sem precisar mudar nada
    // em quem chama isso, mesmo depois de aumentar a resolução interna da página.
    boxW = Math.min(boxW, PixelArt.PAGE_W - boxX);
    boxH = Math.min(boxH, PixelArt.PAGE_H - boxY);
    if (boxW <= 0 || boxH <= 0) { ctx.fillText(text, x, y); return; }
    const S = PixelArt.RENDER_SCALE;
    const dX = Math.round(boxX * S), dY = Math.round(boxY * S);
    const dW = Math.round(boxW * S), dH = Math.round(boxH * S);
    const before = ctx.getImageData(dX, dY, dW, dH);
    ctx.fillText(text, x, y);
    const after = ctx.getImageData(dX, dY, dW, dH);
    const bd = before.data, ad = after.data;
    for (let i = 0; i < ad.length; i += 4) {
      const br = bd[i], bg = bd[i + 1], bb = bd[i + 2];
      const distText = (ad[i] - tr) ** 2 + (ad[i + 1] - tg) ** 2 + (ad[i + 2] - tb) ** 2;
      const distBg = (ad[i] - br) ** 2 + (ad[i + 1] - bg) ** 2 + (ad[i + 2] - bb) ** 2;
      if (distText < distBg) { ad[i] = tr; ad[i + 1] = tg; ad[i + 2] = tb; ad[i + 3] = 255; }
      else { ad[i] = br; ad[i + 1] = bg; ad[i + 2] = bb; ad[i + 3] = bd[i + 3]; }
    }
    ctx.putImageData(after, dX, dY);
  },

  wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = (text || '').split(' ');
    let line = '', yy = y;
    words.forEach((word, n) => {
      const test = line + word + ' ';
      if (ctx.measureText(test).width > maxWidth && n > 0) {
        PixelArt.crispFillText(ctx, line, x, yy);
        line = word + ' ';
        yy += lineHeight;
      } else line = test;
    });
    PixelArt.crispFillText(ctx, line, x, yy);
  },

  // mesma quebra de linha do wrapText, mas devolve as linhas em vez de desenhar — usado pelos
  // bullets das páginas de conteúdo, onde cada item precisa saber sua própria altura antes de
  // desenhar o ícone ao lado.
  wrapLines(ctx, text, maxWidth) {
    const words = (text || '').split(' ');
    const lines = [];
    let line = '';
    words.forEach((word, n) => {
      const test = line + word + ' ';
      if (ctx.measureText(test).width > maxWidth && n > 0) {
        lines.push(line.trim());
        line = word + ' ';
      } else line = test;
    });
    if (line) lines.push(line.trim());
    return lines;
  },

  // desenha um ícone pixel art a partir de uma "grade" de texto ('#'=pixel aceso). x,y = canto
  // superior esquerdo do ícone; size = tamanho de cada pixel em px do canvas.
  drawIcon(ctx, rows, x, y, size, color) {
    ctx.fillStyle = color;
    rows.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) {
        if (row[rx] === '#') ctx.fillRect(Math.round(x + rx * size), Math.round(y + ry * size), size, size);
      }
    });
  },
  iconWidth(rows, size) { return rows[0].length * size; },

  // textura pequena contendo SÓ um ícone, com fundo transparente — usada pelos objetos 3D que
  // representam as setas/runas animadas (ver addIconObject em book.js). Esses ícones não são mais
  // pintados dentro da textura da página: eles existem como objetos próprios na cena, o que deixa
  // o movimento fluido (mover um objeto é grátis perto de repintar e reenviar uma textura por
  // quadro) e abre caminho pra poder arrastá-los depois.
  makeIconTexture(icon, size, color) {
    const S = PixelArt.RENDER_SCALE;
    const iw = PixelArt.iconWidth(icon, size), ih = icon.length * size;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(iw * S);
    canvas.height = Math.ceil(ih * S);
    const ctx = canvas.getContext('2d');
    ctx.scale(S, S);
    ctx.imageSmoothingEnabled = false;
    PixelArt.drawIcon(ctx, icon, 0, 0, size, color);
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    return { tex, iw, ih };
  },

  // textura pequena com um texto curto (ex: o número da página), fundo transparente. O truque de
  // nitidez aqui é por ALFA, não por cor: o crispFillText normal compara cada pixel com o fundo
  // já desenhado, o que não existe num canvas transparente — então aqui qualquer pixel com alfa
  // razoável vira cor cheia e o resto some, o que dá a mesma borda "dura" de pixel art.
  makeTextTexture(text, font, color) {
    const S = PixelArt.RENDER_SCALE;
    const probe = document.createElement('canvas').getContext('2d');
    probe.font = font;
    const m = probe.measureText(text);
    const ascent = Math.ceil(m.actualBoundingBoxAscent || 8);
    const descent = Math.ceil(m.actualBoundingBoxDescent || 2);
    const iw = Math.max(1, Math.ceil(m.width) + 2), ih = Math.max(1, ascent + descent + 2);
    const canvas = document.createElement('canvas');
    canvas.width = iw * S;
    canvas.height = ih * S;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.scale(S, S);
    ctx.font = font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = color;
    ctx.fillText(text, 1, ascent + 1);
    const [tr, tg, tb] = PixelArt.hexToRgb(color);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const on = d[i + 3] > 110;
      d[i] = tr; d[i + 1] = tg; d[i + 2] = tb; d[i + 3] = on ? 255 : 0;
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    return { tex, iw, ih, ascent: ascent + 1 };
  },

  // largura/altura "de verdade" de qualquer coisa desenhável (img, canvas ou video — cada um
  // expõe isso num nome de propriedade diferente).
  mediaSize(el) {
    return [el.naturalWidth || el.videoWidth || el.width, el.naturalHeight || el.videoHeight || el.height];
  },

  // desenha uma imagem "contida" numa caixa (x,y,maxW,maxH), mantendo a proporção original.
  // reduções grandes numa passagem só (ex: 864px → 130px) saem borradas mesmo com suavização
  // ligada — por isso reduz pela metade repetidamente até chegar perto do tamanho final, que é
  // como navegadores/editores de imagem fazem downscale de qualidade. radius (opcional) arredonda
  // os cantos, recortando a imagem com clip antes de desenhar. sepia (opcional, ligado por
  // padrão) dá um tom envelhecido/dourado — combina com o papel do livro, e funciona bem tanto
  // pra ilustrações (o carrinho) quanto pra prints de tela (fica tipo "foto antiga colada na
  // página" em vez de destoar como uma UI moderna solta no meio do pergaminho).
  drawImageContain(ctx, img, x, y, maxW, maxH, radius = 0, sepia = true) {
    const [iw, ih] = PixelArt.mediaSize(img);
    let dw = maxW, dh = dw * (ih / iw);
    if (dh > maxH) { dh = maxH; dw = dh * (iw / ih); }
    dw = Math.round(dw); dh = Math.round(dh);
    // dw/dh são em unidades "lógicas" (o ctx já vem com scale(RENDER_SCALE) de makeFaceTexture),
    // então o resultado final na textura tem dw*S × dh*S pixels de verdade — o downscale
    // progressivo precisa mirar NESSE tamanho real, não no lógico, senão essa última ampliação
    // (feita pelo transform do ctx) reintroduz o borrão que a gente tava tentando evitar.
    const S = PixelArt.RENDER_SCALE;
    const targetW = Math.max(1, Math.round(dw * S)), targetH = Math.max(1, Math.round(dh * S));
    let src = img, sw = iw, sh = ih;
    while (sw > targetW * 2) {
      const nw = Math.max(targetW, Math.floor(sw / 2)), nh = Math.max(targetH, Math.floor(sh / 2));
      const step = document.createElement('canvas');
      step.width = nw; step.height = nh;
      const sctx = step.getContext('2d');
      sctx.imageSmoothingEnabled = true;
      sctx.imageSmoothingQuality = 'high';
      sctx.drawImage(src, 0, 0, nw, nh);
      src = step; sw = nw; sh = nh;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    // tom sépia/dourado via filtro nativo do canvas — muito mais simples (e mais barato) que
    // manipular pixel a pixel, e dá pro CSS Filters Level 1 já suportar sem lib nenhuma.
    ctx.filter = sepia ? 'sepia(0.55) saturate(1.5) contrast(1.08) brightness(0.95)' : 'none';
    const rx = Math.round(x), ry = Math.round(y);
    if (radius > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(rx, ry, dw, dh, radius);
      ctx.clip();
      ctx.drawImage(src, rx, ry, dw, dh);
      ctx.restore();
    } else {
      ctx.drawImage(src, rx, ry, dw, dh);
    }
    ctx.filter = 'none'; // não pode vazar pro resto do desenho (texto, ícones etc.)
    ctx.imageSmoothingEnabled = false;
    return { dw, dh };
  },

  // gradiente "posterizado" — faixas sólidas em vez de transição suave (pixel art não tem blur),
  // mas com bastante degraus finos o suficiente pra transição não ficar brusca.
  bandFill(ctx, x, y, w, h, colors) {
    const bandH = h / colors.length;
    colors.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(x, Math.round(y + i * bandH), w, Math.ceil(bandH) + 1);
    });
  },
  lerpColor(c1, c2, t) {
    const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), bl = Math.round(ab + (bb - ab) * t);
    return `rgb(${r},${g},${bl})`;
  },
  makeBands(c1, c2, steps) {
    const arr = [];
    for (let i = 0; i < steps; i++) arr.push(PixelArt.lerpColor(c1, c2, i / (steps - 1)));
    return arr;
  },

  // tamanho de fonte que encolhe até o texto caber em maxWidth — evita título cortado na borda
  fitFont(ctx, text, maxWidth, family, weight, maxSize, minSize) {
    let size = maxSize;
    ctx.font = `${weight} ${size}px "${family}", monospace`;
    while (size > minSize && ctx.measureText(text).width > maxWidth) {
      size--;
      ctx.font = `${weight} ${size}px "${family}", monospace`;
    }
    return size;
  },

  // como fitFont, mas pra títulos longos demais até pra uma linha só: em vez de encolher até
  // ficar minúsculo, tenta quebrar em até maxLines linhas primeiro, só encolhendo a fonte se
  // ainda não couber. Devolve {size, lines} — quem chama desenha uma crispFillText por linha.
  fitFontWrap(ctx, text, maxWidth, family, weight, maxSize, minSize, maxLines) {
    let size = maxSize, lines;
    do {
      ctx.font = `${weight} ${size}px "${family}", monospace`;
      lines = PixelArt.wrapLines(ctx, text, maxWidth);
      if (lines.length <= maxLines || size <= minSize) break;
      size--;
    } while (size > minSize);
    return { size, lines };
  },

  // calcula a posição (em pixels do canvas) de cada linha do sumário. Usada tanto pra DESENHAR
  // a lista quanto, em book.js, pra saber em qual linha do mundo 3D cada clique deve cair —
  // usar a MESMA função nos dois lugares garante que ficam sempre alinhados.
  tocLayout(entries, w, h) {
    const top = 58, bottom = 14;
    const rowH = Math.min(28, (h - top - bottom) / entries.length);
    return entries.map((entry, i) => ({ ...entry, y: top + i * rowH + rowH / 2, rowH }));
  },

  // mesma ideia do tocLayout, só que pras linhas de contato na contracapa. cada linha tem
  // label (o que aparece, curto) e value (pra onde o clique abre/copia, pode ser bem maior).
  contactLayout(lines, h) {
    return lines.map((line, i) => ({ label: line.label, value: line.value, y: h * 0.42 + i * 15 }));
  },

  // onde a lista de tópicos da página divisória (type:'section') começa — função única usada
  // tanto pra DESENHAR (makeFaceTexture) quanto por book.js pra calcular a zona de clique de
  // cada linha; se calculasse esse número em dois lugares diferentes, uma hora ficaria
  // dessincronizado (foi exatamente o bug: clique caindo na linha errada).
  sectionItemsTop(data) {
    return 96 + (data.tagline ? 22 : 0);
  },

  // mesma ideia do tocLayout, pros itens clicáveis da página divisória — cada item tem label
  // (nome do projeto) e targetSpread (pra onde o clique leva), igual um tocEntry.
  sectionItemsLayout(items, top) {
    return items.map((item, i) => ({ ...item, y: top + i * 16 }));
  },

  // moldura dupla com cantinhos — estilo caixa de diálogo de RPG antigo
  pixelBorder(ctx, x, y, w, h, outer, inner, corner) {
    ctx.strokeStyle = outer; ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.strokeStyle = inner; ctx.lineWidth = 1;
    ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
    const cs = 3;
    ctx.fillStyle = corner;
    [[x, y], [x + w - cs, y], [x, y + h - cs], [x + w - cs, y + h - cs]].forEach(([cx, cy]) => {
      ctx.fillRect(cx, cy, cs, cs);
    });
  },

  // ponto de entrada do componente: dados de UMA face de UMA folha → textura pronta pro Three.js
  makeFaceTexture(data) {
    // NearestFilter (lá embaixo) é o que faz o pixel aparecer nítido/quadrado em vez de borrado
    // ao ampliar pra folha 3D — mas o canvas em si roda em RENDER_SCALE× mais pixels reais (ver
    // comentário na constante), então "quadradinho" fica fino o suficiente pra não parecer baixa
    // resolução. Todo o desenho abaixo continua em unidades lógicas (w/h = PAGE_W/PAGE_H).
    const w = PixelArt.PAGE_W, h = PixelArt.PAGE_H, S = PixelArt.RENDER_SCALE;
    const canvas = document.createElement('canvas');
    canvas.width = w * S; canvas.height = h * S;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.scale(S, S);
    ctx.imageSmoothingEnabled = false;

    let iconSpecs = [];
    if (data.type === 'cover') {
      PixelArt.bandFill(ctx, 0, 0, w, h, PixelArt.makeBands('#8a3f22', '#2e120a', 7));
      PixelArt.pixelBorder(ctx, 7, 7, w - 14, h - 14, '#e8b23d', 'rgba(232,178,61,0.5)', '#ffd76b');
      ctx.textAlign = 'center';
      if (!data.contacts) {
        PixelArt.drawIcon(ctx, PixelArt.ICONS.sword, w / 2 - PixelArt.iconWidth(PixelArt.ICONS.sword, 3) / 2, h * 0.2, 3, '#e8b23d');
        ctx.fillStyle = '#ffd76b';
        PixelArt.fitFont(ctx, data.title, w - 40, 'Silkscreen', 700, 20, 11);
        PixelArt.crispFillText(ctx, data.title, w / 2, h * 0.48);
        ctx.fillStyle = '#e8c98a';
        PixelArt.fitFont(ctx, data.subtitle, w - 32, 'Pixelify Sans', 400, 13, 10);
        PixelArt.crispFillText(ctx, data.subtitle, w / 2, h * 0.545);
      } else {
        iconSpecs = PixelArt.drawContactCoverFace(ctx, data);
      }
    } else if (data.type === 'section') {
      iconSpecs = PixelArt.drawSectionFace(ctx, data);
    } else if (data.type === 'endpaper') {
      PixelArt.drawEndpaperFace(ctx);
      iconSpecs = PixelArt.endpaperIconSpecs();
    } else if (data.type === 'toc') {
      iconSpecs = PixelArt.drawTocFace(ctx, data);
    } else {
      iconSpecs = PixelArt.drawDefaultPage(ctx, data).iconSpecs;
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    // as peças soltas (setas, runas, número da página) que esta face deve ter. Vão junto com a
    // textura porque só quem desenhou a página sabe onde elas caem — no caso dos bullets, a
    // posição depende da quebra de linha real do texto.
    tex.userData = { iconSpecs };
    return tex;
  },

  // quebra um texto em UMA peça por letra, na mesma posição em que o canvas as desenharia.
  // Precisa do ctx com a fonte já aplicada (ex: depois de fitFont), porque a largura de cada
  // caractere vem de measureText — e respeita o textAlign atual, pra títulos centralizados
  // caírem no mesmo lugar de antes. Só letras e números viram peça: espaço, traço e pontuação
  // continuam ocupando o lugar deles (pro título não se deslocar), mas não são arrastáveis.
  letterSpecs(ctx, text, x, y, color) {
    // acentos e cedilha são removidos: cada peça é uma letra simples do alfabeto ("Á" vira "A",
    // "ç" vira "c"). O traço vira espaço ("Guarda-Vidas" -> "Guarda Vidas"): ele une palavras e
    // atrapalharia no meio das letras soltas.
    const plain = (text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/-/g, ' ');
    const font = ctx.font, chars = Array.from(plain);
    const widths = chars.map(ch => ctx.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0);
    let cursor = x;
    if (ctx.textAlign === 'center') cursor -= total / 2;
    else if (ctx.textAlign === 'right') cursor -= total;
    const specs = [];
    chars.forEach((ch, i) => {
      // role/char: a peça carrega O QUE ela é. Letra guarda qual letra (é o que vai permitir
      // reconhecer palavras montadas); pontuação como "?" continua existindo e sendo arrastável,
      // mas fica fora do alfabeto do jogo. Espaço não vira peça — não há o que pegar.
      if (ch !== ' ') {
        const isLetter = /[\p{L}\p{N}]/u.test(ch);
        specs.push({
          kind: 'text', role: isLetter ? 'letter' : 'symbol', char: isLetter ? ch : null,
          text: ch, font, color, x: cursor, y
        });
      }
      cursor += widths[i];
    });
    return specs;
  },

  // o número da página (eyebrow) também vira objeto arrastável — mesma fonte/posição que era
  // desenhada no canvas, só que agora como peça solta. y = linha de base do texto.
  eyebrowSpecs(data) {
    if (!data.eyebrow) return [];
    return [{ kind: 'text', role: 'pageNumber', text: data.eyebrow, font: '700 11px "Silkscreen", monospace', color: '#a9631c', x: 14, y: 26 }];
  },

  // posição do rune da contracapa de contato — função à parte (fonte única) pra que o nudge em
  // book.js possa saber onde ele fica sem precisar redesenhar a página inteira pra animar (isso
  // é o que deixava o movimento engasgado: redesenhar título+links a 60fps é caro; mexer só no
  // ícone, restaurando um retalho salvo do fundo, é praticamente grátis).
  contactIconSpecs(data) {
    const w = PixelArt.PAGE_W, h = PixelArt.PAGE_H;
    return [{ kind: 'icon', icon: PixelArt.ICONS.rune, x: w / 2 - PixelArt.iconWidth(PixelArt.ICONS.rune, 3) / 2, y: h * 0.13, scale: 3, color: '#a880ff' }];
  },

  // contracapa de contato ("Como me achar?")
  drawContactCoverFace(ctx, data) {
    const w = PixelArt.PAGE_W, h = PixelArt.PAGE_H;
    PixelArt.bandFill(ctx, 0, 0, w, h, PixelArt.makeBands('#8a3f22', '#2e120a', 7));
    PixelArt.pixelBorder(ctx, 7, 7, w - 14, h - 14, '#e8b23d', 'rgba(232,178,61,0.5)', '#ffd76b');
    ctx.textAlign = 'center';
    // o rune NÃO é desenhado aqui — ele é um objeto 3D próprio (ver addIconObject em book.js),
    // pra poder se mover de forma fluida e, no futuro, ser arrastado.
    // o título não é pintado: cada letra vira uma peça própria (ver letterSpecs)
    PixelArt.fitFont(ctx, data.title, w - 40, 'Silkscreen', 700, 18, 11);
    const specs = [
      ...PixelArt.contactIconSpecs(data),
      ...PixelArt.letterSpecs(ctx, data.title, w / 2, h * 0.3, '#ffd76b')
    ];
    // sublinhado dourado embaixo de cada linha — sinaliza que é clicável (abre + copia).
    // mostra só o rótulo curto (ex: "GitHub"); o link/e-mail completo vai no clique.
    PixelArt.contactLayout(data.contacts, h).forEach(row => {
      ctx.fillStyle = '#e8c98a';
      PixelArt.fitFont(ctx, row.label, w - 28, 'Pixelify Sans', 600, 13, 9);
      const lineW = ctx.measureText(row.label).width;
      PixelArt.crispFillText(ctx, row.label, w / 2, row.y);
      ctx.fillStyle = '#ffd76b';
      ctx.fillRect(Math.round(w / 2 - lineW / 2), Math.round(row.y + 3), Math.round(lineW), 1);
    });
    return specs;
  },

  // posição do rune do guarda (endpaper) — mesma ideia de contactIconSpecs.
  endpaperIconSpecs() {
    const w = PixelArt.PAGE_W, h = PixelArt.PAGE_H;
    return [{ kind: 'icon', icon: PixelArt.ICONS.rune, x: w / 2 - PixelArt.iconWidth(PixelArt.ICONS.rune, 4) / 2, y: h / 2 - 10, scale: 4, color: 'rgba(90,60,30,0.5)' }];
  },

  // guarda ("endpaper") logo depois da capa — só o símbolo decorativo.
  drawEndpaperFace(ctx) {
    const w = PixelArt.PAGE_W, h = PixelArt.PAGE_H;
    PixelArt.bandFill(ctx, 0, 0, w, h, PixelArt.makeBands('#e8c98a', '#c2984e', 5));
    PixelArt.pixelBorder(ctx, 9, 9, w - 18, h - 18, 'rgba(90,60,30,0.4)', 'rgba(90,60,30,0.22)', 'rgba(90,60,30,0.5)');
    // rune fica por conta do objeto 3D (ver addIconObject em book.js)
  },

  // posições dos ícones de uma página divisória: a runa do topo (que gira) + a seta de cada item
  // (que desliza) — fonte única (ver comentário em contactIconSpecs).
  sectionIconSpecs(data) {
    const w = PixelArt.PAGE_W;
    return [
      ...PixelArt.eyebrowSpecs(data),
      { kind: 'icon', icon: PixelArt.ICONS.rune, x: w / 2 - PixelArt.iconWidth(PixelArt.ICONS.rune, 3) / 2, y: 60, scale: 3, color: '#a9631c' },
      ...PixelArt.sectionItemsLayout(data.items || [], PixelArt.sectionItemsTop(data)).map(row => ({
        kind: 'icon', icon: PixelArt.ICONS.arrow, x: 14, y: row.y - 6, scale: 1.5, color: '#a9631c'
      }))
    ];
  },

  // página divisória (ex: "Projetos") — mesmo papel pergaminho das páginas normais (não é uma
  // capa). Título e símbolo centralizados no topo (como um "frontispício" de seção), e a lista
  // de tópicos clicáveis alinhada à esquerda bem abaixo — layout pedido à mão pelo usuário.
  drawSectionFace(ctx, data) {
    const w = PixelArt.PAGE_W, h = PixelArt.PAGE_H;
    PixelArt.bandFill(ctx, 0, 0, w, h, PixelArt.makeBands('#e8c98a', '#c2984e', 6));
    ctx.textAlign = 'left';
    // o número da página é objeto 3D (ver eyebrowSpecs / addIconObject em book.js)
    ctx.textAlign = 'center';
    // título não é pintado: cada letra é uma peça (assim como a runa e as setas)
    PixelArt.fitFont(ctx, data.title, w - 40, 'Silkscreen', 700, 20, 12);
    const specs = [
      ...PixelArt.sectionIconSpecs(data),
      ...PixelArt.letterSpecs(ctx, data.title, w / 2, 50, '#2b1a12')
    ];
    if (data.tagline) {
      ctx.fillStyle = '#5c4020'; ctx.font = '400 9px "Silkscreen", monospace';
      PixelArt.wrapText(ctx, data.tagline, w / 2, 96, w - 50, 12);
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = '#5c4020'; ctx.font = '400 9px "Silkscreen", monospace';
    PixelArt.sectionItemsLayout(data.items || [], PixelArt.sectionItemsTop(data)).forEach(row => {
      PixelArt.crispFillText(ctx, row.label, 26, row.y);
    });
    ctx.textAlign = 'left';
    return specs;
  },

  // posições das setas do sumário — fonte única (ver comentário em contactIconSpecs).
  tocIconSpecs(data) {
    return [
      ...PixelArt.eyebrowSpecs(data),
      ...PixelArt.tocLayout(data.entries, PixelArt.PAGE_W, PixelArt.PAGE_H).map(row => ({
        kind: 'icon', icon: PixelArt.ICONS.arrow, x: 14, y: row.y - 5, scale: 2, color: '#a9631c'
      }))
    ];
  },

  // sumário
  drawTocFace(ctx, data) {
    const w = PixelArt.PAGE_W, h = PixelArt.PAGE_H;
    PixelArt.bandFill(ctx, 0, 0, w, h, PixelArt.makeBands('#e8c98a', '#c2984e', 6));
    ctx.textAlign = 'left';
    // o número da página é objeto 3D (ver eyebrowSpecs / addIconObject em book.js)
    // título não é pintado: cada letra é uma peça
    PixelArt.fitFont(ctx, data.title, w - 28, 'Silkscreen', 700, 16, 10);
    const specs = [
      ...PixelArt.tocIconSpecs(data),
      ...PixelArt.letterSpecs(ctx, data.title, 14, 46, '#2b1a12')
    ];

    PixelArt.tocLayout(data.entries, w, h).forEach(row => {
      ctx.fillStyle = '#2b1a12';
      PixelArt.fitFont(ctx, row.label, w - 44, 'Pixelify Sans', 600, 12, 8);
      PixelArt.crispFillText(ctx, row.label, 30, row.y + 4);
    });
    return specs;
  },

  // o desenho de uma página "normal" (eyebrow + título + bullets + ilustração opcional) —
  // isolado do makeFaceTexture pra também poder ser chamado a cada quadro de um GIF (ver
  // playGifOnce em book.js), redesenhando só o canvas já existente daquela página em vez de
  // gerar uma textura nova a cada quadro. overrideImg, se passado, substitui data.image (usado
  // pelo GIF: desenha o quadro atual no lugar da ilustração estática).
  drawDefaultPage(ctx, data, overrideImg, bounceOffsetY = 0) {
    const w = PixelArt.PAGE_W, h = PixelArt.PAGE_H;
    ctx.imageSmoothingEnabled = false;
    PixelArt.bandFill(ctx, 0, 0, w, h, PixelArt.makeBands('#e8c98a', '#c2984e', 6));
    ctx.textAlign = 'left';
    // o número da página é objeto 3D (ver eyebrowSpecs / addIconObject em book.js)
    const { size: titleSize, lines: titleLines } = PixelArt.fitFontWrap(ctx, data.title, w - 28, 'Silkscreen', 700, 16, 8, 2);
    const titleLineH = Math.round(titleSize * 1.3);
    const titleTop = 44; // espaço entre o número da página (eyebrow, y=26) e o título
    // nem o título nem as setas dos bullets são pintados aqui: viram peças soltas (ver
    // addIconObject em book.js). Como a posição delas depende da quebra de linha real do texto,
    // só é conhecida durante este desenho — por isso a lista volta no retorno.
    const iconSpecs = PixelArt.eyebrowSpecs(data);
    titleLines.forEach((line, i) => {
      iconSpecs.push(...PixelArt.letterSpecs(ctx, line, 14, titleTop + i * titleLineH, '#2b1a12'));
    });
    ctx.fillStyle = '#5c4020'; ctx.font = '400 9px "Silkscreen", monospace';
    const bulletMaxW = w - 40, lineH = 11, bulletGap = 5;
    let by2 = titleTop + titleLines.length * titleLineH + 10;
    (data.bullets || [data.text]).forEach(item => {
      const lines = PixelArt.wrapLines(ctx, item, bulletMaxW);
      iconSpecs.push({ kind: 'icon', icon: PixelArt.ICONS.arrow, x: 14, y: by2 - 6, scale: 1.5, color: '#a9631c' });
      lines.forEach(line => { PixelArt.crispFillText(ctx, line, 26, by2); by2 += lineH; });
      by2 += bulletGap;
    });
    // ilustração opcional no espaço que sobra embaixo dos bullets — o quanto maior possível
    // ali, mantendo a proporção original (sem esticar) e com downscale de qualidade (nítida
    // mesmo bem reduzida — ver drawImageContain). overrideImg pode ser um <img> estático, o
    // canvas de um quadro de GIF já composto (playGifOnce) ou um <video> tocando (playVideoOnce)
    // — mediaSize sabe extrair width/height dos três.
    const [ovW, ovH] = overrideImg ? PixelArt.mediaSize(overrideImg) : [0, 0];
    const img = overrideImg && ovW ? overrideImg : null;
    // caixa onde a imagem foi desenhada, em coordenadas lógicas da página (PAGE_W/PAGE_H) — book.js
    // usa isso pra saber onde colocar a zona de clique invisível do efeito "pular ao clicar",
    // sem duplicar essa conta (mesmo princípio de sectionItemsTop: quem desenha é quem decide onde).
    let imageBox = null;
    if (img) {
      // margens simétricas (não só na horizontal) pra imagem parecer "encaixada" no meio do
      // espaço livre, com cantos arredondados em vez de esquinas retas. imageMargin (opcional
      // em content.js) deixa uma página específica usar mais espaço (imagem maior).
      const margin = data.imageMargin ?? 16;
      const maxW = w - margin * 2, availTop = by2 + margin / 2, availH = h - margin - availTop;
      if (availH > 12) {
        const iw = ovW, ih = ovH;
        let dw = maxW, dh = dw * (ih / iw);
        if (dh > availH) { dh = availH; dw = dh * (iw / ih); }
        const dx = (w - dw) / 2, dy = availTop + (availH - dh) / 2;
        imageBox = { dx, dy, dw, dh };
        if (bounceOffsetY) {
          // "pulinho flutuante": desloca só a imagem verticalmente por cima do desenho normal —
          // o resto da página (texto etc.) fica parado.
          ctx.save();
          ctx.translate(0, bounceOffsetY);
          PixelArt.drawImageContain(ctx, img, dx, dy, dw, dh, 4);
          ctx.restore();
        } else {
          PixelArt.drawImageContain(ctx, img, dx, dy, dw, dh, 4);
        }
      }
    }
    return { imageBox, iconSpecs };
  }
};

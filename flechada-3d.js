// =====================================================================
// A flechada do século XVI em 3D de verdade.
//
// As versões anteriores eram desenhos chapados girados por CSS, e é por
// isso que nunca pareciam vir na nossa direção: figura plana não tem
// volume, então virada de frente ela some. Aqui a flecha é um objeto —
// haste, ponta e penas — voando num espaço com câmera e perspectiva.
// Ela cai por gravidade e aponta sozinha pra direção em que está indo,
// que é o que resolve de uma vez a pose em cada momento do voo.
//
// Pra manter a cara do livro, a cena é renderizada menor que a tela e
// esticada com os pixels quadrados (o "pixel" lá embaixo) — 3D com
// acabamento de pixel art, em vez de 3D liso destoando do resto. Quanto
// mais grosso o pixel, mais o movimento parece picotado, então ele é um
// ajuste e não um número fixo.
// =====================================================================
const Flechada3D = (function () {

  // Cores com contraste de propósito: o livro e a mesa são marrons avermelhados médios, e a
  // primeira versão, no mesmo tom, sumia no fundo. A flecha tem ponta quase branca e penas bem
  // vermelhas; a paliçada usa uma foto de casca (os tons dela moram em TINTAS).
  const COR = {
    haste: 0xc8843f,
    ponta: 0xf4f8fc,
    // só a pontinha puxa pro verde, num degradê: um toque de contraste (e de veneno — o texto do
    // século fala de flechas envenenadas), sem pintar a ponta inteira
    veneno: 0x8fd46a,
    penas: [0xfff4dc, 0xe8412f, 0xfff4dc],
    contorno: 0x140a04
  };

  const PADRAO = {
    quantidade: 5,
    duracao: 1.9,        // segundos de voo de cada flecha
    atraso: 0,           // entre uma e outra
    distancia: 12,       // de quão longe elas vêm
    altura: -1.6,        // altura de onde partem
    origemX: 0,          // centro da largura de onde partem
    espalhamento: 9.2,   // quanto se abrem na largura, na partida
    destinoX: 0,         // centro da largura pra onde vão
    espalhamentoFim: 0,  // e quanto ainda estão abertas quando se encontram (0 = no mesmo ponto)
    encontro: 0.61,       // em que altura do voo isso acontece (1 = só no fim, em cima da câmera)
    alvoAltura: 1.6,     // em que altura ela chega em quem vê (1.6 = altura dos olhos da câmera)
    gravidade: -5.4,     // menor que a de verdade: com -9.8 o arco sai do quadro
    tamanho: 1.1,        // escala da flecha
    rodopio: 1,          // giro em torno do próprio eixo, por segundo
    pixel: 1,            // grossura do pixel: 1 é a resolução da tela, 4 é bem quadradão
    muro: true,          // a paliçada de troncos na frente da cena
    muroAltura: 2.3,     // altura dos troncos (define até onde a paliçada sobe na tela)
    muroDistancia: 4,    // a que distância da câmera ela fica
    muroBase: -1.3,      // onde o pé dos troncos encosta
    muroEspera: 0.75,    // quanto as flechas esperam a paliçada subir antes de partir
    brilho: 1,           // força da luz da cena (mais alto = cores mais estouradas)
    contorno: true       // borda escura em volta dos troncos, igual às artes 2D do livro
  };

  // O contorno é o truque do "casco invertido": uma cópia um pouco maior do objeto, pintada de
  // escuro e virada do avesso, desenhada atrás dele. Só a beirada dessa cópia aparece, e ela vira
  // o traço preto em volta — o mesmo contorno das pixel arts, só que num objeto 3D.
  function comContorno(malha, grossura) {
    const casco = new THREE.Mesh(
      malha.geometry,
      new THREE.MeshBasicMaterial({ color: COR.contorno, side: THREE.BackSide })
    );
    casco.scale.set(grossura, 1 + (grossura - 1) * 0.15, grossura);
    malha.add(casco);
    return malha;
  }

  // Contorno pra peças chatas (a ponta e as penas). O casco invertido de cima só funciona em
  // objeto com volume; numa placa, o avesso é só o outro lado dela. Aqui vai uma cópia escura um
  // pouco maior, no mesmo plano, empurrada pra trás na profundidade (polygonOffset): onde as duas
  // se sobrepõem ganha a peça colorida, e só a beirada da cópia escura sobra à mostra.
  //   mapa (opcional) = a textura com recorte, pra borda seguir o formato desenhado nela
  function contornoChato(geometria, fator, mapa) {
    const copia = geometria.clone();
    copia.computeBoundingBox();
    const centro = copia.boundingBox.getCenter(new THREE.Vector3());
    copia.translate(-centro.x, -centro.y, -centro.z);
    copia.scale(fator, fator, 1);
    copia.translate(centro.x, centro.y, centro.z);
    return new THREE.Mesh(copia, new THREE.MeshBasicMaterial({
      color: COR.contorno, side: THREE.DoubleSide,
      map: mapa || null, alphaTest: mapa ? 0.5 : 0,
      polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2
    }));
  }

  // O recorte da ponta: larga atrás, com as farpas abrindo pra fora, e tudo fechando num bico só.
  // É a silhueta clássica de ponta de flecha — um cone, que era o que tinha antes, fica redondo
  // demais e parece lápis.
  function recorteDaPonta() {
    const p = new THREE.Shape();
    p.moveTo(0, 0.40);      // o bico
    p.lineTo(0.13, -0.04);  // a lâmina abrindo
    p.lineTo(0.16, -0.12);  // a farpa apontando pra trás
    p.lineTo(0.05, 0.00);   // e o recuo até o encaixe na haste
    p.lineTo(0, -0.05);
    p.lineTo(-0.05, 0.00);
    p.lineTo(-0.16, -0.12);
    p.lineTo(-0.13, -0.04);
    p.closePath();
    const geometria = new THREE.ShapeGeometry(p);

    // Cor por vértice: metal na base, verde só perto do bico. Os vértices com y alto (perto do
    // bico) ganham o verde e o resto fica prateado; a placa de vídeo faz o degradê entre eles.
    const pos = geometria.attributes.position, cores = [];
    const metal = new THREE.Color(COR.ponta), verde = new THREE.Color(COR.veneno), cor = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const t = THREE.MathUtils.clamp((pos.getY(i) - 0.12) / 0.28, 0, 1); // 0 até o meio, 1 no bico
      cor.copy(metal).lerp(verde, t * 0.8);
      cores.push(cor.r, cor.g, cor.b);
    }
    geometria.setAttribute('color', new THREE.Float32BufferAttribute(cores, 3));
    return geometria;
  }

  // A pena desenhada fio a fio numa textura: o canhão (a haste da pena) colado na flecha e as
  // barbas saindo dele em diagonal pra trás, com umas falhas na borda, onde a pena abriu. A placa
  // lisa de antes, de perto, parecia bandeirinha. A parte sem pena fica transparente, então o
  // recorte da pena é a própria textura.
  //   largura = pra fora da flecha, altura = ao longo dela (o topo da textura aponta pra frente)
  function texturaDaPena(corHex) {
    const L = 24, A = 96;
    const tela = document.createElement('canvas');
    tela.width = L; tela.height = A;
    const ctx = tela.getContext('2d');
    const imagem = ctx.createImageData(L, A);
    const cor = new THREE.Color(corHex), sombra = cor.clone().multiplyScalar(0.7);
    const falhas = [23, 41, 58, 70]; // linhas onde a borda da pena abriu
    for (let v = 0; v < A; v++) {
      const t = v / (A - 1); // 0 = frente (lado da ponta da flecha), 1 = fim (lado das penas)
      // o recorte: nasce fininho na frente, abre e fica cheio até o fim, onde é cortado reto
      const largura = Math.round((L - 1) * (t < 0.45 ? Math.pow(t / 0.45, 0.7) : 1));
      const falha = falhas.some(f => Math.abs(v - f) < 2);
      for (let u = 0; u < largura; u++) {
        if (falha && u > largura * 0.55) continue; // o rasgo na borda
        // barbas: faixas diagonais que descem pra trás a partir do canhão
        const barba = Math.floor(u * 0.9 + v * 0.55) % 4 === 0;
        const c = u < 2 ? cor.clone().multiplyScalar(0.85) : (barba ? sombra : cor); // u<2: o canhão
        const i = (v * L + u) * 4;
        imagem.data[i] = c.r * 255; imagem.data[i + 1] = c.g * 255; imagem.data[i + 2] = c.b * 255;
        imagem.data[i + 3] = 255;
      }
    }
    ctx.putImageData(imagem, 0, 0);
    const textura = new THREE.CanvasTexture(tela);
    // Sem as versões reduzidas da textura (mipmaps): de longe o three.js usa uma cópia menor e
    // borrada, em que o recorte da pena vira "meio transparente" — e o alphaTest descarta a pena
    // inteira. Era por isso que, com a flecha longe, as penas simplesmente sumiam.
    textura.generateMipmaps = false;
    textura.minFilter = THREE.LinearFilter;
    return textura;
  }

  // ---- o objeto flecha: haste + ponta + três penas, apontando pro +Y ----
  function montarFlecha(escala) {
    const flecha = new THREE.Group();

    // Cada parte da flecha leva contorno escuro, como os troncos: fina e num tom de madeira, ela
    // se perdia no marrom do fundo. A haste e o encaixe têm volume (casco invertido); a ponta e
    // as penas são chapadas (contornoChato).
    const haste = new THREE.Mesh(
      new THREE.CylinderGeometry(0.013, 0.013, 1.1, 6),
      new THREE.MeshLambertMaterial({ color: COR.haste })
    );
    haste.add(new THREE.Mesh( // o contorno da haste: um cilindro mais grosso, do avesso
      new THREE.CylinderGeometry(0.024, 0.024, 1.1, 6),
      new THREE.MeshBasicMaterial({ color: COR.contorno, side: THREE.BackSide })
    ));
    flecha.add(haste);

    // duas lâminas cruzadas em X: de qualquer ângulo se vê uma ponta de flecha, e não um losango.
    // Menor que antes (0,7 do tamanho): grande, ela pesava mais que a flecha inteira.
    const recorte = recorteDaPonta();
    recorte.scale(0.7, 0.7, 0.7);
    // a cor vem dos vértices (o degradê do metal pro verde), por isso o material é branco
    const metal = new THREE.MeshLambertMaterial({
      vertexColors: true, side: THREE.DoubleSide
    });
    for (const giro of [0, Math.PI / 2]) {
      const lamina = new THREE.Mesh(recorte, metal);
      lamina.add(contornoChato(recorte, 1.22));
      lamina.position.y = 0.58; // o pé da lâmina encaixado no fim da haste
      lamina.rotation.y = giro;
      flecha.add(lamina);
    }

    // as penas: três em volta da cauda, compridas como numa flecha de verdade, com o canhão
    // colado na haste. A textura já traz o recorte (o resto é transparente) — e o contorno usa a
    // mesma textura, então a borda escura acompanha o formato da pena, falhas incluídas.
    const formatoPena = new THREE.PlaneGeometry(0.12, 0.36);
    formatoPena.translate(0.06 + 0.01, 0, 0); // começa na superfície da haste e abre pra fora
    for (let i = 0; i < 3; i++) {
      const desenho = texturaDaPena(COR.penas[i]);
      const pena = new THREE.Mesh(formatoPena, new THREE.MeshLambertMaterial({
        map: desenho, side: THREE.DoubleSide, alphaTest: 0.5
      }));
      pena.add(contornoChato(formatoPena, 1.12, desenho));
      pena.position.y = -0.35;
      pena.rotation.y = (i / 3) * Math.PI * 2;
      flecha.add(pena);
    }

    // a ranhura do fim, onde a corda encaixava
    const encaixe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.017, 0.05, 6),
      new THREE.MeshLambertMaterial({ color: 0x3a2616 })
    );
    encaixe.position.y = -0.55;
    comContorno(encaixe, 1.5);
    flecha.add(encaixe);

    flecha.scale.setScalar(escala);
    return flecha;
  }

  // Sorteio com semente: os troncos saem "aleatórios", mas sempre do mesmo jeito — a paliçada não
  // muda de cara cada vez que a animação toca.
  function sorteador(semente) {
    return function () {
      semente = (semente + 0x6D2B79F5) | 0;
      let t = Math.imul(semente ^ (semente >>> 15), 1 | semente);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Filtro da textura. Sem filtro nenhum ("pixel mais próximo") a casca serrilhava e cintilava;
  // com o filtro comum ela esfumaçava nos troncos vistos de lado. O anisotrópico é o meio-termo:
  // continua nítido mesmo com a superfície inclinada em relação à câmera.
  let anisotropia = 1; // o máximo que a placa de vídeo aceita, lido em criar()
  function texturaNitida(tela, repete) {
    const textura = new THREE.CanvasTexture(tela);
    textura.anisotropy = anisotropia;
    if (repete) textura.wrapS = THREE.RepeatWrapping;
    return textura;
  }

  // ---- a foto de casca (Poly Haven, licença CC0: uso livre, inclusive em site público) ----
  // Uma foto de verdade é o que faz o tronco parecer tronco; a casca desenhada por código lá em
  // cima fica de reserva, pra quando a foto ainda não chegou. Ela é baixada em segundo plano,
  // depois que o site já abriu — não atrasa a abertura do livro, e da segunda visita em diante o
  // navegador já tem ela guardada.
  const FOTO_CASCA = {
    cor: 'assets/texturas/bark_willow_02_diff_1k.jpg',
    relevo: 'assets/texturas/bark_willow_02_nor_gl_1k.jpg'
  };
  let fotoCor = null, fotoRelevo = null;
  function carregarFotoDaCasca() {
    if (typeof THREE === 'undefined' || fotoCor) return;
    const carregador = new THREE.TextureLoader();
    // o tronco é um pouco mais alto do que largo em volta; repetir 1,2x na altura evita que a
    // casca fique esticada na vertical
    const preparar = t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 1.2); return t; };
    carregador.load(FOTO_CASCA.cor, t => { fotoCor = preparar(t); });
    carregador.load(FOTO_CASCA.relevo, t => { fotoRelevo = preparar(t); });
  }
  // "quando o navegador estiver folgado" — mas com prazo: numa aba em segundo plano essa folga
  // pode nunca chegar, e aí a foto não carregava nunca
  window.addEventListener('load', () => {
    if (window.requestIdleCallback) requestIdleCallback(carregarFotoDaCasca, { timeout: 2000 });
    else setTimeout(carregarFotoDaCasca, 500);
  });

  // Tons pra tingir a mesma foto e a fileira não sair toda igual: natural, mais alaranjado (como
  // os troncos lascados da foto de referência), mais escuro e um puxado pro cinza.
  const TINTAS = [0xffffff, 0xf0b884, 0x8f7c70, 0xc4bab0];

  // O corte no alto do tronco: madeira clara com os anéis de crescimento e umas rachaduras.
  function texturaDeAneis() {
    const tela = document.createElement('canvas');
    tela.width = tela.height = 64;
    const ctx = tela.getContext('2d');
    ctx.fillStyle = '#a8824f';
    ctx.fillRect(0, 0, 64, 64);
    for (let r = 30; r > 2; r -= 3) {
      ctx.strokeStyle = (r / 3) % 2 < 1 ? '#8a653a' : '#bd9660';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(32, 32, r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.strokeStyle = '#4a321c'; // rachaduras saindo do miolo, de quando a madeira secou
    ctx.lineWidth = 1.5;
    for (const angulo of [0.4, 2.3, 4.1]) {
      ctx.beginPath(); ctx.moveTo(32, 32);
      ctx.lineTo(32 + Math.cos(angulo) * 22, 32 + Math.sin(angulo) * 22); ctx.stroke();
    }
    ctx.fillStyle = '#5a3d22';
    ctx.beginPath(); ctx.arc(32, 32, 2.5, 0, Math.PI * 2); ctx.fill(); // o miolo
    return texturaNitida(tela, false);
  }

  // Um tronco de verdade não é um cilindro: ele engrossa e afina pelo caminho, tem calombos e o
  // topo foi cortado a machado, torto. Aqui cada vértice do cilindro é empurrado pra fora ou pra
  // dentro por umas ondas sobrepostas (sorteadas por tronco), e a borda de cima é inclinada.
  function moldarTronco(geometria, sorte, altura) {
    const pos = geometria.attributes.position;
    const f1 = 1 + sorte() * 2, f2 = 3 + sorte() * 4, fase = sorte() * 6.28;
    const inclinacao = (sorte() - 0.5) * 0.35; // quanto o corte de cima pende pra um lado
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const angulo = Math.atan2(z, x), h = y / altura + 0.5; // h: 0 no pé, 1 no topo
      // as ondas: uma larga ao longo da altura (engrossa/afina) e outra em volta (calombos)
      const bojo = 1 + 0.05 * Math.sin(h * f1 * Math.PI + fase)
        + 0.035 * Math.sin(angulo * f2 + h * 5 + fase);
      pos.setX(i, x * bojo);
      pos.setZ(i, z * bojo);
      if (h > 0.999) pos.setY(i, y + x * inclinacao); // o corte torto no topo
    }
    geometria.computeVertexNormals();
    return geometria;
  }

  // ---- a paliçada: troncos fincados lado a lado ----
  // Fica entre a câmera e as flechas, então elas nascem atrás dela e passam por cima. Segue a foto
  // de referência: troncos grossos, retos e colados, quase da mesma altura, cada um de uma cor.
  function montarPalicada(cfg, largura) {
    const muro = new THREE.Group();
    const sorte = sorteador(21);
    // A mesma foto de casca tingida de quatro jeitos. Phong em vez de Lambert porque ele aceita
    // o mapa de relevo da foto: as fendas afundam e as cristas saltam conforme a luz bate.
    // Se a foto ainda não chegou (alguém conquistou o troféu logo que o site abriu), os troncos
    // saem só na cor, sem casca, em vez de pretos.
    if (fotoCor) {
      fotoCor.anisotropy = anisotropia;
      if (fotoRelevo) fotoRelevo.anisotropy = anisotropia;
    }
    const cascas = TINTAS.map(tinta => new THREE.MeshPhongMaterial(fotoCor
      ? { map: fotoCor, normalMap: fotoRelevo, normalScale: new THREE.Vector2(0.9, 0.9), color: tinta, shininess: 4 }
      : { color: new THREE.Color(0x6e5a48).multiply(new THREE.Color(tinta)), shininess: 4 }));
    const aneisTextura = texturaDeAneis();
    const topo = new THREE.MeshPhongMaterial({ map: aneisTextura, bumpMap: aneisTextura, bumpScale: 0.02, shininess: 2 });

    let x = -largura / 2;
    while (x < largura / 2) {
      const raio = 0.19 + sorte() * 0.06; // grossos: fino e comprido é que lembra lápis
      const altura = cfg.muroAltura * (0.94 + sorte() * 0.12);
      x += raio;

      const tronco = new THREE.Mesh(
        moldarTronco(new THREE.CylinderGeometry(raio * 0.96, raio, altura, 16, 10), sorte, altura),
        [cascas[Math.floor(sorte() * cascas.length)], topo, topo] // lado, topo e pé
      );
      tronco.position.set(x, altura / 2, 0);
      tronco.rotation.set(0, sorte() * Math.PI * 2, (sorte() - 0.5) * 0.02); // quase retos
      if (cfg.contorno) comContorno(tronco, 1.05);
      muro.add(tronco);

      x += raio + 0.005; // colados, só uma linha de sombra entre um e outro
    }

    muro.position.set(0, cfg.muroBase, -cfg.muroDistancia);
    return muro;
  }

  // ---- a cena ----
  function criar(opcoes) {
    if (typeof THREE === 'undefined') return null; // sem three.js não há cena
    const cfg = Object.assign({}, PADRAO, opcoes || {});

    const caixa = document.createElement('div');
    caixa.className = 'flechada-3d';

    // com a janela minimizada a tela mede 0x0, e a proporção da câmera viraria 0/0
    const L = Math.max(1, window.innerWidth), A = Math.max(1, window.innerHeight);
    // antisserrilhado ligado: sem ele as bordas dos troncos e das flechas ficam em escadinha
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(1);
    anisotropia = renderer.capabilities.getMaxAnisotropy();
    // Em tela com ampliação do Windows (125%, 150%), cada pixel "da página" vale mais de um pixel
    // de verdade. Sem multiplicar por isso, a cena era desenhada pequena e o navegador esticava —
    // e era isso que deixava tudo embaçado. Agora pixel 1 é a resolução real da tela.
    const densidade = window.devicePixelRatio || 1;
    renderer.setSize(Math.ceil(L * densidade / cfg.pixel), Math.ceil(A * densidade / cfg.pixel), false);
    // só estica com pixel quadrado quando se pede pixelado; em pixel 1 não há o que esticar
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;'
      + (cfg.pixel > 1 ? 'image-rendering:pixelated' : '');
    caixa.appendChild(renderer.domElement);

    const cena = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, L / A, 0.1, 200);
    camera.position.set(0, 1.6, 0); // a câmera é quem está sendo alvejado

    // Duas luzes com funções diferentes: a principal, quente, vem da frente e do alto e dá a cor;
    // a de recorte, fria, vem de trás e acende só as beiradas. Esse fio azulado em volta de cada
    // objeto é o que descola ele do fundo marrom — contraste de temperatura, não só de claro/escuro.
    cena.add(new THREE.AmbientLight(0xffffff, 0.55 * cfg.brilho));
    const luz = new THREE.DirectionalLight(0xfff2d8, 1.15 * cfg.brilho);
    luz.position.set(-3, 6, 4);
    cena.add(luz);
    const recorte = new THREE.DirectionalLight(0x9fc8ff, 0.75 * cfg.brilho);
    recorte.position.set(2, 4, -8);
    cena.add(recorte);

    // O impulso pra cima é calculado, não escolhido: a conta acha a velocidade vertical que faz a
    // flecha estar exatamente na altura "alvoAltura" no instante em que passa pela câmera. Com o
    // impulso escolhido à mão ela passava abaixo dos olhos e ainda caindo — parecia passar por
    // baixo de quem vê, e não vir nele. (Quanto o arco sobe no meio do caminho fica por conta da
    // gravidade: com a partida e a chegada fixas, mais gravidade = arco mais alto.)
    const noRosto = cfg.distancia * cfg.duracao / (cfg.distancia + 2); // quando ela cruza a câmera
    const impulso = (cfg.alvoAltura - cfg.altura - 0.5 * cfg.gravidade * noRosto * noRosto) / noRosto;

    // cada flecha ganha posição e velocidade próprias; o resto é física
    const tiros = [];
    for (let i = 0; i < cfg.quantidade; i++) {
      const passo = cfg.quantidade === 1 ? 0 : i / (cfg.quantidade - 1) - 0.5;
      const objeto = montarFlecha(cfg.tamanho);
      objeto.visible = false;
      cena.add(objeto);

      const saiEm = cfg.origemX + passo * cfg.espalhamento;
      const chegaEm = cfg.destinoX + passo * cfg.espalhamentoFim;
      const origem = new THREE.Vector3(saiEm, cfg.altura, -cfg.distancia);
      // A velocidade lateral leva cada uma do ponto de saída ao de chegada — mas chegando lá no
      // instante do "encontro", não no fim do voo. Com o encontro no meio do caminho elas se
      // juntam à vista e seguem se cruzando; marcado pro fim, elas só se encontrariam quando já
      // estão passando pela câmera, ou seja, nunca dava pra ver.
      const velocidade = new THREE.Vector3(
        (chegaEm - saiEm) / (cfg.duracao * cfg.encontro),
        impulso,
        (cfg.distancia + 2) / cfg.duracao
      );
      // a espera é pra paliçada já estar de pé quando a primeira flecha aparece
      const espera = cfg.muro ? cfg.muroEspera : 0;
      tiros.push({ objeto, origem, velocidade, atraso: espera + i * cfg.atraso });
    }

    // a paliçada precisa cobrir a largura do quadro na profundidade em que está
    const abertura = 2 * Math.tan((camera.fov / 2) * Math.PI / 180);
    const muro = cfg.muro
      ? montarPalicada(cfg, abertura * cfg.muroDistancia * camera.aspect + 2)
      : null;
    if (muro) cena.add(muro);

    const EIXO = new THREE.Vector3(0, 1, 0); // a flecha é desenhada apontando pra cima
    const direcao = new THREE.Vector3();
    // o fim de tudo: a última flecha a sair ainda tem o voo inteiro pela frente
    const TOTAL = (tiros.length ? tiros[tiros.length - 1].atraso : 0) + cfg.duracao;
    const SOBE = 0.6; // segundos que a paliçada leva pra subir (e pra descer, no fim)
    let inicio = null, parado = false;

    // sobe antes das flechas e desce depois que a última passa
    function moverMuro(tempo) {
      if (!muro) return;
      const entrando = Math.min(1, tempo / SOBE);
      const saindo = Math.min(1, Math.max(0, (tempo - (TOTAL + 0.3)) / SOBE));
      const fora = Math.min(entrando, 1 - saindo); // 0 = escondida embaixo, 1 = de pé
      const suave = fora * fora * (3 - 2 * fora); // tira o arranque seco das pontas
      muro.position.y = cfg.muroBase - (1 - suave) * (cfg.muroAltura + 0.6);
    }

    function posicionar(tiro, t) {
      // lançamento oblíquo puro: posição = origem + velocidade*t + gravidade*t²/2
      tiro.objeto.position.copy(tiro.origem)
        .addScaledVector(tiro.velocidade, t)
        .add(new THREE.Vector3(0, 0.5 * cfg.gravidade * t * t, 0));
      // e aponta pra onde está indo: a derivada da conta de cima
      direcao.set(tiro.velocidade.x, tiro.velocidade.y + cfg.gravidade * t, tiro.velocidade.z).normalize();
      tiro.objeto.quaternion.setFromUnitVectors(EIXO, direcao);
      tiro.objeto.rotateY(t * cfg.rodopio * Math.PI * 2); // rodopio em torno do próprio eixo
    }

    function quadro(agora) {
      if (parado) return;
      if (!caixa.isConnected) { parar(); return; }
      if (inicio === null) inicio = agora;
      const tempo = (agora - inicio) / 1000;

      for (const tiro of tiros) {
        const t = tempo - tiro.atraso;
        tiro.objeto.visible = t > 0 && t < cfg.duracao;
        if (tiro.objeto.visible) posicionar(tiro, t);
      }
      moverMuro(tempo);
      renderer.render(cena, camera);
      requestAnimationFrame(quadro);
    }

    function parar() {
      parado = true;
      renderer.dispose();
    }

    requestAnimationFrame(quadro);

    // pra página de teste: manda a cena pra um instante qualquer, sem depender do relógio
    caixa.irPara = function (tempo) {
      for (const tiro of tiros) {
        const t = tempo - tiro.atraso;
        tiro.objeto.visible = t > 0 && t < cfg.duracao;
        if (tiro.objeto.visible) posicionar(tiro, t);
      }
      moverMuro(tempo);
      renderer.render(cena, camera);
    };
    caixa.parar = parar;
    caixa.pausar = function () { parado = true; }; // congela sem desmontar, pra conferir um quadro
    // onde cada flecha está na tela num dado instante — usado pra conferir enquadramento
    caixa.ondeEstao = function (tempo) {
      const p = new THREE.Vector3();
      camera.updateMatrixWorld(); // sem isso a conta usa a câmera parada no chão, antes do 1º quadro
      return tiros.map(tiro => {
        const t = tempo - tiro.atraso;
        if (t <= 0 || t >= cfg.duracao) return null;
        posicionar(tiro, t);
        p.copy(tiro.objeto.position).project(camera);
        return {
          x: Math.round((p.x + 1) / 2 * L), y: Math.round((1 - p.y) / 2 * A),
          z: +tiro.objeto.position.z.toFixed(1), altura: +tiro.objeto.position.y.toFixed(2), naFrente: p.z < 1
        };
      });
    };
    caixa.duracaoTotal = TOTAL + (muro ? 0.3 + SOBE : 0); // inclui a paliçada descendo no fim
    return caixa;
  }

  // montarFlecha fica exposto pra página de teste poder mostrar a flecha parada, de perto
  return { criar, PADRAO, montarFlecha };
})();

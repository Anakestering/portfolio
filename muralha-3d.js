// =====================================================================
// A muralha do século III em 3D.
//
// Mesma história da versão em pixel — a muralha sobe, um soldado romano
// espia pelo vão entre as ameias, olha pros dois lados, se esconde e a
// muralha desce — só que com volume: pedra de verdade (foto do Poly Haven,
// CC0) e o soldado como um objeto que GIRA a cabeça pra olhar, com os
// olhos correndo na frente, como a gente faz.
//
// O soldado segue as referências de um personagem de desenho animado com o
// "gálea imperial": metal de verdade (reflete um estúdio de mentira), faixa
// larga com frisos, quilha na calota, protetores de bochecha, nuca reta e a
// crista em leque num trilho de latão. O rosto é esculpido numa peça só
// (nariz comprido, queixo forte), com olhos de verdade que giram e piscam, e
// cabelo curto em mechas aparecendo embaixo do elmo.
// =====================================================================
const Muralha3D = (function () {
  const COR = {
    pele: 0xe89a72, palpebra: 0xdc8e68,
    // olhos escuros e grandes, sobrancelha e cílios quase pretos
    olho: 0xe2dcd3, iris: 0x1e110b, pupila: 0x0c0806, cilio: 0x21150e, boca: 0x4a1c14, cabelo: 0x2a1a12,
    // o elmo: aço cinza, as beiradas enroladas mais claras, o avesso escuro, e os botões e o
    // trilho da crista num latão bem claro, quase creme, como nas referências
    aco: 0x92969b, acoChapa: 0xb6b9bc, acoFriso: 0xcfd1d1, acoAvesso: 0x2a2c2e, latao: 0xd8c48e,
    crina: 0xd41820,
    pedraReserva: 0x7b8490, contorno: 0x140a04
  };

  const PADRAO = {
    // a muralha
    muroAltura: 2.2,      // altura do corpo da muralha (sem as ameias)
    muroDistancia: 6.1,   // a que distância da câmera ela fica
    muroBase: -1.4,       // onde o pé dela encosta
    espessura: 0.75,      // grossura da parede
    ameiaAltura: 0.7,     // altura dos dentes do topo
    ameiaLargura: 0.7,    // largura de cada dente
    vao: 1.15,            // espaço entre um dente e outro
    vaoCentral: 1.1,      // o vão do meio, onde o soldado aparece
    pedraTamanho: 3.5,    // quantos metros de muro cabem numa repetição da foto (maior = pedras maiores)
    pedraFrio: 1,         // o quanto a pedra puxa pro cinza frio (0 = a cor da foto, 1 = bem azulada)
    // o soldado
    tamanho: 2.05,        // escala da cabeça (maior que o natural, pra ler de longe)
    espiada: -0.18,       // quanto o queixo passa do chão do vão (negativo = a muralha tapa parte do queixo)
    olhar: 27,            // quantos graus ele vira a cabeça pra cada lado
    olharOlhos: 9,        // quantos graus os olhos viram pra cada lado (eles vão na frente da cabeça)
    // os tempos, em segundos, na ordem em que acontecem
    sobeMuro: 0.6,
    antesDeEspiar: 0.3,
    espiar: 0.45,
    olhaEsquerda: 0.7,
    olhaDireita: 0.75,
    voltaFrente: 0.4,
    esconder: 0.7,
    antesDeDescer: 0.3,
    desceMuro: 0.6,
    // o acabamento
    brilho: 1.1,
    contorno: 1,
    pixel: 1
  };

  // ---- a foto da pedra: baixada em segundo plano, depois que o site abre ----
  const FOTO_PEDRA = {
    cor: 'assets/texturas/stone_brick_wall_001_diff_1k.jpg',
    relevo: 'assets/texturas/stone_brick_wall_001_nor_gl_1k.jpg'
  };
  let fotoCor = null, fotoRelevo = null;
  function carregarFotoDaPedra() {
    if (typeof THREE === 'undefined' || fotoCor) return;
    const carregador = new THREE.TextureLoader();
    const preparar = t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
    carregador.load(FOTO_PEDRA.cor, t => { fotoCor = preparar(t); });
    carregador.load(FOTO_PEDRA.relevo, t => { fotoRelevo = preparar(t); });
  }
  window.addEventListener('load', () => {
    if (window.requestIdleCallback) requestIdleCallback(carregarFotoDaPedra, { timeout: 2000 });
    else setTimeout(carregarFotoDaPedra, 500);
  });

  // contorno escuro em volta de uma peça com volume (a cópia maior, do avesso, desenhada atrás)
  // — o mesmo traço das pixel arts do livro. "borda" é a grossura do traço, em metros.
  function comContorno(malha, borda, tamanho) {
    const casco = new THREE.Mesh(malha.geometry,
      new THREE.MeshBasicMaterial({ color: COR.contorno, side: THREE.BackSide }));
    casco.scale.set(1 + 2 * borda / tamanho.x, 1 + 2 * borda / tamanho.y, 1 + 2 * borda / tamanho.z);
    malha.add(casco);
    return malha;
  }

  // O mesmo traço pra formas que não são uma caixa ou uma bola: a cópia é inchada empurrando
  // cada ponto pra fora pela normal, então o traço sai com a mesma grossura em toda a volta.
  function contornoPorNormal(malha, borda, material) {
    const g = malha.geometry.clone();
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      p.setXYZ(i, p.getX(i) + n.getX(i) * borda, p.getY(i) + n.getY(i) * borda, p.getZ(i) + n.getZ(i) * borda);
    }
    malha.add(new THREE.Mesh(g, material));
    return malha;
  }

  // Coordenada de textura pelo tamanho real: cada face ganha a foto na escala do mundo, e não
  // esticada de ponta a ponta. Assim a mesma foto cobre o corpo e as ameias com pedras do mesmo
  // tamanho, e as fiadas continuam de uma peça pra outra.
  function texturaPeloTamanho(geometria, metrosPorFoto, onde) {
    const pos = geometria.attributes.position, nor = geometria.attributes.normal;
    const uv = geometria.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + onde.x, y = pos.getY(i) + onde.y, z = pos.getZ(i) + onde.z;
      let u = x, v = y;                                 // frente e trás
      if (Math.abs(nor.getX(i)) > 0.5) u = z;           // laterais
      else if (Math.abs(nor.getY(i)) > 0.5) v = z;      // topo e fundo
      uv.setXY(i, u / metrosPorFoto, v / metrosPorFoto);
    }
    uv.needsUpdate = true;
    return geometria;
  }

  // ---- a muralha: o corpo e os dentes (ameias) em cima, com o vão largo no meio ----
  function montarMuralha(cfg, largura, pedra) {
    const muro = new THREE.Group();
    const bloco = (l, a, x, y) => {
      const onde = new THREE.Vector3(x, y, 0);
      const peca = new THREE.Mesh(
        texturaPeloTamanho(new THREE.BoxGeometry(l, a, cfg.espessura), cfg.pedraTamanho, onde), pedra);
      peca.position.copy(onde);
      if (cfg.contorno) comContorno(peca, 0.018, new THREE.Vector3(l, a, cfg.espessura));
      muro.add(peca);
    };
    bloco(largura, cfg.muroAltura, 0, cfg.muroAltura / 2);
    const passo = cfg.ameiaLargura + cfg.vao, yAmeia = cfg.muroAltura + cfg.ameiaAltura / 2;
    const ameias = [];
    for (let x = cfg.vaoCentral / 2 + cfg.ameiaLargura / 2; x < largura / 2 + passo; x += passo) {
      bloco(cfg.ameiaLargura, cfg.ameiaAltura, x, yAmeia);
      bloco(cfg.ameiaLargura, cfg.ameiaAltura, -x, yAmeia);
      ameias.push(x);
    }

    // Os vincos da pedra — onde duas faces se encontram — ganham o mesmo traço escuro do
    // contorno, que sozinho só aparece onde a muralha encontra o fundo: a quina da frente de cada
    // ameia (a do lado que dá pra ver a face lateral, virada pro meio) e a beirada da frente do
    // chão entre as ameias. Cada traço é uma barrinha escura bem em cima da quina.
    if (cfg.contorno) {
      const traco = new THREE.MeshBasicMaterial({ color: COR.contorno });
      const G = 0.022, frente = cfg.espessura / 2, chao = cfg.muroAltura, meia = cfg.ameiaLargura / 2;
      const barra = (de, ate, y, alto) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(ate - de) + G, alto + G, G), traco);
        m.position.set((de + ate) / 2, y, frente);
        muro.add(m);
      };
      barra(-cfg.vaoCentral / 2, cfg.vaoCentral / 2, chao, 0); // o chão do vão do meio
      ameias.forEach((x, k) => {
        for (const lado of [-1, 1]) {
          const quina = lado * (x - meia);
          barra(quina, quina, chao + cfg.ameiaAltura / 2, cfg.ameiaAltura);     // a quina de dentro da ameia
          barra(lado * (x + meia), lado * (x + meia + cfg.vao), chao, 0);        // o chão até a próxima ameia
        }
      });
    }
    return muro;
  }

  // ---- a luz ----
  // luz quente de frente dando a cor, e uma fria por trás acendendo as beiradas (ver flechada-3d.js)
  function iluminar(cena, cfg) {
    cena.add(new THREE.AmbientLight(0xffffff, 0.55 * cfg.brilho));
    const luz = new THREE.DirectionalLight(0xfff2d8, 1.15 * cfg.brilho);
    luz.position.set(-3, 6, 4);
    cena.add(luz);
    const recorte = new THREE.DirectionalLight(0x9fc8ff, 0.75 * cfg.brilho);
    recorte.position.set(2, 4, -8);
    cena.add(recorte);
  }

  // ---- o reflexo do metal ----
  // Metal só parece metal quando tem alguma coisa pra refletir. Aqui é um estúdio de fotografia
  // de mentira — paredes cinza escurecendo até o chão e umas placas de luz — que o three.js
  // transforma no reflexo usado pelo elmo. Devolve o "alvo" do three: .texture vai nos
  // materiais e .dispose() libera a memória quando a cena acaba.
  function ambienteDoElmo(renderer) {
    const sala = new THREE.Scene();
    const paredes = new THREE.SphereGeometry(20, 32, 16);
    const p = paredes.attributes.position, cores = [];
    for (let i = 0; i < p.count; i++) {
      const h = p.getY(i) / 20; // -1 no chão, 1 no teto
      const v = h > 0 ? 0.34 + 0.18 * h : 0.34 + 0.2 * h;
      cores.push(v, v * 0.97, v * 0.93);
    }
    paredes.setAttribute('color', new THREE.Float32BufferAttribute(cores, 3));
    sala.add(new THREE.Mesh(paredes, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const placa = (largura, altura, forca, x, y, z) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(largura, altura),
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
      m.material.color.setScalar(forca); // acima de 1: mais forte que branco, como uma lâmpada
      m.position.set(x, y, z);
      m.lookAt(0, 0, 0);
      sala.add(m);
    };
    placa(16, 7, 1.6, 0, 15, 2);      // o teto: o brilho no alto da calota
    placa(7, 12, 1.5, -13, 3, 9);     // a luz principal, da frente e da esquerda, como a da cena
    placa(26, 1.8, 1.6, 0, 1.5, 15);  // uma faixa na altura dos olhos, atrás de quem olha: o risco claro na faixa do elmo
    placa(6, 9, 1.1, 13, 2, -9);      // o recorte, de trás
    const gerador = new THREE.PMREMGenerator(renderer);
    const reflexo = gerador.fromScene(sala, 0.04);
    gerador.dispose();
    sala.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    return reflexo;
  }

  // ---- as medidas do elmo ----
  // Na escala da cabeça, com o centro dela na origem e o rosto olhando pro +Z. Os ângulos (phi)
  // dão a volta na cabeça a partir da frente, positivos pro +X (a esquerda dele). Visto de cima o
  // elmo é um ovo: mais curto na frente, pra faixa encostar na testa, e mais comprido atrás.
  const OVO_FRENTE = 0.9, OVO_TRAS = 1.08;
  const CALOTA = { base: 0.179, raio: 0.178, altura: 0.15 }; // onde a calota começa, largura e altura
  const limitar = x => Math.min(1, Math.max(0, x));
  // manchas de uso no metal: um "ruído" barato, sempre o mesmo pro mesmo ponto
  const mancha = (a, b) => 0.5 + 0.25 * Math.sin(a * 5.3 + Math.sin(b * 31) * 1.7) + 0.25 * Math.sin(b * 23.1 + a * 2.7);

  function emVolta(phi, y, r) {
    const c = Math.cos(phi);
    return new THREE.Vector3(r * Math.sin(phi), y, r * c * (c > 0 ? OVO_FRENTE : OVO_TRAS));
  }
  // a direção pra fora da parede do elmo nesse ângulo (deitada)
  function praFora(phi) {
    const c = Math.cos(phi);
    return new THREE.Vector3(Math.sin(phi), 0, c / (c > 0 ? OVO_FRENTE : OVO_TRAS)).normalize();
  }
  // o alto da calota cortado no meio (x = 0): psi = 0 no topo, negativo pra frente e positivo pra
  // trás. Devolve o ponto e a normal; "fora" afasta o ponto da calota
  function noMeio(psi, fora = 0) {
    const t = Math.PI / 2 - Math.abs(psi), frente = psi < 0;
    const k = frente ? OVO_FRENTE : OVO_TRAS, lado = frente ? 1 : -1;
    const n = new THREE.Vector3(0, Math.sin(t) / CALOTA.altura, lado * Math.cos(t) / (CALOTA.raio * k)).normalize();
    const p = new THREE.Vector3(0, CALOTA.base + CALOTA.altura * Math.sin(t), lado * CALOTA.raio * k * Math.cos(t));
    return { p: p.addScaledVector(n, fora), n };
  }

  // Uma malha em grade. ponto(i, j) dá a posição de cada nó e tom(i, j, ponto) o quanto ele é
  // claro — é assim que a sujeira escurece os cantos e as beiradas ficam mais claras (o tom
  // multiplica a cor do material; um número, ou [r, g, b] pra mudar a cor). "fechada" = a grade
  // dá a volta inteira, e a primeira e a última coluna são a mesma costura. As normais saem pra
  // fora da cabeça; "orientar" = false pra peças que já nascem viradas certo (os fios do rosto).
  function superficie(nI, nJ, ponto, tom, fechada, orientar = true) {
    const pos = [], cores = [], idx = [];
    for (let i = 0; i <= nI; i++) {
      for (let j = 0; j <= nJ; j++) {
        const p = ponto(i, j), k = tom ? tom(i, j, p) : 1;
        pos.push(p.x, p.y, p.z);
        if (typeof k === 'number') cores.push(k, k, k);
        else cores.push(k[0], k[1], k[2]);
      }
    }
    for (let i = 0; i < nI; i++) {
      for (let j = 0; j < nJ; j++) {
        const a = i * (nJ + 1) + j, b = a + nJ + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cores, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    let praDentro = 0; // se a maioria das normais apontou pro miolo da cabeça, vira os triângulos
    const n = g.attributes.normal;
    for (let v = 0; v < n.count; v++) praDentro -= n.getX(v) * pos[v * 3] + n.getZ(v) * pos[v * 3 + 2];
    if (orientar && praDentro > 0) {
      for (let k = 0; k < idx.length; k += 3) [idx[k + 1], idx[k + 2]] = [idx[k + 2], idx[k + 1]];
      g.setIndex(idx);
      g.computeVertexNormals();
    }
    if (fechada) {
      const m = g.attributes.normal, ultima = nI * (nJ + 1), v = new THREE.Vector3();
      for (let j = 0; j <= nJ; j++) {
        v.set(m.getX(j) + m.getX(ultima + j), m.getY(j) + m.getY(ultima + j), m.getZ(j) + m.getZ(ultima + j)).normalize();
        m.setXYZ(j, v.x, v.y, v.z);
        m.setXYZ(ultima + j, v.x, v.y, v.z);
      }
    }
    return g;
  }

  // ---- o elmo ----
  function montarElmo(cfg, ambiente) {
    const elmo = new THREE.Group();
    const metal = (cor, metalicidade, aspereza, comTons) => new THREE.MeshStandardMaterial({
      color: cor, metalness: metalicidade, roughness: aspereza, vertexColors: comTons,
      envMap: ambiente || null, envMapIntensity: 0.75 * cfg.brilho
    });
    // aço acetinado, não espelho: nas referências o metal é gasto, com brilho macio
    const aco = metal(COR.aco, 0.75, 0.5, true);         // calota, faixa e nuca
    const chapa = metal(COR.acoChapa, 0.55, 0.5, true);  // protetores de bochecha, mais foscos
    const friso = metal(COR.acoFriso, 0.5, 0.45, false); // as beiradas enroladas
    const latao = metal(COR.latao, 0.5, 0.4, false);
    const avesso = new THREE.MeshStandardMaterial({ color: COR.acoAvesso, metalness: 0.3, roughness: 0.75, side: THREE.BackSide });
    const tracado = new THREE.MeshBasicMaterial({ color: COR.contorno, side: THREE.BackSide });
    const cima = new THREE.Vector3(0, 1, 0);

    const por = malha => { elmo.add(malha); return malha; };
    const contorno = (malha, borda) => { if (cfg.contorno) contornoPorNormal(malha, borda, tracado); return malha; };
    // chapa de metal tem dois lados: por dentro ela é escura
    const comAvesso = malha => { malha.add(new THREE.Mesh(malha.geometry, avesso)); return malha; };
    // uma beirada enrolada (um tubo) seguindo uma fila de pontos
    const enrolado = (pontos, raio) => contorno(por(new THREE.Mesh(new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(pontos, false, 'centripetal'), pontos.length * 4, raio, 8, false), friso)), 0.004);
    // botão ou rebite: meia bola achatada, deitada na superfície
    const tacha = (raio, achatar, onde, normal, borda = 0) => {
      const m = por(new THREE.Mesh(new THREE.SphereGeometry(raio, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2), latao));
      m.position.copy(onde);
      m.quaternion.setFromUnitVectors(cima, normal);
      m.scale.y = achatar;
      return borda ? contorno(m, borda) : m;
    };

    // ---- a faixa e a calota: uma peça só, um perfil girando em volta da cabeça ----
    // De baixo pra cima: a beirada de dentro, o friso de baixo (que na frente avança e vira a aba
    // sobre os olhos), a faixa larga, o friso de cima e a calota. Cada ponto sabe o que é, pra
    // ganhar o seu tom: friso mais claro, os cantos junto dos frisos encardidos.
    const perfil = [];
    const rolo = (rc, yc, raio, de, ate, passos, aba) => {
      for (let k = 0; k <= passos; k++) {
        const a = de + (ate - de) * k / passos;
        perfil.push({ r: rc + raio * Math.cos(a), y: yc + raio * Math.sin(a), tipo: 'friso', aba: aba ? Math.max(0, Math.cos(a)) : 0 });
      }
    };
    perfil.push({ r: 0.174, y: 0.0735, tipo: 'canto' });
    rolo(0.19, 0.0815, 0.0085, -Math.PI / 2 - 0.35, Math.PI / 2, 9, true);
    for (let k = 1; k < 9; k++) {
      const t = k / 9;
      perfil.push({ r: 0.1875 - 0.0035 * Math.sin(Math.PI * t), y: 0.09 + 0.073 * t, tipo: t < 0.2 || t > 0.8 ? 'canto' : 'faixa' });
    }
    rolo(0.1875, 0.1705, 0.0075, -Math.PI / 2, Math.PI / 2 + 0.45, 8, false);
    for (let k = 0; k <= 26; k++) {
      const t = (k / 26) * Math.PI / 2;
      perfil.push({ r: CALOTA.raio * Math.cos(t), y: CALOTA.base + CALOTA.altura * Math.sin(t), tipo: 'calota', t });
    }
    const VOLTA = 192;
    const phiDoCasco = i => Math.PI + 2 * Math.PI * i / VOLTA; // começa e termina atrás, onde a costura some
    contorno(por(comAvesso(new THREE.Mesh(superficie(VOLTA, perfil.length - 1, (i, j) => {
      const phi = phiDoCasco(i), q = perfil[j];
      let r = q.r, y = q.y;
      if (q.aba) { // a aba sobre os olhos: o friso de baixo avança e desce um pouco na frente
        const naFrente = Math.pow(Math.max(0, Math.cos(phi)), 2) * q.aba;
        r += 0.013 * naFrente;
        y -= 0.004 * naFrente;
      }
      return emVolta(phi, y, r);
    }, (i, j, p) => {
      const q = perfil[j];
      const k = q.tipo === 'friso' ? 1.12 : q.tipo === 'canto' ? 0.7 : q.tipo === 'faixa' ? 1
        : 0.5 + 0.55 * suave(limitar(q.t / 0.55)); // a calota encardida embaixo, junto do friso
      return k * (0.78 + 0.22 * mancha(phiDoCasco(i) * 2, p.y * 3));
    }, true), aco))), 0.008);

    // a quilha: uma nervura de reforço subindo no meio da testa, do friso até o trilho da crista
    const linhaDaQuilha = [];
    for (let k = 0; k <= 16; k++) linhaDaQuilha.push(noMeio(-1.5 + (1.5 - 0.62) * k / 16, 0.003).p);
    const quilha = contorno(por(new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(linhaDaQuilha), 40, 0.0095, 12, false), aco)), 0.003);
    quilha.scale.x = 2.6;
    quilha.geometry.setAttribute('color', new THREE.Float32BufferAttribute(
      new Array(quilha.geometry.attributes.position.count * 3).fill(1.05), 3));

    // o botão grande no meio da testa (uma placa oval com a cabeça do rebite) e os menores dos lados
    const naFaixa = (phi, y) => emVolta(phi, y, 0.1875 - 0.0035 * Math.sin(Math.PI * limitar((y - 0.09) / 0.073)));
    const frente = new THREE.Vector3(0, 0, 1), meioDaTesta = naFaixa(0, 0.1265);
    const placaDoBotao = contorno(por(new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.005, 28), latao)), 0.003);
    placaDoBotao.position.copy(meioDaTesta).addScaledVector(frente, 0.002);
    placaDoBotao.quaternion.setFromUnitVectors(cima, frente);
    placaDoBotao.scale.set(1, 1, 0.62);
    tacha(0.0135, 0.85, meioDaTesta.clone().addScaledVector(frente, 0.004), frente, 0.003);
    for (const phi of [-2.05, -1.15, 1.15, 2.05]) tacha(0.0105, 0.8, naFaixa(phi, 0.104), praFora(phi), 0.003);
    const pe = noMeio(-1.48, 0.012); // o rebite no pé da quilha, logo acima do friso
    tacha(0.0075, 0.8, pe.p, pe.n);

    // ---- a nuca: desce reta atrás das orelhas, protegendo o pescoço ----
    // Logo atrás da orelha ela é só uma tirinha; indo pra trás, desce até o fim.
    const NUCA = 1.62, NI = 72, NJ = 22;
    const phiDaNuca = i => NUCA + (2 * Math.PI - 2 * NUCA) * i / NI;
    const alcance = phi => 0.24 + 0.76 * suave(limitar((Math.PI - Math.abs(Math.PI - phi) - NUCA) / 0.75));
    const naNuca = (phi, s) => emVolta(phi, 0.077 - 0.235 * s, 0.1855 + 0.004 * s);
    contorno(por(comAvesso(new THREE.Mesh(superficie(NI, NJ,
      (i, j) => naNuca(phiDaNuca(i), alcance(phiDaNuca(i)) * j / NJ),
      (i, j, p) => (0.55 + 0.5 * suave(limitar(j / NJ / 0.5))) * (0.78 + 0.22 * mancha(phiDaNuca(i) * 2, p.y * 3))),
    aco))), 0.008);
    const beiradaDaNuca = [];
    for (let j = 0; j <= 6; j++) beiradaDaNuca.push(naNuca(NUCA, alcance(NUCA) * j / 6));
    for (let i = 1; i < NI; i++) beiradaDaNuca.push(naNuca(phiDaNuca(i), alcance(phiDaNuca(i))));
    for (let j = 6; j >= 0; j--) beiradaDaNuca.push(naNuca(2 * Math.PI - NUCA, alcance(NUCA) * j / 6));
    enrolado(beiradaDaNuca, 0.0055);

    // ---- os protetores de bochecha ----
    // Pendurados da faixa, na frente da orelha: em cima são uma tira estreita (o recorte deixa o
    // olho livre), na altura da ponta do nariz avançam pra frente e descem largos até passar do
    // queixo, fechando um pouco em volta do rosto. Beirada enrolada e rebites de latão.
    const BOCHECHA = { topo: 0.075, fundo: -0.225, canto: 0.026 };
    const altura = v => BOCHECHA.topo + (BOCHECHA.fundo - BOCHECHA.topo) * (1 - Math.pow(1 - v, 1.6)); // mais fileiras embaixo, pros cantos redondos
    const raioDaBochecha = y => 0.1865 - 0.047 * Math.pow(limitar((BOCHECHA.topo - y) / (BOCHECHA.topo - BOCHECHA.fundo)), 1.4);
    // de que ângulo a que ângulo a chapa vai nessa altura, com os cantos de baixo arredondados
    const larguraDaBochecha = y => {
      const r = raioDaBochecha(y), desce = limitar((BOCHECHA.topo - y) / (BOCHECHA.topo - BOCHECHA.fundo));
      let deFrente = (0.92 - 0.5 * suave(limitar((-0.03 - y) / 0.06))) * r, atras = (1.47 - 0.07 * desce) * r;
      const d = y - (BOCHECHA.fundo + BOCHECHA.canto);
      if (d < 0) {
        const recolhe = BOCHECHA.canto - Math.sqrt(Math.max(0, BOCHECHA.canto ** 2 - d * d));
        deFrente += recolhe;
        atras -= recolhe;
      }
      return [deFrente / r, atras / r, r];
    };
    const BI = 14, BJ = 60;
    for (const lado of [-1, 1]) {
      const ponto = (i, j) => {
        const y = altura(j / BJ), [de, ate, r] = larguraDaBochecha(y);
        return emVolta(lado * (de + (ate - de) * i / BI), y, r);
      };
      por(comAvesso(new THREE.Mesh(superficie(BI, BJ, ponto,
        (i, j, p) => (1.04 - 0.22 * j / BJ) * (0.9 + 0.1 * mancha(p.z * 9, p.y * 3))), chapa)));
      const beirada = []; // desce pela frente, contorna o fundo e sobe por trás
      for (let j = 0; j <= BJ; j += 2) beirada.push(ponto(0, j));
      for (let i = 1; i < BI; i++) beirada.push(ponto(i, BJ));
      for (let j = BJ; j >= 0; j -= 2) beirada.push(ponto(BI, j));
      enrolado(beirada, 0.0048);
      const naBochecha = (phi, y) => emVolta(lado * phi, y, raioDaBochecha(y));
      tacha(0.019, 0.7, naBochecha(1.22, -0.022), praFora(lado * 1.22), 0.004); // a dobradiça
      for (const [phi, y] of [[0.56, -0.1], [0.52, -0.19], [1.3, -0.172]]) {
        tacha(0.0062, 0.85, naBochecha(phi, y), praFora(lado * phi));
      }
    }

    // ---- a crista ----
    // O trilho de latão corre por cima da calota, da testa até a nuca, com um botão na ponta
    // da frente e rebites dos lados.
    const TRILHO = { de: -0.62, ate: 1.45, fora: 0.009 };
    const linhaDoTrilho = [];
    for (let k = 0; k <= 30; k++) linhaDoTrilho.push(noMeio(TRILHO.de + (TRILHO.ate - TRILHO.de) * k / 30, TRILHO.fora).p);
    const trilho = contorno(por(new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(linhaDoTrilho), 90, 0.011, 10, false), latao)), 0.002);
    trilho.scale.x = 2.4;
    for (const [psi, raio, x, y] of [[TRILHO.de - 0.03, 0.016, 1.5, 1.15], [TRILHO.ate, 0.012, 2.3, 1]]) {
      const ponta = contorno(por(new THREE.Mesh(new THREE.SphereGeometry(raio, 16, 12), latao)), 0.003);
      ponta.position.copy(noMeio(psi, TRILHO.fora + 0.003).p);
      ponta.scale.set(x, y, 1);
    }
    for (const psi of [-0.3, 0.12, 0.55, 0.98]) {
      const { p } = noMeio(psi, TRILHO.fora);
      for (const lado of [-1, 1]) tacha(0.0058, 0.8, p.clone().add(new THREE.Vector3(lado * 0.0262, 0, 0)), new THREE.Vector3(lado, 0, 0));
    }

    // A crina: um leque saindo do trilho — comprido e inclinado pra frente na testa, alto no topo
    // e mais curto deitando pra trás. É uma peça só, esculpida: dos dois lados ela tem sulcos
    // correndo da raiz até a ponta (os "fios"), e a beirada de fora é redonda. Cada ponto sai
    // de (tau, s): tau anda pelo trilho, da frente pra trás; s dá a volta no corte da crina, subindo
    // por um lado, passando pela ponta e descendo pelo outro.
    const FIOS = 48, PASSOS = 288, VOLTA_DO_CORTE = 30, GROSSURA = 0.06, LADO = 0.3, PONTA = 0.8;
    const raizes = [];
    for (let i = 0; i <= PASSOS; i++) {
      const tau = i / PASSOS, { p, n } = noMeio(TRILHO.de + 0.02 + (TRILHO.ate - TRILHO.de - 0.04) * tau, TRILHO.fora + 0.004);
      // o ângulo a partir da vertical (positivo = pra trás): o da calota, mais o leque abrindo
      const angulo = Math.atan2(-n.z, n.y) - 0.36 * Math.pow(1 - tau, 2) + 0.3 * Math.pow(tau, 3);
      const fio = 0.5 + 0.5 * Math.cos(2 * Math.PI * FIOS * tau); // 1 no fundo de cada sulco
      raizes.push({
        p, fio,
        para: new THREE.Vector3(0, Math.cos(angulo), -Math.sin(angulo)),
        comprimento: 0.2 * (1 - 0.28 * suave(limitar((tau - 0.35) / 0.65))) * (0.86 + 0.14 * suave(limitar(tau / 0.08)))
          * (1 + 0.012 * Math.sin(2 * Math.PI * FIOS * tau + 1.3)), // a pontinha de cada fio
        // a grossura: arredonda na frente e atrás, e afunda um pouco em cada sulco
        largura: GROSSURA * Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(2 * tau - 1), 6))) * (1 - 0.08 * fio)
      });
    }
    const noCorte = j => { // [quanto sobe (0 raiz, 1 ponta), de que lado (-1 a 1)]
      const s = j / VOLTA_DO_CORTE;
      if (s <= LADO) return [PONTA * s / LADO, -1];
      if (s >= 1 - LADO) return [PONTA * (1 - s) / LADO, 1];
      const a = Math.PI * (s - LADO) / (1 - 2 * LADO);
      return [PONTA + (1 - PONTA) * Math.sin(a), -Math.cos(a)];
    };
    const crina = new THREE.Mesh(superficie(PASSOS, VOLTA_DO_CORTE, (i, j) => {
      const q = raizes[i], [sobe, lado] = noCorte(j);
      return q.p.clone().addScaledVector(q.para, sobe * q.comprimento)
        .add(new THREE.Vector3(lado * q.largura * (0.45 + 0.55 * Math.pow(sobe, 0.6)), 0, 0));
    }, (i, j) => { // escura na raiz e no fundo dos sulcos, e uns fios mais escuros que outros
      const q = raizes[i], [sobe] = noCorte(j);
      return (0.45 + 0.55 * suave(limitar(sobe / 0.5))) * (1 - 0.2 * q.fio) * (0.88 + 0.12 * mancha(i * 0.37, 0));
    }), new THREE.MeshStandardMaterial({
      color: COR.crina, roughness: 0.55, metalness: 0, vertexColors: true,
      envMap: ambiente || null, envMapIntensity: 0.4 * cfg.brilho
    }));
    contorno(por(crina), 0.005);
    return elmo;
  }

  // ---- o rosto ----
  // Uma peça só, esculpida: a cabeça é um ovo meio quadrado (superelipsoide) e o rosto ganha
  // relevo somando morrinhos e covinhas — o nariz comprido, as maçãs, os lábios, o queixo e as
  // covas onde os olhos entram. Atrás e dos lados vai o cabelo (a orelha some nele). Medidas na
  // escala da cabeça, com os olhos na altura y = 0.
  const CABECA = { centro: -0.017, altura: 0.205, largura: 0.142, frente: 0.152, tras: 0.165, e1: 0.85 };
  const QUEIXO = CABECA.altura - CABECA.centro; // do centro da cabeça até a ponta do queixo
  const OLHO = { x: 0.072, y: 0.003, raio: 0.036, fora: 0.02 }; // "fora" = quanto o olho sai da cova
  const NARIZ = { raiz: 0.035, ponta: -0.083 };
  const BOCA = { y: -0.136, meia: 0.056 };
  const spow = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
  const morro = (x, y, cx, cy, rx, ry) => Math.exp(-(((x - cx) / rx) ** 2) - (((y - cy) / ry) ** 2));
  // A largura do rosto em cada altura: as bochechas afinam na altura da boca (senão a cabeça fica
  // uma bola) e a mandíbula abre um pouco embaixo, marcando os cantos do queixo.
  const larguraNaAltura = y => CABECA.largura
    * (1 + 0.15 * suave(limitar((-0.1 - y) / 0.08)))
    * (1 - 0.07 * Math.exp(-(((y + 0.1) / 0.045) ** 2)));
  // o quanto o corte da cabeça é quadrado: bem reto na altura dos olhos (o olho assenta no rosto
  // em vez de sobrar pro lado), e embaixo também meio reto, pra mandíbula não ficar redonda
  const quadrado = y => 0.75 + 0.07 * suave(limitar((-0.03 - y) / 0.09));

  // O cabelo começa na têmpora (a costeleta, do lado do olho), desce na frente de onde seria a
  // orelha, sobe um pouco e vai descendo até a nuca. "beira" = [ângulo a partir da frente, até
  // que altura ele desce ali].
  const CABELO = { frente: 1.0, beira: [[1.0, 0.012], [1.25, -0.065], [1.45, -0.05], [1.8, -0.12], [2.4, -0.172], [Math.PI, -0.186]] };
  function beiraDoCabelo(a, comPontas) {
    const B = CABELO.beira;
    let k = 1;
    while (k < B.length - 1 && B[k][0] < a) k++;
    const [a0, y0] = B[k - 1], [a1, y1] = B[k];
    const y = y0 + (y1 - y0) * suave(limitar((a - a0) / (a1 - a0)));
    return comPontas ? y - 0.014 * (1 - Math.abs(((a * 11) % 2) - 1)) : y; // as pontas das mechas
  }

  // o nariz comprido e reto das referências: nasce entre as sobrancelhas, vai crescendo até a
  // ponta redonda, com as duas asas de cada lado, e embaixo volta pro rosto
  function nariz(x, y) {
    const { raiz, ponta } = NARIZ;
    // de lado ele é "chato em cima e íngreme nos lados", pra luz marcar as laterais do nariz
    const t = limitar((raiz - y) / (raiz - ponta)), largura = 0.013 + 0.009 * t;
    let alto = (0.005 + 0.035 * Math.pow(t, 1.25)) * Math.exp(-((x / largura) ** 4));
    if (y < ponta) alto *= Math.exp(-(((ponta - y) / 0.012) ** 2));
    if (y > raiz) alto *= Math.exp(-(((y - raiz) / 0.014) ** 2));
    return alto + 0.011 * morro(x, y, 0, ponta + 0.003, 0.016, 0.013)
      + 0.009 * (morro(x, y, 0.021, ponta - 0.002, 0.01, 0.01) + morro(x, y, -0.021, ponta - 0.002, 0.01, 0.01));
  }
  function relevo(x, y) {
    const ax = Math.abs(x);
    return nariz(x, y)
      - 0.016 * morro(ax, y, OLHO.x, OLHO.y, 0.045, 0.034)    // as covas dos olhos
      + 0.014 * morro(ax, y, 0.11, 0, 0.018, 0.035)           // a borda de fora da cova
      + 0.009 * morro(ax, y, 0.068, 0.047, 0.07, 0.013)       // a testa, onde assentam as sobrancelhas
      + 0.003 * morro(ax, y, 0.09, -0.04, 0.035, 0.025)       // as maçãs do rosto, discretas
      - 0.0025 * morro(x, y, 0, -0.11, 0.005, 0.012)          // o sulco entre o nariz e a boca
      + 0.009 * morro(x, y, 0, BOCA.y + 0.012, 0.052, 0.01)   // o lábio de cima
      + 0.012 * morro(x, y, 0, BOCA.y - 0.011, 0.045, 0.011)  // o de baixo, mais cheio
      - 0.004 * morro(ax, y, BOCA.meia, BOCA.y, 0.009, 0.009) // os cantos da boca
      - 0.004 * morro(x, y, 0, BOCA.y - 0.029, 0.034, 0.007)  // a dobrinha embaixo do lábio
      + 0.045 * morro(x, y, 0, -0.2, 0.046, 0.03);            // o queixo, grande e pra frente
  }
  // um ponto da cabeça: theta vai do alto (0) até embaixo (pi), phi dá a volta a partir da frente
  function naCabeca(theta, phi) {
    const W = Math.pow(Math.sin(theta), CABECA.e1);
    const y = CABECA.centro + CABECA.altura * spow(Math.cos(theta), CABECA.e1), e2 = quadrado(y);
    const x = larguraNaAltura(y) * W * spow(Math.sin(phi), e2);
    const c = Math.cos(phi);
    const z = (c > 0 ? CABECA.frente : CABECA.tras) * W * spow(c, e2)
      + relevo(x, y) * (1 - suave(limitar((Math.abs(phi) - 0.9) / 0.5))); // o relevo só na frente
    return new THREE.Vector3(x, y, z);
  }
  // a profundidade do rosto num ponto (x, y) da frente: onde assentar olhos, sobrancelhas e boca
  function rostoZ(x, y) {
    const cosT = Math.pow(limitar(Math.abs(y - CABECA.centro) / CABECA.altura), 1 / CABECA.e1);
    const W = Math.pow(Math.max(0, 1 - cosT * cosT), CABECA.e1 / 2), e2 = quadrado(y);
    const s = Math.pow(limitar(Math.abs(x) / (larguraNaAltura(y) * W)), 1 / e2);
    return CABECA.frente * W * Math.pow(Math.max(0, 1 - s * s), e2 / 2) + relevo(x, y);
  }

  // um fio de grossura variável seguindo uma curva: sobrancelha, a linha da boca, os cílios.
  // grossura(t) dá o raio ao longo dele (0 nas pontas, pra fechar); "achatar" amassa o fio
  // contra o rosto.
  function fio(pontos, grossura, achatar = 1) {
    const curva = new THREE.CatmullRomCurve3(pontos), frente = new THREE.Vector3(0, 0, 1);
    const N = Math.max(16, pontos.length * 8), V = 10;
    return superficie(N, V, (i, j) => {
      const t = i / N, p = curva.getPoint(t), tangente = curva.getTangent(t);
      const lado = new THREE.Vector3().crossVectors(tangente, frente).normalize();
      const fora = new THREE.Vector3().crossVectors(lado, tangente).normalize();
      const a = 2 * Math.PI * j / V, r = grossura(t);
      return p.addScaledVector(lado, Math.cos(a) * r).addScaledVector(fora, Math.sin(a) * r * achatar);
    }, null, false, false);
  }

  // A pele: com a luz forte da cena, a cor da pele estourava pra um amarelo claro no lado
  // iluminado. Então parte da cor vem "de dentro" (brilho próprio) e parte da luz — a diferença
  // entre claro e escuro fica macia, como nas referências. O brilho próprio também respeita os
  // tons do rosto (o cabelo não acende).
  function materialDePele(cfg, cor, comTons) {
    const base = new THREE.Color(cor);
    const pele = new THREE.MeshStandardMaterial({
      color: base.clone().multiplyScalar(0.34), emissive: base.clone().multiplyScalar(0.37 * cfg.brilho / 1.15),
      roughness: 0.65, metalness: 0, vertexColors: comTons, envMapIntensity: 0.12 * cfg.brilho
    });
    if (comTons) {
      pele.onBeforeCompile = shader => {
        shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= vColor;');
      };
    }
    return pele;
  }

  function montarRosto(cfg, ambiente) {
    const rosto = new THREE.Group();
    const macio = (cor, aspereza, reflexo, comTons) => new THREE.MeshStandardMaterial({
      color: cor, roughness: aspereza, metalness: 0, vertexColors: comTons,
      envMap: ambiente || null, envMapIntensity: reflexo * cfg.brilho
    });
    const pele = materialDePele(cfg, COR.pele, true);
    pele.envMap = ambiente || null;
    const tracado = new THREE.MeshBasicMaterial({ color: COR.contorno, side: THREE.BackSide });

    // ---- a cabeça ----
    // Mais pontos no rosto, poucos atrás e no alto (que ficam no cabelo e embaixo do elmo).
    const phis = [], thetas = [];
    for (let k = 0; k <= 200; k++) { const t = -1 + 2 * k / 200; phis.push(Math.PI * (0.3 * t + 0.7 * t * t * t)); }
    for (let k = 0; k < 24; k++) thetas.push(0.95 * k / 24);
    for (let k = 0; k < 160; k++) thetas.push(0.95 + 2 * k / 160);
    for (let k = 0; k <= 10; k++) thetas.push(2.95 + (Math.PI - 2.95) * k / 10);
    // embaixo do cabelo a cabeça também é escura, pra não aparecer pele por alguma fresta
    const cabelo = (phi, y) => {
      const a = Math.abs(phi);
      return suave(limitar((a - CABELO.frente - 0.02) / 0.04)) * suave(limitar((y - beiraDoCabelo(a, false)) / 0.02));
    };
    const ESCURO = [0.13, 0.12, 0.13]; // castanho quase preto, em relação à cor da pele
    const tomDaPele = (p, phi) => {
      const { x, y } = p, ax = Math.abs(x);
      let r = 1, g = 1, b = 1;
      // bochechas e ponta do nariz um pouco coradas
      const corado = 0.5 * morro(ax, y, 0.09, -0.06, 0.04, 0.03) + 0.35 * morro(x, y, 0, NARIZ.ponta, 0.018, 0.014);
      g -= 0.08 * corado; b -= 0.1 * corado;
      const labios = morro(x, y, 0, BOCA.y + 0.01, 0.05, 0.008) + morro(x, y, 0, BOCA.y - 0.011, 0.043, 0.01);
      r -= 0.04 * labios; g -= 0.24 * labios; b -= 0.22 * labios;
      // sombrinhas: na dobra da pálpebra, dos lados do nariz e nas narinas
      const sombra = 0.12 * morro(ax, y, OLHO.x, 0.034, 0.04, 0.008) + 0.08 * morro(ax, y, 0.028, -0.05, 0.01, 0.03)
        + 0.15 * morro(ax, y, 0.01, NARIZ.ponta - 0.012, 0.006, 0.004);
      r -= sombra; g -= sombra; b -= sombra;
      const h = cabelo(phi, y);
      return [r + (ESCURO[0] - r) * h, g + (ESCURO[1] - g) * h, b + (ESCURO[2] - b) * h];
    };
    const cabeca = new THREE.Mesh(superficie(phis.length - 1, thetas.length - 1,
      (i, j) => naCabeca(thetas[j], phis[i]), (i, j, p) => tomDaPele(p, phis[i]), true), pele);
    if (cfg.contorno) contornoPorNormal(cabeca, 0.005, tracado);
    rosto.add(cabeca);

    // ---- o cabelo ----
    // Curto, escuro e em mechas grossas, embaixo do elmo: uma casca por cima da cabeça, mais
    // alta onde passa uma mecha, com a beirada de baixo terminando em pontas.
    const HI = 150, HJ = 48, centroDaCabeca = new THREE.Vector3(0, CABECA.centro, 0);
    const thetaDaAltura = y => Math.acos(Math.max(-1, Math.min(1, spow((y - CABECA.centro) / CABECA.altura, 1 / CABECA.e1))));
    const mecha = (a, y) => Math.pow(Math.abs(Math.sin(a * 9 - y * 30)), 0.7); // 1 no alto de cada mecha
    const phiDoCabelo = i => { // de uma têmpora, por trás, até a outra
      const phi = CABELO.frente + (2 * Math.PI - 2 * CABELO.frente) * i / HI;
      return phi > Math.PI ? phi - 2 * Math.PI : phi;
    };
    const fios = new THREE.Mesh(superficie(HI, HJ, (i, j) => {
      const phi = phiDoCabelo(i), a = Math.abs(phi), beira = beiraDoCabelo(a, true);
      const p = naCabeca(thetaDaAltura(beira) * j / HJ, phi);
      // fino na beirada (encosta na pele) e cheio por dentro
      const dentro = suave(limitar((a - CABELO.frente) / 0.07)) * suave(limitar((p.y - beira) / 0.025));
      return p.addScaledVector(p.clone().sub(centroDaCabeca).normalize(), 0.0012 + dentro * (0.006 + 0.006 * mecha(a, p.y)));
    }, (i, j, p) => 0.7 + 0.45 * mecha(Math.abs(phiDoCabelo(i)), p.y)), macio(COR.cabelo, 0.5, 0.4, true));
    if (cfg.contorno) contornoPorNormal(fios, 0.004, tracado);
    rosto.add(fios);

    // ---- os olhos ----
    // Bola de olho de verdade, encaixada na cova: pra olhar pro lado ela GIRA (a íris corre pro
    // canto), e pra piscar a pálpebra de cima desce por cima dela. O brilhinho branco fica parado
    // quando o olho gira — é o reflexo da luz, não uma mancha pintada no olho.
    const R = OLHO.raio;
    const globo = new THREE.SphereGeometry(R, 32, 24);
    const tons = [], pg = globo.attributes.position;
    for (let v = 0; v < pg.count; v++) { // o branco mais escuro em cima, na sombra da pálpebra
      const k = 1 - 0.3 * suave(limitar((pg.getY(v) / R - 0.1) / 0.6));
      tons.push(k, k, k);
    }
    globo.setAttribute('color', new THREE.Float32BufferAttribute(tons, 3));
    const iris = new THREE.SphereGeometry(R * 1.003, 40, 12, 0, Math.PI * 2, 0, 0.58);
    const tonsIris = [], pi = iris.attributes.position;
    for (let v = 0; v < pi.count; v++) { // o aro de fora escuro, um anel mais claro no meio
      const a = Math.acos(limitar(pi.getY(v) / (R * 1.003)));
      const k = a > 0.48 ? 0.5 : a > 0.3 ? 1.2 : 1;
      tonsIris.push(k, k, k);
    }
    iris.setAttribute('color', new THREE.Float32BufferAttribute(tonsIris, 3));
    const pupila = new THREE.SphereGeometry(R * 1.006, 32, 8, 0, Math.PI * 2, 0, 0.28);
    const branco = macio(COR.olho, 0.2, 0.4, true), marrom = macio(COR.iris, 0.12, 0.3, true);
    const preto = macio(COR.pupila, 0.1, 0.3, false), palpebra = materialDePele(cfg, COR.palpebra, false);
    const escuro = macio(COR.cilio, 0.8, 0.2, false);
    // As pálpebras são cascas em volta do olho, inclinadas pra trás: assim a beirada faz um arco
    // (alta no meio, descendo pros cantos). "altura" = onde a beirada cruza a frente do olho.
    const casca = (eixo, altura, folga, material) => {
      const meio = new THREE.Vector3(0, Math.sin(altura), Math.cos(altura));
      const abertura = Math.acos(eixo.dot(meio)), raio = R + folga;
      const m = new THREE.Mesh(new THREE.SphereGeometry(raio, 48, 20, 0, Math.PI * 2, 0, abertura), material);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), eixo);
      return { m, abertura, raio };
    };
    const eixoCima = new THREE.Vector3(0, Math.cos(0.45), -Math.sin(0.45));
    const eixoBaixo = new THREE.Vector3(0, -Math.cos(0.5), -Math.sin(0.5));
    // a de baixo é rente ao olho e da cor do rosto, pra não parecer olheira
    const cima = casca(eixoCima, 0.66, 0.003, palpebra);
    const baixo = casca(eixoBaixo, -0.68, 0.0012, materialDePele(cfg, COR.pele, false));
    // os cílios: um fio escuro na beirada da pálpebra de cima, só na parte da frente
    const centroDaBeirada = eixoCima.clone().multiplyScalar(cima.raio * Math.cos(cima.abertura));
    const raioDaBeirada = cima.raio * Math.sin(cima.abertura) + 0.0012;
    const e1 = new THREE.Vector3(1, 0, 0), e2 = new THREE.Vector3(0, eixoCima.z, -eixoCima.y);
    const beirada = [];
    for (let k = 0; k <= 8; k++) {
      const t = Math.PI + 0.45 + (Math.PI - 0.9) * k / 8;
      beirada.push(centroDaBeirada.clone().addScaledVector(e1, Math.cos(t) * raioDaBeirada).addScaledVector(e2, Math.sin(t) * raioDaBeirada));
    }
    const cilios = fio(beirada, t => 0.0028 * Math.pow(Math.sin(Math.PI * t), 0.6));
    // o brilhinho: em cima e à esquerda, de onde vem a luz principal
    const brilhinho = new THREE.SphereGeometry(0.0048, 12, 8), luz = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const ondeBrilha = new THREE.Vector3(-0.42, 0.42, 0.8).normalize().multiplyScalar(R + 0.001);

    const olhos = [], palpebras = [];
    for (const lado of [-1, 1]) {
      const x = lado * OLHO.x;
      const centro = new THREE.Group();
      centro.position.set(x, OLHO.y, rostoZ(x, OLHO.y) + OLHO.fora - R);
      rosto.add(centro);
      const bola = new THREE.Group(); // gira pra olhar
      bola.add(new THREE.Mesh(globo, branco));
      for (const [geometria, material] of [[iris, marrom], [pupila, preto]]) {
        const m = new THREE.Mesh(geometria, material);
        m.rotation.x = Math.PI / 2; // da ponta de cima da esfera pra frente
        bola.add(m);
      }
      centro.add(bola);
      const brilho = new THREE.Mesh(brilhinho, luz); // por dentro da pálpebra: some quando ela fecha
      brilho.position.copy(ondeBrilha);
      const tampa = new THREE.Group(); // a pálpebra de cima: gira pra frente pra fechar
      tampa.add(cima.m.clone(), new THREE.Mesh(cilios, escuro));
      centro.add(brilho, tampa, baixo.m.clone());
      olhos.push(bola);
      palpebras.push(tampa);

      // a sobrancelha: grossa, escura e quase reta, como nas referências
      const pontos = [[0.03, 0.05], [0.055, 0.054], [0.085, 0.053], [0.112, 0.046]]
        .map(([bx, by]) => new THREE.Vector3(lado * bx, by, rostoZ(lado * bx, by) + 0.002));
      rosto.add(new THREE.Mesh(fio(pontos, t => 0.0095 * Math.pow(Math.sin(Math.PI * t), 0.35) * (1 - 0.4 * t), 0.55), escuro));
    }

    // a boca: fechada, uma linha escura entre os lábios, com os cantos um tiquinho pra baixo
    const boca = [];
    for (let k = 0; k <= 6; k++) {
      const bx = BOCA.meia * (-1 + 2 * k / 6), by = BOCA.y - 0.004 * (bx / BOCA.meia) ** 2;
      boca.push(new THREE.Vector3(bx, by, rostoZ(bx, by) - 0.0012));
    }
    rosto.add(new THREE.Mesh(fio(boca, t => 0.003 * Math.pow(Math.sin(Math.PI * t), 0.5)), macio(COR.boca, 0.7, 0.2, false)));
    return { rosto, olhos, palpebras };
  }

  // ---- o soldado, no estilo das referências: rosto de desenho animado e o elmo romano ----
  // Tudo olhando pro +Z (pra câmera). "cabeca" é o grupo que gira pra olhar os lados.
  // "ambiente" é o reflexo do metal (ver ambienteDoElmo).
  function montarSoldado(cfg, ambiente) {
    const soldado = new THREE.Group(), cabeca = new THREE.Group();
    soldado.add(cabeca);
    const { rosto, olhos, palpebras } = montarRosto(cfg, ambiente);
    cabeca.add(rosto);
    // O pescoço: grosso e meio oval, nascendo por dentro da cabeça, com o pomo de adão na frente.
    // Embaixo ele abre só pros lados, no começo dos ombros (se abrisse pra frente e pra trás
    // também, de lado virava um pé de taça). Mais escuro em cima, na sombra do queixo.
    const perfilDoPescoco = new THREE.SplineCurve([[-0.1, 0.06], [-0.16, 0.064], [-0.22, 0.068], [-0.28, 0.072],
      [-0.33, 0.076], [-0.37, 0.08], [-0.39, 0.08], [-0.395, 0.05], [-0.398, 0]]
      .map(([y, r]) => new THREE.Vector2(r, y))).getPoints(48);
    const pescoco = new THREE.Mesh(superficie(48, perfilDoPescoco.length - 1, (i, j) => {
      const phi = -Math.PI + 2 * Math.PI * i / 48, { x: r, y } = perfilDoPescoco[j];
      const ombro = 0.11 * suave(limitar((-0.29 - y) / 0.08));
      const pomo = 0.008 * morro(phi * r, y, 0, -0.235, 0.014, 0.02);
      return new THREE.Vector3((1.1 * r + ombro) * Math.sin(phi), y, (0.95 * r + pomo) * Math.cos(phi));
    }, (i, j) => 0.72 + 0.28 * suave(limitar((-0.19 - perfilDoPescoco[j].y) / 0.08)), true), materialDePele(cfg, COR.pele, true));
    if (cfg.contorno) contornoPorNormal(pescoco, 0.005, new THREE.MeshBasicMaterial({ color: COR.contorno, side: THREE.BackSide }));
    soldado.add(pescoco);
    cabeca.add(montarElmo(cfg, ambiente));

    // o que a cena precisa pra esconder ele inteiro dentro da muralha: até onde a crista sobe e
    // até onde a frente dele avança (a ponta da crista, o nariz) — medido antes de aumentar
    const caixa = new THREE.Box3().setFromObject(cabeca);
    soldado.scale.setScalar(cfg.tamanho);
    return { soldado, cabeca, olhos, palpebras, topo: caixa.max.y, frente: caixa.max.z, queixo: QUEIXO };
  }

  // ---- a linha do tempo: cada etapa começa quando a anterior termina ----
  function linhaDoTempo(cfg) {
    const t = {};
    let agora = 0;
    const etapa = (nome, duracao) => { t[nome] = [agora, agora += duracao]; };
    etapa('muroSobe', cfg.sobeMuro);
    agora += cfg.antesDeEspiar;
    etapa('espia', cfg.espiar);
    etapa('esquerda', cfg.olhaEsquerda);
    etapa('direita', cfg.olhaDireita);
    etapa('frente', cfg.voltaFrente);
    etapa('esconde', cfg.esconder);
    agora += cfg.antesDeDescer;
    etapa('muroDesce', cfg.desceMuro);
    t.total = agora;
    return t;
  }

  const suave = x => x * x * (3 - 2 * x);
  const entre = (t, [a, b]) => Math.min(1, Math.max(0, (t - a) / Math.max(0.001, b - a)));
  // sai rápido e vai freando até parar, sem passar do ponto
  const saida = x => 1 - Math.pow(1 - x, 3);

  // pra onde ele está olhando: 0 = frente, 1 = um lado, -1 = o outro
  function direcaoDoOlhar(t, T) {
    if (t < T.esquerda[0]) return 0;
    if (t < T.direita[0]) return suave(entre(t, [T.esquerda[0], T.esquerda[0] + 0.35]));
    if (t < T.frente[0]) return 1 - 2 * suave(entre(t, [T.direita[0], T.direita[0] + 0.45]));
    return -1 + suave(entre(t, T.frente));
  }

  // ---- a cena ----
  function criar(opcoes) {
    if (typeof THREE === 'undefined') return null;
    const cfg = Object.assign({}, PADRAO, opcoes || {});
    const T = linhaDoTempo(cfg);

    const caixa = document.createElement('div');
    caixa.className = 'muralha-3d';
    const L = Math.max(1, window.innerWidth), A = Math.max(1, window.innerHeight);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(1);
    const densidade = window.devicePixelRatio || 1; // resolução real da tela (ver flechada-3d.js)
    renderer.setSize(Math.ceil(L * densidade / cfg.pixel), Math.ceil(A * densidade / cfg.pixel), false);
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;'
      + (cfg.pixel > 1 ? 'image-rendering:pixelated' : '');
    caixa.appendChild(renderer.domElement);

    const cena = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, L / A, 0.1, 200);
    camera.position.set(0, 1.6, 0);
    iluminar(cena, cfg);
    const reflexo = ambienteDoElmo(renderer);

    // a pedra: a foto, se já chegou; senão, cinza liso
    if (fotoCor) { // nitidez da foto quando a parede é vista de lado (ver flechada-3d.js)
      const nitidez = renderer.capabilities.getMaxAnisotropy();
      fotoCor.anisotropy = nitidez;
      if (fotoRelevo) fotoRelevo.anisotropy = nitidez;
    }
    // A foto é tingida pra um cinza frio: com a luz quente da cena ela saía bege, no mesmo tom do
    // livro e da mesa. Cinza contra marrom é o contraste que já funcionava na versão em pixel.
    const tinta = new THREE.Color(0xffffff).lerp(new THREE.Color(0x8e9db3), cfg.pedraFrio);
    const pedra = new THREE.MeshPhongMaterial(fotoCor
      ? { map: fotoCor, normalMap: fotoRelevo, color: tinta, shininess: 6 }
      : { color: COR.pedraReserva, shininess: 6 });

    const abertura = 2 * Math.tan((camera.fov / 2) * Math.PI / 180);
    const largura = abertura * cfg.muroDistancia * camera.aspect + 3;
    const muro = montarMuralha(cfg, largura, pedra);
    const alturaTotal = cfg.muroAltura + cfg.ameiaAltura;
    cena.add(muro);

    // O soldado fica ATRÁS da muralha, no vão central: a frente dele (a ponta da crista, o que
    // mais avança) logo atrás da face de trás da parede. Assim ele sobe por trás dela, e não de
    // dentro da pedra.
    const { soldado, cabeca, olhos, palpebras, topo, frente, queixo: ateOQueixo } = montarSoldado(cfg, reflexo.texture);
    const piso = cfg.muroBase + cfg.muroAltura; // o chão do vão
    const queixo = ateOQueixo * cfg.tamanho;    // do centro da cabeça até o queixo
    const recuo = cfg.espessura / 2 + frente * cfg.tamanho + 0.03;
    // Escondido, ele fica abaixo da linha de visão que passa raspando no alto da muralha: como a
    // câmera está mais alta, atrás da muralha ela enxerga um pouco abaixo do chão do vão, e mais
    // quanto mais pra trás. "caida" é quanto essa linha desce por metro atrás da parede, e
    // "fundo" é até onde a cabeça dele vai, atrás dela.
    const costas = cfg.muroDistancia + cfg.espessura / 2;
    const caida = (camera.position.y - piso) / costas;
    const fundo = frente * cfg.tamanho + 0.03 + 0.35 * cfg.tamanho;
    const dePe = piso + queixo + cfg.espiada;
    const escondido = piso - topo * cfg.tamanho - 0.05 - caida * fundo;
    // com a muralha lá embaixo a câmera enxerga ainda mais atrás dela: ele afunda mais rápido que ela
    const afunda = 1 + fundo / costas + 0.1;
    soldado.position.set(0, escondido, -cfg.muroDistancia - recuo);
    cena.add(soldado);
    // Prepara os materiais já aqui: o metal com reflexo demora um pouco pra ficar pronto, e se isso
    // acontecesse no primeiro quadro a muralha já apareceria no meio do caminho.
    renderer.compile(cena, camera);

    function posicionar(tempo) {
      const muroFora = Math.min(suave(entre(tempo, T.muroSobe)), 1 - suave(entre(tempo, T.muroDesce)));
      const abaixo = (1 - muroFora) * (alturaTotal + 0.6); // o quanto a muralha ainda está abaixo do lugar
      muro.position.set(0, cfg.muroBase - abaixo, -cfg.muroDistancia);

      // escondido, ele sobe e desce junto com a muralha; pra espiar, sobe por trás dela e para
      // de uma vez, sem quicar
      const fora = saida(entre(tempo, T.espia)) * (1 - suave(entre(tempo, T.esconde)));
      soldado.position.y = escondido - abaixo * afunda + fora * (dePe - escondido);

      // os olhos giram primeiro, a cabeça acompanha um instante depois — como a gente olha
      cabeca.rotation.y = direcaoDoOlhar(tempo - 0.12, T) * cfg.olhar * Math.PI / 180;
      for (const o of olhos) o.rotation.y = direcaoDoOlhar(tempo, T) * cfg.olharOlhos * Math.PI / 180;

      // uma piscada logo depois de aparecer: a pálpebra de cima desce até a de baixo e volta
      const piscada = entre(tempo, [T.espia[1] + 0.1, T.espia[1] + 0.26]);
      for (const p of palpebras) p.rotation.x = Math.sin(Math.PI * piscada) * 1.2;
    }

    let inicio = null, parado = false, liberado = false;
    function quadro(agora) {
      if (parado) return;
      if (!caixa.isConnected) { parar(); return; }
      if (inicio === null) inicio = agora;
      posicionar((agora - inicio) / 1000);
      renderer.render(cena, camera);
      requestAnimationFrame(quadro);
    }
    function parar() {
      parado = true;
      if (liberado) return;
      liberado = true;
      reflexo.dispose();
      renderer.dispose();
      renderer.forceContextLoss(); // devolve o WebGL na hora, em vez de esperar o navegador
    }
    requestAnimationFrame(quadro);

    // pra página de teste: congela, e mostra um instante qualquer
    caixa.pausar = () => { parado = true; };
    caixa.parar = parar;
    caixa.irPara = tempo => { posicionar(tempo); renderer.render(cena, camera); };
    caixa.duracaoTotal = T.total;
    return caixa;
  }

  // ---- a vitrine do elmo: só o capacete, grande, pra girar arrastando (na estante de troféus) ----
  // Mexe do mesmo jeito que o livro fechado: arrastar pro lado gira, pra cima e pra baixo inclina,
  // e ao soltar ele continua girando e vai parando aos poucos. Parado, flutua de leve. Devolve a
  // caixa com a tela dentro; o tamanho acompanha o da caixa, e .parar() libera tudo.
  function criarVitrineDoElmo(opcoes) {
    if (typeof THREE === 'undefined') return null;
    const cfg = Object.assign({}, PADRAO, opcoes || {});
    const caixa = document.createElement('div');
    caixa.className = 'elmo-3d';
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    const tela = renderer.domElement;
    tela.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;cursor:grab';
    caixa.appendChild(tela);

    const cena = new THREE.Scene();
    iluminar(cena, cfg);
    const reflexo = ambienteDoElmo(renderer);
    const giro = new THREE.Group(); // é ele que o arrasto gira
    const elmo = montarElmo(cfg, reflexo.texture);
    elmo.position.set(0, -0.16, 0.05); // o meio do elmo (com a crista) no eixo do giro
    giro.add(elmo);
    giro.rotation.set(0.2, -0.5, 0);
    cena.add(giro);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);

    const medir = () => {
      const l = Math.max(1, caixa.clientWidth), a = Math.max(1, caixa.clientHeight);
      renderer.setSize(l, a, false);
      camera.aspect = l / a;
      camera.updateProjectionMatrix();
    };
    const observador = new ResizeObserver(medir);
    observador.observe(caixa);

    // girar, chegar perto e deslocar — o mesmo manuseio das outras vitrines, em vitrine-3d.js
    const controles = Vitrine3D.manusear({ tela, caixa, camera, giro, inclinacaoMax: 0.7 });
    controles.enquadrar(1.85);

    let parado = false;
    function quadro(agora) {
      if (parado) return;
      controles.aoQuadro();
      giro.position.y = Math.sin(agora * 0.0012) * 0.015;
      renderer.render(cena, camera);
      requestAnimationFrame(quadro);
    }
    requestAnimationFrame(quadro);
    caixa.parar = () => {
      if (parado) return;
      parado = true;
      observador.disconnect();
      reflexo.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    };
    return caixa;
  }

  // montarSoldado, iluminar e ambienteDoElmo ficam expostos pra página de teste mostrar o soldado de perto
  return { criar, criarVitrineDoElmo, PADRAO, montarSoldado, iluminar, ambienteDoElmo };
})();

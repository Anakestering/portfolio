// =====================================================================
// O pergaminho em 3D.
//
// Feito à mão em three.js, como a muralha e o elmo — nada de arquivo
// pronto. O motivo: o pergaminho vai ABRIR depois, e abrir é o papel
// mudando de forma quadro a quadro. Um modelo pronto vem numa pose só e
// não se desenrola; a forma aqui é calculada, então basta mudar um número
// pra ele estar mais aberto ou mais fechado.
//
// Como o papel é montado: ele é UMA tira só, percorrida de baixo pra
// cima. Nas pontas ela dá um quarto de volta em torno de cada varão (é o
// que faz o papel parecer enrolado neles) e no meio desce reta, na frente
// dos dois. As rugas verticais só existem nesse trecho reto — no rolo o
// papel está apertado e liso.
//
// Os torneados das pontas dos varões são LatheGeometry: um perfil (a
// silhueta de meia peça) girado em volta do eixo, que é exatamente como
// se torneia madeira de verdade.
// =====================================================================
const Pergaminho3D = (function () {
  const PADRAO = {
    // o papel
    largura: 1.55,
    altura: 1.65,       // o trecho reto, entre os dois varões
    ondulacao: 0.02,    // o quanto as rugas afundam o papel
    ondas: 4,           // quantas rugas ao longo da largura
    manchas: 1.55,      // força das manchas de idade no papel
    rasgado: 0.035,     // o quanto as beiradas laterais são irregulares, de papel rasgado
    // o desenho no meio do papel
    imagem: 'assets/julius.png',
    imagemTamanho: 0.6, // que fatia da largura do papel ele ocupa
    imagemForca: 0.75,  // 0 = sumido no papel, 1 = tinta cheia
    // os varões
    raioDoRolo: 0.1,    // o papel enrolado em volta do varão, com o pergaminho aberto
    raioDaHaste: 0.035,
    saliencia: 0.19,    // o quanto o torneado sai pra fora do papel, de cada lado
    engorda: 0.3,       // o quanto os rolos engordam quando o papel volta pra dentro deles
    // a abertura
    duracao: 2,         // quanto tempo o pergaminho leva pra abrir
    // a cena da comemoração: ele entra pela esquerda, abre o tanto de ver o desenho, fecha e volta
    distancia: 4.2,     // o quanto a câmera fica longe dele
    alturaNaTela: 0,    // onde ele fica na vertical (positivo = mais pra cima)
    escala: 1,
    origemX: -5,        // de onde ele vem (e pra onde volta), fora da tela
    entrada: 0.75,      // quanto tempo leva pra chegar no centro
    mostra: 0.9,        // e quanto fica parado, aberto, pra dar pra ver
    fechar: 0.45,
    saida: 0.5,
    aberturaMaxima: 0.7, // não precisa abrir tudo: só até o desenho aparecer inteiro
    balanco: 2.5,       // o quanto ele bamboleia, em graus
    // acabamento
    brilho: 1.3,
    pixel: 1
  };

  const limitar = n => Math.max(0, Math.min(1, n));
  const suave = t => t * t * (3 - 2 * t);

  // ---- o papel ----
  // manchas de idade: borrões largos e claros, uns por cima dos outros
  function manchas(ctx, cfg, quantas) {
    for (let i = 0; i < quantas; i++) {
      const x = Math.random() * 512, y = Math.random() * 512, r = 30 + Math.random() * 120;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(138,102,58,${(0.05 + Math.random() * 0.11) * cfg.manchas})`);
      g.addColorStop(1, 'rgba(150,116,70,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  function envelhecer(ctx) {
    // as beiradas do papel escurecem primeiro — é onde ele mais pega sujeira e sol
    const beira = ctx.createLinearGradient(0, 0, 512, 0);
    beira.addColorStop(0, 'rgba(126,95,55,.28)');
    beira.addColorStop(0.12, 'rgba(126,95,55,0)');
    beira.addColorStop(0.88, 'rgba(126,95,55,0)');
    beira.addColorStop(1, 'rgba(126,95,55,.28)');
    ctx.fillStyle = beira;
    ctx.fillRect(0, 0, 512, 512);
    // fibra: riscos finos e curtos, no sentido do comprimento
    ctx.strokeStyle = 'rgba(120,92,56,.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 400; i++) {
      const x = Math.random() * 512, y = Math.random() * 512, h = 10 + Math.random() * 60;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (Math.random() - .5) * 4, y + h); ctx.stroke();
    }
  }

  // A imagem entra como TINTA, não como foto colada: sem cor, com contraste puxado e num sépia
  // escuro, e por cima do papel em "multiply" — assim o claro dela deixa o papel aparecer e só o
  // escuro marca, que é como funciona qualquer coisa desenhada numa folha.
  function desenharImagem(ctx, cfg, img) {
    const comprimento = cfg.altura + Math.PI * cfg.raioDoRolo;
    const larguraPx = 512 * cfg.imagemTamanho;
    // a textura cobre uma folha mais comprida do que larga; pra imagem sair quadrada NO PAPEL ela
    // tem que sair achatada aqui, na mesma proporção
    const alturaPx = larguraPx * (cfg.largura / comprimento);
    const fora = document.createElement('canvas');
    fora.width = Math.ceil(larguraPx); fora.height = Math.ceil(alturaPx);
    const fctx = fora.getContext('2d');
    // contraste e brilho altos demais estouram os claros da foto: como a composição é "multiply",
    // tudo que chega no branco simplesmente deixa o papel passar e SOME — era assim que o alto da
    // cabeça (o ponto mais claro da imagem) desaparecia, e o resto do rosto achatava. Escurecendo
    // um tiquinho, o branco vira um cinza claro que ainda marca o papel.
    fctx.filter = 'grayscale(1) contrast(1.08) brightness(0.88) sepia(0.85)';
    fctx.drawImage(img, 0, 0, fora.width, fora.height);
    ctx.save();
    ctx.globalAlpha = cfg.imagemForca;
    ctx.globalCompositeOperation = 'multiply';
    // o desenho mora na face de TRÁS da folha (ver montar), e de lá o UV é lido espelhado — então
    // ele já entra espelhado aqui, pra sair na posição certa de quem olha
    ctx.translate(512, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(fora, (512 - larguraPx) / 2, (512 - alturaPx) / 2, larguraPx, alturaPx);
    ctx.restore();
  }

  // comImagem: só a folha leva o desenho. O rolo usa a mesma receita sem ele — senão a imagem
  // apareceria repetida, torta, em volta dos varões.
  function texturaDoPapel(cfg, comImagem) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#d8c298';
    ctx.fillRect(0, 0, 512, 512);
    manchas(ctx, cfg, 60);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    // o resto das manchas vai DEPOIS do desenho, pra ele ficar dentro do papel e não em cima dele
    const terminar = () => { manchas(ctx, cfg, 30); envelhecer(ctx); tex.needsUpdate = true; };
    if (comImagem && cfg.imagem) {
      const img = new Image();
      img.onload = () => { desenharImagem(ctx, cfg, img); terminar(); };
      img.onerror = () => terminar(); // sem a imagem o pergaminho continua, só em branco
      img.src = cfg.imagem;
    } else {
      terminar();
    }
    return tex;
  }

  // O recorte da beirada rasgada, de 0 a 1: uma soma de senos de frequências que não se encaixam,
  // o que dá um vaivém sem repetição visível — dentes grandes com dentinhos por cima. Nunca passa
  // de zero pra baixo porque rasgar só TIRA papel, nunca acrescenta.
  function recorte(t, semente) {
    return (Math.sin(t * 31.4 + semente) * 0.5
      + Math.sin(t * 77.7 + semente * 2.7) * 0.3
      + Math.sin(t * 149.3 + semente * 5.3) * 0.2 + 1) / 2;
  }

  // A tira de papel, percorrida de baixo pra cima. O caminho dela no perfil (visto de lado) é
  // sempre o mesmo: um quarto de volta no varão de baixo, um trecho reto na frente dos dois, e um
  // quarto de volta no varão de cima. "s" é quanto de papel já foi percorrido nesse caminho.
  //
  // Abrir é só refazer esse caminho com outros dois números: C (metade do trecho reto) e R (a
  // grossura do rolo). A malha é sempre a mesma — os vértices só mudam de lugar.
  // A folha é desenhada DUAS vezes, com a mesma geometria: uma malha só pra frente, com o desenho,
  // e outra só pro verso, com papel limpo. Com um material de dois lados (DoubleSide) o verso
  // mostrava a mesma textura espelhada — o desenho aparecia do lado de trás, invertido.
  function folha(cfg, frente, verso) {
    const L = cfg.largura;
    const geo = new THREE.PlaneGeometry(L, 1, 60, 150); // o x e o y saem reescritos a cada quadro
    const pos = geo.attributes.position;
    const aoLongo = new Float32Array(pos.count);  // onde cada vértice fica na tira, de 0 a 1
    const aoLargo = new Float32Array(pos.count);  // e na largura dela, de 0 a 1
    for (let i = 0; i < pos.count; i++) {
      aoLongo[i] = pos.getY(i) + 0.5;
      aoLargo[i] = pos.getX(i) / L + 0.5;
    }
    // o comprimento do papel inteiro: o trecho reto de quando está todo aberto, mais o quarto de
    // volta que sobra em cada varão. O UV da malha já nasce medindo isso, então a textura (e a
    // imagem que for escrita nela) fica presa ao papel e não escorrega enquanto ele abre
    const comprimentoAberto = cfg.altura + Math.PI * cfg.raioDoRolo;
    const malha = new THREE.Group();
    malha.add(new THREE.Mesh(geo, frente), new THREE.Mesh(geo, verso));

    // C = metade do trecho reto; R = raio do rolo; espessura = o quanto o papel afunda a cada
    // volta que dá em torno do varão.
    //
    // O ponto de partida é: cada vértice tem um lugar FIXO no papel (aoLongo), e é esse lugar que
    // decide onde ele fica no espaço — não o contrário. Por isso o papel que já saiu não se mexe
    // mais quando o pergaminho abre: só entra papel novo, que estava enrolado. (Antes eu espalhava
    // a malha ao longo do caminho de cada instante, e aí o papel inteiro escorregava do meio pras
    // pontas — dava a impressão de uma folha esticando, não de um rolo desenrolando.)
    malha.remontar = (C, R, espessura) => {
      for (let i = 0; i < pos.count; i++) {
        // a largura não é a mesma em toda a altura: as duas beiradas são rasgadas, e o recorte
        // anda com o papel (ele depende de onde o ponto está NA TIRA, não de onde está na tela) —
        // por isso o mesmo rasgo continua no mesmo pedaço de papel enquanto o pergaminho abre
        const t = aoLongo[i];
        const esquerda = -L / 2 + cfg.rasgado * recorte(t, 0);
        const direita = L / 2 - cfg.rasgado * recorte(t, 8.6);
        const x = esquerda + aoLargo[i] * (direita - esquerda);

        const p = (t - 0.5) * comprimentoAberto; // a que distância do meio do papel esse ponto está
        const lado = p < 0 ? -1 : 1, d = Math.abs(p);
        let y, z;
        if (d <= C) {                        // ainda solto, pendurado entre os dois varões
          y = p; z = R;
        } else {                             // já enrolado: dá a volta no varão, afundando um
          const ang = (d - C) / R;           // pouco a cada volta até sumir dentro do rolo
          const raio = Math.max(0.002, R - espessura * ang / (Math.PI * 2));
          y = lado * (C + raio * Math.sin(ang));
          z = raio * Math.cos(ang);
        }
        // as rugas só valem no papel solto, e somem chegando no rolo (lá ele está apertado). A
        // medida de folga é a altura CHEIA: quase fechado, o pedaço solto é curto demais pra
        // enrugar — o papel ainda está preso entre os dois rolos
        const folgado = suave(limitar((C - d) / (cfg.altura * 0.2)));
        const u = x / L;                     // -0.5 numa beirada, +0.5 na outra
        const ruga = Math.sin(u * Math.PI * 2 * cfg.ondas) * 0.62
          + Math.sin(u * Math.PI * 2 * cfg.ondas * 1.7 + 2.1) * 0.38;
        const beirada = Math.pow(Math.abs(u * 2), 3); // as pontas do papel enrolam um tiquinho pra frente
        pos.setXYZ(i, x, y, z + (ruga + beirada * 1.1) * cfg.ondulacao * folgado);
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    };
    return malha;
  }

  // ---- os varões ----
  // O perfil do torneado, da beirada do papel até a ponta: [raio, distância], os dois de 0 a 1.
  // O raio vai em medidas do rolo (1 = a grossura do papel enrolado) e a distância, da saliência.
  const TORNEADO = [
    [0.46, 0.00], [0.46, 0.04],   // o colar que segura a beirada do papel
    [0.82, 0.08], [0.84, 0.17], [0.64, 0.23],  // o bojo grande, colado no rolo
    [0.30, 0.28], [0.28, 0.40],   // o pescoço fino
    [0.52, 0.46], [0.72, 0.56], [0.64, 0.67], [0.42, 0.73],  // a segunda bola
    [0.26, 0.79],
    [0.48, 0.85], [0.44, 0.93],   // o capuz da ponta
    [0.19, 0.99], [0.00, 1.00]
  ];

  function ponteira(cfg, material) {
    const perfil = TORNEADO.map(([r, t]) =>
      new THREE.Vector2(Math.max(0.001, r * cfg.raioDoRolo), t * cfg.saliencia));
    const m = new THREE.Mesh(new THREE.LatheGeometry(perfil, 28), material);
    m.geometry.computeVertexNormals();
    return m;
  }

  function varao(cfg, madeira, papel) {
    const g = new THREE.Group();
    const R = cfg.raioDoRolo, L = cfg.largura;
    const rolo = new THREE.Mesh(new THREE.CylinderGeometry(R, R, L, 48, 1, true), papel);
    rolo.rotation.z = Math.PI / 2;
    g.rolo = rolo; // quem abre engorda e afina ele
    g.add(rolo);
    const haste = new THREE.Mesh(
      new THREE.CylinderGeometry(cfg.raioDaHaste, cfg.raioDaHaste, L + cfg.saliencia * 2, 20), madeira);
    haste.rotation.z = Math.PI / 2;
    g.add(haste);
    for (const lado of [-1, 1]) {
      const p = ponteira(cfg, madeira);
      p.position.x = lado * L / 2;
      p.rotation.z = lado * -Math.PI / 2; // o lathe nasce em pé; deita ele pro lado certo
      g.add(p);
    }
    return g;
  }

  function montar(cfg) {
    // o lado de ler é aquele em que os varões ficam NA FRENTE do papel — na malha, a face de trás.
    // O outro lado fica com papel limpo.
    const papelLimpo = texturaDoPapel(cfg, false);
    const frente = new THREE.MeshStandardMaterial({
      map: papelLimpo, roughness: 0.95, metalness: 0, side: THREE.FrontSide
    });
    const verso = new THREE.MeshStandardMaterial({
      map: texturaDoPapel(cfg, true), roughness: 0.95, metalness: 0, side: THREE.BackSide
    });
    const papelDoRolo = new THREE.MeshStandardMaterial({
      map: papelLimpo, roughness: 0.95, metalness: 0, side: THREE.DoubleSide
    });
    const madeira = new THREE.MeshStandardMaterial({
      color: 0xb98d4e, roughness: 0.45, metalness: 0.3
    });
    const g = new THREE.Group();
    const malha = folha(cfg, frente, verso);
    const cima = varao(cfg, madeira, papelDoRolo), baixo = varao(cfg, madeira, papelDoRolo);
    g.add(malha, cima, baixo);

    // abertura: 0 = fechado (os dois rolos gordos, encostados um no outro), 1 = aberto de todo.
    // O papel não aparece nem some — ele sai de dentro dos rolos, que afinam na mesma medida; por
    // isso o raio encolhe conforme abre. Em 1 tudo bate com o objeto parado: rolo no raio de
    // sempre e o trecho reto valendo a altura cheia.
    const espessura = Math.max(0.004, cfg.raioDoRolo * 0.09);
    g.abrir = quanto => {
      const a = limitar(quanto);
      const R = cfg.raioDoRolo * (1 + cfg.engorda * (1 - a));
      const C = R + a * (cfg.altura / 2 - cfg.raioDoRolo); // metade do trecho reto
      malha.remontar(C, R, espessura);
      // o miolo do rolo (o papel que já deu voltas demais pra se ver) fica uma espessura mais
      // fino que a tira, senão os dois brigariam pelo mesmo lugar na linha em que ela encosta
      const grossura = (R - espessura) / cfg.raioDoRolo;
      for (const [varaoDoLado, lado] of [[cima, 1], [baixo, -1]]) {
        varaoDoLado.position.y = lado * C;
        varaoDoLado.rolo.scale.set(grossura, 1, grossura);
      }
    };
    g.abrir(1);
    return g;
  }

  // ---- a luz (mesmo esquema das outras cenas: quente na frente, fria por trás) ----
  function iluminar(cena, cfg) {
    // o papel é claro por natureza: com luz forte ele satura e vira uma chapa branca, sem mancha
    // nenhuma à vista. Daí a luz aqui ser mais baixa que a das outras cenas.
    cena.add(new THREE.AmbientLight(0xffffff, 0.38 * cfg.brilho));
    const luz = new THREE.DirectionalLight(0xfff2d8, 0.68 * cfg.brilho);
    luz.position.set(-3, 5, 6);
    cena.add(luz);
    const contraluz = new THREE.DirectionalLight(0xbcd2ff, 0.32 * cfg.brilho);
    contraluz.position.set(3, 2, -6);
    cena.add(contraluz);
  }

  // ---- a cena: o pergaminho abrindo sozinho no meio da tela ----
  function criar(opcoes) {
    if (typeof THREE === 'undefined') return null;
    const cfg = Object.assign({}, PADRAO, opcoes || {});

    const caixa = document.createElement('div');
    caixa.className = 'pergaminho-3d';
    const L = Math.max(1, window.innerWidth), A = Math.max(1, window.innerHeight);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(1);
    const densidade = window.devicePixelRatio || 1;
    renderer.setSize(Math.ceil(L * densidade / cfg.pixel), Math.ceil(A * densidade / cfg.pixel), false);
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;'
      + (cfg.pixel > 1 ? 'image-rendering:pixelated' : '');
    caixa.appendChild(renderer.domElement);

    const cena = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, L / A, 0.1, 100);
    camera.position.set(0, 0, cfg.distancia);
    iluminar(cena, cfg);

    const grupo = new THREE.Group();
    const pergaminho = montar(cfg);
    pergaminho.rotation.y = Math.PI; // vira o lado do desenho pra câmera
    grupo.add(pergaminho);
    grupo.scale.setScalar(cfg.escala);
    cena.add(grupo);

    // a linha do tempo, marcando o FIM de cada trecho
    const fimDaEntrada = cfg.entrada;
    const fimDaAbertura = fimDaEntrada + cfg.duracao;
    const fimDaMostra = fimDaAbertura + cfg.mostra;
    const fimDoFecho = fimDaMostra + cfg.fechar;
    const duracaoTotal = fimDoFecho + cfg.saida;
    const desacelera = t => 1 - Math.pow(1 - t, 3); // chega freando
    const acelera = t => t * t * t;                 // e sai embalando

    function posicionar(tempo) {
      let x = 0, abertura = 0;
      if (tempo < fimDaEntrada) {
        x = cfg.origemX * (1 - desacelera(limitar(tempo / cfg.entrada)));
      } else if (tempo < fimDaAbertura) {
        abertura = cfg.aberturaMaxima * suave(limitar((tempo - fimDaEntrada) / cfg.duracao));
      } else if (tempo < fimDaMostra) {
        abertura = cfg.aberturaMaxima;
      } else if (tempo < fimDoFecho) {
        abertura = cfg.aberturaMaxima * (1 - suave(limitar((tempo - fimDaMostra) / cfg.fechar)));
      } else {
        x = cfg.origemX * acelera(limitar((tempo - fimDoFecho) / cfg.saida));
      }
      pergaminho.abrir(abertura);
      grupo.position.set(x, cfg.alturaNaTela + Math.sin(tempo * 0.9) * 0.04, 0);
      grupo.rotation.z = Math.sin(tempo * 1.1) * cfg.balanco * Math.PI / 180;
    }

    let parado = false, pausado = false, comeco = null, instante = 0;
    function quadro(agora) {
      if (parado) return;
      if (comeco === null) comeco = agora;
      if (!pausado) instante = (agora - comeco) / 1000;
      posicionar(instante);
      renderer.render(cena, camera);
      requestAnimationFrame(quadro);
    }
    posicionar(0);
    requestAnimationFrame(quadro);

    caixa.duracaoTotal = duracaoTotal;
    caixa.pausar = () => { pausado = true; };
    caixa.irPara = t => { instante = t; posicionar(t); renderer.render(cena, camera); };
    caixa.parar = () => { parado = true; renderer.dispose(); };
    return caixa;
  }

  // ---- a vitrine: o pergaminho parado, pra girar, chegar perto e deslocar ----
  function criarVitrine(opcoes) {
    if (typeof THREE === 'undefined') return null;
    const cfg = Object.assign({}, PADRAO, opcoes || {});
    const caixa = document.createElement('div');
    caixa.className = 'pergaminho-vitrine-3d';
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    const tela = renderer.domElement;
    tela.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;cursor:grab';
    caixa.appendChild(tela);

    const cena = new THREE.Scene();
    iluminar(cena, cfg);
    const giro = new THREE.Group();
    const pergaminho = montar(cfg);
    giro.add(pergaminho);
    giro.rotation.set(0.05, Math.PI - 0.35, 0); // já abre virado pro lado que tem o desenho
    cena.add(giro);
    const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 100);
    const alcance = new THREE.Box3().setFromObject(giro).getBoundingSphere(new THREE.Sphere()).radius;

    const medir = () => {
      const l = Math.max(1, caixa.clientWidth), a = Math.max(1, caixa.clientHeight);
      renderer.setSize(l, a, false);
      camera.aspect = l / a;
      camera.updateProjectionMatrix();
    };
    new ResizeObserver(medir).observe(caixa);

    // girar, chegar perto e deslocar — o mesmo manuseio das outras vitrines, em vitrine-3d.js
    const controles = Vitrine3D.manusear({ tela, caixa, camera, giro, inclinacaoMax: 0.7, embalo: 0.05 });
    controles.enquadrar(alcance / Math.sin((camera.fov / 2) * Math.PI / 180) * 1.1);

    let parado = false;
    function quadro(agora) {
      if (parado) return;
      controles.aoQuadro();
      giro.position.y = Math.sin(agora * 0.0012) * 0.015;
      renderer.render(cena, camera);
      requestAnimationFrame(quadro);
    }
    requestAnimationFrame(quadro);

    caixa.parar = () => { parado = true; renderer.dispose(); };
    caixa.abrir = quanto => pergaminho.abrir(quanto);
    // toca a abertura uma vez, do fechado ao aberto. Devolve uma função que interrompe no meio.
    caixa.tocarAbertura = () => {
      const comeco = performance.now();
      let vivo = true;
      const passo = agora => {
        if (!vivo || parado) return;
        const t = limitar((agora - comeco) / (cfg.duracao * 1000));
        pergaminho.abrir(suave(t)); // devagar no começo e no fim, solto no meio
        if (t < 1) requestAnimationFrame(passo);
      };
      requestAnimationFrame(passo);
      return () => { vivo = false; };
    };
    return caixa;
  }

  return { criar, criarVitrine, montar, iluminar, PADRAO };
})();

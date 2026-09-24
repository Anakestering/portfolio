// =====================================================================
// A caravela do século XV em 3D.
//
// O texto fala de Gutenberg e das caravelas portuguesas nas Grandes
// Navegações — o Atlântico virando rota em vez de fronteira. A cena é só o
// barco passando de um lado a outro da tela, baixo, no mesmo lugar onde
// ficaria a muralha do século III — sem mar, sem chão, só ele mesmo
// balançando como quem enfrenta onda; a vitrine (clicada na estante) é só
// ele, parado, pra girar arrastando e ver de perto.
//
// O modelo é pronto — "ship-large" do Pirate Kit da Kenney (kenney.nl,
// licença CC0, não precisa creditar) — mas o casco e as velas dele são
// baixo-poli demais pra aguentar de perto: aqui eles ganham tábuas e uma
// linha d'água no casco, e um pano fino e curvado (com cara de tecido de
// verdade) nas velas. Ver melhorarCasco/melhorarVela.
// =====================================================================
const Barco3D = (function () {
  const PADRAO = {
    // o barco
    escala: 0.34,        // tamanho do modelo na cena (o arquivo vem grande — ~13m de proa a popa)
    distancia: 10,         // profundidade fixa até a câmera
    origemX: -11,           // de onde ele entra (esquerda)
    destinoX: 11,           // até onde ele sai (direita)
    altura: -1.9,           // onde ele passa, na vertical — baixo na tela, como a muralha do III
    anguloExtra: 18,        // gira um pouco além do rumo, pra ver de 3/4 e não só de perfil
    balancoAltura: 0.055,   // sobe e desce com a onda
    balancoGiro: 5,         // e balança pros lados (graus)
    balancoVelocidade: 1.6,
    duracao: 5.5,
    // o acabamento
    brilho: 1.1,
    pixel: 1
  };

  const suave = x => x * x * (3 - 2 * x);
  const limitar = x => Math.min(1, Math.max(0, x));

  // ---- o modelo: baixado em segundo plano, depois que o site abre ----
  const ARQUIVO_MODELO = 'assets/modelos/barco-caravela.glb';
  let modeloBase = null;
  const aoCarregar = [];
  function carregarModelo() {
    if (typeof THREE === 'undefined' || typeof THREE.GLTFLoader === 'undefined' || modeloBase) return;
    new THREE.GLTFLoader().load(ARQUIVO_MODELO, gltf => {
      melhorarBarco(gltf.scene);
      modeloBase = gltf.scene;
      aoCarregar.forEach(fn => fn());
      aoCarregar.length = 0;
    }, undefined, erro => console.error('[barco] não consegui carregar o modelo', erro));
  }
  window.addEventListener('load', () => {
    if (window.requestIdleCallback) requestIdleCallback(carregarModelo, { timeout: 2000 });
    else setTimeout(carregarModelo, 500);
  });

  // ---- deixando o casco e as velas do kit prontas menos cruas ----

  // O casco NÃO é uma cor só: o UV original do modelo pinta o janelinha lateral, a moldura de
  // madeira na popa, os degraus e o buraco de entrada cada um puxando um pedaço diferente da
  // paleta (a "colormap") — inclusive um contorno escuro em volta da janela e da moldura. Trocar
  // essa textura por uma nova (como eu tinha feito) apaga tudo isso e pinta o casco inteiro de um
  // marrom só. A tábua tem que entrar por CIMA disso, sem tocar no UV nem na textura original.
  //
  // O jeito certo: um MAPA DE OCLUSÃO (aoMap) — uma segunda textura, num segundo canal de UV
  // (uv2), que só ESCURECE o que já está pintado, sem substituir a cor de nada. Cinza claro = não
  // mexe; mais escuro = escurece ali. É onde entram as juntas das tábuas e a linha d'água.
  //
  // O casco é baixo-poli: cada tábua teria só 2 vértices (topo e base), sem nenhum no meio — cor
  // por VÉRTICE não segura uma linha fina, ela se perde interpolada no meio do caminho. Por isso
  // as juntas vão nessa textura (lida por pixel); só a mancha de madeira, que não precisa ser
  // nítida, continua em cor de vértice.
  function texturaDeTabuas(alturaTotal, alturaDoCasco) {
    const ALTO = 512, LARGO = 12;
    const c = document.createElement('canvas');
    c.width = LARGO; c.height = ALTO;
    const ctx = c.getContext('2d');
    const linhaDoCasco = ALTO * (alturaDoCasco / alturaTotal);
    const PASSO_PX = 14, AGUA_PX = ALTO * 0.1, TRANSICAO_PX = ALTO * 0.05;
    for (let y = 0; y < ALTO; y++) {
      // acima da linha do casco (mastro/verga) a textura não faz nada — fica branca (255)
      const ehCasco = 1 - suave(limitar((y - (linhaDoCasco - TRANSICAO_PX)) / TRANSICAO_PX));
      let v = 255;
      if (ehCasco > 0.1) {
        const fase = y % PASSO_PX, distDaJunta = Math.min(fase, PASSO_PX - fase);
        const junta = 1 - Math.pow(limitar(1 - distDaJunta / 2), 3); // 1 bem na linha da junta
        v -= 46 * junta * ehCasco;
        if (y > linhaDoCasco - AGUA_PX) { // as últimas tábuas antes do mastro = perto da quilha
          v -= 40 * ehCasco * suave((y - (linhaDoCasco - AGUA_PX)) / AGUA_PX);
        }
      }
      ctx.fillStyle = `rgb(${v | 0},${v | 0},${v | 0})`;
      ctx.fillRect(0, y, LARGO, 1);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.flipY = false;                     // v=0 é a quilha, como no cálculo do UV2 abaixo
    tex.wrapS = THREE.RepeatWrapping;      // no sentido U a cor não muda — qualquer valor serve
    tex.wrapT = THREE.ClampToEdgeWrapping; // não repete verticalmente: é uma imagem só, ponta a ponta
    return tex;
  }

  // A moldura da janela, os degraus e a beirada do casco não têm uma cor PRÓPRIA no arquivo — é
  // tudo pintado do mesmo laranja, só que a folha de cores original tem um degradê "de luz"
  // pintado junto (mais claro numa ponta, mais escuro na outra), e é esse degradê que faz essas
  // peças lerem como "mais claras": bordas, beiradas e detalhes grossos caem, por acaso da forma
  // deles, do lado claro do degradê. Dá pra usar isso: quanto mais claro o pixel que o UV
  // ORIGINAL de um vértice aponta, mais essa peça é "beirada/detalhe" — e mais ela escurece.
  function leitorDaFolhaDeCores(imagem) {
    const c = document.createElement('canvas');
    c.width = imagem.width; c.height = imagem.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(imagem, 0, 0);
    const dados = ctx.getImageData(0, 0, c.width, c.height).data;
    return (u, v) => {
      const x = Math.min(c.width - 1, Math.max(0, Math.round(u * (c.width - 1))));
      const y = Math.min(c.height - 1, Math.max(0, Math.round(v * (c.height - 1))));
      const i = (y * c.width + x) * 4;
      return [dados[i], dados[i + 1], dados[i + 2]];
    };
  }

  function melhorarCasco(malha, materialDaVelaDeProa, pixelDaFolha) {
    // o casco, as velas e as bandeirinhas do modelo compartilham UM material só (assim o kit sai
    // mais leve) — mexer nele direto pintaria as velas e as bandeiras junto. Separa uma cópia só
    // pro casco antes de mudar qualquer coisa. O mapa original (material.map) e o UV original da
    // geometria continuam intactos.
    const materialDoCasco = malha.material.clone();
    const materialDoRelevo = malha.material.clone();
    const geo = malha.geometry;
    const pos = geo.attributes.position;
    const uvOriginal = geo.attributes.uv;
    const indices = geo.index;
    const brilhoOriginal = (u, v) => { const p = pixelDaFolha(u, v); return (p[0] + p[1] + p[2]) / 3; };

    geo.computeBoundingBox();
    const alturaTotal = geo.boundingBox.max.y; // do zero (quilha) até o alto do mastro
    // acima da linha do convés já não é o corpo do casco: é amurada, castelo de popa, mastro. Lá a
    // tábua não entra — o casco planqueado é o que fica abaixo dela
    const TOPO_DO_CASCO = 2.9;
    const ESCURO = 0.16; // bem mais escuro que o casco, mas não chapado de preto
    const LIMIAR_BAIXO = 150, LIMIAR_ALTO = 195; // faixa de brilho onde vira "beirada"
    // o degradê da paleta não é contínuo: ele dá um salto do laranja do casco (o mais claro deles
    // bate em 160 de brilho) pra uma família bem mais lavada, que começa em 165 — e é essa família
    // que as peças em relevo pegam. Esse vão é o corte natural entre "casco" e "relevo"
    const LIMIAR_DO_RELEVO = 162;
    // quanto cada vértice é "beirada", de 0 a 1 (ver o comentário acima da função)
    const beiradas = new Float32Array(pos.count);
    const ehRelevo = [];
    for (let i = 0; i < pos.count; i++) {
      const b = brilhoOriginal(uvOriginal.getX(i), uvOriginal.getY(i));
      beiradas[i] = suave(limitar((b - LIMIAR_BAIXO) / (LIMIAR_ALTO - LIMIAR_BAIXO)));
      ehRelevo.push(b > LIMIAR_DO_RELEVO);
    }

    // A vela triangular da proa não é uma malha à parte: ela faz parte do casco. E não é madeira —
    // na folha de cores ela é branca, bem no ponto em que o "beirada" escurece de propósito (ele
    // parte do princípio de que claro = detalhe em relevo da madeira). Era por isso que ela saía
    // preta. Separada daqui, ela fica com a lona das velas. O que a identifica: é branca na paleta
    // E fica em cima do eixo do barco (as outras peças brancas são largas).
    const daVelaDeProa = i => {
      const p = pixelDaFolha(uvOriginal.getX(i), uvOriginal.getY(i));
      return p[0] - p[2] < 30 && (p[0] + p[1] + p[2]) / 3 > 150 && Math.abs(pos.getX(i)) < 0.5;
    };
    // As tábuas são do casco, e só dele: nos relevos (a moldura da janela, as peças atravessadas da
    // popa, a borda de cima do costado, o leme) a listra não faz sentido. Quem decide isso é o
    // TRIÂNGULO, não o vértice: um relevo divide vértices com o casco em volta, então fazendo por
    // vértice a listra entrava pela metade da peça — era esse o meio-termo que aparecia. E basta
    // UM vértice de relevo pro triângulo inteiro sair: nas quinas da peça é justamente o triângulo
    // de transição, com um pé em cada lado, que deixava a listra escapar por cima do relevo.
    const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
    const areaDo = tri => {
      A.fromBufferAttribute(pos, tri[0]); B.fromBufferAttribute(pos, tri[1]); C.fromBufferAttribute(pos, tri[2]);
      return B.sub(A).cross(C.sub(A)).length() / 2;
    };
    const AREA_DO_DETALHE = 0.35;
    const doCasco = [], daVela = [], doRelevo = [], velaDeProa = new Set();
    for (let t = 0; t < indices.count; t += 3) {
      const tri = [indices.getX(t), indices.getX(t + 1), indices.getX(t + 2)];
      if (tri.filter(daVelaDeProa).length >= 2) { daVela.push(...tri); tri.forEach(i => velaDeProa.add(i)); }
      else if (tri.some(i => ehRelevo[i]) || areaDo(tri) < AREA_DO_DETALHE) doRelevo.push(...tri);
      else doCasco.push(...tri);
    }

    // uv2.x guarda o quanto de "beirada" o vértice tem (0 a 1) — reaproveitado como um canal
    // extra, porque a textura das tábuas é a mesma em qualquer U (só muda com a altura, no V), daí
    // sobra o U pra carregar esse valor sem atrapalhar a amostra da textura em si.
    const uv2 = [], cores = [];
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const tabua = Math.floor(y / 0.34);
      const variacao = 0.95 + 0.06 * (Math.sin(tabua * 12.9898) * 0.5 + 0.5); // mancha de madeira, bem de leve
      uv2.push(beiradas[i], y / alturaTotal);
      const tom = ESCURO * beiradas[i] + variacao * (1 - beiradas[i]);
      cores.push(tom, tom, tom * 0.99);
    }
    geo.setAttribute('uv2', new THREE.Float32BufferAttribute(uv2, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cores, 3));

    // UV nova só pros vértices da vela de proa (o resto continua apontando pra folha de cores):
    // ela é um plano em pé, então u corre no comprimento (Z) e v na altura (Y)
    const uv = Array.from(uvOriginal.array);
    let minY = Infinity, maxY = -Infinity, minZ = Infinity;
    for (const i of velaDeProa) {
      minY = Math.min(minY, pos.getY(i)); maxY = Math.max(maxY, pos.getY(i));
      minZ = Math.min(minZ, pos.getZ(i));
    }
    for (const i of velaDeProa) {
      uv[i * 2] = (pos.getZ(i) - minZ) * COSTURAS_POR_UNIDADE;
      uv[i * 2 + 1] = (pos.getY(i) - minY) / Math.max(0.001, maxY - minY);
    }
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    // os triângulos são reagrupados (casco, vela, relevos) pra cada grupo ter o seu material
    geo.setIndex([...doCasco, ...daVela, ...doRelevo]);
    geo.clearGroups();
    geo.addGroup(0, doCasco.length, 0);
    geo.addGroup(doCasco.length, daVela.length, 1);
    geo.addGroup(doCasco.length + daVela.length, doRelevo.length, 2);

    materialDoCasco.aoMap = texturaDeTabuas(alturaTotal, TOPO_DO_CASCO);
    materialDoCasco.vertexColors = true;
    // o "aoMap" do three.js só escurece a luz AMBIENTE — nesta cena, fraca perto das duas luzes
    // direcionais, então quase não se via. Pra ele valer nas luzes direcionais também, entra por
    // cima do resultado do color_fragment (a cor de base, antes de qualquer luz ser aplicada) —
    // a mesma ideia de "multiplica a cor final" usada na pele do soldado, em muralha-3d.js. Na
    // beirada (vUv2.x alto) a mistura vai pra 1.0 — sem tábua nenhuma ali, só a cor escura já
    // aplicada na cor de vértice.
    materialDoCasco.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>',
        '#include <color_fragment>\n\t#ifdef USE_AOMAP\n\tdiffuseColor.rgb *= mix( texture2D( aoMap, vUv2 ).rgb, vec3( 1.0 ), vUv2.x );\n\t#endif');
    };
    materialDoCasco.needsUpdate = true;
    // os relevos ficam sem o mapa das tábuas — daí não há listra nenhuma pra desenhar neles. A cor
    // escura deles continua vindo da cor de vértice, como antes.
    materialDoRelevo.vertexColors = true;
    materialDoRelevo.needsUpdate = true;
    malha.material = [materialDoCasco, materialDaVelaDeProa, materialDoRelevo];
  }

  // comCostura = as listras verticais que unem os "panos" de lona. Numa vela grande elas contam a
  // história de como a vela foi costurada; numa pequena viram só listra, então lá entra só o grão.
  function texturaDoTecido(comCostura) {
    const c = document.createElement('canvas');
    c.width = 48; c.height = 72;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f4efe4';
    ctx.fillRect(0, 0, c.width, c.height);
    if (comCostura) {
      ctx.strokeStyle = 'rgba(95,80,58,.6)';
      ctx.lineWidth = 1.4;
      for (let x = 6; x < c.width; x += 9) { ctx.beginPath(); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, c.height); ctx.stroke(); }
    }
    for (let i = 0; i < 700; i++) { // grão do tecido
      ctx.fillStyle = `rgba(${90 + Math.random() * 40},${75 + Math.random() * 35},${55 + Math.random() * 30},${Math.random() * .1})`;
      ctx.fillRect(Math.random() * c.width, Math.random() * c.height, 1, 1);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // quantas vezes o tecido se repete por unidade do modelo. Vale pra tudo que é pano (as duas
  // velas grandes, a vela de proa e as bandeirinhas), pra costura sair do mesmo tamanho em todas
  const COSTURAS_POR_UNIDADE = 0.545;

  // A vela do arquivo é uma casca fechada, curvada em C, e ela NÃO é só pano: as duas vigas de
  // madeira onde o pano fica amarrado — uma em cima e outra embaixo, passando na frente do mastro
  // — fazem parte da MESMA malha (é uma barra de seção octogonal em cada ponta). Essa forma já é
  // a forma certa; o que pesava era só a grossura da casca: uns 0.34 de fundo, que lê como uma
  // placa. Empurrar o Z inteiro pro meio (o que eu fazia antes) achatava tudo junto — esmagava as
  // vigas até sumirem dentro do mastro e ainda descolava o pano delas.
  //
  // Então a forma não se mexe. Os triângulos de madeira ficam intocados, com o material original
  // do modelo; os de pano ganham a lona nova. Pra afinar, só a face de DENTRO da casca é puxada na
  // direção da de fora — a de fora não anda um milímetro, então a barriga da curva e a silhueta
  // continuam exatamente as do arquivo. Perto das vigas o afinamento vai a zero, senão o pano
  // descola da amarração.
  //
  // Quem é madeira e quem é pano: no arquivo nada tem cor própria (o barco inteiro divide uma
  // folha de cores só), mas o UV de cada vértice aponta pro pedaço certo dela — laranja na viga,
  // branco no pano. É só olhar que cor o UV original pega.
  function melhorarVela(malha, materialDoPano, pixelDaFolha) {
    const geo = malha.geometry.clone();
    const pos = geo.attributes.position, uvOriginal = geo.attributes.uv, indices = geo.index;
    const ehMadeira = i => {
      const p = pixelDaFolha(uvOriginal.getX(i), uvOriginal.getY(i));
      return p[0] - p[2] > 30; // laranja: muito mais vermelho que azul
    };
    const dePano = [], deMadeira = [], pano = new Set();
    for (let t = 0; t < indices.count; t += 3) {
      const tri = [indices.getX(t), indices.getX(t + 1), indices.getX(t + 2)];
      if (tri.filter(ehMadeira).length >= 2) deMadeira.push(...tri);
      else { dePano.push(...tri); tri.forEach(i => pano.add(i)); }
    }

    const listaDePano = [...pano];
    const zDeAntes = new Float32Array(pos.count);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const i of listaDePano) {
      zDeAntes[i] = pos.getZ(i);
      minX = Math.min(minX, pos.getX(i)); maxX = Math.max(maxX, pos.getX(i));
      minY = Math.min(minY, pos.getY(i)); maxY = Math.max(maxY, pos.getY(i));
    }
    const altura = Math.max(0.001, maxY - minY);
    const ESPESSURA = 0.35;         // o quanto sobra da grossura da casca no meio da vela
    // no arquivo a vela nasce enfiada no mastro (a viga de baixo fica dentro dele) — empurrada pra
    // frente, ela encosta no mastro em vez de atravessá-lo, que é como uma verga é amarrada
    const AFASTA_DO_MASTRO = 0.2;
    const VIZINHANCA = altura * .07; // até essa diferença de altura, dois vértices são "o mesmo ponto da curva"
    const uv = Array.from(uvOriginal.array); // a madeira continua com o UV dela, na folha de cores
    for (const i of listaDePano) {
      const y = pos.getY(i);
      // o ponto mais fundo na mesma altura é a face de fora; a de dentro fica atrás dele
      let fora = -Infinity;
      for (const j of listaDePano) if (Math.abs(pos.getY(j) - y) < VIZINHANCA) fora = Math.max(fora, zDeAntes[j]);
      const t = (y - minY) / altura;
      const longeDaViga = suave(limitar((t - .1) / .15)) * suave(limitar((.9 - t) / .15));
      pos.setZ(i, fora - (fora - zDeAntes[i]) * (1 - (1 - ESPESSURA) * longeDaViga));
      // UV nova, pro tecido: u varre a largura (repetindo o pano algumas vezes), v vai de uma
      // viga à outra — a UV original aponta pra folha de cores, que não serve pra essa textura
      uv[i * 2] = (pos.getX(i) - minX) * COSTURAS_POR_UNIDADE;
      uv[i * 2 + 1] = (y - minY) / altura;
    }
    pos.needsUpdate = true;
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    // os triângulos são reagrupados (pano primeiro, madeira depois) pra cada grupo poder ter o
    // seu material — é o jeito de uma malha só usar dois materiais no three.js
    geo.setIndex([...dePano, ...deMadeira]);
    geo.clearGroups();
    geo.addGroup(0, dePano.length, 0);
    geo.addGroup(dePano.length, deMadeira.length, 1);
    malha.geometry = geo;
    malha.material = [materialDoPano, malha.material]; // 0 = a lona nova, 1 = a madeira do modelo
    malha.translateZ(AFASTA_DO_MASTRO);
  }

  // As bandeirinhas do topo dos mastros são duas coisas na mesma malha: a fita que tremula (uma
  // folha de uma camada só, sem grossura nenhuma pra tirar) e a argola em volta do mastro. A forma
  // não muda — apertar a argola contra o mastro só fazia ela afundar dentro dele, porque a folga
  // entre os dois é mínima (raio 0.175 contra 0.13 do mastro). Só o pano muda, o mesmo das velas.
  function melhorarBandeira(malha, materialDoPano) {
    const geo = malha.geometry.clone();
    const pos = geo.attributes.position;
    geo.computeBoundingBox();
    const b = geo.boundingBox;
    const altura = Math.max(0.001, b.max.y - b.min.y);
    const uv = [];
    for (let i = 0; i < pos.count; i++) {
      // a fita é deitada: u corre no comprimento (Z), v na altura (Y)
      uv.push((pos.getZ(i) - b.min.z) * COSTURAS_POR_UNIDADE, (pos.getY(i) - b.min.y) / altura);
    }
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    malha.geometry = geo;
    malha.material = materialDoPano;
  }

  // roda uma vez só, na cópia que fica em cache — quem usa o barco depois (a cena e a vitrine)
  // clona esse resultado já pronto, sem refazer nada
  function melhorarBarco(cena) {
    const casco = cena.children.find(o => o.name === 'ship-large_1');
    if (!casco) return;
    // o pano das velas grandes e das bandeirinhas, com as costuras; e o mesmo pano liso, sem elas,
    // pra vela de proa — ela é pequena e as listras dominavam
    const materialDoPano = new THREE.MeshStandardMaterial({
      map: texturaDoTecido(true), roughness: .92, metalness: 0, side: THREE.DoubleSide
    });
    const materialDoPanoLiso = new THREE.MeshStandardMaterial({
      map: texturaDoTecido(false), roughness: .92, metalness: 0, side: THREE.DoubleSide
    });
    const pixelDaFolha = leitorDaFolhaDeCores(casco.material.map.image);
    // a vela de proa mora dentro da malha do casco, por isso ela sai de lá
    melhorarCasco(casco, materialDoPanoLiso, pixelDaFolha);
    // velas/bandeiras são filhas do próprio casco no arquivo, não do grupo raiz
    casco.children.forEach(o => {
      if (/^sail-/.test(o.name)) {
        melhorarVela(o, materialDoPano, pixelDaFolha);
        // a vela do mastro do meio nasce alta demais: a verga de cima entra no cesto da gávea (o
        // cone redondo do topo do mastro, que começa ali pela altura 7.7 e ela alcança 7.86)
        if (o.name === 'sail-a') o.translateY(-0.25);
      } else if (/^flag-/.test(o.name)) melhorarBandeira(o, materialDoPano);
    });
  }

  // ---- a luz (mesmo esquema das outras cenas: quente na frente, fria por trás) ----
  function iluminar(cena, cfg) {
    cena.add(new THREE.AmbientLight(0xffffff, 0.6 * cfg.brilho));
    const luz = new THREE.DirectionalLight(0xfff2d8, 1.1 * cfg.brilho);
    luz.position.set(-3, 6, 4);
    cena.add(luz);
    const recorte = new THREE.DirectionalLight(0x9fc8ff, 0.65 * cfg.brilho);
    recorte.position.set(2, 4, -8);
    cena.add(recorte);
  }

  // ---- a cena: só o barco, passando baixo na tela de um lado a outro ----
  function criar(opcoes) {
    if (typeof THREE === 'undefined' || typeof THREE.GLTFLoader === 'undefined') return null;
    const cfg = Object.assign({}, PADRAO, opcoes || {});

    const caixa = document.createElement('div');
    caixa.className = 'barco-3d';
    const L = Math.max(1, window.innerWidth), A = Math.max(1, window.innerHeight);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(1);
    const densidade = window.devicePixelRatio || 1;
    renderer.setSize(Math.ceil(L * densidade / cfg.pixel), Math.ceil(A * densidade / cfg.pixel), false);
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;'
      + (cfg.pixel > 1 ? 'image-rendering:pixelated' : '');
    caixa.appendChild(renderer.domElement);

    const cena = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, L / A, 0.1, 200);
    camera.position.set(0, 1.6, 0);
    iluminar(cena, cfg);

    const grupoBarco = new THREE.Group();
    grupoBarco.position.z = -cfg.distancia;
    cena.add(grupoBarco);
    let barco = null;
    function tentarPorBarco() {
      if (barco || !modeloBase) return;
      barco = modeloBase.clone();
      barco.scale.setScalar(cfg.escala);
      grupoBarco.add(barco);
    }
    tentarPorBarco();

    // rumo: a proa do modelo olha pro +Z local (a ponta fina do casco; a popa, quadrada com a
    // janela, fica pro -Z) — pra "olhar" na direção que ele anda (+X ou -X), vira 90° pro lado
    // certo, e mais um tiquinho (anguloExtra) pra ver de 3/4, não de perfil
    const sentido = cfg.destinoX >= cfg.origemX ? 1 : -1;
    const rumo = (sentido > 0 ? Math.PI / 2 : -Math.PI / 2) + sentido * cfg.anguloExtra * Math.PI / 180;

    function posicionar(tempo) {
      if (!barco) tentarPorBarco();
      const t = limitar(tempo / cfg.duracao);
      grupoBarco.position.x = cfg.origemX + (cfg.destinoX - cfg.origemX) * t;
      const onda = tempo * cfg.balancoVelocidade;
      grupoBarco.position.y = cfg.altura + Math.sin(onda) * cfg.balancoAltura;
      grupoBarco.rotation.z = Math.sin(onda * 0.9 + 1) * cfg.balancoGiro * Math.PI / 180;
      grupoBarco.rotation.x = Math.sin(onda * 1.3) * cfg.balancoGiro * 0.35 * Math.PI / 180;
      grupoBarco.rotation.y = rumo;
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
      renderer.dispose();
      renderer.forceContextLoss();
    }
    requestAnimationFrame(quadro);

    caixa.pausar = () => { parado = true; };
    caixa.parar = parar;
    caixa.irPara = tempo => { posicionar(tempo); renderer.render(cena, camera); };
    caixa.duracaoTotal = cfg.duracao;
    return caixa;
  }

  // ---- a vitrine: só o barco, parado, pra girar arrastando (na estante de troféus) ----
  function criarVitrineDoBarco(opcoes) {
    if (typeof THREE === 'undefined' || typeof THREE.GLTFLoader === 'undefined') return null;
    const cfg = Object.assign({}, PADRAO, opcoes || {});
    const caixa = document.createElement('div');
    // classe própria, diferente da cena (.barco-3d): essa fica DENTRO do palco da vitrine, não
    // cobrindo a tela inteira — ela não pode herdar o position:absolute;inset:0 da outra
    caixa.className = 'barco-vitrine-3d';
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    const tela = renderer.domElement;
    tela.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;cursor:grab';
    caixa.appendChild(tela);

    const cena = new THREE.Scene();
    iluminar(cena, cfg);
    const giro = new THREE.Group();
    cena.add(giro);
    const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 100);

    // girar, chegar perto e deslocar — o mesmo manuseio das outras vitrines, em vitrine-3d.js
    const controles = Vitrine3D.manusear({ tela, caixa, camera, giro, inclinacaoMax: 0.6 });

    let barco = null;
    function tentarMontar() {
      if (barco || !modeloBase) return;
      barco = modeloBase.clone();
      const caixaEnv = new THREE.Box3().setFromObject(barco);
      const centro = caixaEnv.getCenter(new THREE.Vector3());
      barco.position.set(-centro.x, -caixaEnv.min.y, -centro.z);
      giro.add(barco);
      const c2 = new THREE.Box3().setFromObject(barco);
      const meio = c2.getCenter(new THREE.Vector3());
      const raio = c2.getBoundingSphere(new THREE.Sphere()).radius;
      // o enquadramento só dá pra calcular aqui: o barco vem de um arquivo, e antes de ele
      // carregar não há tamanho nenhum pra medir
      controles.enquadrar(raio / Math.sin((camera.fov / 2) * Math.PI / 180) * 1.15, meio.y);
    }
    tentarMontar();

    const medir = () => {
      const l = Math.max(1, caixa.clientWidth), a = Math.max(1, caixa.clientHeight);
      renderer.setSize(l, a, false);
      camera.aspect = l / a;
      camera.updateProjectionMatrix();
    };
    const observador = new ResizeObserver(medir);
    observador.observe(caixa);

    let parado = false;
    function quadro(agora) {
      if (parado) return;
      if (!barco) tentarMontar();
      controles.aoQuadro();
      giro.position.y = Math.sin(agora * 0.0012) * 0.02;
      renderer.render(cena, camera);
      requestAnimationFrame(quadro);
    }
    requestAnimationFrame(quadro);
    caixa.parar = () => {
      if (parado) return;
      parado = true;
      observador.disconnect();
      renderer.dispose();
      renderer.forceContextLoss();
    };
    return caixa;
  }

  return { criar, criarVitrineDoBarco, PADRAO };
})();

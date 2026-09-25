// =====================================================================
// textura de mesa de madeira envelhecida (fundo, atrás do livro) — gerada uma vez via canvas
// em vez de simulada só com gradientes CSS (que ficam chapados/artificiais e não têm como
// desenhar veio orgânico nem rachaduras de verdade). Roda assim que o script carrega, sem
// depender do THREE/fontes — é só uma imagem 2D comum, plugada em --table-bg-img (ver body::before
// em book.css).
function makeWoodTableTexture() {
  const SZ = 512;
  const c = document.createElement('canvas');
  c.width = c.height = SZ;
  const ctx = c.getContext('2d');

  const base = ctx.createLinearGradient(0, 0, 0, SZ);
  base.addColorStop(0, '#6f4426');
  base.addColorStop(0.5, '#4d2c17');
  base.addColorStop(1, '#2c1a0d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, SZ, SZ);

  const PLANKS = 6, plankW = SZ / PLANKS;
  for (let p = 0; p < PLANKS; p++) {
    const x0 = p * plankW;
    // sombra de junção entre tábuas
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x0, 0, 2, SZ);
    // veio: várias linhas onduladas semi-transparentes, cada uma com sua própria curva —
    // é isso que dá o aspecto orgânico que um gradiente reto não consegue.
    for (let i = 0; i < 9; i++) {
      const y = Math.random() * SZ;
      ctx.strokeStyle = `rgba(20,10,5,${0.08 + Math.random() * 0.14})`;
      ctx.lineWidth = 1 + Math.random() * 1.2;
      ctx.beginPath();
      ctx.moveTo(x0 + 3, y);
      const cx = x0 + plankW / 2, cy = y + (Math.random() - 0.5) * 46;
      ctx.quadraticCurveTo(cx, cy, x0 + plankW - 3, y + (Math.random() - 0.5) * 24);
      ctx.stroke();
    }
    // nó de madeira ocasional
    if (Math.random() < 0.55) {
      const kx = x0 + plankW / 2 + (Math.random() - 0.5) * 12;
      const ky = 40 + Math.random() * (SZ - 80);
      const g = ctx.createRadialGradient(kx, ky, 0, kx, ky, 15);
      g.addColorStop(0, 'rgba(15,8,4,0.65)');
      g.addColorStop(0.6, 'rgba(15,8,4,0.25)');
      g.addColorStop(1, 'rgba(15,8,4,0)');
      ctx.fillStyle = g;
      ctx.fillRect(kx - 16, ky - 16, 32, 32);
    }
  }

  // rachaduras — linhas finas em ziguezague (não retas, pra não parecer risco de régua)
  ctx.strokeStyle = 'rgba(8,4,2,0.6)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    let x = Math.random() * SZ, y = Math.random() * SZ;
    const angle = Math.random() * Math.PI * 2, len = 50 + Math.random() * 90;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < len; s += 6) {
      x += Math.cos(angle) * 6 + (Math.random() - 0.5) * 5;
      y += Math.sin(angle) * 6 + (Math.random() - 0.5) * 5;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // vinheta radial suave — dá volume/3D à superfície (mais escura nas bordas)
  const vign = ctx.createRadialGradient(SZ / 2, SZ / 2, SZ * 0.2, SZ / 2, SZ / 2, SZ * 0.75);
  vign.addColorStop(0, 'rgba(0,0,0,0)');
  vign.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = vign;
  ctx.fillRect(0, 0, SZ, SZ);

  return c.toDataURL('image/png');
}
document.documentElement.style.setProperty('--table-bg-img', `url(${makeWoodTableTexture()})`);

// =====================================================================
// initBook — a cena 3D: mesa + livro girável, capa/folhas com dobradiça
// real. Lê leavesData (content.js) e usa PixelArt
// (pixel-art.js) pra gerar as texturas. Roda uma vez, quando as fontes
// pixeladas terminarem de carregar (senão a primeira textura desenhada
// usaria a fonte padrão do sistema e ficaria presa assim, já que
// CanvasTexture não redesenha sozinha depois).
// =====================================================================
function initBook() {
  const container = document.getElementById('scene3d');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);
  // posicao camera
  camera.position.set(0, 0.6, 4.6);
  camera.lookAt(0, 0.8, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0); // transparente — mostra a mesa em CSS atrás
  container.insertBefore(renderer.domElement, container.firstChild);

  const ambient = new THREE.AmbientLight(0xffe9c4, 0.55);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(0xfff2d6, 0.9);
  key.position.set(3, 5, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x8899ff, 0.25);
  fill.position.set(-4, 2, -3);
  scene.add(fill);
  // intensidade "base" de cada luz que treme — a chama da vela nunca é 100% do brilho de pico,
  // ela oscila EM TORNO desse valor (ver flicker no animate()).
  const AMBIENT_BASE = ambient.intensity, KEY_BASE = key.intensity;

  // ---- poeira flutuando na luz da vela ----
  // uma nuvem de pontinhos dourados subindo bem devagar, com um leve balanço lateral — puramente
  // decorativo, não interage com nada. Reaproveita CanvasTexture (mesma técnica das páginas) só
  // que aqui é um pontinho com brilho suave (gradiente radial) em vez de pixel art.
  function makeDustTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const dctx = c.getContext('2d');
    const g = dctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255, 224, 170, 0.9)');
    g.addColorStop(1, 'rgba(255, 224, 170, 0)');
    dctx.fillStyle = g;
    dctx.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  }
  const DUST_COUNT = 70;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(DUST_COUNT * 3);
  const dustSpeed = new Float32Array(DUST_COUNT);
  const dustPhase = new Float32Array(DUST_COUNT);
  for (let i = 0; i < DUST_COUNT; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 6;
    dustPos[i * 3 + 1] = Math.random() * 3.2;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 4 + 1;
    dustSpeed[i] = 0.05 + Math.random() * 0.09;
    dustPhase[i] = Math.random() * Math.PI * 2;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    size: 0.045, map: makeDustTexture(), transparent: true, opacity: 0.55,
    depthWrite: false, blending: THREE.AdditiveBlending
  }));
  scene.add(dust);

  // ---- livro ----
  const bookGroup = new THREE.Group();
  scene.add(bookGroup);

  const palette = { leather: 0x6b2e1a, leatherDark: 0x2e120a, gold: 0xe8b23d, pages: 0xd4a866 };
  const W = 1.5, H = 2.0;
  const step = 0.03; // passo de profundidade entre folhas (ordenação da pilha)

  // -----------------------------------------------------------------
  // AJUSTE FINO — posição/escala/altura do livro em cada fase.
  //   BASE_Y_DROP    → quanto o livro desce em relação ao centro da tela
  //
  //   IDLE_SCALE/Z   → tamanho/proximidade do livro fechado (parado/arrastando)
  //   OPEN_ZOOM_*    → tamanho/proximidade durante o zoom antes da capa abrir
  //   READING_SCALE/Z→ tamanho/proximidade do livro já aberto, pronto p/ leitura
  // A centralização horizontal (X) na leitura é calculada automaticamente a
  // partir da geometria real do livro aberto, então não precisa mexer nela.
  // -----------------------------------------------------------------
  const BASE_Y_DROP = 0.2;

  const IDLE_SCALE = 0.9;
  const IDLE_Z = 1.4;

  const OPEN_ZOOM_SCALE = 1;
  const OPEN_ZOOM_Z = 1;

  const READING_SCALE = 1.1;
  const READING_Z = 1;

  const BASE_Y = H / 2 - BASE_Y_DROP;

  function flatMat(color) {
    return new THREE.MeshStandardMaterial({ color, flatShading: false, roughness: 0.9, metalness: 0.05 });
  }
  function faceMaterialsFor(data, isCoverLeaf) {
    const frontTex = PixelArt.makeFaceTexture(data.front);
    const backTex = PixelArt.makeFaceTexture(data.back);
    const edgeColor = isCoverLeaf ? palette.leather : palette.pages;
    return [0, 1, 2, 3, 4, 5].map(idx => {
      if (idx === 4) return new THREE.MeshStandardMaterial({ map: frontTex, flatShading: false, roughness: 0.85 });
      if (idx === 5) return new THREE.MeshStandardMaterial({ map: backTex, flatShading: false, roughness: 0.85 });
      return flatMat(edgeColor);
    });
  }

  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.13, 2.01, 1), flatMat(palette.leatherDark));
  spine.position.x = -W / 2 - 0.02;
  bookGroup.add(spine);

  const leafPivots = leavesData.map((data, i) => {
    const pivot = new THREE.Group();
    pivot.position.set(-W / 2, 0, 0); // lombada — mesmo eixo de dobradiça pra todas as folhas
    bookGroup.add(pivot);

    const isCover = i === 0 || i === leavesData.length - 1;
    const depth = isCover ? 0.045 : 0.012;
    // 16 segmentos ao longo da largura — necessário pra folha poder curvar (ver applyCurl)
    const geo = new THREE.BoxGeometry(W, H, depth, 16, 10, 1);
    const mesh = new THREE.Mesh(geo, faceMaterialsFor(data, isCover));
    mesh.position.x = W / 2; // desloca pra que a borda esquerda do miolo fique sobre o pivô
    mesh.userData.basePos = geo.attributes.position.array.slice();
    mesh.userData.depth = depth; // usado por addIconObject pra pousar o ícone rente à superfície
    pivot.add(mesh);
    pivot.userData.mesh = mesh;

    return pivot;
  });

  bookGroup.position.set(0, BASE_Y, IDLE_Z);
  bookGroup.rotation.set(0.3, -1, 0);
  bookGroup.scale.setScalar(escalaParada());

  // ---- estado de leitura ----
  let current = 0;                 // nº de folhas já viradas
  const total = leafPivots.length;
  let reading = false;             // true = livro aberto, folhas navegáveis
  let animating = false;

  function computeDepths(curr) {
    return leafPivots.map((_, i) => i < curr ? i * step : -(i - curr) * step);
  }
  function applyDepths(depths) {
    let minZ = Infinity, maxZ = -Infinity;
    leafPivots.forEach((pivot, i) => {
      pivot.position.z = depths[i];
      const half = (i === 0 || i === total - 1) ? 0.025 : 0.01;
      minZ = Math.min(minZ, depths[i] - half);
      maxZ = Math.max(maxZ, depths[i] + half);
    });
    const margin = -0.001;
    spine.scale.z = (maxZ - minZ) + margin * 2;
    spine.position.z = (maxZ + minZ) / 2;
  }
  function syncDepth() { applyDepths(computeDepths(current)); }
  syncDepth();

  const navPrevEl = document.getElementById('navPrev');
  const navNextEl = document.getElementById('navNext');
  // habilita/desabilita as setas de navegação e zera a dobrinha suavizada — chamada toda vez
  // que "current" muda (virar página, sumário, fechar).
  function updateNavState() {
    navPrevEl.classList.toggle('disabled', current === 0);
    navNextEl.classList.toggle('disabled', current === total);
    // zera o valor JÁ SUAVIZADO (não só o alvo) — a próxima folha começa a dobra do zero,
    // em vez de herdar o quanto a folha anterior já estava dobrada.
    cornerHoverNext = 0;
    cornerHoverPrev = 0;
  }

  // ---- dobrinha do canto no hover ----
  // checa a posição real do mouse a cada frame (em vez de mouseenter/mouseleave), porque a
  // zona é reposicionada programaticamente — o navegador só reavalia :hover em movimento real
  // do cursor, então um mouseenter/mouseleave "perde" toda vez que a zona pula pra debaixo dele.
  let hoverNextTarget = 0, hoverPrevTarget = 0;
  let cornerHoverNext = 0, cornerHoverPrev = 0;
  let mouseX = -1, mouseY = -1;
  window.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });
  // o dedo não dispara mousemove: sem isto, no celular mouseX ficava parado em -1 e tudo que
  // depende de onde o cursor está (virar a página segurando uma peça, por exemplo) não acontecia.
  // touchmove entra junto porque o navegador pode CANCELAR os eventos de ponteiro no meio de um
  // gesto (quando decide que aquilo é rolagem), e aí o pointermove simplesmente para de vir.
  window.addEventListener('pointermove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });
  window.addEventListener('touchmove', (e) => {
    const dedo = e.touches[0];
    if (dedo) { mouseX = dedo.clientX; mouseY = dedo.clientY; }
  }, { passive: true });
  function pointInEl(el, x, y) {
    if (el.classList.contains('disabled')) return false;
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  // posiciona as zonas de hover/clique em cima da ponta real da página (projetada da cena 3D),
  // em vez de uma porcentagem fixa da tela — que não acompanha onde o livro realmente aparece.
  const cornerScreenPt = new THREE.Vector3();
  function placeCornerZone(el, mesh) {
    cornerScreenPt.set(W / 2, -H / 2, 0.02);
    mesh.localToWorld(cornerScreenPt);
    cornerScreenPt.project(camera);
    const half = 45;
    const x = (cornerScreenPt.x * 0.5 + 0.5) * window.innerWidth;
    const y = (1 - (cornerScreenPt.y * 0.5 + 0.5)) * window.innerHeight;
    el.style.right = 'auto';
    el.style.bottom = 'auto';
    el.style.left = (x - half) + 'px';
    el.style.top = (y - half) + 'px';
  }
  // posiciona uma zona de clique cobrindo a LARGURA INTEIRA da linha (ícone + texto), em vez de
  // uma largura fixa em pixels de tela centralizada — largura fixa não acompanha o tamanho real
  // da página projetada (que muda com a resolução/zoom da janela), então em telas maiores a zona
  // ficava estreita demais e nem cobria o ícone da seta. Projeta os dois cantos (esquerdo/direito
  // da página, na altura da linha) e usa a distância entre eles como largura real.
  const rowZonePtA = new THREE.Vector3(), rowZonePtB = new THREE.Vector3();
  function placeRowZone(el, mesh, localY) {
    const margin = 0.04; // pequena folga da borda da página, em unidades locais (W=1.5)
    rowZonePtA.set(-W / 2 + margin, localY, 0.02); mesh.localToWorld(rowZonePtA); rowZonePtA.project(camera);
    rowZonePtB.set(W / 2 - margin, localY, 0.02); mesh.localToWorld(rowZonePtB); rowZonePtB.project(camera);
    const x1 = (rowZonePtA.x * 0.5 + 0.5) * window.innerWidth;
    const x2 = (rowZonePtB.x * 0.5 + 0.5) * window.innerWidth;
    const y = (1 - (rowZonePtA.y * 0.5 + 0.5)) * window.innerHeight;
    el.style.left = Math.min(x1, x2) + 'px';
    el.style.width = Math.abs(x2 - x1) + 'px';
    el.style.top = (y - 14) + 'px';
  }
  function updateCornerZones() {
    bookGroup.updateMatrixWorld(true);
    if (current < total) placeCornerZone(navNextEl, leafPivots[current].userData.mesh);
    if (current > 0) placeCornerZone(navPrevEl, leafPivots[current - 1].userData.mesh);
  }

  // ---- sumário clicável ----
  // acha sozinho qual folha/face tem o sumário (type:'toc' em content.js) — assim não precisa
  // hardcodar "é a folha 1" em lugar nenhum; se o sumário mudar de posição no livro, continua
  // funcionando. tocVisibleAtCurrent = o valor de "current" em que essa página aparece na tela.
  let tocLeafIndex = -1, tocFace = null;
  leavesData.forEach((leaf, i) => {
    if (leaf.front.type === 'toc') { tocLeafIndex = i; tocFace = 'front'; }
    if (leaf.back.type === 'toc') { tocLeafIndex = i; tocFace = 'back'; }
  });
  const tocVisibleAtCurrent = tocFace === 'front' ? tocLeafIndex : tocLeafIndex + 1;
  const tocRows = tocLeafIndex >= 0
    ? PixelArt.tocLayout(leavesData[tocLeafIndex][tocFace].entries, PixelArt.PAGE_W, PixelArt.PAGE_H)
    : [];

  // uma zona de clique invisível por item — reaproveita a mesma técnica de projeção 3D→tela
  // das zonas de canto (placeCornerZone), só que numa posição por linha em vez de um cantinho.
  const tocZoneEls = tocRows.map(() => {
    const el = document.createElement('div');
    el.className = 'toc-zone';
    container.appendChild(el);
    return el;
  });
  function hideTocZones() {
    tocZoneEls.forEach(el => el.classList.remove('visible'));
  }
  function placeTocZone(el, mesh, row) {
    const localY = H / 2 - (row.y / PixelArt.PAGE_H) * H; // canvas Y (topo=0) → local Y (topo=+H/2)
    placeRowZone(el, mesh, localY);
  }
  function updateTocZones() {
    if (tocLeafIndex < 0) return;
    if (!reading || animating || current !== tocVisibleAtCurrent) { hideTocZones(); return; }
    bookGroup.updateMatrixWorld(true);
    const mesh = leafPivots[tocLeafIndex].userData.mesh;
    tocRows.forEach((row, i) => {
      placeTocZone(tocZoneEls[i], mesh, row);
      tocZoneEls[i].classList.add('visible');
    });
  }
  tocZoneEls.forEach((el, i) => {
    el.addEventListener('click', () => {
      if (animating || !reading) return;
      const target = tocRows[i].targetSpread;
      if (target === current) return;
      hideTocZones();
      hideContactZones();
      hideSectionZones();
      hideImageZones();
      animating = true;
      rapidFlipAllTo(target, 90, 550, () => { animating = false; updateCornerZones(); updateTocZones(); updateContactZones(); updateSectionZones(); updateMediaPlayback();});
    });
  });

  // ---- página divisória clicável (type:'section', ex: "Projetos") ----
  // mesmíssima ideia do sumário: acha sozinho a folha/face com "items" e cria uma zona de
  // clique por linha, na mesma posição calculada por PixelArt.sectionItemsLayout (usada
  // também pra desenhar o texto — garante que ficam sempre alinhadas).
  let sectionLeafIndex = -1, sectionFace = null, sectionData = null;
  leavesData.forEach((leaf, i) => {
    if (leaf.front.type === 'section') { sectionLeafIndex = i; sectionFace = 'front'; sectionData = leaf.front; }
    if (leaf.back.type === 'section') { sectionLeafIndex = i; sectionFace = 'back'; sectionData = leaf.back; }
  });
  const sectionVisibleAtCurrent = sectionFace === 'front' ? sectionLeafIndex : sectionLeafIndex + 1;
  const sectionRows = sectionLeafIndex >= 0
    ? PixelArt.sectionItemsLayout(sectionData.items, PixelArt.sectionItemsTop(sectionData))
    : [];

  const sectionZoneEls = sectionRows.map(() => {
    const el = document.createElement('div');
    el.className = 'toc-zone';
    container.appendChild(el);
    return el;
  });
  function hideSectionZones() {
    sectionZoneEls.forEach(el => el.classList.remove('visible'));
  }
  function placeSectionZone(el, mesh, row) {
    const localY = H / 2 - (row.y / PixelArt.PAGE_H) * H;
    placeRowZone(el, mesh, localY);
  }
  function updateSectionZones() {
    if (sectionLeafIndex < 0) return;
    if (!reading || animating || current !== sectionVisibleAtCurrent) { hideSectionZones(); return; }
    bookGroup.updateMatrixWorld(true);
    const mesh = leafPivots[sectionLeafIndex].userData.mesh;
    sectionRows.forEach((row, i) => {
      placeSectionZone(sectionZoneEls[i], mesh, row);
      sectionZoneEls[i].classList.add('visible');
    });
  }
  sectionZoneEls.forEach((el, i) => {
    el.addEventListener('click', () => {
      if (animating || !reading) return;
      const target = sectionRows[i].targetSpread;
      if (target === current) return;
      hideTocZones();
      hideContactZones();
      hideSectionZones();
      hideImageZones();
      animating = true;
      rapidFlipAllTo(target, 90, 550, () => { animating = false; updateCornerZones(); updateTocZones(); updateContactZones(); updateSectionZones(); updateMediaPlayback();});
    });
  });

  // ---- mídia (gif/vídeo/slideshow) que toca quando a página onde ela está é aberta ----
  // acha sozinha TODAS as folhas/faces com "gif", "video" ou "images" em content.js — uma
  // lista, não uma folha só, senão duas páginas usando o mesmo tipo de mídia (ex: Biblioteca E
  // Guarda-Vidas com slideshow) brigariam pelas mesmas variáveis e uma delas nunca tocaria.
  // Como só uma folha fica visível de cada vez ("current"), no máximo um item toca por vez.
  const mediaItems = [];
  leavesData.forEach((leaf, i) => {
    ['front', 'back'].forEach(face => {
      const data = leaf[face];
      if (data.gif || data.video || data.images) {
        mediaItems.push({
          leafIndex: i, face, data,
          visibleAtCurrent: face === 'front' ? i : i + 1,
          playing: false, stop: null, slideImages: null, slideLoading: null,
          lastFrame: null, imageBox: null, bounceOffset: 0, bouncing: false
        });
      }
    });
  });
  // redesenha o quadro atual (o último composto por gif/vídeo/slideshow) já levando em conta o
  // deslocamento do "pulinho" — chamada tanto pela playback normal quanto pelo bounceImage.
  function redrawMediaItem(item) {
    const mesh = leafPivots[item.leafIndex].userData.mesh;
    const tex = mesh.material[item.face === 'front' ? 4 : 5].map;
    const ctx = tex.image.getContext('2d');
    const { imageBox } = PixelArt.drawDefaultPage(ctx, item.data, item.lastFrame, item.bounceOffset);
    item.imageBox = imageBox;
    tex.needsUpdate = true;
  }
  function updateMediaPlayback() {
    mediaItems.forEach(item => {
      const shouldPlay = reading && !animating && current === item.visibleAtCurrent;
      if (shouldPlay && !item.playing) {
        item.playing = true;
        const onFrame = (frame) => { item.lastFrame = frame; redrawMediaItem(item); updateImageZones(); };
        if (item.data.gif) {
          item.stop = PixelArt.playGifOnce(item.data.gif, onFrame, () => { item.playing = false; });
        } else if (item.data.video) {
          item.stop = PixelArt.playVideoOnce(item.data.video, onFrame, () => { item.playing = false; });
        } else if (item.data.images) {
          const start = () => {
            if (!item.playing) return; // saiu da página antes das imagens carregarem
            item.stop = PixelArt.playSlideshowLoop(item.slideImages, item.data.slideInterval || 2500, onFrame);
          };
          if (item.slideImages) start();
          else {
            if (!item.slideLoading) item.slideLoading = PixelArt.loadImages(item.data.images).then(imgs => { item.slideImages = imgs; });
            item.slideLoading.then(start);
          }
        }
      } else if (!shouldPlay && item.playing) {
        // saiu da página (gif/vídeo no meio, ou slideshow) — para e deixa pra tocar de novo na
        // próxima visita
        item.playing = false;
        if (item.stop) item.stop();
        item.stop = null;
      }
    });
    updateImageZones();
  }

  // ---- "pulinho" ao clicar na ilustração/gif/slideshow de uma página ----
  // uma zona de clique invisível por item de mídia, posicionada em cima da imagem já desenhada
  // (item.imageBox, calculado por drawDefaultPage — mesmo princípio de sectionItemsTop: quem
  // desenha decide onde, quem clica só lê). Ao clicar, redesenha a imagem alguns quadros com
  // um deslocamento vertical que sobe e assenta de volta, como se ela "flutuasse".
  const imageZoneEls = mediaItems.map(() => {
    const el = document.createElement('div');
    el.className = 'image-zone';
    container.appendChild(el);
    return el;
  });
  function hideImageZones() {
    imageZoneEls.forEach(el => el.classList.remove('visible'));
  }
  const imageZonePtA = new THREE.Vector3(), imageZonePtB = new THREE.Vector3();
  function placeImageZone(el, mesh, box) {
    // caixa em pixels lógicos de página (topo=0,0) → espaço local da folha (centro=0,0, topo=+H/2),
    // mesma conversão usada nas zonas de texto (toc/section/contact) mas com dois cantos em vez de um.
    const lx1 = (box.dx / PixelArt.PAGE_W) * W - W / 2;
    const ly1 = H / 2 - (box.dy / PixelArt.PAGE_H) * H;
    const lx2 = ((box.dx + box.dw) / PixelArt.PAGE_W) * W - W / 2;
    const ly2 = H / 2 - ((box.dy + box.dh) / PixelArt.PAGE_H) * H;
    imageZonePtA.set(lx1, ly1, 0.02); mesh.localToWorld(imageZonePtA); imageZonePtA.project(camera);
    imageZonePtB.set(lx2, ly2, 0.02); mesh.localToWorld(imageZonePtB); imageZonePtB.project(camera);
    const x1 = (imageZonePtA.x * 0.5 + 0.5) * window.innerWidth;
    const y1 = (1 - (imageZonePtA.y * 0.5 + 0.5)) * window.innerHeight;
    const x2 = (imageZonePtB.x * 0.5 + 0.5) * window.innerWidth;
    const y2 = (1 - (imageZonePtB.y * 0.5 + 0.5)) * window.innerHeight;
    el.style.left = Math.min(x1, x2) + 'px';
    el.style.top = Math.min(y1, y2) + 'px';
    el.style.width = Math.abs(x2 - x1) + 'px';
    el.style.height = Math.abs(y2 - y1) + 'px';
  }
  function updateImageZones() {
    bookGroup.updateMatrixWorld(true);
    mediaItems.forEach((item, i) => {
      const el = imageZoneEls[i];
      const show = reading && !animating && current === item.visibleAtCurrent && item.imageBox;
      if (!show) { el.classList.remove('visible'); return; }
      placeImageZone(el, leafPivots[item.leafIndex].userData.mesh, item.imageBox);
      el.classList.add('visible');
    });
  }
  // sobe e assenta de volta com uma leve quicada — não usa requestAnimationFrame (que fica
  // pausado com a aba/pane fora de foco) e sim setTimeout, igual ao resto da mídia deste livro.
  function bounceImage(item) {
    if (item.bouncing || !item.imageBox) return;
    item.bouncing = true;
    const duration = 500, start = performance.now();
    function tick() {
      const p = Math.min((performance.now() - start) / duration, 1);
      item.bounceOffset = -14 * Math.sin(p * Math.PI) * (1 - p * 0.3);
      redrawMediaItem(item);
      if (p < 1) setTimeout(tick, 16);
      else { item.bounceOffset = 0; item.bouncing = false; redrawMediaItem(item); }
    }
    tick();
  }
  imageZoneEls.forEach((el, i) => {
    el.addEventListener('click', () => bounceImage(mediaItems[i]));
  });

  // ---- contatos clicáveis (abrem o link de verdade + copiam pra área de transferência) ----
  // acha sozinho a folha/face com "contacts" — mesmo espírito do sumário, sem hardcodar posição.
  let contactLeafIndex = -1, contactFace = null, contactLines = [];
  leavesData.forEach((leaf, i) => {
    if (leaf.front.contacts) { contactLeafIndex = i; contactFace = 'front'; contactLines = leaf.front.contacts; }
    if (leaf.back.contacts) { contactLeafIndex = i; contactFace = 'back'; contactLines = leaf.back.contacts; }
  });
  const contactVisibleAtCurrent = contactFace === 'front' ? contactLeafIndex : contactLeafIndex + 1;
  const contactRows = PixelArt.contactLayout(contactLines, PixelArt.PAGE_H);

  // ---- ícones como objetos 3D de verdade (setas do sumário/divisória, runas do guarda e da
  // contracapa) ----
  // Antes eram pixels pintados dentro da textura da página: pra movê-los era preciso repintar o
  // canvas e reenviar a textura pra GPU a cada quadro, o que nunca ficava fluido (e ainda por
  // cima só permitia saltos de pixel inteiro, deixando o desenho "tremido"). Agora cada ícone é
  // um plano próprio, filho do mesh da folha — herda sozinho a posição/rotação da página (abrir,
  // virar, dobrar), anima só mexendo na posição (barato, dentro do rAF que já desenha a cena) e,
  // por existir de fato na cena, pode ser arrastado no futuro.
  const iconObjects = [];
  function addIconObject(leafIndex, face, spec) {
    const mesh = leafPivots[leafIndex].userData.mesh;
    // dois tipos de peça: ícone pixel art (setas, runas) e texto curto (número da página)
    const made = spec.kind === 'text'
      ? PixelArt.makeTextTexture(spec.text, spec.font, spec.color)
      : PixelArt.makeIconTexture(spec.icon, spec.scale, spec.color);
    const { tex, iw, ih } = made;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry((iw / PixelArt.PAGE_W) * W, (ih / PixelArt.PAGE_H) * H),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    );
    // spec.x/y = canto superior-esquerdo em px lógicos da página (no texto, y é a linha de base,
    // então sobe-se o "ascent"); o plano é posicionado pelo CENTRO, no espaço local da folha
    // (x: -W/2..+W/2, y: topo +H/2 .. base -H/2).
    // No VERSO a textura da folha é mapeada espelhada no eixo X (é a face de trás da caixa, vista
    // do outro lado) — então a mesma coordenada de canvas cai no lado oposto do espaço local, e a
    // peça precisa ser espelhada junto pra pousar em cima do texto a que pertence.
    const topY = spec.kind === 'text' ? spec.y - made.ascent : spec.y;
    const cx = ((spec.x + iw / 2) / PixelArt.PAGE_W) * W;
    const x = face === 'front' ? cx - W / 2 : W / 2 - cx;
    const y = H / 2 - ((topY + ih / 2) / PixelArt.PAGE_H) * H;
    const z = mesh.userData.depth / 2 + 0.0015; // rente à superfície, sem brigar no z-buffer
    const baseZ = face === 'front' ? z : -z;
    plane.position.set(x, y, baseZ);
    // profundidade "de repouso" da peça e os cantos originais dela: a curvatura da folha é somada
    // em cima disso a cada quadro da virada (ver applyCurl / curlPiece)
    plane.userData.restZ = baseZ;
    plane.userData.baseVerts = plane.geometry.attributes.position.array.slice();
    // no verso o plano é girado pra olhar pra -z; como a própria folha também está virada, as
    // duas rotações se cancelam e o desenho não sai espelhado.
    if (face === 'back') plane.rotation.y = Math.PI;
    mesh.add(plane);
    // cada peça carrega o que ela É (uma letra específica, o número da página, um ícone) — não só
    // um desenho solto. É isso que vai permitir ler as letras espalhadas e reconhecer palavras.
    plane.userData.piece = { role: spec.role || 'icon', char: spec.char || null };
    // spin = giro atual (suavizado a cada quadro) / spinTarget = pra onde ele está indo
    iconObjects.push({
      obj: plane, baseX: x, baseY: y, baseZ, spin: 0, spinTarget: 0,
      role: spec.role || 'icon', char: spec.char || null, text: spec.text || null,
      w: (iw / PixelArt.PAGE_W) * W, h: (ih / PixelArt.PAGE_H) * H
    });
  }
  // cada face guarda na própria textura a lista de peças que ela deve ter (ver makeFaceTexture),
  // então aqui é só varrer o livro inteiro — sem casos especiais por tipo de página.
  leafPivots.forEach((pivot, i) => {
    ['front', 'back'].forEach((face, fi) => {
      const specs = pivot.userData.mesh.material[fi === 0 ? 4 : 5].map.userData?.iconSpecs || [];
      specs.forEach(spec => addIconObject(i, face, spec));
    });
  });
  // e-mail → mailto:; qualquer outra coisa vira link https:// (funciona bem pra "github.com/..."
  // e "linkedin.com/in/...", que é o formato que BOOK_CONTENT.contact.lines já usa)
  function deriveHref(text) {
    if (text.includes('@')) return 'mailto:' + text;
    if (/^https?:\/\//.test(text)) return text;
    return 'https://' + text;
  }

  const contactZoneEls = contactRows.map(() => {
    const el = document.createElement('div');
    el.className = 'toc-zone'; // mesma zona invisível de clique do sumário
    container.appendChild(el);
    return el;
  });
  function hideContactZones() {
    contactZoneEls.forEach(el => el.classList.remove('visible'));
  }
  function placeContactZone(el, mesh, row) {
    const localY = H / 2 - (row.y / PixelArt.PAGE_H) * H;
    placeRowZone(el, mesh, localY);
  }
  function updateContactZones() {
    if (contactLeafIndex < 0) return;
    if (!reading || animating || current !== contactVisibleAtCurrent) { hideContactZones(); return; }
    bookGroup.updateMatrixWorld(true);
    const mesh = leafPivots[contactLeafIndex].userData.mesh;
    contactRows.forEach((row, i) => {
      placeContactZone(contactZoneEls[i], mesh, row);
      contactZoneEls[i].classList.add('visible');
    });
  }
  function showCopiedToast(x, y, text) {
    const toast = document.createElement('div');
    toast.className = 'copy-toast';
    toast.textContent = 'Copiado!';
    toast.style.left = x + 'px';
    toast.style.top = y + 'px';
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 250);
    }, 1300);
  }
  contactZoneEls.forEach((el, i) => {
    el.addEventListener('click', (e) => {
      const value = contactRows[i].value;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).catch(() => {});
      }
      showCopiedToast(e.clientX, e.clientY, value);
      window.open(deriveHref(value), '_blank', 'noopener');
    });
  });

  // ---- animação (sem lib externa) ----
  function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function tween(duration, onUpdate, onComplete) {
    const start = performance.now();
    (function step(now) {
      const t = Math.min(1, (now - start) / duration);
      onUpdate(easeInOutCubic(t));
      if (t < 1) requestAnimationFrame(step); else if (onComplete) onComplete();
    })(start);
  }
  // curvatura da folha durante a virada — plana em repouso (t=0/1), estufa no meio (t=0.5).
  // mais forte embaixo, quase nula em cima — como se a folha fosse puxada pelo canto de baixo.
  const CURL_STRENGTH = 0.44;
  function curlProfile(t) { return 4 * t * (1 - t); }
  // deslocamento em z da curvatura da folha num ponto (x,y) dela — é a mesma conta aplicada aos
  // vértices do papel e às peças coladas nele, pra que andem juntos.
  function curlOffsetAt(x, y, amount) {
    const u = Math.min(1, Math.max(0, (x + W / 2) / W)); // 0 na lombada, 1 na borda livre
    const v = Math.min(1, Math.max(0, (H / 2 - y) / H));  // 0 no topo, 1 embaixo
    return amount * Math.pow(u, 1.5) * (0.2 + 0.8 * v);
  }
  function applyCurl(mesh, amount) {
    const geo = mesh.geometry;
    const pos = geo.attributes.position;
    const base = mesh.userData.basePos;
    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3], by = base[i * 3 + 1], bz = base[i * 3 + 2];
      pos.setXYZ(i, bx, by, bz + curlOffsetAt(bx, by, amount));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    // as peças coladas na folha se deformam com ELA. Um filho herda a transformação do pai, mas
    // não a deformação dos vértices — então a única forma de a peça "fazer parte" da folha sem
    // deixar de ser um objeto próprio (arrastável) é passar pela mesma conta de curvatura, vértice
    // a vértice. Só mover o centro não bastava: a peça seguia plana sobre uma superfície curva e
    // as pontas dela afundavam no papel.
    mesh.children.forEach(piece => {
      if (iconDrag && iconDrag.entry.obj === piece) return; // a que está na mão ainda não é da folha
      curlPiece(piece, amount);
    });
  }

  // aplica a curvatura da folha nos 4 cantos de uma peça, em torno do próprio centro dela.
  function curlPiece(piece, amount) {
    const pos = piece.geometry.attributes.position;
    const base = piece.userData.baseVerts;
    const rz = piece.rotation.z, cos = Math.cos(rz), sin = Math.sin(rz);
    // no verso da folha o eixo x/z local da peça aponta ao contrário (ela é girada 180°)
    const flip = Math.cos(piece.rotation.y) < 0 ? -1 : 1;
    const cx = piece.position.x, cy = piece.position.y;
    const centerD = curlOffsetAt(cx, cy, amount);
    piece.position.z = piece.userData.restZ + centerD;
    for (let i = 0; i < pos.count; i++) {
      const vx = base[i * 3], vy = base[i * 3 + 1];
      const rx = vx * cos - vy * sin, ry = vx * sin + vy * cos; // canto já girado pelo spin
      const d = curlOffsetAt(cx + flip * rx, cy + ry, amount);
      pos.setXYZ(i, vx, vy, (d - centerD) * flip); // altura relativa ao centro, no espaço da peça
    }
    pos.needsUpdate = true;
  }

  // dobrinha no canto — vinco reto perto do canto livre/de baixo; a pontinha (além do vinco)
  // gira de verdade em torno desse vinco (Rodrigues), em vez de só "inchar". A sombra sai de
  // graça: a normal muda de direção e a luz já existente escurece a parte de baixo da dobra.
  const FOLD_SIZE = 0.3;          // tamanho da pontinha que dobra, a partir do canto
  const MAX_FOLD_ANGLE = 0.95;    // ~54°, ângulo máximo da dobra
  // vinco: liga o ponto (borda livre, FOLD_SIZE acima do canto) ao ponto (FOLD_SIZE à esquerda
  // do canto, na borda de baixo) — essa diagonal já para sozinha nas bordas reais da página,
  // isolando só a pontinha do canto (sem "vazar" pelo resto da folha).
  const FOLD_DIAG = new THREE.Vector3(-1, -1, 0).normalize();
  const FOLD_DIAG_MIRROR = FOLD_DIAG.clone().negate(); // pág. da esquerda já está ~166° virada;
  // sem inverter o eixo, a dobra "sai" na direção errada (pra trás) em vez de vir pro leitor.
  const foldPivot = new THREE.Vector3(W / 2 - FOLD_SIZE / 2, -H / 2 + FOLD_SIZE / 2, 0);
  function applyCornerFold(mesh, amount, mirror) {
    const axis = mirror ? FOLD_DIAG_MIRROR : FOLD_DIAG;
    const geo = mesh.geometry;
    const pos = geo.attributes.position;
    const base = mesh.userData.basePos;
    const theta = MAX_FOLD_ANGLE * amount;
    const cosT = Math.cos(theta), sinT = Math.sin(theta);
    const v = new THREE.Vector3(), cross = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3], by = base[i * 3 + 1], bz = base[i * 3 + 2];
      const cx = bx - W / 2, cy = by + H / 2; // 0,0 no canto livre/de baixo
      const inFlap = theta > 0 && (cy - cx) < FOLD_SIZE;
      if (!inFlap) {
        pos.setXYZ(i, bx, by, bz); // fora da pontinha — fica reto, sem mexer
        continue;
      }
      v.set(bx - foldPivot.x, by - foldPivot.y, bz - foldPivot.z);
      const dot = axis.dot(v);
      cross.crossVectors(axis, v);
      pos.setXYZ(
        i,
        foldPivot.x + v.x * cosT + cross.x * sinT + axis.x * dot * (1 - cosT),
        foldPivot.y + v.y * cosT + cross.y * sinT + axis.y * dot * (1 - cosT),
        foldPivot.z + v.z * cosT + cross.z * sinT + axis.z * dot * (1 - cosT)
      );
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }

  function flipPage(pivot, toRotY, fromDepths, toDepths, duration, onComplete, foldSnapshot) {
    const fromRotY = pivot.rotation.y;
    const mesh = pivot.userData.mesh;
    // sentido do giro: abrindo (próxima) estufa pra um lado, fechando (voltar) espelha pro outro
    const dirSign = (toRotY - fromRotY) < 0 ? 1 : -1;
    // primeira fatia do movimento: dissolve a "foto" da dobrinha (como a folha estava no clique)
    // na curva normal da virada, pra virar continuar o gesto em vez de dar um corte seco pra reta.
    const BLEND_FRAC = 0.3;
    tween(duration, t => {
      pivot.rotation.y = fromRotY + (toRotY - fromRotY) * t;
      applyDepths(fromDepths.map((z, i) => z + (toDepths[i] - z) * t));
      applyCurl(mesh, dirSign * CURL_STRENGTH * curlProfile(t));
      if (foldSnapshot && t < BLEND_FRAC) {
        const w = 1 - t / BLEND_FRAC; // 1 = puro instantâneo da dobrinha, 0 = pura curva da virada
        const pos = mesh.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const cx = pos.getX(i), cy = pos.getY(i), cz = pos.getZ(i);
          pos.setXYZ(i,
            cx + (foldSnapshot[i * 3] - cx) * w,
            cy + (foldSnapshot[i * 3 + 1] - cy) * w,
            cz + (foldSnapshot[i * 3 + 2] - cz) * w
          );
        }
        pos.needsUpdate = true;
        mesh.geometry.computeVertexNormals();
      }
    }, onComplete);
  }

  function goNext() {
    if (animating || current >= total) return;
    const flipping = current;
    animating = true;
    hideTocZones();
    hideContactZones();
    hideSectionZones();
    hideImageZones();
    const fromDepths = computeDepths(current);
    const foldSnapshot = leafPivots[flipping].userData.mesh.geometry.attributes.position.array.slice();
    current++;
    updateNavState();
    // em tela estreita a dupla não cabe: virando pra frente, quem entra é a página da esquerda
    if (umaPaginaPorVez) { ladoDaPagina = 'esquerda'; enquadrarLeitura(600); }
    flipPage(leafPivots[flipping], -Math.PI * 0.92, fromDepths, computeDepths(current), 1150, () => { animating = false; updateCornerZones(); updateTocZones(); updateContactZones(); updateSectionZones(); updateMediaPlayback();}, foldSnapshot);
  }
  function goPrev() {
    if (animating || current <= 0) return;
    animating = true;
    hideTocZones();
    hideContactZones();
    hideSectionZones();
    hideImageZones();
    const fromDepths = computeDepths(current);
    const foldSnapshot = leafPivots[current - 1].userData.mesh.geometry.attributes.position.array.slice();
    current--;
    updateNavState();
    // voltando, quem entra é a página da direita da dupla anterior
    if (umaPaginaPorVez && current > 0) { ladoDaPagina = 'direita'; enquadrarLeitura(600); }
    flipPage(leafPivots[current], 0, fromDepths, computeDepths(current), 1150, () => {
      animating = false;
      if (current === 0) closeToInspect();
      else { updateCornerZones(); updateTocZones(); updateContactZones(); updateSectionZones(); updateMediaPlayback();}
    }, foldSnapshot);
  }
  // gira só a rotação + curvatura de UMA folha (sem mexer na profundidade/lombada — isso é
  // tratado à parte quando várias folhas giram ao mesmo tempo, ver rapidFlipAllTo).
  function rotateLeafOnly(pivot, toRotY, duration, onComplete) {
    const fromRotY = pivot.rotation.y;
    const mesh = pivot.userData.mesh;
    const dirSign = (toRotY - fromRotY) < 0 ? 1 : -1;
    tween(duration, t => {
      pivot.rotation.y = fromRotY + (toRotY - fromRotY) * t;
      applyCurl(mesh, dirSign * CURL_STRENGTH * curlProfile(t));
    }, onComplete);
  }

  // vira várias páginas ao mesmo tempo até chegar em targetCurrent — como um baralho sendo
  // solto, não uma de cada vez. Cada folha começa a girar num instante escalonado (stagger),
  // então várias ficam no ar sobrepostas. A profundidade/lombada NÃO pode ser controlada por
  // cada folha independente (elas "brigariam" pela pilha a cada frame) — por isso é uma única
  // transição coordenada, do jeito atual pro estado final, rodando em paralelo com os giros.
  // Serve tanto pra fechar o livro (targetCurrent=0) quanto, no futuro, pro acesso rápido pelo
  // sumário (targetCurrent=a página escolhida, virando pra frente ao invés de pra trás).
  function rapidFlipAllTo(targetCurrent, stagger, leafDuration, onAllDone) {
    const startCurrent = current;
    const steps = Math.abs(targetCurrent - startCurrent);
    if (steps === 0) { if (onAllDone) onAllDone(); return; }
    const forward = targetCurrent > startCurrent;
    const totalDuration = (steps - 1) * stagger + leafDuration;

    const fromDepths = computeDepths(startCurrent);
    current = targetCurrent;
    updateNavState();
    const toDepths = computeDepths(current);
    tween(totalDuration, t => {
      applyDepths(fromDepths.map((z, i) => z + (toDepths[i] - z) * t));
    });

    let done = 0;
    function leafDone() { done++; if (done === steps && onAllDone) onAllDone(); }
    for (let i = 0; i < steps; i++) {
      const leafIndex = forward ? startCurrent + i : startCurrent - 1 - i;
      const toRotY = forward ? -Math.PI * 0.92 : 0;
      setTimeout(() => rotateLeafOnly(leafPivots[leafIndex], toRotY, leafDuration, leafDone), i * stagger);
    }
  }

  // as setas passam a função por dentro de uma seta anônima de propósito: ligar goNext direto
  // entregaria o objeto do CLIQUE como primeiro argumento, e ele viraria o "ladoDestino"
  navNextEl.addEventListener('click', () => goNext());
  navPrevEl.addEventListener('click', () => goPrev());
  document.addEventListener('keydown', (e) => {
    if (!reading || Trofeus.estanteAberta()) return;
    if (e.key === 'ArrowRight') goNext();
    if (e.key === 'ArrowLeft') goPrev();
  });

  // ---- arrastar para girar (só antes de abrir) ----
  let dragging = false, hasDragged = false, lastX = 0, lastY = 0;
  const rotVel = { y: 0.3 };

  function onDown(e) {
    if (animating || reading) return;
    dragging = true; hasDragged = false;
    container.classList.add('dragging');
    lastX = (e.touches ? e.touches[0].clientX : e.clientX);
    lastY = (e.touches ? e.touches[0].clientY : e.clientY);
  }
  function onMove(e) {
    if (!dragging) return;
    const x = (e.touches ? e.touches[0].clientX : e.clientX);
    const y = (e.touches ? e.touches[0].clientY : e.clientY);
    const dx = x - lastX, dy = y - lastY;
    if (Math.abs(dx) + Math.abs(dy) > 3) hasDragged = true;
    bookGroup.rotation.y += dx * 0.012;
    bookGroup.rotation.x = Math.max(-0.55, Math.min(0.55, bookGroup.rotation.x + dy * 0.008));
    rotVel.y = dx * 0.002;
    lastX = x; lastY = y;
  }
  function onUp(e) {
    if (dragging && !hasDragged) tryOpen(e);
    dragging = false;
    container.classList.remove('dragging');
  }
  container.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  container.addEventListener('touchstart', onDown, { passive: true });
  window.addEventListener('touchmove', onMove, { passive: true });
  window.addEventListener('touchend', onUp);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  function tryOpen(e) {
    if (animating || reading) return;
    const x = (e.changedTouches ? e.changedTouches[0].clientX : e.clientX);
    const y = (e.changedTouches ? e.changedTouches[0].clientY : e.clientY);
    pointer.x = (x / window.innerWidth) * 2 - 1;
    pointer.y = -(y / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(bookGroup.children, true);
    if (hits.length) playOpenSequence();
  }

  // ---- arrastar os ícones (setas/runas) pela página ----
  // Como eles são objetos 3D de verdade, dá pra "pegá-los" com raycast e deslizá-los pela
  // superfície da folha. Os eventos são escutados na JANELA e não no canvas porque as zonas de
  // clique do sumário são divs invisíveis POR CIMA dele — sem isso elas engoliriam o mousedown.
  // Só funciona com o livro aberto e parado: durante a virada a folha se curva, e o ícone (que
  // vive num plano reto) descolaria da superfície.
  let iconDrag = null;      // { entry, mesh, grabX, grabY }
  let iconDragMoved = false; // pra engolir o clique quando o gesto foi arrastar, não clicar
  let iconLift = 0;          // degrau de profundidade: o último pego fica por cima dos outros
  let suppressContextMenu = false; // engole o menu do navegador quando o direito girou uma peça
  const dragHit = new THREE.Vector3();
  const dragPlane = new THREE.Plane();
  const dragNormal = new THREE.Vector3();
  const dragAnchor = new THREE.Vector3();

  // qual das duas páginas abertas está sob o cursor. A aberta mostra sempre o VERSO da folha
  // anterior (esquerda) e a FRENTE da folha atual (direita) — mesma convenção usada pela mídia
  // e pelas zonas de clique.
  function pageUnderPointer() {
    const candidates = [];
    if (current > 0) candidates.push({ mesh: leafPivots[current - 1].userData.mesh, face: 'back' });
    if (current < total) candidates.push({ mesh: leafPivots[current].userData.mesh, face: 'front' });
    const hits = raycaster.intersectObjects(candidates.map(c => c.mesh), false);
    if (!hits.length) return null;
    const target = candidates.find(c => c.mesh === hits[0].object);
    return target && { ...target, point: hits[0].point };
  }

  // muda a peça de folha mantendo-a "colada" na superfície certa: o lado (z) e a orientação
  // dependem de a página de destino ser frente ou verso.
  function moveIconToPage(entry, target) {
    const z = target.mesh.userData.depth / 2 + 0.0015;
    entry.baseZ = target.face === 'front' ? z : -z;
    target.mesh.add(entry.obj);
    // girar o plano no verso NÃO espelha o desenho: a própria folha já está virada 180°, então
    // as duas rotações se cancelam e a textura continua na orientação certa.
    entry.obj.rotation.y = target.face === 'back' ? Math.PI : 0;
    entry.obj.position.z = entry.baseZ + Math.sign(entry.baseZ) * iconLift * 0.0004;
    entry.obj.userData.restZ = entry.obj.position.z;
  }

  function setPointerFrom(e) {
    const x = (e.touches ? e.touches[0].clientX : e.clientX);
    const y = (e.touches ? e.touches[0].clientY : e.clientY);
    pointer.x = (x / window.innerWidth) * 2 - 1;
    pointer.y = -(y / window.innerHeight) * 2 + 1;
  }

  // Só as peças das duas páginas abertas podem ser pegas. O raio do mouse não é barrado por nada:
  // sem esse filtro ele atravessa o papel e agarra uma peça de uma folha escondida no meio do
  // livro. De cada folha vale só o lado que está virado pro leitor (a da direita mostra a frente,
  // a da esquerda mostra o verso), que é o que o sinal de baseZ diz.
  function pecasAoAlcance() {
    const direita = current < total ? leafPivots[current].userData.mesh : null;
    const esquerda = current > 0 ? leafPivots[current - 1].userData.mesh : null;
    return iconObjects.filter(p => {
      const folha = p.obj.parent;
      if (folha === direita && p.baseZ > 0) return true;
      if (folha === esquerda && p.baseZ < 0) return true;
      return false;
    });
  }

  function onIconDown(e) {
    if (e.button !== undefined && e.button !== 0 && e.button !== 2) return; // só esquerdo/direito
    // a escuta é na janela inteira, então um clique na estante ou nos botões acertaria as peças
    // que estão atrás deles
    if (Trofeus.estanteAberta() || (e.target.closest && e.target.closest('.trofeus-btn, .close-book'))) return;
    // com uma peça na mão, o direito gira ELA — sem precisar mirar de novo (o cursor pode estar
    // um pouco fora do desenho) e mesmo no meio de uma virada de página
    if (e.button === 2 && iconDrag) {
      iconDrag.entry.spinTarget += Math.PI / 4;
      suppressContextMenu = true;
      return;
    }
    if (!reading || animating) return;
    setPointerFrom(e);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pecasAoAlcance().map(i => i.obj), false);
    if (!hits.length) return;
    const entry = iconObjects.find(i => i.obj === hits[0].object);
    // botão direito gira a peça um passo no sentido horário (não arrasta)
    if (e.button === 2) {
      entry.spinTarget += Math.PI / 4;
      suppressContextMenu = true;
      return;
    }
    const mesh = entry.obj.parent;
    mesh.updateMatrixWorld(true);
    // guarda onde DENTRO do ícone foi o clique, pra ele não saltar pro centro do cursor
    dragHit.copy(hits[0].point);
    mesh.worldToLocal(dragHit);
    iconDrag = { entry, mesh, grabX: dragHit.x - entry.baseX, grabY: dragHit.y - entry.baseY };
    iconDragMoved = false;
    entry.obj.position.z = entry.baseZ + Math.sign(entry.baseZ) * (++iconLift) * 0.0004;
    entry.obj.userData.restZ = entry.obj.position.z;
    container.classList.add('dragging');
  }

  // plano da superfície da folha em que a peça está, estendido ao infinito — usado enquanto a
  // página vira: mirar nas folhas naquele momento não dá (uma delas está girando e curvada), mas
  // a peça já foi passada pra página de destino, que fica parada. Assim o arrasto continua fluido
  // durante a virada em vez de congelar até a animação acabar.
  function pointOnCurrentPagePlane() {
    const mesh = iconDrag.mesh;
    if (!mesh) return null;
    mesh.updateMatrixWorld(true);
    dragNormal.set(0, 0, 1).transformDirection(mesh.matrixWorld).normalize();
    iconDrag.entry.obj.getWorldPosition(dragAnchor);
    dragPlane.setFromNormalAndCoplanarPoint(dragNormal, dragAnchor);
    return raycaster.ray.intersectPlane(dragPlane, dragAnchor) ? dragAnchor : null;
  }

  function onIconMove(e) {
    if (!iconDrag) return;
    setPointerFrom(e);
    raycaster.setFromCamera(pointer, camera);
    const { entry } = iconDrag;
    let point;
    if (animating) {
      point = pointOnCurrentPagePlane(); // vira a folha sem soltar a peça: segue deslizando
    } else {
      // mira na própria superfície das páginas abertas (em vez de um plano fixo), o que deixa a
      // peça atravessar pra outra folha naturalmente quando o cursor passa por cima dela
      const target = pageUnderPointer();
      if (target && target.mesh !== iconDrag.mesh) {
        moveIconToPage(entry, target);
        iconDrag.mesh = target.mesh;
        iconDrag.grabX = 0; iconDrag.grabY = 0; // ao trocar de folha, a peça centra no cursor
      }
      point = target && target.point;
    }
    if (!point) return; // cursor fora do papel: a peça fica onde estava
    dragHit.copy(point);
    iconDrag.mesh.worldToLocal(dragHit);
    iconDragMoved = true;
    // mantém o ícone dentro do papel — soltar no vazio ao lado do livro ficaria estranho
    entry.baseX = Math.max(-W / 2, Math.min(W / 2, dragHit.x - iconDrag.grabX));
    entry.baseY = Math.max(-H / 2, Math.min(H / 2, dragHit.y - iconDrag.grabY));
  }

  function onIconUp(e) {
    // soltar o botão DIREITO (usado pra girar) não pode largar a peça — só o esquerdo solta
    if (e && e.button !== undefined && e.button !== 0) return;
    if (!iconDrag) return;
    const solta = iconDrag.entry;
    iconDrag = null;
    iconCornerHold = 0;
    container.classList.remove('dragging');
    const premio = Jogos.avaliar(grupoDaPeca(solta));
    if (premio) Trofeus.conquistar(premio);
  }

  // Peças "encostadas" na que acabou de ser solta: mesma folha, na mesma linha e coladas
  // horizontalmente, seguindo a corrente (A encosta em B, B encosta em C → as três contam).
  // As tolerâncias saem do tamanho das próprias peças, então valem pra letra miúda e pro
  // numeral graúdo igual.
  function grupoDaPeca(alvo) {
    const naPagina = iconObjects.filter(p => p.obj.parent === alvo.obj.parent);

    // distância entre CENTROS, não vão entre bordas: assim vale tanto encostar de lado quanto
    // largar uma peça por cima da outra — que é como a mão da gente junta as coisas de verdade.
    const encostam = (a, b) => {
      const alturaMedia = (a.h + b.h) / 2;
      const alcance = (a.w + b.w) / 2 + alturaMedia * 0.5; // encostadas + uma folga curta
      return Math.abs(a.baseY - b.baseY) <= alturaMedia * 0.6
        && Math.abs(a.baseX - b.baseX) <= alcance;
    };

    // propagação por contato (A encosta em B, B em C → as três contam). Precisa ser por contato e
    // não pela ordem horizontal: entre duas peças encostadas costuma haver peças de OUTRA linha
    // com x intermediário (as letras do título, por exemplo), que quebrariam a corrente à toa.
    const grupo = [alvo];
    for (let i = 0; i < grupo.length; i++) {
      naPagina.forEach(p => {
        if (!grupo.includes(p) && encostam(grupo[i], p)) grupo.push(p);
      });
    }
    // Ordem de LEITURA, não ordem de coordenada: no verso da folha (página da esquerda) o eixo x
    // local corre ao contrário do que o leitor enxerga — sem inverter aqui, juntar X e XI seria
    // lido como "XIX" em vez de "XXI".
    const verso = alvo.baseZ < 0;
    return grupo.sort((a, b) => verso ? b.baseX - a.baseX : a.baseX - b.baseX);
  }

  // segurar a peça no canto da página vira a folha sozinha — é o mesmo canto que já mostra a
  // dobrinha no hover, só que com algo na mão não precisa clicar. Assim dá pra levar o objeto
  // pro livro inteiro, e não só pras duas páginas abertas no momento.
  let iconCornerHold = 0;
  const ICON_TURN_MS = 600;
  function updateIconCornerTurn(dt) {
    if (!iconDrag || animating || !reading) { iconCornerHold = 0; return; }
    // no computador as zonas são os cantos de virar; no celular são as mesmas faixas laterais que
    // já viram a página num toque, senão não haveria como levar a peça pro resto do livro
    const lado = umaPaginaPorVez ? faixaDoToque(mouseX)
      : pointInEl(navNextEl, mouseX, mouseY) ? 1
        : pointInEl(navPrevEl, mouseX, mouseY) ? -1 : 0;
    if (!lado) { iconCornerHold = 0; return; }
    iconCornerHold += dt;
    if (iconCornerHold < ICON_TURN_MS) return;
    iconCornerHold = 0;
    const praFrente = lado > 0;
    const { entry } = iconDrag;
    const paginaAntes = umaPaginaPorVez ? ladoDaPagina + current : current;

    // No celular anda UMA página por vez, na mesma sequência do toque (esquerda → direita → vira a
    // folha → esquerda...), e a peça acompanha a página que ficou à vista — virando a folha ou só
    // deslizando pra outra metade da dupla, tanto faz. No computador as duas páginas aparecem
    // juntas, então a folha vira sempre, e a peça vai pra página que NÃO está virando: se fosse
    // pra que está, viajaria junto com ela e sumiria no meio do movimento.
    let target;
    if (umaPaginaPorVez) {
      andarPagina(lado);
      if (paginaAntes === ladoDaPagina + current) return; // não saiu do lugar (fim do livro)
      target = paginaAVista();
    } else {
      const folhaAntes = current;
      if (praFrente) goNext(); else goPrev();
      if (current === folhaAntes) return; // chegou na capa/contracapa: nada virou
      const pivot = leafPivots[praFrente ? current : current - 1];
      target = pivot && { mesh: pivot.userData.mesh, face: praFrente ? 'front' : 'back' };
    }
    if (!target) return;
    // as coordenadas locais são as mesmas em qualquer folha, então a peça continua exatamente sob
    // o dedo enquanto a página troca por baixo dela
    moveIconToPage(entry, target);
    iconDrag.mesh = target.mesh;
  }

  // sem o menu do navegador quando o direito foi usado pra girar uma peça
  window.addEventListener('contextmenu', (e) => {
    if (!suppressContextMenu) return;
    suppressContextMenu = false;
    e.preventDefault();
  }, true);
  // captura: precisa rodar antes das divs de clique (sumário/contatos) verem o evento
  window.addEventListener('mousedown', onIconDown, true);
  window.addEventListener('mousemove', onIconMove, true);
  window.addEventListener('mouseup', onIconUp, true);
  window.addEventListener('touchstart', onIconDown, true);
  window.addEventListener('touchmove', onIconMove, true);
  window.addEventListener('touchend', onIconUp, true);
  // arrastar uma seta do sumário não pode navegar junto — engole só o clique desse gesto
  window.addEventListener('click', (e) => {
    if (!iconDragMoved) return;
    iconDragMoved = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);

  // ---- leitura em tela estreita: uma página por vez ----
  // Numa tela de celular em pé a página dupla não cabe. E o motivo não é falta de CSS: a câmera
  // é em perspectiva com abertura vertical fixa, ou seja, ela enquadra pela ALTURA — numa tela
  // alta e estreita sobra altura e falta largura, e o livro sai cortado dos dois lados.
  //
  // A saída é enquadrar UMA página de cada vez: o livro continua aberto e inteiro em 3D, só que o
  // grupo se desloca pra pôr no meio da tela ora a página da esquerda, ora a da direita. Tocar nas
  // laterais anda entre elas, virando a folha só quando chega no fim da dupla.
  const LARGURA_DE_CELULAR = 760;
  const FOLGA_DA_TELA = 0.92;   // sobra uma beiradinha em volta da página, não encosta na borda
  const ZOOM_MAX = 3;
  let umaPaginaPorVez = window.innerWidth < LARGURA_DE_CELULAR;
  let ladoDaPagina = 'direita'; // qual metade da dupla está enquadrada
  let zoomDeLeitura = 1;        // o que a pinça de dois dedos acrescenta por cima do enquadramento
  let arrastoX = 0, arrastoY = 0; // o quanto dois dedos empurraram a vista, pra ler uma parte

  // quanto de mundo cabe na tela, na distância em que o livro estiver
  function janelaVisivel(zDoLivro) {
    const distancia = camera.position.z - zDoLivro;
    const altura = 2 * distancia * Math.tan(camera.fov * Math.PI / 360);
    return { altura, largura: altura * (window.innerWidth / window.innerHeight) };
  }

  // o tamanho do livro FECHADO. Numa tela estreita ele não cabia e saía cortado nas laterais —
  // aqui ele encolhe só o necessário pra caber. Numa tela larga o IDLE_SCALE de sempre já cabe,
  // então nada muda. A folga é maior que na leitura porque a capa fechada gira com o arrasto.
  function escalaParada() {
    const v = janelaVisivel(IDLE_Z);
    return Math.min(IDLE_SCALE, 0.8 * Math.min(v.largura / W, v.altura / H));
  }

  // o tamanho que faz a página (ou a dupla inteira, na tela grande) caber na tela
  function escalaDeLeitura() {
    const v = janelaVisivel(READING_Z);
    const larguraNecessaria = umaPaginaPorVez ? W : W * 2;
    return FOLGA_DA_TELA * Math.min(v.largura / larguraNecessaria, v.altura / H) * zoomDeLeitura;
  }

  // onde o grupo precisa estar pra que a página escolhida caia no meio da tela. O centro é medido
  // na geometria real do livro aberto (não num número chutado), como a abertura já fazia.
  function centroDeLeitura(escala) {
    bookGroup.updateMatrixWorld(true);
    const caixa = new THREE.Box3().setFromObject(bookGroup);
    const centroLocal = (caixa.getCenter(new THREE.Vector3()).x - bookGroup.position.x) / bookGroup.scale.x;
    const meiaPagina = umaPaginaPorVez ? (ladoDaPagina === 'esquerda' ? -W / 2 : W / 2) : 0;
    return -escala * (centroLocal + meiaPagina);
  }

  // duracao 0 = pula pro lugar na hora (usado no redimensionar e na pinça)
  function enquadrarLeitura(duracao) {
    const escala = escalaDeLeitura();
    const alvoX = centroDeLeitura(escala) + arrastoX;
    const alvoY = BASE_Y + arrastoY;
    if (!duracao) {
      bookGroup.position.x = alvoX;
      bookGroup.position.y = alvoY;
      bookGroup.scale.set(escala, escala, escala);
      return;
    }
    const deX = bookGroup.position.x, deY = bookGroup.position.y, deEscala = bookGroup.scale.x;
    tween(duracao, t => {
      bookGroup.position.x = deX + (alvoX - deX) * t;
      bookGroup.position.y = deY + (alvoY - deY) * t;
      const s = deEscala + (escala - deEscala) * t;
      bookGroup.scale.set(s, s, s);
    });
  }

  // anda uma página: +1 pra frente, -1 pra trás. Só vira a folha quando já está na ponta da dupla
  function andarPagina(direcao) {
    if (animating || !reading || !umaPaginaPorVez) return;
    const praFrente = direcao > 0;
    zoomDeLeitura = 1; arrastoX = 0; arrastoY = 0; // trocar de página desfaz o zoom
    const naPonta = praFrente ? ladoDaPagina === 'direita' : ladoDaPagina === 'esquerda';
    if (!naPonta) {
      ladoDaPagina = praFrente ? 'direita' : 'esquerda';
      enquadrarLeitura(420);
      return;
    }
    if (praFrente ? current >= total : current <= 0) return;
    if (praFrente) goNext(); else goPrev(); // eles já escolhem a metade certa e reenquadram
  }

  // qual página está à vista agora, no modo de uma por vez: a da esquerda é o VERSO da folha
  // anterior, a da direita é a FRENTE da folha atual — mesma convenção do resto do arquivo
  function paginaAVista() {
    const naEsquerda = ladoDaPagina === 'esquerda';
    const pivot = leafPivots[naEsquerda ? current - 1 : current];
    return pivot && { mesh: pivot.userData.mesh, face: naEsquerda ? 'back' : 'front' };
  }

  // ---- os gestos do celular: tocar na lateral vira, dois dedos dão zoom ----
  // Um dedo continua fazendo o que sempre fez (arrastar as peças, tocar nos links); a lateral só
  // conta como "virar" se o toque não virou arrasto, senão soltar uma peça perto da borda viraria
  // a página sem querer.
  const FAIXA_DA_LATERAL = 0.16; // que fatia da largura, de cada lado, vira a página
  const dedos = new Map();
  let pinca = 0, centroPinca = null, tocouEm = null;

  // -1 = faixa da esquerda (volta), 1 = a da direita (avança), 0 = no meio, não vira nada.
  // O teste de "não sei onde está" vem PRIMEIRO de propósito: mouseX começa em -1, e sem isto
  // qualquer posição desconhecida caía no primeiro if e era lida como faixa esquerda — a página
  // voltava mesmo com a peça segurada na direita.
  function faixaDoToque(x) {
    if (!(x >= 0)) return 0;
    if (x < window.innerWidth * FAIXA_DA_LATERAL) return -1;
    if (x > window.innerWidth * (1 - FAIXA_DA_LATERAL)) return 1;
    return 0;
  }
  function medirDedos() {
    const [a, b] = [...dedos.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, abertura: Math.hypot(a.x - b.x, a.y - b.y) };
  }
  container.addEventListener('pointerdown', e => {
    if (!umaPaginaPorVez || !reading) return;
    dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (dedos.size === 2) { const m = medirDedos(); pinca = m.abertura; centroPinca = m; tocouEm = null; }
    else tocouEm = { x: e.clientX, y: e.clientY };
  });
  container.addEventListener('pointermove', e => {
    if (!dedos.has(e.pointerId)) return;
    dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (dedos.size !== 2) {
      if (tocouEm && Math.hypot(e.clientX - tocouEm.x, e.clientY - tocouEm.y) > 12) tocouEm = null;
      return;
    }
    const m = medirDedos();
    if (pinca > 0 && m.abertura > 0) {
      zoomDeLeitura = Math.max(1, Math.min(ZOOM_MAX, zoomDeLeitura * (m.abertura / pinca)));
    }
    if (centroPinca) { // arrastar os dois dedos juntos empurra a vista, pra ler o resto da página
      const porPixel = 2 * (camera.position.z - READING_Z) * Math.tan(camera.fov * Math.PI / 360)
        / Math.max(1, window.innerHeight);
      arrastoX += (m.x - centroPinca.x) * porPixel;
      arrastoY -= (m.y - centroPinca.y) * porPixel;
    }
    pinca = m.abertura; centroPinca = m;
    enquadrarLeitura(0);
  });
  const soltarDedo = e => {
    const tocou = tocouEm;
    dedos.delete(e.pointerId);
    if (dedos.size < 2) { pinca = 0; centroPinca = null; }
    tocouEm = null;
    if (!tocou || dedos.size > 0) return;
    const lado = faixaDoToque(e.clientX);
    if (lado) andarPagina(lado);
  };
  container.addEventListener('pointerup', soltarDedo);
  container.addEventListener('pointercancel', e => { dedos.delete(e.pointerId); tocouEm = null; });

  // ---- sequência de abertura: vira de frente → zoom → capa abre → centraliza ----
  function playOpenSequence() {
    if (animating) return;
    animating = true;

    const fromRotY = bookGroup.rotation.y, fromRotX = bookGroup.rotation.x;
    const fromZ = bookGroup.position.z, fromScale = bookGroup.scale.x;

    // fase 1 — vira de frente pro leitor e aproxima (zoom)
    tween(950, (t) => {
      bookGroup.rotation.y = fromRotY * (1 - t);
      bookGroup.rotation.x = fromRotX * (1 - t);
      bookGroup.position.z = fromZ + (OPEN_ZOOM_Z - fromZ) * t;
      const s = fromScale + (OPEN_ZOOM_SCALE - fromScale) * t;
      bookGroup.scale.set(s, s, s);
    }, () => {
      // fase 2 — a capa abre devagar, feito uma dobradiça
      const fromDepths = computeDepths(current);
      current = 1;
      flipPage(leafPivots[0], -Math.PI * 0.92, fromDepths, computeDepths(current), 1300, () => {
        // fase 3 — centraliza de verdade (calculado pela geometria real do
        // livro já aberto, não por um número chutado) e aproxima/ajusta o
        // tamanho pro valor de leitura definido em READING_SCALE/READING_Z.
        // o tamanho e o deslocamento saem da tela de agora: na larga entra a página dupla
        // inteira, na estreita entra uma página só (ver escalaDeLeitura/centroDeLeitura)
        const escalaFinal = escalaDeLeitura();
        const targetX = centroDeLeitura(escalaFinal);
        const fromX = bookGroup.position.x, fromZ2 = bookGroup.position.z, fromScale2 = bookGroup.scale.x;

        tween(550, (t) => {
          bookGroup.position.x = fromX + (targetX - fromX) * t;
          bookGroup.position.z = fromZ2 + (READING_Z - fromZ2) * t;
          const s = fromScale2 + (escalaFinal - fromScale2) * t;
          bookGroup.scale.set(s, s, s);
        }, () => {
          reading = true;
          container.classList.add('reading');
          updateNavState();
          animating = false;
          updateCornerZones();
          updateTocZones();
          updateContactZones();
          updateSectionZones();
          updateMediaPlayback();
        });
      });
    });
  }

  // fecha o livro de onde estiver: primeiro vira rápido todas as páginas abertas de volta
  // (fastFlipAllTo até current=0), depois dá um deszoom suave até a posição de repouso —
  // o inverso da sequência de abertura, em vez do corte seco de antes.
  function closeToInspect() {
    if (animating) return;
    animating = true;
    reading = false;
    container.classList.remove('reading'); // esconde a UI de leitura já de cara
    hideTocZones();
    hideContactZones();
    hideSectionZones();
    hideImageZones();
    updateMediaPlayback(); // reading já é false aqui — isso para gif/vídeo/slideshow se estava tocando

    const STAGGER = 90, LEAF_DURATION = 550;
    const steps = current; // nº de folhas abertas que precisam fechar
    const totalDuration = Math.max(650, steps > 0 ? (steps - 1) * STAGGER + LEAF_DURATION : 0);

    let pending = 2; // só termina quando AS FOLHAS e O DESZOOM tiverem acabado, o que vier depois
    function onPartDone() { if (--pending === 0) animating = false; }

    // deszoom já começa junto — não espera as folhas terminarem de fechar
    const fromX = bookGroup.position.x, fromZ = bookGroup.position.z, fromScale = bookGroup.scale.x;
    tween(totalDuration, (t) => {
      bookGroup.position.x = fromX * (1 - t);
      bookGroup.position.z = fromZ + (IDLE_Z - fromZ) * t;
      const s = fromScale + (escalaParada() - fromScale) * t;
      bookGroup.scale.set(s, s, s);
    }, () => {
      bookGroup.rotation.set(0, 0, 0);
      onPartDone();
    });

    rapidFlipAllTo(0, STAGGER, LEAF_DURATION, onPartDone);
  }
  document.getElementById('closeBook').addEventListener('click', closeToInspect);

  function ajustarATela() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    // a tela pode ter virado de pé pra deitada (ou o navegador mudou de tamanho): o enquadramento
    // é refeito, e com ele a decisão de mostrar a dupla inteira ou uma página só
    const eraUmaSo = umaPaginaPorVez;
    umaPaginaPorVez = window.innerWidth < LARGURA_DE_CELULAR;
    if (eraUmaSo !== umaPaginaPorVez) { zoomDeLeitura = 1; arrastoX = 0; arrastoY = 0; }
    if (reading && !animating) enquadrarLeitura(eraUmaSo === umaPaginaPorVez ? 0 : 420);
    else if (!reading && !animating) bookGroup.scale.setScalar(escalaParada());
    if (reading) { updateCornerZones(); updateTocZones(); updateContactZones(); updateSectionZones(); }
  }
  window.addEventListener('resize', ajustarATela);
  // Quando o initBook roda, a janela ainda pode não estar no tamanho final: fontes carregando, a
  // barra de endereço do celular, o navegador assentando o layout. Sem refazer a conta aqui, a
  // PROPORÇÃO DA CÂMERA ficava com o valor errado até o primeiro redimensionamento — e é ela que
  // decide o quanto cabe na largura, então o livro saía cortado sem motivo aparente.
  window.addEventListener('load', ajustarATela);

  // capas (frente/fundo) são "tábua" de couro — sem dobrinha de papel nelas
  const isCoverIndex = idx => idx === 0 || idx === total - 1;

  let lastFrameT = performance.now() * 0.001;
  function animate() {
    requestAnimationFrame(animate);
    // luz de vela tremeluzindo — soma de três ondas lentas em frequências diferentes (fica mais
    // orgânico que uma senoide só). Antes tinha um chacoalho aleatório recalculado a cada quadro
    // por cima disso, mas trocar de valor toda hora (60x/s) lia como a luz "piscando" em vez de
    // tremeluzir — só as ondas, mais lentas, dão a sensação de chama de verdade.
    const t = performance.now() * 0.001;
    const flicker = 1 + 0.08 * Math.sin(t * 3.1) + 0.05 * Math.sin(t * 7.7 + 1.4) + 0.03 * Math.sin(t * 13.1 + 0.6);
    key.intensity = KEY_BASE * flicker;
    ambient.intensity = AMBIENT_BASE * (1 + (flicker - 1) * 0.4); // ambiente treme bem mais sutil
    // ícones (setas/runas) balançando de leve — como são objetos de verdade na cena, basta mexer
    // na posição dentro deste mesmo rAF que já desenha tudo: acompanha o refresh da tela e fica
    // com movimento contínuo (sem passo de pixel inteiro, que era o que deixava "tremido").
    updateIconCornerTurn((t - lastFrameT) * 1000);
    lastFrameT = t;
    // todas as peças balançam igual — o mesmo deslize horizontal curto, em paralelo (px lógicos
    // convertidos pra unidades de mundo)
    const iconWave = Math.sin(t * (2 * Math.PI / 2.6)) * (0.8 / PixelArt.PAGE_W) * W;
    iconObjects.forEach(entry => {
      const { obj } = entry;
      obj.position.x = entry.baseX + iconWave;
      obj.position.y = entry.baseY; // reaplicado todo quadro: é o que faz o arrasto vertical valer
      if (entry.spin !== entry.spinTarget) {
        entry.spin += (entry.spinTarget - entry.spin) * 0.18; // gira suave até o passo pedido
        if (Math.abs(entry.spinTarget - entry.spin) < 0.001) entry.spin = entry.spinTarget;
      }
      // no verso a peça é vista do outro lado, então o mesmo giro apareceria invertido — o sinal
      // (que vem do lado em que ela está pousada) mantém o "horário" horário pro leitor.
      obj.rotation.z = (entry.baseZ > 0 ? -1 : 1) * entry.spin;
    });
    // poeira: sobe bem devagar e balança de leve pros lados; ao passar do topo, volta pro chão
    const dpos = dustGeo.attributes.position.array;
    for (let i = 0; i < DUST_COUNT; i++) {
      dpos[i * 3 + 1] += dustSpeed[i] * 0.006;
      dpos[i * 3] += Math.sin(t * 0.6 + dustPhase[i]) * 0.0008;
      if (dpos[i * 3 + 1] > 3.2) dpos[i * 3 + 1] = 0;
    }
    dustGeo.attributes.position.needsUpdate = true;
    if (!dragging && !animating && !reading) {
      bookGroup.rotation.y += rotVel.y;
      rotVel.y *= 0.96;
      bookGroup.position.y = BASE_Y + Math.sin(Date.now() * 0.0012) * 0.04;
    }
    // a posição das zonas de hover só é recalculada quando a página muda (abrir/virar/resize) —
    // recalcular todo frame move o elemento por baixo do cursor parado, o que não dispara
    // mouseenter de verdade (o navegador só reavalia :hover em movimento real do mouse).
    if (reading && !animating) {
      hoverNextTarget = pointInEl(navNextEl, mouseX, mouseY) ? 1 : 0;
      hoverPrevTarget = pointInEl(navPrevEl, mouseX, mouseY) ? 1 : 0;
      cornerHoverNext += (hoverNextTarget - cornerHoverNext) * 0.15;
      cornerHoverPrev += (hoverPrevTarget - cornerHoverPrev) * 0.15;
      if (current < total && !isCoverIndex(current) && Math.abs(cornerHoverNext) > 0.001) applyCornerFold(leafPivots[current].userData.mesh, cornerHoverNext);
      if (current > 0 && !isCoverIndex(current - 1) && Math.abs(cornerHoverPrev) > 0.001) applyCornerFold(leafPivots[current - 1].userData.mesh, cornerHoverPrev, true);
    }
    renderer.render(scene, camera);
  }
  animate();
}

// espera as fontes pixeladas carregarem antes de desenhar qualquer textura — senão o canvas
// desenha com a fonte padrão do sistema na primeira vez e fica preso assim (CanvasTexture
// não é redesenhada depois).
document.fonts.ready.then(initBook);

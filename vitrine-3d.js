// =====================================================================
// O manuseio das vitrines 3D — o que deixa girar, chegar perto e deslocar
// o objeto que abre na estante de troféus.
//
// Mora aqui porque é o MESMO gesto nas três vitrines (o elmo, a caravela e
// o pergaminho): arrastar gira, a roda do mouse chega perto e afasta, e o
// botão direito (ou dois dedos no celular) desloca. É o manuseio que todo
// programa de modelagem tem, e antes estava copiado nos três arquivos.
//
// A divisão de trabalho: GIRAR mexe no objeto, CHEGAR PERTO e DESLOCAR
// mexem na câmera — que olha sempre reto pra frente, e é por isso que
// mudar o x/y dela desloca de verdade, sem torcer a vista.
// =====================================================================
const Vitrine3D = (function () {
  const ZOOM_MIN = 0.2, ZOOM_MAX = 1.8; // 0.2 = bem perto, dá pra ver a textura

  // tela = o canvas que recebe os gestos; caixa = o elemento que dá o tamanho dele;
  // giro = o grupo que o arrasto gira; inclinacaoMax = o quanto dá pra tombar pra cima e pra baixo.
  function manusear(opcoes) {
    const { tela, caixa, camera, giro } = opcoes;
    const inclinacaoMax = opcoes.inclinacaoMax || 0.7;
    let distancia = 0, alturaBase = 0, zoom = 1;
    let embalo = opcoes.embalo === undefined ? 0.09 : opcoes.embalo; // a voltinha que ele já dá sozinho
    let modo = null, ultimoX = 0, ultimoY = 0;
    const dedos = new Map(); // ponteiros encostados agora; com dois, é pinça, não arrasto
    let pinca = 0, meioX = 0, meioY = 0;

    const porPixel = () => 2 * camera.position.z * Math.tan(camera.fov * Math.PI / 360)
      / Math.max(1, caixa.clientHeight); // quanto de mundo vale um pixel, na distância de agora
    const mudarZoom = fator => {
      zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * fator));
      if (distancia) camera.position.z = distancia * zoom;
    };
    const deslocar = (dx, dy) => {
      if (!distancia) return;
      const k = porPixel(), limite = distancia * 0.8; // não deixa o objeto se perder fora da vista
      camera.position.x = Math.max(-limite, Math.min(limite, camera.position.x - dx * k));
      camera.position.y = Math.max(alturaBase - limite,
        Math.min(alturaBase + limite, camera.position.y + dy * k));
    };
    const girar = (dx, dy) => {
      giro.rotation.y += dx * 0.012;
      giro.rotation.x = Math.max(-inclinacaoMax, Math.min(inclinacaoMax, giro.rotation.x + dy * 0.008));
      embalo = dx * 0.002;
    };
    const entreOsDedos = () => {
      const [a, b] = [...dedos.values()];
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, abertura: Math.hypot(a.x - b.x, a.y - b.y) };
    };

    tela.addEventListener('contextmenu', e => e.preventDefault()); // o botão direito aqui é deslocar
    tela.addEventListener('wheel', e => {
      e.preventDefault(); // a vitrine cobre a tela: a roda aqui é zoom, não rolagem da página
      mudarZoom(1 + e.deltaY * 0.0015);
    }, { passive: false });

    tela.addEventListener('pointerdown', e => {
      dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
      tela.setPointerCapture(e.pointerId);
      if (dedos.size === 2) { // dois dedos: abrir/fechar chega perto, arrastar junto desloca
        const c = entreOsDedos();
        pinca = c.abertura; meioX = c.x; meioY = c.y;
        modo = 'dois dedos';
        return;
      }
      modo = e.button === 0 ? 'girar' : 'deslocar';
      ultimoX = e.clientX; ultimoY = e.clientY;
      tela.style.cursor = modo === 'girar' ? 'grabbing' : 'move';
    });
    tela.addEventListener('pointermove', e => {
      if (!modo) return;
      if (dedos.has(e.pointerId)) dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (dedos.size === 2) {
        const c = entreOsDedos();
        if (pinca > 0 && c.abertura > 0) mudarZoom(pinca / c.abertura); // dedos abrindo = mais perto
        deslocar(c.x - meioX, c.y - meioY);
        pinca = c.abertura; meioX = c.x; meioY = c.y;
        return;
      }
      const dx = e.clientX - ultimoX, dy = e.clientY - ultimoY;
      if (modo === 'girar') girar(dx, dy); else deslocar(dx, dy);
      ultimoX = e.clientX; ultimoY = e.clientY;
    });
    const soltar = e => {
      dedos.delete(e.pointerId);
      if (dedos.size < 2) pinca = 0;
      modo = null;
      tela.style.cursor = 'grab';
    };
    tela.addEventListener('pointerup', soltar);
    tela.addEventListener('pointercancel', soltar);

    return {
      // Põe a câmera na distância de enquadrar o objeto. É um passo à parte porque nem sempre dá
      // pra saber isso na hora de ligar o manuseio: a caravela, por exemplo, só é medida depois
      // que o arquivo dela termina de carregar.
      enquadrar(novaDistancia, novaAltura) {
        distancia = novaDistancia;
        alturaBase = novaAltura || 0;
        camera.position.set(0, alturaBase, distancia * zoom);
        camera.lookAt(0, alturaBase, 0); // reto pra frente — deslocar depois é só mudar o x/y dela
      },
      // chame a cada quadro: é o giro solto que continua sozinho depois que o arrasto acaba
      aoQuadro() {
        if (!modo) { giro.rotation.y += embalo; embalo *= 0.96; }
      }
    };
  }

  return { manusear };
})();

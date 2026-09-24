// =====================================================================
// Troféus — infraestrutura compartilhada pelos joguinhos do livro.
//
// Jogos.registrar({ nome, trofeus, avaliar(grupo) }) pendura um jogo novo;
// o livro chama Jogos.avaliar(grupo) toda vez que uma peça é solta
// encostada em outras. Cada jogo responde com um troféu ou null, e entrega
// o catálogo completo (trofeus) pra estante mostrar também os que faltam.
// O "nome" do jogo diz em qual aba da estante ele aparece (ver ABAS).
//
// Conquistar é guardado pra sempre (localStorage), mas a comemoração roda
// TODA vez que o desafio é refeito — o registro serve pra estante saber o
// que já foi descoberto, não pra impedir de repetir a graça.
// =====================================================================
const Jogos = (function () {
  const lista = [];
  return {
    registrar(jogo) { lista.push(jogo); },
    doNome(nome) { return lista.find(j => j.nome === nome); },
    // devolve o primeiro troféu que algum jogo reconhecer no grupo
    avaliar(grupo) {
      for (const jogo of lista) {
        const premio = jogo.avaliar(grupo);
        if (premio) return premio;
      }
      return null;
    }
  };
})();

const Trofeus = (function () {
  const ABAS = [
    { nome: 'romanos', titulo: 'Romanos' }
  ];
  const DURACAO_AVISO = 8000;
  const TEXTO_PADRAO = 'Clique num troféu pra ler a história dele.';

  function lerSet(chave) {
    try {
      return new Set(JSON.parse(localStorage.getItem(chave)) || []);
    } catch (e) {
      return new Set(); // navegador sem storage (aba anônima, permissão negada): joga sem guardar
    }
  }
  function guardarSet(chave, set) {
    try {
      localStorage.setItem(chave, JSON.stringify([...set]));
    } catch (e) { /* sem storage: a sessão continua normal, só não persiste */ }
  }
  const conquistados = lerSet('portfolio-trofeus');
  // conquistados que a pessoa ainda não abriu na estante — são os que piscam como "novo"
  const novos = lerSet('portfolio-trofeus-novos');

  const botao = document.getElementById('abrirTrofeus');
  function avisarBotao(ligado) {
    if (botao) botao.classList.toggle('tem-novo', ligado);
  }
  avisarBotao(novos.size > 0);

  // ---- aviso na hora da conquista ----
  let toast = null, sumir = null, premioDoAviso = null;
  function esconderAviso() {
    clearTimeout(sumir);
    if (toast) toast.classList.remove('aparece');
  }
  function avisar(premio, jaTinha) {
    premioDoAviso = premio;
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'trofeu-toast';
      toast.setAttribute('role', 'button');
      toast.tabIndex = 0;
      toast.title = 'Ver na estante';
      toast.innerHTML =
        '<div class="trofeu-icone">🏆</div>' +
        '<div><div class="trofeu-titulo"></div><div class="trofeu-texto"></div>' +
        '<div class="trofeu-repeticao">já conquistado</div>' +
        '<div class="trofeu-dica">clique para ver na estante</div></div>' +
        '<button class="trofeu-fechar" type="button" aria-label="Fechar aviso">✕</button>';
      // o ✕ fecha sem abrir a estante — por isso o clique dele não pode subir pro aviso
      toast.querySelector('.trofeu-fechar').addEventListener('click', (e) => {
        e.stopPropagation();
        esconderAviso();
      });
      // clicar no aviso leva direto ao troféu: abre a estante na aba dele, já selecionado
      toast.addEventListener('click', () => {
        esconderAviso();
        abrirEstante(premioDoAviso);
      });
      document.body.appendChild(toast);
    }
    const caixaIcone = toast.querySelector('.trofeu-icone');
    caixaIcone.innerHTML = '';
    const arte = IconesTrofeu.criar(premio, { tamanho: 4 });
    if (arte) caixaIcone.appendChild(arte); else caixaIcone.textContent = '🏆';
    toast.querySelector('.trofeu-titulo').textContent = premio.titulo;
    toast.querySelector('.trofeu-texto').textContent = premio.texto;
    toast.querySelector('.trofeu-repeticao').hidden = !jaTinha;
    // reinicia a animação mesmo se o aviso anterior ainda estiver na tela
    toast.classList.remove('aparece');
    void toast.offsetWidth;
    toast.classList.add('aparece');
    clearTimeout(sumir);
    sumir = setTimeout(() => toast.classList.remove('aparece'), DURACAO_AVISO);
  }

  // ---- comemoração especial: uma cena toma a tela por alguns segundos ----
  // Um troféu com o campo "animacao" (ex: 'muralha', 'flechada') ganha a cena de mesmo nome em
  // cenas-trofeu.js. Roda toda vez que o desafio é refeito, mesmo já conquistado.
  function comemorar(premio) {
    if (!premio.animacao) return;
    const cena = CenasTrofeu.criar(premio.animacao, premio);
    if (!cena) return;
    document.body.appendChild(cena);
    // só o fim da animação da própria cena encerra — as das peças internas também borbulham até aqui
    cena.addEventListener('animationend', e => { if (e.target === cena) cena.remove(); });
  }

  // ---- vitrine: o objeto do troféu em 3D, pra girar arrastando ----
  // Um troféu conquistado com o campo "vitrine" (ex: 'elmo') abre, ao ser clicado na estante, uma
  // janela por cima dela com o objeto de cenas-trofeu.js; "vitrineNome" é como o objeto é chamado
  // no título e na dica — JÁ com o artigo ("o elmo romano", "a caravela"), porque o gênero muda de
  // um objeto pro outro e não dá pra adivinhar. Fechar libera o 3D (ele não fica rodando escondido).
  let vitrine = null, objetoDaVitrine = null;
  function abrirVitrine(premio) {
    const objeto = CenasTrofeu.vitrine(premio.vitrine, premio);
    if (!objeto) return;
    if (!vitrine) {
      vitrine = document.createElement('div');
      vitrine.className = 'trofeu-vitrine';
      vitrine.hidden = true;
      vitrine.innerHTML =
        '<div class="trofeu-vitrine-caixa" role="dialog">' +
        '<div class="trofeus-topo"><div class="trofeus-cabecalho"></div>' +
        '<button class="trofeus-fechar" type="button" aria-label="Fechar">✕</button></div>' +
        '<div class="trofeu-vitrine-palco"></div>' +
        '<div class="trofeu-vitrine-dica">arraste para girar</div>' +
        '</div>';
      document.body.appendChild(vitrine);
      vitrine.addEventListener('click', (e) => { if (e.target === vitrine) fecharVitrine(); });
      vitrine.querySelector('.trofeus-fechar').addEventListener('click', fecharVitrine);
    }
    fecharVitrine();
    const nome = premio.vitrineNome ? premio.vitrineNome[0].toUpperCase() + premio.vitrineNome.slice(1) : premio.titulo; // "o elmo romano" → "O elmo romano"
    vitrine.querySelector('.trofeus-cabecalho').textContent = nome;
    vitrine.querySelector('.trofeu-vitrine-caixa').setAttribute('aria-label', nome);
    vitrine.querySelector('.trofeu-vitrine-palco').appendChild(objeto);
    objetoDaVitrine = objeto;
    vitrine.hidden = false;
  }
  // devolve true se havia uma vitrine aberta (pro Esc fechar só ela, e não a estante junto)
  function fecharVitrine() {
    if (objetoDaVitrine) {
      objetoDaVitrine.parar();
      objetoDaVitrine.remove();
      objetoDaVitrine = null;
    }
    if (!vitrine || vitrine.hidden) return false;
    vitrine.hidden = true;
    return true;
  }

  // ---- estante: uma aba por jogo, conquistados e silhuetas dos que faltam ----
  let painel = null, abaAtual = ABAS[0].nome, selecionado = null;

  function trofeusDaAba(nome) {
    const jogo = Jogos.doNome(nome);
    return (jogo && jogo.trofeus) || [];
  }
  function abaDoTrofeu(premio) {
    const aba = ABAS.find(a => trofeusDaAba(a.nome).some(t => t.id === premio.id));
    return aba && aba.nome;
  }
  // o selo "novo" de um troféu fica lá (mesmo depois de recarregar a página) até a pessoa clicar
  // nele pra ler a história
  function marcarVisto(t) {
    if (t && novos.delete(t.id)) {
      guardarSet('portfolio-trofeus-novos', novos);
      return true;
    }
    return false;
  }

  function montarEstante() {
    painel = document.createElement('div');
    painel.className = 'trofeus-painel';
    painel.hidden = true;
    painel.innerHTML =
      '<div class="trofeus-caixa" role="dialog" aria-label="Estante de troféus">' +
      '<div class="trofeus-topo"><div class="trofeus-cabecalho">Estante de troféus</div>' +
      '<button class="trofeus-fechar" type="button" aria-label="Fechar estante">✕</button></div>' +
      '<div class="trofeus-abas" role="tablist"></div>' +
      '<div class="trofeus-contagem"></div>' +
      '<div class="trofeus-lista"></div>' +
      '<div class="trofeus-detalhe"><div class="trofeus-detalhe-titulo"></div><div class="trofeus-detalhe-texto"></div>' +
      '<div class="trofeus-detalhe-dica" hidden></div></div>' +
      '</div>';
    document.body.appendChild(painel);
    painel.addEventListener('click', (e) => { if (e.target === painel) fecharEstante(); });
    painel.querySelector('.trofeus-fechar').addEventListener('click', fecharEstante);
  }

  // Os textos longos são escritos em várias linhas no arquivo do jogo, então a indentação do código
  // entra junto. Aqui ela some: tira o espaço do começo de cada linha e junta os vãos grandes num
  // parágrafo só — assim dá pra indentar à vontade lá sem estragar o texto na tela.
  function limpar(texto) {
    return texto
      .replace(/^[ \t]+/gm, '')   // a indentação do código
      .replace(/\n{3,}/g, '\n\n') // vãos grandes viram uma linha em branco só
      .replace(/([^\n])\n(?!\n)/g, '$1 ') // quebra solta era só o código dobrando a linha
      .trim();
  }

  let mostrado; // qual troféu está no painel de texto agora
  function mostrarDetalhe(t) {
    // sem isso, passar o mouse pelos troféus enquanto se lê um texto longo reescrevia o painel
    // e jogava a rolagem de volta pro topo a cada entra-e-sai
    if (mostrado === t) return;
    mostrado = t;
    const titulo = painel.querySelector('.trofeus-detalhe-titulo');
    const texto = painel.querySelector('.trofeus-detalhe-texto');
    const dica = painel.querySelector('.trofeus-detalhe-dica');
    if (!t) { titulo.textContent = ''; texto.textContent = TEXTO_PADRAO; }
    else if (conquistados.has(t.id)) { titulo.textContent = t.titulo; texto.textContent = limpar(t.detalhe || t.texto); }
    // o que ainda não foi conquistado continua segredo: só a silhueta, sem título nem história
    else { titulo.textContent = '???'; texto.textContent = 'Ainda não conquistado.'; }
    // troféu com vitrine avisa que dá pra ver o objeto em 3D
    const temVitrine = !!(t && t.vitrine && conquistados.has(t.id));
    dica.hidden = !temVitrine;
    dica.textContent = temVitrine ? 'Clique no troféu para ver ' + (t.vitrineNome || 'o objeto') + ' em 3D.' : '';
    painel.querySelector('.trofeus-detalhe').scrollTop = 0;
  }

  function preencherAbas() {
    const abas = painel.querySelector('.trofeus-abas');
    abas.hidden = ABAS.length < 2; // com uma aba só não há escolha nenhuma pra oferecer
    abas.innerHTML = '';
    ABAS.forEach(aba => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.className = 'trofeus-aba' + (aba.nome === abaAtual ? ' ativa' : '') +
        (trofeusDaAba(aba.nome).some(t => novos.has(t.id)) ? ' tem-novo' : '');
      b.textContent = aba.titulo;
      b.addEventListener('click', () => {
        abaAtual = aba.nome;
        selecionado = null;
        preencherAbas();
        preencherLista();
      });
      abas.appendChild(b);
    });
  }

  function preencherLista() {
    const lista = painel.querySelector('.trofeus-lista');
    const contagem = painel.querySelector('.trofeus-contagem');
    const trofeus = trofeusDaAba(abaAtual);
    lista.innerHTML = '';
    mostrado = undefined; // ao trocar de aba/reabrir, o painel sempre se redesenha
    mostrarDetalhe(selecionado);
    if (!trofeus.length) {
      contagem.textContent = '';
      const vazio = document.createElement('p');
      vazio.className = 'trofeus-vazio';
      vazio.textContent = 'Nenhum troféu por aqui ainda.';
      lista.appendChild(vazio);
      return;
    }
    contagem.textContent = trofeus.filter(t => conquistados.has(t.id)).length + ' de ' + trofeus.length + ' conquistados';
    const grade = document.createElement('div');
    grade.className = 'trofeus-grade';
    trofeus.forEach(t => {
      const tem = conquistados.has(t.id);
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'trofeu-item' + (tem ? ' conquistado' : '') + (selecionado === t ? ' selecionado' : '');
      item.innerHTML = '<span class="trofeu-item-icone"></span>';
      // bloqueado, o ícone é pintado todo de uma cor escura só: dá pra ver que tem alguma coisa
      // ali sem conseguir ler a forma. Conquistado, aparece colorido.
      const caixa = item.querySelector('.trofeu-item-icone');
      const arte = IconesTrofeu.criar(t, { tamanho: 6, silhueta: !tem });
      if (arte) caixa.appendChild(arte); else caixa.textContent = '🏆';
      // o nome só entra em quem ainda está bloqueado, como "???" — conquistado, o ícone já diz
      // qual é, e o nome aparece inteiro no detalhe ao lado quando se passa o mouse ou clica
      if (!tem) {
        const nome = document.createElement('span');
        nome.className = 'trofeu-item-nome';
        nome.textContent = '???';
        item.appendChild(nome);
      }
      if (novos.has(t.id)) {
        const selo = document.createElement('span');
        selo.className = 'trofeu-novo';
        selo.textContent = 'novo';
        item.appendChild(selo);
      }
      // passar o mouse só espia; clicar fixa o texto (e ele fica lá até clicar em outro)
      item.addEventListener('mouseenter', () => mostrarDetalhe(t));
      item.addEventListener('mouseleave', () => mostrarDetalhe(selecionado));
      item.addEventListener('click', () => {
        selecionado = t;
        grade.querySelectorAll('.selecionado').forEach(el => el.classList.remove('selecionado'));
        item.classList.add('selecionado');
        mostrarDetalhe(t);
        if (marcarVisto(t)) {
          const selo = item.querySelector('.trofeu-novo');
          if (selo) selo.remove();
          preencherAbas();
        }
        if (tem && t.vitrine) abrirVitrine(t);
      });
      grade.appendChild(item);
    });
    lista.appendChild(grade);
  }

  // focar = troféu que deve abrir já selecionado (vem do clique no aviso de conquista)
  function abrirEstante(focar) {
    if (!painel) montarEstante();
    if (focar && abaDoTrofeu(focar)) {
      abaAtual = abaDoTrofeu(focar);
      selecionado = trofeusDaAba(abaAtual).find(t => t.id === focar.id) || null;
      marcarVisto(selecionado); // veio pelo aviso, então já está sendo lido
    } else {
      // sem alvo, abre direto na aba que tem novidade, se houver
      const comNovo = ABAS.find(aba => trofeusDaAba(aba.nome).some(t => novos.has(t.id)));
      if (comNovo) abaAtual = comNovo.nome;
      selecionado = null;
    }
    preencherAbas();
    preencherLista();
    painel.hidden = false;
    avisarBotao(false); // a pessoa já viu que tem coisa nova; o selo fica em cada troféu
    const alvo = painel.querySelector('.trofeu-item.selecionado');
    if (alvo) alvo.scrollIntoView({ block: 'nearest' });
  }
  function fecharEstante() {
    fecharVitrine();
    if (painel) painel.hidden = true;
  }

  // Esc fecha uma coisa por vez: primeiro a vitrine (se estiver aberta), depois a estante
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !fecharVitrine()) fecharEstante();
  });
  if (botao) botao.addEventListener('click', () => abrirEstante());

  return {
    conquistados,
    estanteAberta() { return !!painel && !painel.hidden; },
    conquistar(premio) {
      const jaTinha = conquistados.has(premio.id);
      if (!jaTinha) {
        conquistados.add(premio.id);
        novos.add(premio.id);
        guardarSet('portfolio-trofeus', conquistados);
        guardarSet('portfolio-trofeus-novos', novos);
        avisarBotao(true);
      }
      avisar(premio, jaTinha);
      comemorar(premio);
    }
  };
})();

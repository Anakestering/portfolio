// =====================================================================
// Jogo dos numerais romanos — junte os números das páginas lado a lado
// pra formar outro número e destravar um troféu.
//
// Só a REGRA do jogo mora aqui: quem detecta que peças foram encostadas
// é o livro (ver grupoDaPeca em book.js), e quem mostra/guarda o troféu
// é trofeus.js. Este arquivo recebe um grupo de peças já ordenado da
// esquerda pra direita e responde: "isso vale algum troféu?".
// =====================================================================
(function () {
  const VALOR = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

  function paraNumero(romano) {
    let total = 0;
    for (let i = 0; i < romano.length; i++) {
      const atual = VALOR[romano[i]], proximo = VALOR[romano[i + 1]] || 0;
      total += atual < proximo ? -atual : atual; // IV = 5-1: menor antes de maior subtrai
    }
    return total;
  }

  function paraRomano(n) {
    const tabela = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let saida = '';
    for (const [valor, simbolo] of tabela) while (n >= valor) { saida += simbolo; n -= valor; }
    return saida;
  }

  // "XXI" vale; "IIX" e "VV" não. O teste é simples: escrever o número de volta tem que dar
  // exatamente a mesma string — só a forma canônica sobrevive a essa ida e volta.
  function ehCanonico(romano) {
    return romano.length > 0 && paraRomano(paraNumero(romano)) === romano;
  }

  // Cada número formável é um século, com uma lembrança do que rolou nele. São exatamente 19:
  // com os numerais que existem no livro (I a XI, um de cada), 1, 2, 5, 10 e 20 não têm como ser
  // montados — 20 precisaria de dois "X" — e 24 é o teto absoluto, o que faz dele a maestria.
  // Pra mexer num prêmio é só editar a linha; o resto do jogo não precisa saber de nada.
  // texto = frase curta do aviso na hora da conquista; detalhe (opcional) = a história completa,
  // mostrada na estante ao passar o mouse (sem detalhe, a estante repete o texto).
  const TROFEUS = {
    3: { id: 'romano-3',
          animacao: 'muralha',
          vitrine: 'elmo', vitrineNome: 'o elmo romano', // clicado na estante, abre o elmo em 3D
          imagem: 'assets/trofeus/romano-3.webp',
          titulo: 'Século III', 
          texto: 'O fim de um imperio?',
          detalhe: `O fim de um imperio?\n\n 
          Roma já havia conquistado um território maior que a atual União Europeia, com cerca de 5 milhões de km². Mas, no século III, 
          o império que parecia impossível de derrubar estava tão abalado que voltou a cercar sua própria capital com enormes muralhas.`},

/*///////////////////////////////*/


    4: { id: 'romano-4',
          imagem: 'assets/trofeus/romano-4.png',
          titulo: 'Século IV',
          texto: 'De perseguido a perseguidor.',
          detalhe: `De perseguido a perseguidor. \n\n
            Roma deixou de tentar destruir o cristianismo e passou a usar seu próprio poder para espalhá-lo. 
            Aquilo que antes era motivo de perseguição passou a ser protegido, incentivado e imposto pelo mesmo império que um dia tentou eliminá-lo.
            Essa transformação mudaria a Europa e, séculos depois, chegaria ao Brasil. `},

  /*///////////////////////////*/


    6: { id: 'romano-6',
       imagem: 'assets/trofeus/romano-6.png',
       titulo: 'Século VI',
       texto: 'Roma morreu. Suas leis não.',
       animacao: 'pergaminho',
       vitrine: 'pergaminho', vitrineNome: 'o pergaminho', // clicado na estante, abre ele em 3D
       detalhe: `Roma morreu. Suas leis não. \n\n 
          Um imperador ordenou que se reunissem, revisassem e organizassem séculos de leis espalhadas em diferentes documentos, escritos em papiro, pergaminho e tábuas de madeira enceradas, formando uma das maiores coleções jurídicas da Antiguidade.
          Séculos depois, esse legado influenciaria o direito europeu, e parte dessa tradição atravessaria mais de mil anos até chegar ao Brasil.` },


  /*////////////////////////////*/


    7: { id: 'romano-7',
        imagem: 'assets/trofeus/romano-7.png',
        titulo: 'Século VII',
        texto: 'A morte de um homem influencia até hoje.',
        detalhe:`A morte de um homem influencia até hoje. \n\n
            No século VII, Maomé começou a pregar o Islã. Após sua morte, seus sucessores continuaram sua expansão e, 
            em poucas décadas, o novo poder islâmico já dominava enormes territórios, mudando o mapa político e comercial da região. 
            Séculos depois, essa transformação faria parte do contexto que influenciou a formação de Portugal e de outros reinos europeus.` },

    /*/////////////////////////////*/


    8: { id: 'romano-8',
        imagem: 'assets/trofeus/romano-8.png',
        titulo: 'Século VIII',
        texto: 'O mundo começou a ser escrito.',
        detalhe: `O mundo começou a ser escrito. \n\n
            O papel já era produzido na China havia séculos, mas, durante o século VIII, sua fabricação começou a se espalhar para outras regiões. 
            A técnica chegou ao mundo islâmico e, nos séculos seguintes, continuou se espalhando e sendo aperfeiçoada em diferentes partes do mundo, 
            transformando a forma como textos e conhecimentos eram registrados e compartilhados.` },

    /*///////////////////////////////*/


    9: { id: 'romano-9',
        imagem: 'assets/trofeus/romano-9.png',
        titulo: 'Século IX',
        texto: 'Os vikings transformaram o mar em estrada.',
        detalhe: `Os vikings transformaram o mar em estrada. \n\n 
            Com navios avançados para sua época, que conseguiam navegar pelo oceano e em águas rasas, os vikings ampliaram enormemente o alcance de suas viagens. 
            No século IX, espalharam ataques, comércio e assentamentos por enormes distâncias, chegando à Inglaterra, Irlanda, França e Europa Oriental, criando uma rede que conectava regiões muito distantes entre si.` },

    /*///////////////////////////////*/


    11: { id: 'romano-11',
         imagem: 'assets/trofeus/romano-11.png',
         titulo: 'Século XI',
         texto: 'Os vikings chegaram à América.',
         detalhe: `Os vikings chegaram à América. \n\n
            Os vikings atravessaram o Atlântico Norte e chegaram à América do Norte, provando na prática que era possível cruzar o oceano e alcançar terras muito além da Europa.
            Enquanto os vikings exploravam novas fronteiras através do oceano, a Europa começava um novo período de conflitos. No final daquele século, começaria a Primeira Cruzada. ` },

    /*///////////////////////////////////*/


    12: { id: 'romano-12',
         imagem: 'assets/trofeus/romano-12.png',
         titulo: 'Século XII',
         texto: 'Enquanto a Europa guerreava, a floresta prosperava.',
         detalhe: `Enquanto a Europa guerreava, a floresta prosperava. \n\n
            Nesse período, o continente europeu enfrentava a Segunda e a Terceira Cruzada, ao mesmo tempo que Portugal consolidava sua independência e se estabelecia como reino.  
            Enquanto isso, a engenharia indígena brilhava no Brasil. Povos que se desenvolviam já havia séculos modificaram o solo com a Terra Preta, revolucionando a agricultura, e construíam redes de assentamentos com estradas, estruturas defensivas e ilhas artificiais.
            Essa era de inovação durou séculos, mas foi profundamente afetada pela chegada dos europeus, dizimando grande parte das populações que desenvolveram esses saberes. ` },

    /*////////////////////////////////*/


    13: { id: 'romano-13',
         imagem: 'assets/trofeus/romano-13.png',
         titulo: 'Século XIII',
         texto: 'Expansões de dois mundos.',
         detalhe: `Expansões de dois mundos. \n\n No século XIII, enquanto os indígenas no Brasil cruzavam grandes territórios, conectando aldeias do interior com as do litoral, expandindo a biotecnologia da Terra Preta e a química do Timbó para a pesca em larga escala, do outro lado do oceano o Império Mongol se expandia pela Ásia e chegava à Europa, tornando-se o maior império de terras contíguas da história e intensificando o comércio, a circulação de pessoas, mercadorias e conhecimentos entre diferentes partes da Eurásia.` },
    
    /*///////////////////////////////*/

    14: { id: 'romano-14',
        imagem: 'assets/trofeus/romano-14.png',
        titulo: 'Século XIV',
        texto: 'Quando a tragédia virou tecnologia.',
        detalhe: `Quando a tragédia virou tecnologia. \n\n No século XIV, a Europa foi atingida por duas forças que mudariam seu futuro. A Guerra dos Cem Anos impulsionou novas formas de combater, com armaduras cada vez mais sofisticadas e o avanço da artilharia de pólvora. Ao mesmo tempo, a Peste Negra matou uma enorme parcela da população e deixou regiões inteiras com falta de trabalhadores, aumentando os salários e dando mais poder de negociação à população trabalhadora, contribuindo para o enfraquecimento da servidão na Europa Ocidental.`   },

    /*///////////////////////////////*/

    15: { id: 'romano-15',
        animacao: 'barco',
        vitrine: 'caravela', vitrineNome: 'a caravela', // clicado na estante, abre o barco em 3D
        imagem: 'assets/trofeus/romano-15.png',
        titulo: 'Século XV',
        texto: 'O mundo ficou menor.', 
        detalhe: `O mundo ficou menor. \n\n No século XV, Gutenberg transformou a reprodução do conhecimento com a prensa de tipos móveis, enquanto Portugal e Espanha avançavam pelas Grandes Navegações, aperfeiçoando caravelas, mapas e técnicas de navegação astronômica. Livros passaram a ser reproduzidos em escala inédita e o Atlântico deixou de ser apenas uma fronteira: tornou-se uma rota. Do outro lado estava um continente que os europeus ainda não conheciam e a distância entre esses mundos estava prestes a desaparecer.` },
    
    
    /*///////////////////////////////*/


    16: { id: 'romano-16',
        imagem: 'assets/trofeus/romano-16.png',
        animacao: 'flechada',
        titulo: 'Século XVI',
        texto: 'O inimigo do meu inimigo é meu amigo.',
        detalhe: `O inimigo do meu inimigo é meu amigo. \n\n No século XVI, os portugueses chegaram ao Brasil e encontraram povos indígenas que já tinham suas próprias rivalidades. Eles souberam explorar essas divisões a seu favor: os Tamoios se aliaram aos franceses, enquanto grupos rivais dos Tamoios se aliaram aos colonizadores portugueses. A guerra chegou às aldeias, protegidas por paliçadas de troncos, onde guerreiros usavam arcos e flechas, incluindo flechas envenenadas. Enquanto isso, os portugueses avançavam sobre o território, explorando o pau-brasil, criando engenhos de açúcar e impondo a fé católica.`},

    /*///////////////////////////////*/

    17: { id: 'romano-17',
        imagem: 'assets/trofeus/romano-17.png',
        titulo: 'Século XVII',
        texto: 'A liberdade tinha endereço, e era na mata.',
        detalhe: `A liberdade tinha endereço, e era na mata. \n\n No século XVII, enquanto o Brasil colonial vivia sob o regime da escravidão, milhares de pessoas escravizadas fugiam dos engenhos e formavam comunidades de resistência em diferentes regiões. Entre elas, Palmares cresceu a ponto de formar uma rede de comunidades com agricultura, organização própria e sistemas de defesa, tornando-se uma ameaça tão grande que as autoridades coloniais precisaram enviar sucessivas expedições para destruí-lo. Palmares resistiu por décadas e acabou se tornando um dos maiores símbolos da resistência negra à escravidão no Brasil.

Enquanto isso, do outro lado do oceano, a Europa vivia a Revolução Científica: Galileu observava o céu com seu telescópio, Kepler calculava o movimento dos planetas e Newton formulava as leis do movimento e da gravidade. Enquanto Palmares lutava para construir e proteger uma sociedade livre, cientistas europeus tentavam descobrir as leis que governavam o universo.`},
    
  /*///////////////////////////////*/

  18: { id: 'romano-18',
      imagem: 'assets/trofeus/romano-18.png',
      titulo: 'Século XVIII',
      texto: 'Impostos altos não são novidades.',
      detalhe: `Impostos altos não são novidades. \n\n No século XVIII, o ouro transformou Minas Gerais em um dos centros mais ricos da América portuguesa, mas também trouxe uma cobrança cada vez maior de impostos pela Coroa. Com o tempo, a produção de ouro caiu, mas a pressão por impostos continuou, com isso surgiram revoltas e conspirações que defendiam o rompimento com Portugal.

Enquanto isso, a Europa entrava no Iluminismo e entrava na Revolução Industrial. No fim do século, a Revolução Francesa abalava a ordem política europeia.
`},

/*///////////////////////////////*/


    19: { id: 'romano-19',
       imagem: 'assets/trofeus/romano-19.png',
       titulo: 'Século XIX',
       texto: 'Tudo em um.',
       detalhe: `Tudo em um. \n\n No século XIX, enquanto o Brasil conquistava sua independência, transformava-se em Império e depois em República, enfrentava revoltas populares e abolía a escravidão, Hercule Florence desenvolvia no Brasil, de forma independente, um dos primeiros processos fotográficos do mundo. Enquanto isso, a Europa expandia seus impérios coloniais e vivia a Segunda Revolução Industrial, marcada pela expansão do uso da eletricidade, pelo desenvolvimento dos motores de combustão interna e, no fim do século, pela criação do cinema.`},

  
/*///////////////////////////////*/

  
    21: { id: 'romano-21', imagem: 'assets/trofeus/romano-21.png', titulo: 'Século XXI', texto: 'O livro alcançou o seu tempo.' },

    22: { id: 'romano-22', imagem: 'assets/trofeus/romano-22.png', titulo: 'Século XXII', texto: 'Você chegou antes do futuro.' },

    23: { id: 'romano-23', imagem: 'assets/trofeus/romano-23.png', titulo: 'Século XXIII', texto: 'Longe o bastante pra virar ficção científica.' },

    24: {
      id: 'romano-24', imagem: 'assets/trofeus/romano-24.png', titulo: 'Século XXIV — o fim da linha',
      texto: 'Não existe número maior. É, você dominou a arte dos numerais romanos.'
    }
  };

  Jogos.registrar({
    nome: 'romanos', // também é a aba da estante onde os troféus deste jogo aparecem
    // catálogo completo, em ordem de século — a estante precisa conhecer também os não conquistados
    trofeus: Object.values(TROFEUS),
    // grupo = peças encostadas, já em ordem da esquerda pra direita
    avaliar(grupo) {
      if (grupo.length < 2) return null; // uma peça sozinha não é "junção"
      if (!grupo.every(p => p.role === 'pageNumber')) return null;
      const juntas = grupo.map(p => p.text).join('');
      if (!ehCanonico(juntas)) return null;
      return TROFEUS[paraNumero(juntas)] || null;
    }
  });
})();

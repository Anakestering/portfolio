// =====================================================================
// CONTEÚDO DO LIVRO — a "fonte única de verdade". Pra adicionar/mudar
// páginas, mexa só neste arquivo — book.js lê estes dados e desenha o
// livro sozinho, sem precisar tocar em nenhuma lógica.
// =====================================================================
const BOOK_CONTENT = {
  cover: { title: 'Ana Kestering', subtitle: 'Desenvolvedora · FullStack' },
  contact: {
    title: 'Como me achar?',
    // label = o que aparece na página; value = pra onde o clique abre/copia (pode ser mais longo)
    lines: [
      { label: 'GitHub', value: 'https://github.com/Anakestering' },
      { label: 'E-mail', value: 'anakestering51@gmail.com' },
      { label: 'LinkedIn', value: 'https://www.linkedin.com/in/ana-paula-kestering-7a946a2bb/' }
    ]
  }
};

// Sumário — cada entrada é um item clicável do menu. targetSpread é o número de folhas
// viradas (o mesmo "current" interno) que mostra essa seção. "Projetos" leva pra página
// divisória (type:'section') que anuncia o bloco — os projetos em si são acessados virando
// a página a partir dali, sempre em pares lado a lado (esquerda/direita da mesma abertura).
// Referência rápida — qual targetSpread mostra o quê:
//   2 Tecnologias + Além do Software · 3 Interesses + divisória "Projetos"
//   4 Carrinho Autônomo + Console de Jogos · 5 Guarda-Vidas + Biblioteca
//   6 Portfólio Interativo + Em Construção · 7 Contato (contracapa, fecha o livro)
const tocEntries = [
  { label: 'Tecnologias & Ferramentas', targetSpread: 2 },
  { label: 'Além do Software', targetSpread: 2 },
  { label: 'Interesses de Exploração', targetSpread: 3 },
  { label: 'Projetos', targetSpread: 3 },
  { label: 'O que Estou Construindo', targetSpread: 6 },
  { label: 'Contatos', targetSpread: 7 }
];

// cada item é uma FOLHA física (tem frente e verso, como uma folha de papel real). front =
// o que se vê ANTES de virar essa folha; back = o que aparece DEPOIS de virar. Como o miolo do
// livro mostra sempre duas páginas lado a lado, um par "um lado / outro lado" descrito pelo
// usuário é o BACK de uma folha ao lado do FRONT da folha seguinte — não frente/verso da mesma.
const leavesData = [
  {
    front: { type: 'cover', title: BOOK_CONTENT.cover.title, subtitle: BOOK_CONTENT.cover.subtitle },
    back: { type: 'endpaper' }
  },
  {
    front: { type: 'toc', eyebrow: 'I', title: 'Sumário', entries: tocEntries },
    back: {
      type: 'page', eyebrow: 'II', title: 'Tecnologias',
      bullets: [
        'Frontend: Next.js, React, TypeScript, Tailwind, Vite, Three.js',
        'Backend: Java, Spring Boot, JPA, Hibernate, REST API, JWT',
        'BD: MySQL, SQL',
        'Testes: JUnit, MockMvc, JSONPath'
      ]
    }
  },
  {
    front: {
      type: 'page', eyebrow: 'III', title: 'Além do Software',
      bullets: [
        'Arduino, C/C++, eletrônica, microsoldagem',
        'Multímetro e leitura de esquemas elétricos',
        'Diagnóstico de circuitos e hardware',
        'Aprendizado autodidata via projetos práticos'
      ]
    },
    back: {
      type: 'page', eyebrow: 'IV', title: 'Interesses a explorar na area da tecnologia',
      bullets: [
        'Modelagem 3D para interfaces interativas',
        'Eletrônica e sistemas embarcados',
        'Explorar impressão 3D, corte a laser, prototipagem e fabricação de peças.'
      ]
    }
  },
  {
    front: {
      type: 'section', eyebrow: 'V', title: 'Projetos',
      items: [
        { label: 'Carrinho Autônomo', targetSpread: 4 },
        { label: 'Console de Jogos', targetSpread: 4 },
        { label: 'Guarda-Vidas', targetSpread: 5 },
        { label: 'Biblioteca', targetSpread: 5 },
        { label: 'Portfólio Interativo', targetSpread: 6 }
      ]
    },
    back: {
      type: 'page', eyebrow: 'VI', title: 'Carrinho Autônomo',
      bullets: [
        'Detecta obstáculos e desvia sozinho',
        'Arduino, C/C++, sensores, motores'
      ],
      // toca uma vez (do traço em branco até o desenho completo) sempre que a página é aberta,
      // depois congela no desenho final — ver playGifOnce em pixel-art.js / book.js.
      gif: 'assets/carrinho-autonomo.gif',
      imageMargin: 6 // menos margem que o padrão (16) — deixa o desenho bem maior na página
    }
  },
  {
    front: {
      type: 'page', eyebrow: 'VII', title: 'Console de Jogos',
      bullets: [
        'Console físico com Stacker e Snake',
        'Matriz LED 8x8 + componentes eletrônicos',
        'Arduino, C/C++, eletrônica'
      ]
    },
    back: {
      type: 'page', eyebrow: 'VIII', title: 'Guarda-Vidas',
      bullets: [
        'Gestão de postos e registros operacionais',
        'React, Spring Boot, Java, MySQL'
      ],
      // fica alternando entre esses prints em loop contínuo enquanto a página estiver aberta —
      // ver playSlideshowLoop em pixel-art.js / book.js.
      images: [
        'assets/guardavidas-1-login.png',
        'assets/guardavidas-2-postos.png',
        'assets/guardavidas-3-registros.png',
        'assets/guardavidas-4-relatorios.png',
        'assets/guardavidas-5-posto1.png'
      ]
    }
  },
  {
    front: {
      type: 'page', eyebrow: 'IX', title: 'Biblioteca',
      bullets: [
        'Reservas, aprovações e dashboard admin',
        'Next.js, TypeScript, Spring Boot, MySQL'
      ],
      // fica alternando entre esses prints em loop contínuo enquanto a página estiver aberta —
      // ver playSlideshowLoop em pixel-art.js / book.js.
      images: [
        'assets/biblioteca-1-login.png',
        'assets/biblioteca-2-reserva.png',
        'assets/biblioteca-3-reserva.png',
        'assets/biblioteca-4-estatisticas.png',
        'assets/biblioteca-6-relatorio.png'
      ]
    },
    back: {
      type: 'page', eyebrow: 'X', title: 'Portfólio Interativo',
      bullets: [
        'O próprio portfólio como projeto experimental',
        'Interfaces 3D e novas formas de interação',
        'Next.js, Three.js, TypeScript'
      ]
    }
  },
  {
    front: {
      type: 'page', eyebrow: 'XI', title: 'Em Construção',
      bullets: [
        'Assistência Técnica — estoque, serviços, vendas',
        'Aluguel de Caixas — clientes, aluguéis, divulgação'
      ]
    },
    back: { type: 'cover', title: BOOK_CONTENT.contact.title, subtitle: 'Vamos conversar', contacts: BOOK_CONTENT.contact.lines }
  }
];

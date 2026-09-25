# Portfólio — O Livro

Um portfólio em forma de livro 3D: a pessoa gira o livro na mesa, abre, folheia as
páginas e lê os projetos. Tudo é desenhado em tempo real com three.js — não há
imagem de página pronta, nem vídeo.

**Ao vivo:** https://anakestering.github.io/portfolio/

## Como rodar

Não tem build nem dependência pra instalar. É um site estático: basta servir a pasta.

```bash
npx serve . -l 5757
```

E abrir `http://localhost:5757`. Abrir o `index.html` direto pelo sistema de arquivos
não funciona, porque o navegador bloqueia o carregamento dos módulos e texturas por
`file://`.

## O que tem dentro

**As páginas são geradas por código.** Cada página é uma textura desenhada num canvas
a partir do conteúdo em `content.js` — a fonte pixel, o título, as listas, as imagens
dos projetos. Trocar um texto não exige refazer imagem nenhuma.

**As letras são objetos de verdade.** As setas e runas espalhadas pelas páginas não
são desenho: são objetos 3D que dá pra pegar e arrastar pela folha, inclusive levando
de uma página pra outra. É nisso que se apoia o joguinho.

**Um jogo de numerais romanos.** Juntando as peças certas na página, o livro reconhece
o numeral formado e entrega um troféu do século correspondente — dezenove deles, com
o texto histórico de cada um. Os troféus ficam guardados numa estante, e quatro deles
abrem uma cena 3D de comemoração:

| século | cena |
|---|---|
| III | uma muralha romana sobe e um soldado espia por trás dela |
| VI | um pergaminho se desenrola no meio da tela |
| XV | uma caravela portuguesa atravessa a tela |
| XVI | uma paliçada de troncos e uma saraivada de flechas |

Três desses objetos abrem também numa vitrine, pra girar, aproximar e deslocar — o
mesmo manuseio dos programas de modelagem.

**O pergaminho abre de verdade.** A forma dele é recalculada quadro a quadro: o papel
tem um lugar fixo na tira, e abrir é deixar sair papel que estava enrolado no varão,
que afina na mesma medida. Foi feito assim, e não com um modelo pronto, justamente
porque um arquivo `.glb` vem numa pose só e não se desenrola.

**No celular, uma página por vez.** A página dupla não cabe numa tela em pé, então
abaixo de 760px o livro enquadra uma página de cada vez; tocar nas laterais anda na
sequência de leitura e dois dedos dão zoom.

**Nada vem de CDN.** As bibliotecas e as fontes moram em `vendor/`. O site é mostrado
em rede de escola, e rede de escola bloqueia CDN sem avisar — faltando o three.js não
seria um detalhe a menos, seria a tela inteira em branco.

## Como está organizado

```
index.html          a página; carrega tudo na ordem
content.js          o conteúdo do livro (textos, projetos, contatos)
pixel-art.js        desenha as páginas e a fonte pixel no canvas
book.js             o livro em si: cena, folhear, arrastar as peças, celular
trofeu-icones.js    os ícones dos troféus
trofeus.js          a estante e o registro dos troféus
jogo-romanos.js     a regra do jogo e o texto de cada século
cenas-trofeu.js     quais cenas e vitrines existem, e os números de cada uma
vitrine-3d.js       girar/aproximar/deslocar, compartilhado pelas vitrines
muralha-3d.js       cena do século III  (e a vitrine do elmo)
pergaminho-3d.js    cena do século VI   (e a vitrine do pergaminho)
barco-3d.js         cena do século XV   (e a vitrine da caravela)
flechada-3d.js      cena do século XVI
book.css            todo o estilo
assets/             imagens dos projetos, texturas, ícones e o modelo do barco
vendor/             three.js, GLTFLoader, gifuct-js e as fontes
```

## Créditos

Os recursos de terceiros são todos de uso livre:

- **three.js** (MIT) — o motor 3D
- **gifuct-js** (MIT) — decodifica os GIFs dos projetos quadro a quadro, pra dar
  controle de quando tocar e quando congelar
- **Kenney** (CC0) — o modelo da caravela é o *ship-large* do Pirate Kit, de
  [kenney.nl](https://kenney.nl), com o casco e as velas retrabalhados aqui
- **Poly Haven** (CC0) — as fotos de pedra e de casca de árvore
- **Google Fonts** (OFL) — Pixelify Sans, Silkscreen e Jacquarda Bastarda 9

# Portfólio — O Livro

Um portfólio em forma de livro 3D: gira o livro na mesa, abre e folheia as páginas.
Feito com three.js, sem build e sem dependência pra instalar.

**Ao vivo:** https://anakestering.github.io/portfolio/

## Rodar

```bash
npx serve . -l 5757
```

Abrir em `http://localhost:5757`. Abrir o `index.html` direto pelo sistema de
arquivos não funciona — o navegador bloqueia módulos e texturas por `file://`.

## Arquivos

| | |
|---|---|
| `content.js` | o conteúdo do livro |
| `pixel-art.js` | desenha as páginas no canvas |
| `book.js` | o livro: folhear, arrastar as peças, celular |
| `trofeus.js` | os troféus e a estante |
| `*-3d.js` | as cenas de comemoração e as vitrines |
| `vendor/` | three.js e as fontes, locais em vez de CDN |

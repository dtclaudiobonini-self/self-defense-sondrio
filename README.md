# Self Defense Sondrio – sito Astro

Progetto Astro statico predisposto per GitHub e Cloudflare Pages.

## Apertura in VS Code

1. Estrai lo ZIP.
2. Apri la cartella `self-defense-sondrio-astro` in Visual Studio Code.
3. Apri il terminale integrato.
4. Esegui:

```bash
npm install
npm run dev
```

Il sito sarà disponibile, normalmente, su `http://localhost:4321`.

## Build di produzione

```bash
npm run build
```

La cartella generata sarà `dist`.

## Cloudflare Pages

- Framework preset: Astro
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/`
- Node.js: 20 o superiore

Collega il repository GitHub a Cloudflare Pages. Ogni push sul branch principale
avvierà automaticamente una nuova pubblicazione.

## Immagini

Sostituisci i segnaposto nelle cartelle:

- `public/images/hero`
- `public/images/staff`
- `public/images/gallery`
- `public/images/news`

I testi sono stati importati dal sito esistente e riorganizzati. Prima della
pubblicazione definitiva aggiorna i dati della nuova ASD, gli indirizzi social,
le fotografie e l'informativa privacy.

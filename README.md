# Zero Dash One

Landing page for Zero Dash One holding company.

**Live:** [www.zerodashone.com](https://www.zerodashone.com)

## Stack

- Vanilla JavaScript + Canvas2D API (no frameworks, no libraries except `qrcode.min.js`)
- Single HTML file output (~26KB gzipped)
- Deployed on Vercel

## Features

- Bouncing triangles with arrowhead vertices
- Blue glass accent triangle
- Split-flap airport display (upper right)
- QR code hover reveal with guide arrows
- Origami-inspired click animation + swarm
- Konami code easter egg (inverted color mode)
- Film grain shader overlay
- Mouse repulsion
- Constellation connection lines

## Build

```bash
npm install
npm run build
```

The build step:
1. Obfuscates `src/sketch.js` via `javascript-obfuscator`
2. Minifies with `terser`
3. Inlines everything (JS + QR lib) into a single `dist/index.html`
4. Stamps the version from `package.json` into a `<meta name="version">` tag

## Dev

```bash
npm run dev
```

Copies unobfuscated sketch to `public/` for local development. Serve `public/` with any static server.

## Version

Version is tracked in `package.json` and injected into the HTML `<meta name="version">` tag at build time. Bump with:

```bash
npm version patch  # 1.0.0 -> 1.0.1
npm version minor  # 1.0.0 -> 1.1.0
npm version major  # 1.0.0 -> 2.0.0
```

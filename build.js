const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const { minify } = require('terser');

async function build() {
  const src = fs.readFileSync(path.join(__dirname, 'src', 'sketch.js'), 'utf8');
  const qrSrc = fs.readFileSync(path.join(__dirname, 'public', 'qrcode.min.js'), 'utf8');
  const htmlTemplate = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

  // Step 1: Obfuscate sketch.js
  const obfuscated = JavaScriptObfuscator.obfuscate(src, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.3,
    deadCodeInjection: false,
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,
    selfDefending: false,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.5,
    transformObjectKeys: true,
    unicodeEscapeSequence: false
  });

  // Step 2: Minify with terser
  const result = await minify(obfuscated.getObfuscatedCode(), {
    compress: {
      dead_code: true,
      drop_console: true,
      passes: 2
    },
    mangle: false
  });

  const obfuscatedSketch = result.code;

  // Step 3: Build single HTML file with everything inlined
  let html = htmlTemplate;

  // Inject version from package.json
  html = html.replace(/<meta name="version" content="[^"]*">/, `<meta name="version" content="${pkg.version}">`);
  html = html.replace('<!--BUILD_DATE-->', new Date().toISOString().split('T')[0]);

  // Remove external script tags
  html = html.replace(/<script src="\/qrcode\.min\.js"><\/script>\n?/, '');
  html = html.replace(/<script src="\/sketch\.js"><\/script>\n?/, '');

  // Inject inlined scripts before </body>
  const inlinedScripts = `  <script>${qrSrc}</script>\n  <script>${obfuscatedSketch}</script>\n`;
  html = html.replace('</body>', inlinedScripts + '</body>');

  // Write the single HTML file
  fs.writeFileSync(path.join(__dirname, 'public', 'index.html.bak'), htmlTemplate);
  fs.writeFileSync(path.join(__dirname, 'dist', 'index.html'), html);

  // Also keep favicon in dist
  const faviconSrc = path.join(__dirname, 'public', 'favicon.svg');
  if (fs.existsSync(faviconSrc)) {
    fs.copyFileSync(faviconSrc, path.join(__dirname, 'dist', 'favicon.svg'));
  }

  // Report sizes
  const srcSize = Buffer.byteLength(src) + Buffer.byteLength(qrSrc);
  const outSize = Buffer.byteLength(html);
  console.log(`Build complete — single HTML file`);
  console.log(`  Source: ${(Buffer.byteLength(src)/1024).toFixed(1)}KB sketch + ${(Buffer.byteLength(qrSrc)/1024).toFixed(1)}KB qrcode = ${(srcSize/1024).toFixed(1)}KB`);
  console.log(`  Output: ${(outSize/1024).toFixed(1)}KB (index.html with everything inlined)`);
}

build().catch(err => { console.error(err); process.exit(1); });

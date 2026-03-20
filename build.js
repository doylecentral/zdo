const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const { minify } = require('terser');

async function build() {
  const src = fs.readFileSync(path.join(__dirname, 'src', 'sketch.js'), 'utf8');

  // Step 1: Obfuscate — lighter settings to avoid size bloat
  const obfuscated = JavaScriptObfuscator.obfuscate(src, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.3, // reduced from 0.5
    deadCodeInjection: false,             // was biggest size offender
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,                 // p5.js globals must stay intact
    selfDefending: false,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.5,            // reduced from 0.75
    transformObjectKeys: true,
    unicodeEscapeSequence: false
  });

  // Step 2: Minify with terser for additional compression
  const result = await minify(obfuscated.getObfuscatedCode(), {
    compress: {
      dead_code: true,
      drop_console: true,
      passes: 2
    },
    mangle: false // already obfuscated
  });

  const output = result.code;
  fs.writeFileSync(path.join(__dirname, 'public', 'sketch.js'), output);

  // Report sizes
  const srcSize = Buffer.byteLength(src);
  const outSize = Buffer.byteLength(output);
  const ratio = ((1 - outSize / srcSize) * 100).toFixed(1);
  console.log(`Build complete — ${(srcSize/1024).toFixed(1)}KB source → ${(outSize/1024).toFixed(1)}KB obfuscated (${ratio}% reduction)`);
}

build().catch(err => { console.error(err); process.exit(1); });

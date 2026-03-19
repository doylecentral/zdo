const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const src = fs.readFileSync(path.join(__dirname, 'src', 'sketch.js'), 'utf8');

const obfuscated = JavaScriptObfuscator.obfuscate(src, {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.2,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,  // p5.js globals must stay intact
  selfDefending: false,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  transformObjectKeys: true,
  unicodeEscapeSequence: false
});

fs.writeFileSync(
  path.join(__dirname, 'public', 'sketch.js'),
  obfuscated.getObfuscatedCode()
);

console.log('Build complete — public/sketch.js obfuscated');

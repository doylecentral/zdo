// ═══════════════════════════════════════════════════════════════════
// Zero Dash One — Pure Canvas2D rewrite (no p5.js)
// ═══════════════════════════════════════════════════════════════════

// ─── Math constants ───
const PI = Math.PI;
const TWO_PI = PI * 2;
const HALF_PI = PI / 2;

// ─── Lightweight utility functions ───
function random(a, b) {
  if (a === undefined) return Math.random();
  if (b === undefined) {
    if (Array.isArray(a)) return a[Math.floor(Math.random() * a.length)];
    return Math.random() * a;
  }
  return a + Math.random() * (b - a);
}
function lerp(a, b, t) { return a + (b - a) * t; }
function constrain(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function dist(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return Math.sqrt(dx * dx + dy * dy); }
function map(v, inLo, inHi, outLo, outHi) { return outLo + (outHi - outLo) * ((v - inLo) / (inHi - inLo)); }
const floor = Math.floor;
const min = Math.min;
const max = Math.max;
const sin = Math.sin;
const cos = Math.cos;
const atan2 = Math.atan2;
const sqrt = Math.sqrt;
const abs = Math.abs;
const pow = Math.pow;

// ─── Perlin noise (classic implementation) ───
const _noiseP = new Uint8Array(512);
const _noiseG = [];
(function initNoise() {
  const perm = new Uint8Array(256);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = floor(random(i + 1));
    const tmp = perm[i]; perm[i] = perm[j]; perm[j] = tmp;
  }
  for (let i = 0; i < 512; i++) _noiseP[i] = perm[i & 255];
  for (let i = 0; i < 256; i++) {
    const a = random(TWO_PI);
    _noiseG[i] = [cos(a), sin(a)];
  }
})();

function _noiseFade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function _noiseDot(gi, x, y) { return _noiseG[gi][0] * x + _noiseG[gi][1] * y; }

function noise(x, y, z) {
  if (y === undefined) y = 0;
  if (z === undefined) z = 0;
  // Combine z into x/y for a simple 2D noise seeded by z
  x += z * 31.7;
  y += z * 17.3;
  const X = floor(x) & 255, Y = floor(y) & 255;
  const xf = x - floor(x), yf = y - floor(y);
  const u = _noiseFade(xf), v = _noiseFade(yf);
  const aa = _noiseP[_noiseP[X] + Y];
  const ab = _noiseP[_noiseP[X] + Y + 1];
  const ba = _noiseP[_noiseP[X + 1] + Y];
  const bb = _noiseP[_noiseP[X + 1] + Y + 1];
  const x1 = lerp(_noiseDot(aa, xf, yf), _noiseDot(ba, xf - 1, yf), u);
  const x2 = lerp(_noiseDot(ab, xf, yf - 1), _noiseDot(bb, xf - 1, yf - 1), u);
  return lerp(x1, x2, v) * 0.5 + 0.5; // map to 0-1
}

// ─── Canvas setup ───
const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
const ctx = canvas.getContext('2d');

let width, height;
let mouseX = 0, mouseY = 0;
let frameCount = 0;

function resizeCanvas() {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
}

window.addEventListener('resize', resizeCanvas);
canvas.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; handleMouseMoved(); });
canvas.addEventListener('mousedown', (e) => { mouseX = e.clientX; mouseY = e.clientY; handleMousePressed(); });

// ─── State ───
let triangles = [];
const NUM_TRIANGLES = 18;
let helloTriangleIndex;
let blueArrowIndex;
let qrTriangleIndex;

const BLUE_GLASS = [70, 150, 220];
const ORANGE_GLASS = [220, 130, 50];

// Konami
const KONAMI_SEQ = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65];
let konamiPos = 0;
let inverted = false;
let invertT = 0;

// QR
let qrMatrix = null;
let qrModuleCount = 0;
let qrReveal = 0;
let qrHovering = false;

// Grain
let grainCanvas, grainCtx;
let grainTick = 0;

// Split-flap
const FLAP_TEXT = 'ZERO DASH ONE';
const FLAP_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -';
let flapSlots = [];
let flapIntroTimer = 0;
let flapSettled = false;

// Origami
let origami = {
  active: false, timer: 0, duration: 300,
  shards: [], foldLines: [],
  centerX: 0, centerY: 0
};

// Swarm
let swarm = { active: false, arrows: [], timer: 0, settledOnEdges: false };
const SWARM_DURATION = 600;
const SWARM_SETTLE_START = 360;
const MIN_HELLO_SIZE = 60;

// ─── Konami listener ───
window.addEventListener('keydown', (e) => {
  if (e.keyCode === KONAMI_SEQ[konamiPos]) {
    konamiPos++;
    if (konamiPos >= KONAMI_SEQ.length) {
      inverted = !inverted;
      konamiPos = 0;
    }
  } else {
    konamiPos = (e.keyCode === KONAMI_SEQ[0]) ? 1 : 0;
  }
});

// ─── Color helpers ───
function bgColor() {
  const v = lerp(0, 245, invertT);
  return [v, v, v];
}

function fgColorVal() {
  return lerp(255, 15, invertT);
}

function accentColor() {
  return [
    lerp(BLUE_GLASS[0], ORANGE_GLASS[0], invertT),
    lerp(BLUE_GLASS[1], ORANGE_GLASS[1], invertT),
    lerp(BLUE_GLASS[2], ORANGE_GLASS[2], invertT)
  ];
}

function rgba(r, g, b, a) {
  if (g === undefined) return `rgba(${floor(r)},${floor(r)},${floor(r)},${(a !== undefined ? a : 255) / 255})`;
  return `rgba(${floor(r)},${floor(g)},${floor(b)},${(a !== undefined ? a : 255) / 255})`;
}

// ─── Setup ───
function setup() {
  resizeCanvas();

  buildQR('mailto:doyle@doylecentral.com');

  // Grain buffer
  grainCanvas = document.createElement('canvas');
  grainCanvas.width = 128;
  grainCanvas.height = 128;
  grainCtx = grainCanvas.getContext('2d');
  refreshGrain();

  for (let i = 0; i < NUM_TRIANGLES; i++) {
    let isBackground = i >= 12;
    triangles.push({
      x: random(width * 0.1, width * 0.9),
      y: random(height * 0.1, height * 0.9),
      size: isBackground ? random(100, 250) : random(30, 120),
      angle: random(TWO_PI),
      speed: random(0.003, 0.015) * (random() > 0.5 ? 1 : -1),
      sw: isBackground ? random(0.5, 1) : random(1, 2.5),
      alpha: isBackground ? 25 : 60,
      drift: { x: random(-0.3, 0.3), y: random(-0.3, 0.3) },
      layer: isBackground ? 'bg' : 'fg',
      flashTimer: 0,
      origSave: null
    });
  }

  pickSpecialTriangles();
  initSplitFlap();

  canvas.classList.add('loaded');
}

function initSplitFlap() {
  flapSlots = [];
  flapIntroTimer = 0;
  flapSettled = false;
  for (let i = 0; i < FLAP_TEXT.length; i++) {
    let target = FLAP_TEXT[i];
    flapSlots.push({
      target: target,
      current: FLAP_CHARS[floor(random(FLAP_CHARS.length))],
      settled: false,
      settleDelay: 60 + i * 12,
      flipTimer: 0,
      flipInterval: floor(random(3, 6)),
      flipPhase: 0
    });
  }
}

// ─── QR generation ───
function buildQR(data) {
  if (typeof qrcode === 'undefined') return;
  let qr = qrcode(0, 'M');
  qr.addData(data);
  qr.make();
  qrModuleCount = qr.getModuleCount();
  qrMatrix = [];
  for (let r = 0; r < qrModuleCount; r++) {
    qrMatrix[r] = [];
    for (let c = 0; c < qrModuleCount; c++) {
      qrMatrix[r][c] = qr.isDark(r, c);
    }
  }
}

function drawQRAtTriangle(t) {
  if (!qrMatrix || qrReveal <= 0.01) return;

  let qrSize = max(160, t.size * 2.2);
  let moduleSize = qrSize / qrModuleCount;
  let ox = t.x - qrSize / 2;
  let oy = t.y - qrSize / 2;
  let acc = accentColor();

  ctx.save();

  // Background plate
  let plateAlpha = qrReveal * 200;
  if (inverted) {
    ctx.fillStyle = rgba(245, 245, 245, plateAlpha);
  } else {
    ctx.fillStyle = rgba(0, 0, 0, plateAlpha);
  }
  // Rounded rect centered on t.x, t.y
  let pw = qrSize + 16, ph = qrSize + 16;
  let pr = 4;
  let px = t.x - pw / 2, py = t.y - ph / 2;
  ctx.beginPath();
  ctx.moveTo(px + pr, py);
  ctx.lineTo(px + pw - pr, py);
  ctx.quadraticCurveTo(px + pw, py, px + pw, py + pr);
  ctx.lineTo(px + pw, py + ph - pr);
  ctx.quadraticCurveTo(px + pw, py + ph, px + pw - pr, py + ph);
  ctx.lineTo(px + pr, py + ph);
  ctx.quadraticCurveTo(px, py + ph, px, py + ph - pr);
  ctx.lineTo(px, py + pr);
  ctx.quadraticCurveTo(px, py, px + pr, py);
  ctx.closePath();
  ctx.fill();

  // QR modules
  let totalModules = qrModuleCount * qrModuleCount;
  let revealedCount = floor(qrReveal * totalModules * 1.3);

  let idx = 0;
  for (let r = 0; r < qrModuleCount; r++) {
    for (let c = 0; c < qrModuleCount; c++) {
      if (qrMatrix[r][c] && idx < revealedCount) {
        let mx = ox + c * moduleSize;
        let my = oy + r * moduleSize;
        let isFinder = (r < 7 && c < 7) || (r < 7 && c >= qrModuleCount - 7) || (r >= qrModuleCount - 7 && c < 7);
        if (isFinder) {
          ctx.fillStyle = rgba(acc[0], acc[1], acc[2], qrReveal * 255);
        } else {
          let fg = inverted ? 15 : 255;
          ctx.fillStyle = rgba(fg, fg, fg, qrReveal * 220);
        }
        let ms = moduleSize * 0.9;
        ctx.fillRect(mx + (moduleSize - ms) / 2, my + (moduleSize - ms) / 2, ms, ms);
      }
      idx++;
    }
  }

  // Scan label
  let labelAlpha = constrain((qrReveal - 0.6) / 0.4, 0, 1) * 180;
  if (labelAlpha > 0) {
    let ts = constrain(qrSize * 0.08, 10, 16);
    ctx.fillStyle = rgba(acc[0], acc[1], acc[2], labelAlpha);
    ctx.font = `${ts}px Helvetica`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('scan me', t.x, t.y + qrSize / 2 + 14);
  }

  ctx.restore();
}

// ─── QR Icon ───
function drawQRIcon(triSize) {
  let s = constrain(triSize * 0.4, 16, 42);
  let u = s / 7;
  let fg = fgColorVal();
  let acc = accentColor();
  let half = s / 2;
  let a = 160;

  function finderPattern(fpx, fpy) {
    // Outer ring
    ctx.strokeStyle = rgba(acc[0], acc[1], acc[2], a);
    ctx.lineWidth = constrain(u * 0.35, 0.5, 1.5);
    ctx.strokeRect(fpx, fpy, u * 3, u * 3);
    // Inner dot
    ctx.fillStyle = rgba(acc[0], acc[1], acc[2], a);
    ctx.fillRect(fpx + u, fpy + u, u, u);
  }

  finderPattern(-half, -half);
  finderPattern(-half + u * 4, -half);
  finderPattern(-half, -half + u * 4);

  // Data dots
  ctx.fillStyle = rgba(fg, fg, fg, a * 0.7);
  let dotSize = u * 0.8;
  ctx.fillRect(-half + u * 4.5, -half + u * 4.5, dotSize, dotSize);
  ctx.fillRect(-half + u * 5.5, -half + u * 5, dotSize, dotSize);
  ctx.fillRect(-half + u * 4, -half + u * 6, dotSize, dotSize);
  ctx.fillRect(-half + u * 5.5, -half + u * 6, dotSize, dotSize);

  ctx.fillRect(-half + u * 3.5, -half + u * 1, dotSize, dotSize);
  ctx.fillRect(-half + u * 3.5, -half + u * 2.5, dotSize, dotSize);
  ctx.fillRect(-half + u * 1.5, -half + u * 3.5, dotSize, dotSize);
  ctx.fillRect(-half + u * 3, -half + u * 3.5, dotSize, dotSize);

  ctx.fillRect(-half + u * 5, -half + u * 2, dotSize, dotSize);
  ctx.fillRect(-half + u * 6, -half + u * 3, dotSize, dotSize);
}

// ─── Grain ───
function refreshGrain() {
  let imgData = grainCtx.createImageData(128, 128);
  let d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    let v = floor(random(256));
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
    d[i + 3] = 255;
  }
  grainCtx.putImageData(imgData, 0, 0);
}

function drawGrain() {
  grainTick++;
  if (grainTick % 4 === 0) refreshGrain();

  ctx.save();
  ctx.globalAlpha = inverted ? 0.03 : 0.045;
  ctx.globalCompositeOperation = inverted ? 'multiply' : 'screen';

  for (let x = 0; x < width; x += 128) {
    for (let y = 0; y < height; y += 128) {
      ctx.drawImage(grainCanvas, x, y);
    }
  }

  ctx.globalAlpha = 1.0;
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

// ─── Triangle picking ───
function pickSpecialTriangles() {
  let candidates = [];
  for (let i = 0; i < 12; i++) {
    if (triangles[i].size >= MIN_HELLO_SIZE) candidates.push(i);
  }
  if (candidates.length === 0) {
    for (let i = 0; i < 12; i++) candidates.push(i);
  }
  helloTriangleIndex = candidates[floor(random(candidates.length))];

  do {
    blueArrowIndex = floor(random(0, 12));
  } while (blueArrowIndex === helloTriangleIndex);

  let qrCandidates = [];
  for (let i = 0; i < 12; i++) {
    if (i !== helloTriangleIndex && i !== blueArrowIndex && triangles[i].size >= 50) {
      qrCandidates.push(i);
    }
  }
  if (qrCandidates.length === 0) {
    for (let i = 0; i < 12; i++) {
      if (i !== helloTriangleIndex && i !== blueArrowIndex) qrCandidates.push(i);
    }
  }
  qrTriangleIndex = qrCandidates[floor(random(qrCandidates.length))];
}

// ─── Swarm ───
function spawnSwarm(cx, cy) {
  swarm.active = true;
  swarm.timer = 0;
  swarm.settledOnEdges = false;
  swarm.arrows = [];

  for (let i = 0; i < triangles.length; i++) {
    let t = triangles[i];
    let isBlue = (i === blueArrowIndex);

    for (let j = 0; j < 3; j++) {
      let vertAngle = (TWO_PI / 3) * j - HALF_PI;
      let vx = cos(vertAngle) * t.size;
      let vy = sin(vertAngle) * t.size;

      let cosA = cos(t.angle);
      let sinA = sin(t.angle);
      let worldX = t.x + vx * cosA - vy * sinA;
      let worldY = t.y + vx * sinA + vy * cosA;

      let nextVertAngle = (TWO_PI / 3) * ((j + 1) % 3) - HALF_PI;
      let nx = cos(nextVertAngle) * t.size;
      let ny = sin(nextVertAngle) * t.size;
      let edgeAngle = atan2(ny - vy, nx - vx) + t.angle;

      let edge = floor(random(4));
      let targetX, targetY, targetAngle;
      switch (edge) {
        case 0: targetX = random(width); targetY = 0; targetAngle = HALF_PI; break;
        case 1: targetX = width; targetY = random(height); targetAngle = PI; break;
        case 2: targetX = random(width); targetY = height; targetAngle = -HALF_PI; break;
        case 3: targetX = 0; targetY = random(height); targetAngle = 0; break;
      }

      swarm.arrows.push({
        x: worldX, y: worldY, angle: edgeAngle,
        size: t.size, sw: t.sw, isBlue: isBlue,
        alpha: isBlue ? 180 : lerp(t.alpha, 255, t.flashTimer),
        vx: (worldX - cx) * 0.05 + random(-4, 4),
        vy: (worldY - cy) * 0.05 + random(-4, 4),
        rotSpeed: random(-0.15, 0.15),
        targetX: targetX, targetY: targetY, targetAngle: targetAngle,
        settled: false
      });
    }
  }
}

function drawSwarmArrow(a) {
  let arrowLen = a.size * 0.22;
  let arrowWidth = a.size * 0.12;
  let acc = accentColor();

  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(a.angle);

  ctx.lineWidth = a.sw * 0.8;

  if (a.isBlue) {
    ctx.fillStyle = rgba(acc[0], acc[1], acc[2], a.alpha * 0.3);
    ctx.strokeStyle = rgba(acc[0], acc[1], acc[2], a.alpha);
    ctx.shadowColor = `rgba(${floor(acc[0])},${floor(acc[1])},${floor(acc[2])},0.4)`;
    ctx.shadowBlur = 8;
  } else {
    ctx.fillStyle = 'transparent';
    let fg = fgColorVal();
    ctx.strokeStyle = rgba(fg, fg, fg, a.alpha);
    ctx.shadowBlur = 0;
  }

  ctx.beginPath();
  ctx.moveTo(arrowLen, 0);
  ctx.lineTo(-arrowLen * 0.4, -arrowWidth);
  ctx.lineTo(-arrowLen * 0.1, 0);
  ctx.lineTo(-arrowLen * 0.4, arrowWidth);
  ctx.closePath();
  if (a.isBlue) ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.restore();
}

function updateSwarm() {
  if (!swarm.active) return;
  swarm.timer++;

  let settling = swarm.timer > SWARM_SETTLE_START;
  let settleProgress = settling ? constrain((swarm.timer - SWARM_SETTLE_START) / (SWARM_DURATION - SWARM_SETTLE_START), 0, 1) : 0;
  let easedSettle = easeInOutCubic(settleProgress);

  for (let a of swarm.arrows) {
    if (settling) {
      a.x = lerp(a.x, a.targetX, easedSettle * 0.08);
      a.y = lerp(a.y, a.targetY, easedSettle * 0.08);
      a.angle = lerpAngle(a.angle, a.targetAngle, easedSettle * 0.06);
      a.vx *= 0.92;
      a.vy *= 0.92;
      a.rotSpeed *= 0.92;
    } else {
      let noiseVal = noise(a.x * 0.003, a.y * 0.003, frameCount * 0.01);
      a.vx += cos(noiseVal * TWO_PI * 2) * 0.3;
      a.vy += sin(noiseVal * TWO_PI * 2) * 0.3;

      let speed = sqrt(a.vx * a.vx + a.vy * a.vy);
      if (speed > 6) {
        a.vx = (a.vx / speed) * 6;
        a.vy = (a.vy / speed) * 6;
      }

      if (a.x < 10) { a.x = 10; a.vx = abs(a.vx); }
      if (a.x > width - 10) { a.x = width - 10; a.vx = -abs(a.vx); }
      if (a.y < 10) { a.y = 10; a.vy = abs(a.vy); }
      if (a.y > height - 10) { a.y = height - 10; a.vy = -abs(a.vy); }
    }

    a.x += a.vx;
    a.y += a.vy;
    a.angle += a.rotSpeed;

    drawSwarmArrow(a);
  }

  if (swarm.timer > SWARM_DURATION) {
    let fadeOut = constrain((swarm.timer - SWARM_DURATION) / 60, 0, 1);
    for (let a of swarm.arrows) {
      a.alpha *= (1 - fadeOut);
    }
    if (fadeOut >= 1) {
      swarm.active = false;
      swarm.arrows = [];
    }
  }
}

function lerpAngle(a, b, t) {
  let diff = b - a;
  while (diff > PI) diff -= TWO_PI;
  while (diff < -PI) diff += TWO_PI;
  return a + diff * t;
}

// ─── Arrow + Triangle drawing ───

function drawArrowhead(x, y, angle, size, isBlue) {
  let arrowLen = size * 0.22;
  let arrowWidth = size * 0.12;
  let acc = accentColor();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.beginPath();
  ctx.moveTo(arrowLen, 0);
  ctx.lineTo(-arrowLen * 0.4, -arrowWidth);
  ctx.lineTo(-arrowLen * 0.1, 0);
  ctx.lineTo(-arrowLen * 0.4, arrowWidth);
  ctx.closePath();

  if (isBlue) {
    ctx.fillStyle = rgba(acc[0], acc[1], acc[2], 50);
    ctx.strokeStyle = rgba(acc[0], acc[1], acc[2], 255);
    ctx.fill();
  }
  ctx.stroke();

  ctx.restore();
}

function drawTriangleWithArrows(t, currentAlpha, isBlue) {
  let verts = [];
  for (let j = 0; j < 3; j++) {
    let a = (TWO_PI / 3) * j - HALF_PI;
    verts.push({ x: cos(a) * t.size, y: sin(a) * t.size });
  }

  let acc = accentColor();

  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.rotate(t.angle);

  ctx.lineWidth = t.sw;

  if (isBlue) {
    ctx.fillStyle = rgba(acc[0], acc[1], acc[2], 15);
    ctx.strokeStyle = rgba(acc[0], acc[1], acc[2], currentAlpha);
    ctx.shadowColor = `rgba(${floor(acc[0])},${floor(acc[1])},${floor(acc[2])},0.3)`;
    ctx.shadowBlur = 12;
  } else {
    ctx.fillStyle = 'transparent';
    let fg = fgColorVal();
    ctx.strokeStyle = rgba(fg, fg, fg, currentAlpha);
    ctx.shadowBlur = 0;
  }

  // Draw triangle
  ctx.beginPath();
  ctx.moveTo(verts[0].x, verts[0].y);
  ctx.lineTo(verts[1].x, verts[1].y);
  ctx.lineTo(verts[2].x, verts[2].y);
  ctx.closePath();
  if (isBlue) ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;

  // Arrowheads on vertices
  if (!swarm.active) {
    for (let j = 0; j < 3; j++) {
      let v = verts[j];
      let next = verts[(j + 1) % 3];
      let edgeAngle = atan2(next.y - v.y, next.x - v.x);

      if (isBlue) {
        ctx.strokeStyle = rgba(acc[0], acc[1], acc[2], currentAlpha);
      } else {
        let fg = fgColorVal();
        ctx.strokeStyle = rgba(fg, fg, fg, currentAlpha);
      }
      ctx.lineWidth = t.sw * 0.8;
      drawArrowhead(v.x, v.y, edgeAngle, t.size, isBlue);
    }
  }

  ctx.restore();
}

// ─── Origami ───

function spawnOrigami(cx, cy) {
  origami.active = true;
  origami.timer = 0;
  origami.centerX = cx;
  origami.centerY = cy;
  origami.shards = [];
  origami.foldLines = [];

  spawnSwarm(cx, cy);

  let numRings = 5;
  for (let ring = 0; ring < numRings; ring++) {
    let numInRing = 6 + ring * 4;
    let baseRadius = 30 + ring * 60;
    for (let j = 0; j < numInRing; j++) {
      let a = (TWO_PI / numInRing) * j + ring * 0.3;
      let shardSize = random(15, 40 + ring * 10);
      origami.shards.push({
        angle: a, radius: baseRadius, size: shardSize,
        rotation: random(TWO_PI), rotSpeed: random(-0.04, 0.04),
        foldAngle: PI, targetFold: random(-0.3, 0.3),
        foldSpeed: random(0.02, 0.06),
        delay: ring * 12 + random(8),
        alpha: 0, maxAlpha: random(100, 255),
        fillAlpha: random(0, 40),
        mirror: random() > 0.5
      });
    }
  }

  let numLines = 8;
  for (let i = 0; i < numLines; i++) {
    let a = (TWO_PI / numLines) * i + random(-0.2, 0.2);
    origami.foldLines.push({
      angle: a, length: random(150, 400),
      delay: random(10), alpha: 0
    });
  }

  for (let t of triangles) {
    t.origSave = { dx: t.drift.x, dy: t.drift.y, sp: t.speed };
    t.drift.x = 0;
    t.drift.y = 0;
    t.speed = 0;
  }
}

function drawOrigami() {
  if (!origami.active) return;

  origami.timer++;
  let t = origami.timer;
  let progress = t / origami.duration;

  let cx = origami.centerX;
  let cy = origami.centerY;

  let collapsePhase = progress > 0.7 ? (progress - 0.7) / 0.3 : 0;
  let globalAlphaMult = collapsePhase > 0 ? 1 - easeInQuad(collapsePhase) : 1;

  let fg = fgColorVal();

  // Fold lines
  for (let fl of origami.foldLines) {
    if (t < fl.delay) continue;
    let lineProgress = constrain((t - fl.delay) / 20, 0, 1);
    fl.alpha = lerp(fl.alpha, 200 * globalAlphaMult, 0.1);

    let len = fl.length * easeOutQuad(lineProgress);
    let x1 = cx, y1 = cy;
    let x2 = cx + cos(fl.angle) * len;
    let y2 = cy + sin(fl.angle) * len;

    ctx.strokeStyle = rgba(fg, fg, fg, fl.alpha);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    if (lineProgress > 0.3) {
      ctx.save();
      ctx.translate(x2, y2);
      ctx.rotate(fl.angle);
      ctx.strokeStyle = rgba(fg, fg, fg, fl.alpha);
      ctx.lineWidth = 1.2;
      let aLen = 10;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-aLen, -aLen * 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-aLen, aLen * 0.5);
      ctx.stroke();
      ctx.restore();
    }

    if (lineProgress > 0.5) {
      let numTicks = 3;
      for (let k = 1; k <= numTicks; k++) {
        let frac = k / (numTicks + 1);
        let tx = lerp(x1, x2, frac);
        let ty = lerp(y1, y2, frac);
        let perp = fl.angle + HALF_PI;
        let tickLen = 6;
        ctx.strokeStyle = rgba(fg, fg, fg, fl.alpha * 0.5);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tx - cos(perp) * tickLen, ty - sin(perp) * tickLen);
        ctx.lineTo(tx + cos(perp) * tickLen, ty + sin(perp) * tickLen);
        ctx.stroke();
      }
    }
  }

  // Shards
  for (let s of origami.shards) {
    if (t < s.delay) continue;
    let shardAge = t - s.delay;

    s.foldAngle = lerp(s.foldAngle, s.targetFold, s.foldSpeed);
    s.rotation += s.rotSpeed;

    if (shardAge < 20) {
      s.alpha = lerp(0, s.maxAlpha, shardAge / 20);
    } else {
      s.alpha = s.maxAlpha;
    }
    s.alpha *= globalAlphaMult;

    let expandedRadius = s.radius;
    if (collapsePhase > 0) {
      expandedRadius = s.radius * (1 + collapsePhase * 2);
    }

    let sx = cx + cos(s.angle) * expandedRadius;
    let sy = cy + sin(s.angle) * expandedRadius;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(s.rotation);

    let foldScale = cos(s.foldAngle);
    ctx.scale(1, foldScale);

    ctx.strokeStyle = rgba(fg, fg, fg, s.alpha);
    ctx.lineWidth = 1.2;
    ctx.fillStyle = rgba(fg, fg, fg, s.fillAlpha * globalAlphaMult);

    ctx.beginPath();
    ctx.moveTo(0, -s.size * 0.6);
    ctx.lineTo(-s.size * 0.5, s.size * 0.4);
    ctx.lineTo(s.size * 0.5, s.size * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = rgba(fg, fg, fg, s.alpha * 0.4);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    if (s.mirror) {
      ctx.moveTo(0, -s.size * 0.6);
      ctx.lineTo(-s.size * 0.25, s.size * 0.4);
    } else {
      ctx.moveTo(0, -s.size * 0.6);
      ctx.lineTo(s.size * 0.25, s.size * 0.4);
    }
    ctx.stroke();

    ctx.restore();
  }

  // Central flash
  if (t < 30) {
    let flashAlpha = (1 - t / 30) * 200;
    ctx.fillStyle = rgba(fg, fg, fg, flashAlpha);
    ctx.beginPath();
    ctx.arc(cx, cy, t * 2, 0, TWO_PI);
    ctx.fill();
  }

  // End origami
  if (progress >= 1) {
    origami.active = false;
    for (let tri of triangles) {
      if (tri.origSave) {
        tri.drift.x = tri.origSave.dx;
        tri.drift.y = tri.origSave.dy;
        tri.speed = tri.origSave.sp;
        tri.origSave = null;
      }
    }
    pickSpecialTriangles();
  }
}

// ─── Split-flap display ───

function updateAndDrawSplitFlap() {
  flapIntroTimer++;

  let fg = fgColorVal();
  let bgVal = lerp(20, 230, invertT);
  let cardBg = lerp(30, 215, invertT);
  let dividerColor = lerp(10, 235, invertT);

  let fontSize = constrain(min(width, height) * 0.045, 18, 42);
  let cardW = fontSize * 0.75;
  let cardH = fontSize * 1.3;
  let gap = fontSize * 0.12;
  let totalW = flapSlots.length * (cardW + gap) - gap;

  let baseX = width - totalW - 30;
  let baseY = 40;

  let allSettled = true;

  ctx.save();

  for (let i = 0; i < flapSlots.length; i++) {
    let slot = flapSlots[i];
    let slotCx = baseX + i * (cardW + gap) + cardW / 2;
    let slotCy = baseY + cardH / 2;

    // Update flip logic
    if (!slot.settled) {
      allSettled = false;
      if (flapIntroTimer >= slot.settleDelay) {
        slot.current = slot.target;
        slot.settled = true;
        slot.flipPhase = 1.0;
      } else {
        slot.flipTimer++;
        if (slot.flipTimer >= slot.flipInterval) {
          slot.flipTimer = 0;
          slot.flipPhase = 1.0;
          let next;
          do {
            next = FLAP_CHARS[floor(random(FLAP_CHARS.length))];
          } while (next === slot.current && FLAP_CHARS.length > 1);
          slot.current = next;
        }
      }
    }

    if (slot.flipPhase > 0) {
      slot.flipPhase *= 0.82;
      if (slot.flipPhase < 0.01) slot.flipPhase = 0;
    }

    // Card background (rounded rect)
    ctx.fillStyle = rgba(cardBg, cardBg, cardBg, slot.current === ' ' ? 100 : 220);
    let rx = slotCx - cardW / 2, ry = slotCy - cardH / 2;
    roundRect(rx, ry, cardW, cardH, 2);
    ctx.fill();

    // Character with flip
    let flipScale = 1 - slot.flipPhase * 0.3;
    let flipAlpha = slot.settled ? 255 : lerp(180, 255, 1 - slot.flipPhase);

    ctx.save();
    ctx.translate(slotCx, slotCy);
    ctx.scale(1, flipScale);

    ctx.fillStyle = rgba(fg, fg, fg, flipAlpha);
    ctx.font = `${fontSize}px "Courier New"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(slot.current, 0, 0);
    ctx.restore();

    // Center divider
    ctx.strokeStyle = rgba(dividerColor, dividerColor, dividerColor, 150);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(slotCx - cardW / 2, slotCy);
    ctx.lineTo(slotCx + cardW / 2, slotCy);
    ctx.stroke();

    // Subtle top highlight
    ctx.fillStyle = rgba(fg, fg, fg, 8);
    roundRect(slotCx - cardW / 2, slotCy - cardH / 2, cardW, cardH / 2, 2, 2, 0, 0);
    ctx.fill();
  }

  // Pulsing glow
  if (allSettled && !flapSettled) flapSettled = true;

  if (flapSettled) {
    let pulse = sin(frameCount * 0.02) * 0.5 + 0.5;
    let glowAlpha = lerp(5, 20, pulse);

    ctx.font = `${fontSize}px "Courier New"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < flapSlots.length; i++) {
      let slotCx = baseX + i * (cardW + gap) + cardW / 2;
      let slotCy = baseY + cardH / 2;
      for (let r = 3; r >= 1; r--) {
        ctx.fillStyle = rgba(fg, fg, fg, glowAlpha * (1 / r));
        ctx.fillText(flapSlots[i].current, slotCx, slotCy);
      }
    }
  }

  ctx.restore();
}

// Helper: rounded rect path
function roundRect(x, y, w, h, rtl, rtr, rbr, rbl) {
  if (rtr === undefined) { rtr = rtl; rbr = rtl; rbl = rtl; }
  if (rbr === undefined) { rbr = 0; rbl = 0; }
  ctx.beginPath();
  ctx.moveTo(x + rtl, y);
  ctx.lineTo(x + w - rtr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rtr);
  ctx.lineTo(x + w, y + h - rbr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rbr, y + h);
  ctx.lineTo(x + rbl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rbl);
  ctx.lineTo(x, y + rtl);
  ctx.quadraticCurveTo(x, y, x + rtl, y);
  ctx.closePath();
}

// ─── Guide arrows ───

function drawGuideArrows(tx, ty, triSize, alphaMultiplier) {
  let acc = accentColor();
  let numArrows = 3;
  let orbitRadius = max(triSize * 2, 100);
  let pulse = sin(frameCount * 0.04) * 0.5 + 0.5;
  let breathe = sin(frameCount * 0.025) * 12;

  for (let i = 0; i < numArrows; i++) {
    let baseAngle = (TWO_PI / numArrows) * i + frameCount * 0.005;
    let r = orbitRadius + breathe;
    let ax = tx + cos(baseAngle) * r;
    let ay = ty + sin(baseAngle) * r;

    let pointAngle = atan2(ty - ay, tx - ax);

    let arrowAlpha = lerp(60, 180, pulse) * alphaMultiplier;
    let arrowLen = max(triSize * 0.25, 14);
    let arrowWidth = max(triSize * 0.14, 8);

    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(pointAngle);

    ctx.fillStyle = rgba(acc[0], acc[1], acc[2], arrowAlpha * 0.25);
    ctx.strokeStyle = rgba(acc[0], acc[1], acc[2], arrowAlpha);
    ctx.lineWidth = 1;
    ctx.shadowColor = `rgba(${floor(acc[0])},${floor(acc[1])},${floor(acc[2])},${(arrowAlpha / 255 * 0.4).toFixed(2)})`;
    ctx.shadowBlur = 6;

    ctx.beginPath();
    ctx.moveTo(arrowLen, 0);
    ctx.lineTo(-arrowLen * 0.3, -arrowWidth);
    ctx.lineTo(-arrowLen * 0.05, 0);
    ctx.lineTo(-arrowLen * 0.3, arrowWidth);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

// ─── Easing ───

function easeOutQuad(x) { return 1 - (1 - x) * (1 - x); }
function easeInQuad(x) { return x * x; }
function easeInOutCubic(x) { return x < 0.5 ? 4 * x * x * x : 1 - pow(-2 * x + 2, 3) / 2; }

// ─── Interaction ───

function handleMousePressed() {
  if (origami.active || swarm.active) return;

  let ht = triangles[helloTriangleIndex];
  let dh = dist(mouseX, mouseY, ht.x, ht.y);
  if (dh < ht.size) {
    spawnOrigami(ht.x, ht.y);
    return;
  }
}

function handleMouseMoved() {
  if (origami.active || swarm.active) return;

  let ht = triangles[helloTriangleIndex];
  let dh = dist(mouseX, mouseY, ht.x, ht.y);
  if (dh < ht.size) {
    document.body.style.cursor = 'pointer';
    return;
  }

  if (qrTriangleIndex !== undefined) {
    let qt = triangles[qrTriangleIndex];
    let dq = dist(mouseX, mouseY, qt.x, qt.y);
    if (dq < qt.size * 1.2) {
      document.body.style.cursor = 'pointer';
      return;
    }
  }

  document.body.style.cursor = 'default';
}

// ─── Main draw loop ───

function draw() {
  frameCount++;

  // Smooth invert transition
  let targetInvert = inverted ? 1 : 0;
  invertT = lerp(invertT, targetInvert, 0.04);

  // Background with trail fade (semi-transparent fill for trails)
  let bg = bgColor();
  ctx.fillStyle = rgba(bg[0], bg[1], bg[2], 220);
  ctx.fillRect(0, 0, width, height);

  // Film grain
  drawGrain();

  // Occasional flash
  if (random() < 0.005) {
    let t = random(triangles);
    t.flashTimer = 1.0;
  }

  let mainAlphaMult = origami.active ? 0.3 : 1.0;

  for (let i = 0; i < triangles.length; i++) {
    let t = triangles[i];
    t.angle += t.speed;
    t.x += t.drift.x;
    t.y += t.drift.y;

    // Mouse repulsion
    if (!origami.active && !swarm.active) {
      let dx = t.x - mouseX;
      let dy = t.y - mouseY;
      let d = sqrt(dx * dx + dy * dy);
      let repelRadius = 200;
      if (d < repelRadius && d > 0) {
        let force = (1 - d / repelRadius) * 1.5;
        t.x += (dx / d) * force;
        t.y += (dy / d) * force;
      }
    }

    // Bounce off edges
    if (t.x - t.size < 0) {
      t.x = t.size;
      t.drift.x = abs(t.drift.x);
    } else if (t.x + t.size > width) {
      t.x = width - t.size;
      t.drift.x = -abs(t.drift.x);
    }
    if (t.y - t.size < 0) {
      t.y = t.size;
      t.drift.y = abs(t.drift.y);
    } else if (t.y + t.size > height) {
      t.y = height - t.size;
      t.drift.y = -abs(t.drift.y);
    }

    // Flash decay
    if (t.flashTimer > 0) t.flashTimer *= 0.95;
    let currentAlpha = lerp(t.alpha, 255, t.flashTimer) * mainAlphaMult;

    let isBlue = (i === blueArrowIndex);
    drawTriangleWithArrows(t, currentAlpha, isBlue);

    // QR icon + hover + guide arrows
    if (i === qrTriangleIndex && !origami.active && !swarm.active) {
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(-t.angle);
      drawQRIcon(t.size);
      ctx.restore();

      let d = dist(mouseX, mouseY, t.x, t.y);
      qrHovering = d < t.size * 1.2;

      let guideAlpha = (1 - qrReveal) * (flapSettled ? 1 : 0);
      if (guideAlpha > 0.01) {
        drawGuideArrows(t.x, t.y, t.size, guideAlpha);
      }
    }
  }

  // QR reveal animation
  if (qrHovering && qrReveal < 1) {
    qrReveal = min(1, qrReveal + 0.035);
  } else if (!qrHovering && qrReveal > 0) {
    qrReveal = max(0, qrReveal - 0.06);
  }

  if (qrReveal > 0.01 && qrTriangleIndex !== undefined) {
    drawQRAtTriangle(triangles[qrTriangleIndex]);
  }

  // Swarm layer
  updateSwarm();

  // Origami layer
  drawOrigami();

  // Split-flap display
  updateAndDrawSplitFlap();

  requestAnimationFrame(draw);
}

// ─── Boot ───
setup();
requestAnimationFrame(draw);

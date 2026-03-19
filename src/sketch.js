let triangles = [];
const NUM_TRIANGLES = 18;
let helloTriangleIndex;
let blueArrowIndex;
let qrTriangleIndex;

// Color schemes — normal and inverted (Konami)
const BLUE_GLASS = [70, 150, 220];
const ORANGE_GLASS = [220, 130, 50];

// Konami code state
const KONAMI_SEQ = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65]; // up up down down left right left right b a
let konamiPos = 0;
let inverted = false;
let invertT = 0; // 0 = normal, 1 = fully inverted (smooth transition)

// QR code state
let qrMatrix = null;
let qrModuleCount = 0;
let qrReveal = 0; // 0–1 animation
let qrHovering = false;

// Film grain
let grainBuffer;
let grainTick = 0;

// Origami animation state
let origami = {
  active: false,
  timer: 0,
  duration: 300,
  shards: [],
  foldLines: [],
  centerX: 0,
  centerY: 0
};

// Swarming arrows state
let swarm = {
  active: false,
  arrows: [],
  timer: 0,
  settledOnEdges: false
};
const SWARM_DURATION = 600;
const SWARM_SETTLE_START = 360;
const MIN_HELLO_SIZE = 60;

// ─── Color helpers (lerp between normal/inverted) ───

function bgColor() {
  return lerpColor(color(0), color(245), invertT);
}

function fgColor(a) {
  // foreground stroke/text color
  let r = lerp(255, 15, invertT);
  return color(r, a !== undefined ? a : 255);
}

function accentColor() {
  // blue glass in normal, orange glass in inverted
  return [
    lerp(BLUE_GLASS[0], ORANGE_GLASS[0], invertT),
    lerp(BLUE_GLASS[1], ORANGE_GLASS[1], invertT),
    lerp(BLUE_GLASS[2], ORANGE_GLASS[2], invertT)
  ];
}

// ─── Setup ───

function setup() {
  createCanvas(windowWidth, windowHeight);
  textAlign(CENTER, CENTER);
  textFont('Helvetica');

  // Generate QR matrix
  buildQR('mailto:doyle@doylecentral.com');

  // Grain buffer (small, tiled)
  grainBuffer = createGraphics(128, 128);
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

  let c = document.querySelector('canvas');
  if (c) c.classList.add('loaded');
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

  // Minimum 160px so QR is always scannable
  let qrSize = max(160, t.size * 2.2);
  let moduleSize = qrSize / qrModuleCount;
  let ox = t.x - qrSize / 2;
  let oy = t.y - qrSize / 2;

  let acc = accentColor();

  push();
  // Background plate with slight transparency
  noStroke();
  let plateAlpha = qrReveal * 200;
  if (inverted) {
    fill(245, plateAlpha);
  } else {
    fill(0, plateAlpha);
  }
  rectMode(CENTER);
  rect(t.x, t.y, qrSize + 16, qrSize + 16, 4);

  // Draw QR modules with staggered reveal
  let totalModules = qrModuleCount * qrModuleCount;
  let revealedCount = floor(qrReveal * totalModules * 1.3); // overshoot so it fills

  let idx = 0;
  for (let r = 0; r < qrModuleCount; r++) {
    for (let c = 0; c < qrModuleCount; c++) {
      if (qrMatrix[r][c] && idx < revealedCount) {
        let mx = ox + c * moduleSize;
        let my = oy + r * moduleSize;

        // Accent color for finder patterns, fg color for data
        let isFinder = (r < 7 && c < 7) || (r < 7 && c >= qrModuleCount - 7) || (r >= qrModuleCount - 7 && c < 7);
        if (isFinder) {
          fill(acc[0], acc[1], acc[2], qrReveal * 255);
        } else {
          let fg = inverted ? 15 : 255;
          fill(fg, qrReveal * 220);
        }
        noStroke();
        rect(mx + moduleSize / 2, my + moduleSize / 2, moduleSize * 0.9, moduleSize * 0.9);
      }
      idx++;
    }
  }

  // Scan label
  let labelAlpha = constrain((qrReveal - 0.6) / 0.4, 0, 1) * 180;
  if (labelAlpha > 0) {
    fill(acc[0], acc[1], acc[2], labelAlpha);
    noStroke();
    textSize(constrain(qrSize * 0.08, 10, 16));
    textAlign(CENTER, CENTER);
    text('scan me', t.x, t.y + qrSize / 2 + 14);
  }

  pop();
}

// ─── Grain ───

function refreshGrain() {
  grainBuffer.loadPixels();
  for (let i = 0; i < grainBuffer.pixels.length; i += 4) {
    let v = random(255);
    grainBuffer.pixels[i] = v;
    grainBuffer.pixels[i + 1] = v;
    grainBuffer.pixels[i + 2] = v;
    grainBuffer.pixels[i + 3] = 255;
  }
  grainBuffer.updatePixels();
}

function drawGrain() {
  // Refresh grain texture every 4 frames for animated look
  grainTick++;
  if (grainTick % 4 === 0) refreshGrain();

  push();
  drawingContext.globalAlpha = inverted ? 0.03 : 0.045;
  drawingContext.globalCompositeOperation = inverted ? 'multiply' : 'screen';

  // Tile the small grain buffer across the canvas
  for (let x = 0; x < width; x += 128) {
    for (let y = 0; y < height; y += 128) {
      image(grainBuffer, x, y);
    }
  }

  drawingContext.globalAlpha = 1.0;
  drawingContext.globalCompositeOperation = 'source-over';
  pop();
}

// ─── Konami code ───

function keyPressed() {
  if (keyCode === KONAMI_SEQ[konamiPos]) {
    konamiPos++;
    if (konamiPos >= KONAMI_SEQ.length) {
      inverted = !inverted;
      konamiPos = 0;
    }
  } else {
    // Allow partial restart if first key matches
    konamiPos = (keyCode === KONAMI_SEQ[0]) ? 1 : 0;
  }
}

// ─── Triangle picking ───

function pickSpecialTriangles() {
  // Hello triangle — foreground, large enough
  let candidates = [];
  for (let i = 0; i < 12; i++) {
    if (triangles[i].size >= MIN_HELLO_SIZE) candidates.push(i);
  }
  if (candidates.length === 0) {
    for (let i = 0; i < 12; i++) candidates.push(i);
  }
  helloTriangleIndex = candidates[floor(random(candidates.length))];

  // Blue arrow triangle
  do {
    blueArrowIndex = floor(random(0, 12));
  } while (blueArrowIndex === helloTriangleIndex);

  // QR triangle — different from hello and blue, prefer medium-large
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
        case 0:
          targetX = random(width); targetY = 0; targetAngle = HALF_PI; break;
        case 1:
          targetX = width; targetY = random(height); targetAngle = PI; break;
        case 2:
          targetX = random(width); targetY = height; targetAngle = -HALF_PI; break;
        case 3:
          targetX = 0; targetY = random(height); targetAngle = 0; break;
      }

      swarm.arrows.push({
        x: worldX,
        y: worldY,
        angle: edgeAngle,
        size: t.size,
        sw: t.sw,
        isBlue: isBlue,
        alpha: isBlue ? 180 : lerp(t.alpha, 255, t.flashTimer),
        vx: (worldX - cx) * 0.05 + random(-4, 4),
        vy: (worldY - cy) * 0.05 + random(-4, 4),
        rotSpeed: random(-0.15, 0.15),
        targetX: targetX,
        targetY: targetY,
        targetAngle: targetAngle,
        settled: false
      });
    }
  }
}

function drawSwarmArrow(a) {
  let arrowLen = a.size * 0.22;
  let arrowWidth = a.size * 0.12;
  let acc = accentColor();

  push();
  translate(a.x, a.y);
  rotate(a.angle);

  if (a.isBlue) {
    fill(acc[0], acc[1], acc[2], a.alpha * 0.3);
    stroke(acc[0], acc[1], acc[2], a.alpha);
    drawingContext.shadowColor = `rgba(${floor(acc[0])}, ${floor(acc[1])}, ${floor(acc[2])}, 0.4)`;
    drawingContext.shadowBlur = 8;
  } else {
    noFill();
    let fg = lerp(255, 15, invertT);
    stroke(fg, a.alpha);
    drawingContext.shadowBlur = 0;
  }
  strokeWeight(a.sw * 0.8);

  beginShape();
  vertex(arrowLen, 0);
  vertex(-arrowLen * 0.4, -arrowWidth);
  vertex(-arrowLen * 0.1, 0);
  vertex(-arrowLen * 0.4, arrowWidth);
  endShape(CLOSE);

  drawingContext.shadowBlur = 0;
  pop();
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

  push();
  translate(x, y);
  rotate(angle);

  if (isBlue) {
    fill(acc[0], acc[1], acc[2], 50);
    stroke(acc[0], acc[1], acc[2]);
  } else {
    noFill();
  }

  beginShape();
  vertex(arrowLen, 0);
  vertex(-arrowLen * 0.4, -arrowWidth);
  vertex(-arrowLen * 0.1, 0);
  vertex(-arrowLen * 0.4, arrowWidth);
  endShape(CLOSE);
  pop();
}

function drawTriangleWithArrows(t, currentAlpha, isBlue) {
  let verts = [];
  for (let j = 0; j < 3; j++) {
    let a = (TWO_PI / 3) * j - HALF_PI;
    verts.push({ x: cos(a) * t.size, y: sin(a) * t.size });
  }

  let acc = accentColor();

  push();
  translate(t.x, t.y);
  rotate(t.angle);

  if (isBlue) {
    fill(acc[0], acc[1], acc[2], 15);
    stroke(acc[0], acc[1], acc[2], currentAlpha);
    drawingContext.shadowColor = `rgba(${floor(acc[0])}, ${floor(acc[1])}, ${floor(acc[2])}, 0.3)`;
    drawingContext.shadowBlur = 12;
  } else {
    noFill();
    let fg = lerp(255, 15, invertT);
    stroke(fg, currentAlpha);
    drawingContext.shadowBlur = 0;
  }
  strokeWeight(t.sw);

  beginShape();
  for (let v of verts) vertex(v.x, v.y);
  endShape(CLOSE);

  drawingContext.shadowBlur = 0;

  if (!swarm.active) {
    for (let j = 0; j < 3; j++) {
      let v = verts[j];
      let next = verts[(j + 1) % 3];
      let edgeAngle = atan2(next.y - v.y, next.x - v.x);

      if (isBlue) {
        stroke(acc[0], acc[1], acc[2], currentAlpha);
        strokeWeight(t.sw * 0.8);
      } else {
        let fg = lerp(255, 15, invertT);
        stroke(fg, currentAlpha);
        strokeWeight(t.sw * 0.8);
      }
      drawArrowhead(v.x, v.y, edgeAngle, t.size, isBlue);
    }
  }

  pop();
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
        angle: a,
        radius: baseRadius,
        size: shardSize,
        rotation: random(TWO_PI),
        rotSpeed: random(-0.04, 0.04),
        foldAngle: PI,
        targetFold: random(-0.3, 0.3),
        foldSpeed: random(0.02, 0.06),
        delay: ring * 12 + random(8),
        alpha: 0,
        maxAlpha: random(100, 255),
        fillAlpha: random(0, 40),
        mirror: random() > 0.5
      });
    }
  }

  let numLines = 8;
  for (let i = 0; i < numLines; i++) {
    let a = (TWO_PI / numLines) * i + random(-0.2, 0.2);
    origami.foldLines.push({
      angle: a,
      length: random(150, 400),
      delay: random(10),
      alpha: 0
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

  let fg = lerp(255, 15, invertT);

  // Fold lines
  for (let fl of origami.foldLines) {
    if (t < fl.delay) continue;
    let lineProgress = constrain((t - fl.delay) / 20, 0, 1);
    fl.alpha = lerp(fl.alpha, 200 * globalAlphaMult, 0.1);

    let len = fl.length * easeOutQuad(lineProgress);
    stroke(fg, fl.alpha);
    strokeWeight(1);
    let x1 = cx;
    let y1 = cy;
    let x2 = cx + cos(fl.angle) * len;
    let y2 = cy + sin(fl.angle) * len;
    line(x1, y1, x2, y2);

    if (lineProgress > 0.3) {
      push();
      translate(x2, y2);
      rotate(fl.angle);
      noFill();
      stroke(fg, fl.alpha);
      strokeWeight(1.2);
      let aLen = 10;
      line(0, 0, -aLen, -aLen * 0.5);
      line(0, 0, -aLen, aLen * 0.5);
      pop();
    }

    if (lineProgress > 0.5) {
      let numTicks = 3;
      for (let k = 1; k <= numTicks; k++) {
        let frac = k / (numTicks + 1);
        let tx = lerp(x1, x2, frac);
        let ty = lerp(y1, y2, frac);
        let perp = fl.angle + HALF_PI;
        let tickLen = 6;
        stroke(fg, fl.alpha * 0.5);
        line(tx - cos(perp) * tickLen, ty - sin(perp) * tickLen,
             tx + cos(perp) * tickLen, ty + sin(perp) * tickLen);
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

    push();
    translate(sx, sy);
    rotate(s.rotation);

    let foldScale = cos(s.foldAngle);
    scale(1, foldScale);

    stroke(fg, s.alpha);
    strokeWeight(1.2);
    fill(fg, s.fillAlpha * globalAlphaMult);
    beginShape();
    vertex(0, -s.size * 0.6);
    vertex(-s.size * 0.5, s.size * 0.4);
    vertex(s.size * 0.5, s.size * 0.4);
    endShape(CLOSE);

    stroke(fg, s.alpha * 0.4);
    strokeWeight(0.5);
    if (s.mirror) {
      line(0, -s.size * 0.6, -s.size * 0.25, s.size * 0.4);
    } else {
      line(0, -s.size * 0.6, s.size * 0.25, s.size * 0.4);
    }

    pop();
  }

  // Central flash
  if (t < 30) {
    let flashAlpha = (1 - t / 30) * 200;
    noStroke();
    fill(fg, flashAlpha);
    ellipse(cx, cy, t * 4, t * 4);
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

// ─── Easing ───

function easeOutQuad(x) { return 1 - (1 - x) * (1 - x); }
function easeInQuad(x) { return x * x; }
function easeInOutCubic(x) { return x < 0.5 ? 4 * x * x * x : 1 - pow(-2 * x + 2, 3) / 2; }

// ─── Main draw loop ───

function draw() {
  // Smooth invert transition
  let targetInvert = inverted ? 1 : 0;
  invertT = lerp(invertT, targetInvert, 0.04);

  // Background with trail fade
  let bg = bgColor();
  background(red(bg), green(bg), blue(bg), 220);

  // Film grain overlay
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

    // "hello" label
    if (i === helloTriangleIndex && !origami.active && !swarm.active) {
      push();
      translate(t.x, t.y);
      let labelSize = constrain(t.size * 0.28, 10, 24);
      fill(lerp(255, 15, invertT), 140);
      noStroke();
      textSize(labelSize);
      textAlign(CENTER, CENTER);
      text('hello', 0, 0);
      pop();
    }

    // QR reveal on hover
    if (i === qrTriangleIndex && !origami.active && !swarm.active) {
      let d = dist(mouseX, mouseY, t.x, t.y);
      qrHovering = d < t.size * 1.2;
    }
  }

  // Animate QR reveal
  if (qrHovering && qrReveal < 1) {
    qrReveal = min(1, qrReveal + 0.035);
  } else if (!qrHovering && qrReveal > 0) {
    qrReveal = max(0, qrReveal - 0.06);
  }

  // Draw QR overlay on QR triangle
  if (qrReveal > 0.01 && qrTriangleIndex !== undefined) {
    drawQRAtTriangle(triangles[qrTriangleIndex]);
  }

  // Swarm layer
  updateSwarm();

  // Origami layer
  drawOrigami();

  // Pulsing glow title
  let glowSize = min(width, height) * 0.08;
  let pulse = sin(frameCount * 0.02) * 0.5 + 0.5;
  let glowAlpha = lerp(15, 40, pulse);
  let fg = lerp(255, 15, invertT);

  noStroke();
  textAlign(CENTER, CENTER);
  for (let r = 3; r >= 1; r--) {
    fill(fg, glowAlpha * (1 / r));
    textSize(glowSize + r * 2);
    text('Zero Dash One', width / 2, height / 2);
  }

  fill(fg);
  noStroke();
  textSize(glowSize);
  text('Zero Dash One', width / 2, height / 2);
}

// ─── Interaction ───

function mousePressed() {
  if (origami.active || swarm.active) return;

  // Hello triangle click → origami
  let ht = triangles[helloTriangleIndex];
  let dh = dist(mouseX, mouseY, ht.x, ht.y);
  if (dh < ht.size) {
    spawnOrigami(ht.x, ht.y);
    return;
  }

  // QR triangle click → open mailto
  if (qrTriangleIndex !== undefined) {
    let qt = triangles[qrTriangleIndex];
    let dq = dist(mouseX, mouseY, qt.x, qt.y);
    if (dq < qt.size * 1.2 && qrReveal > 0.3) {
      window.open('mailto:doyle@doylecentral.com', '_self');
    }
  }
}

function mouseMoved() {
  if (origami.active || swarm.active) return;

  let ht = triangles[helloTriangleIndex];
  let dh = dist(mouseX, mouseY, ht.x, ht.y);
  if (dh < ht.size) {
    cursor(HAND);
    return;
  }

  if (qrTriangleIndex !== undefined) {
    let qt = triangles[qrTriangleIndex];
    let dq = dist(mouseX, mouseY, qt.x, qt.y);
    if (dq < qt.size * 1.2) {
      cursor(HAND);
      return;
    }
  }

  cursor(ARROW);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

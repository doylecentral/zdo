let triangles = [];
const NUM_TRIANGLES = 18;
let helloTriangleIndex;
let blueArrowIndex;

// Blue glass color
const BLUE_GLASS = [70, 150, 220];

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
const SWARM_DURATION = 600; // 10 seconds at 60fps
const SWARM_SETTLE_START = 360; // start settling at 6 seconds
const MIN_HELLO_SIZE = 60; // minimum triangle size for hello label

function setup() {
  createCanvas(windowWidth, windowHeight);
  textAlign(CENTER, CENTER);
  textFont('Helvetica');

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

  pickHelloAndBlue();

  // Fade in canvas
  let c = document.querySelector('canvas');
  if (c) c.classList.add('loaded');
}

function pickHelloAndBlue() {
  // Pick hello triangle from foreground triangles that are large enough
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
}

// Detach all arrowheads from all triangles into the swarm
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

      // Transform vertex to world space
      let cosA = cos(t.angle);
      let sinA = sin(t.angle);
      let worldX = t.x + vx * cosA - vy * sinA;
      let worldY = t.y + vx * sinA + vy * cosA;

      let nextVertAngle = (TWO_PI / 3) * ((j + 1) % 3) - HALF_PI;
      let nx = cos(nextVertAngle) * t.size;
      let ny = sin(nextVertAngle) * t.size;
      let edgeAngle = atan2(ny - vy, nx - vx) + t.angle;

      // Pick a random settle target on the screen edges
      let edge = floor(random(4));
      let targetX, targetY, targetAngle;
      switch (edge) {
        case 0: // top
          targetX = random(width);
          targetY = 0;
          targetAngle = HALF_PI;
          break;
        case 1: // right
          targetX = width;
          targetY = random(height);
          targetAngle = PI;
          break;
        case 2: // bottom
          targetX = random(width);
          targetY = height;
          targetAngle = -HALF_PI;
          break;
        case 3: // left
          targetX = 0;
          targetY = random(height);
          targetAngle = 0;
          break;
      }

      swarm.arrows.push({
        x: worldX,
        y: worldY,
        angle: edgeAngle,
        size: t.size,
        sw: t.sw,
        isBlue: isBlue,
        alpha: isBlue ? 180 : lerp(t.alpha, 255, t.flashTimer),
        // Swarm velocity — burst outward from click then random
        vx: (worldX - cx) * 0.05 + random(-4, 4),
        vy: (worldY - cy) * 0.05 + random(-4, 4),
        rotSpeed: random(-0.15, 0.15),
        // Settle target
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

  push();
  translate(a.x, a.y);
  rotate(a.angle);

  if (a.isBlue) {
    fill(BLUE_GLASS[0], BLUE_GLASS[1], BLUE_GLASS[2], a.alpha * 0.3);
    stroke(BLUE_GLASS[0], BLUE_GLASS[1], BLUE_GLASS[2], a.alpha);
    drawingContext.shadowColor = `rgba(${BLUE_GLASS[0]}, ${BLUE_GLASS[1]}, ${BLUE_GLASS[2]}, 0.4)`;
    drawingContext.shadowBlur = 8;
  } else {
    noFill();
    stroke(255, a.alpha);
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
      // Lerp toward edge target
      a.x = lerp(a.x, a.targetX, easedSettle * 0.08);
      a.y = lerp(a.y, a.targetY, easedSettle * 0.08);
      a.angle = lerpAngle(a.angle, a.targetAngle, easedSettle * 0.06);

      // Dampen velocity
      a.vx *= 0.92;
      a.vy *= 0.92;
      a.rotSpeed *= 0.92;
    } else {
      // Swarming: chaotic movement with flocking behavior
      // Add some noise-driven acceleration
      let noiseVal = noise(a.x * 0.003, a.y * 0.003, frameCount * 0.01);
      a.vx += cos(noiseVal * TWO_PI * 2) * 0.3;
      a.vy += sin(noiseVal * TWO_PI * 2) * 0.3;

      // Speed limit
      let speed = sqrt(a.vx * a.vx + a.vy * a.vy);
      if (speed > 6) {
        a.vx = (a.vx / speed) * 6;
        a.vy = (a.vy / speed) * 6;
      }

      // Bounce off screen edges during swarm
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

  // Fade out after fully settled
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

// Draw an arrowhead at the tip of each triangle vertex
function drawArrowhead(x, y, angle, size, isBlue) {
  let arrowLen = size * 0.22;
  let arrowWidth = size * 0.12;

  push();
  translate(x, y);
  rotate(angle);

  if (isBlue) {
    fill(BLUE_GLASS[0], BLUE_GLASS[1], BLUE_GLASS[2], 50);
    stroke(BLUE_GLASS[0], BLUE_GLASS[1], BLUE_GLASS[2]);
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

  push();
  translate(t.x, t.y);
  rotate(t.angle);

  if (isBlue) {
    fill(BLUE_GLASS[0], BLUE_GLASS[1], BLUE_GLASS[2], 15);
    stroke(BLUE_GLASS[0], BLUE_GLASS[1], BLUE_GLASS[2], currentAlpha);
    drawingContext.shadowColor = `rgba(${BLUE_GLASS[0]}, ${BLUE_GLASS[1]}, ${BLUE_GLASS[2]}, 0.3)`;
    drawingContext.shadowBlur = 12;
  } else {
    noFill();
    stroke(255, currentAlpha);
    drawingContext.shadowBlur = 0;
  }
  strokeWeight(t.sw);

  beginShape();
  for (let v of verts) vertex(v.x, v.y);
  endShape(CLOSE);

  drawingContext.shadowBlur = 0;

  // Only draw arrowheads when swarm is not active
  if (!swarm.active) {
    for (let j = 0; j < 3; j++) {
      let v = verts[j];
      let next = verts[(j + 1) % 3];
      let edgeAngle = atan2(next.y - v.y, next.x - v.x);

      if (isBlue) {
        stroke(BLUE_GLASS[0], BLUE_GLASS[1], BLUE_GLASS[2], currentAlpha);
        strokeWeight(t.sw * 0.8);
      } else {
        stroke(255, currentAlpha);
        strokeWeight(t.sw * 0.8);
      }
      drawArrowhead(v.x, v.y, edgeAngle, t.size, isBlue);
    }
  }

  pop();
}

function spawnOrigami(cx, cy) {
  origami.active = true;
  origami.timer = 0;
  origami.centerX = cx;
  origami.centerY = cy;
  origami.shards = [];
  origami.foldLines = [];

  // Also trigger arrow swarm
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

  // Fold lines with arrowheads at tips
  for (let fl of origami.foldLines) {
    if (t < fl.delay) continue;
    let lineProgress = constrain((t - fl.delay) / 20, 0, 1);
    fl.alpha = lerp(fl.alpha, 200 * globalAlphaMult, 0.1);

    let len = fl.length * easeOutQuad(lineProgress);
    stroke(255, fl.alpha);
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
      stroke(255, fl.alpha);
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
        stroke(255, fl.alpha * 0.5);
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

    stroke(255, s.alpha);
    strokeWeight(1.2);
    fill(255, s.fillAlpha * globalAlphaMult);
    beginShape();
    vertex(0, -s.size * 0.6);
    vertex(-s.size * 0.5, s.size * 0.4);
    vertex(s.size * 0.5, s.size * 0.4);
    endShape(CLOSE);

    stroke(255, s.alpha * 0.4);
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
    fill(255, flashAlpha);
    ellipse(cx, cy, t * 4, t * 4);
  }

  // End origami (swarm continues independently)
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
    pickHelloAndBlue();
  }
}

function easeOutQuad(x) { return 1 - (1 - x) * (1 - x); }
function easeInQuad(x) { return x * x; }
function easeInOutCubic(x) { return x < 0.5 ? 4 * x * x * x : 1 - pow(-2 * x + 2, 3) / 2; }

function draw() {
  // Trail fade — more reliable than semi-transparent rect
  background(0, 220);

  // Occasionally flash a random triangle
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

    // Mouse repulsion (only when not animating)
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
      fill(255, 140);
      noStroke();
      textSize(labelSize);
      textAlign(CENTER, CENTER);
      text('hello', 0, 0);
      pop();
    }
  }

  // Swarm layer — arrows flying around then settling on edges
  updateSwarm();

  // Origami animation layer
  drawOrigami();

  // Pulsing glow behind text
  let glowSize = min(width, height) * 0.08;
  let pulse = sin(frameCount * 0.02) * 0.5 + 0.5;
  let glowAlpha = lerp(15, 40, pulse);

  noStroke();
  textAlign(CENTER, CENTER);
  for (let r = 3; r >= 1; r--) {
    fill(255, glowAlpha * (1 / r));
    textSize(glowSize + r * 2);
    text('Zero Dash One', width / 2, height / 2);
  }

  fill(255);
  noStroke();
  textSize(glowSize);
  text('Zero Dash One', width / 2, height / 2);
}

function mousePressed() {
  if (origami.active || swarm.active) return;
  let t = triangles[helloTriangleIndex];
  let d = dist(mouseX, mouseY, t.x, t.y);
  if (d < t.size) {
    spawnOrigami(t.x, t.y);
  }
}

function mouseMoved() {
  if (origami.active || swarm.active) return;
  let t = triangles[helloTriangleIndex];
  let d = dist(mouseX, mouseY, t.x, t.y);
  cursor(d < t.size ? HAND : ARROW);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

import * as THREE from 'three';

// ─── Scene Setup ────────────────────────────────────────────────────────────

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.getElementById('canvas-container').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x87ceeb, 0.0008);

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  20000
);

// ─── Sky ────────────────────────────────────────────────────────────────────

const skyGeo = new THREE.SphereGeometry(15000, 32, 32);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: {
    topColor: { value: new THREE.Color(0x0a2a6e) },
    bottomColor: { value: new THREE.Color(0x87ceeb) },
    offset: { value: 400 },
    exponent: { value: 0.5 },
  },
  vertexShader: `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 topColor;
    uniform vec3 bottomColor;
    uniform float offset;
    uniform float exponent;
    varying vec3 vWorldPosition;
    void main() {
      float h = normalize(vWorldPosition + offset).y;
      gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
    }
  `,
});
const skyMesh = new THREE.Mesh(skyGeo, skyMat);
scene.add(skyMesh);

// ─── Lighting ───────────────────────────────────────────────────────────────

const sun = new THREE.DirectionalLight(0xfff4e0, 2.5);
sun.position.set(500, 1000, 300);
sun.castShadow = true;
sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 5000;
sun.shadow.camera.left = -1000;
sun.shadow.camera.right = 1000;
sun.shadow.camera.top = 1000;
sun.shadow.camera.bottom = -1000;
scene.add(sun);
scene.add(new THREE.AmbientLight(0x4466aa, 0.8));

// ─── Terrain ─────────────────────────────────────────────────────────────────

const TERRAIN_SIZE = 12000;
const TERRAIN_SEGS = 120;

function buildTerrain() {
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGS, TERRAIN_SEGS);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const dist = Math.sqrt(x * x + z * z);
    // Keep a flat runway area near origin, hills further out
    const flatRadius = 600;
    const blend = Math.max(0, (dist - flatRadius) / 2000);
    const noise =
      Math.sin(x * 0.003) * Math.cos(z * 0.003) * 60 +
      Math.sin(x * 0.009 + 1.3) * Math.cos(z * 0.007) * 30 +
      Math.sin(x * 0.02) * Math.sin(z * 0.02) * 15;
    pos.setY(i, noise * blend);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  // Vertex colors for variety
  const colors = [];
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < 2) {
      colors.push(0.22, 0.45, 0.12); // grass
    } else if (y < 30) {
      colors.push(0.28, 0.52, 0.14); // lighter grass
    } else if (y < 60) {
      colors.push(0.45, 0.38, 0.25); // dirt/rock
    } else {
      colors.push(0.85, 0.88, 0.90); // snow
    }
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const mat = new THREE.MeshLambertMaterial({
    vertexColors: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

const terrain = buildTerrain();
scene.add(terrain);

// Runway
function buildRunway() {
  const group = new THREE.Group();

  const runwayGeo = new THREE.PlaneGeometry(30, 600);
  runwayGeo.rotateX(-Math.PI / 2);
  const runwayMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const runway = new THREE.Mesh(runwayGeo, runwayMat);
  runway.position.y = 0.1;
  group.add(runway);

  // Center-line markings
  for (let z = -280; z <= 280; z += 30) {
    const markGeo = new THREE.PlaneGeometry(1.5, 12);
    markGeo.rotateX(-Math.PI / 2);
    const markMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const mark = new THREE.Mesh(markGeo, markMat);
    mark.position.set(0, 0.15, z);
    group.add(mark);
  }

  return group;
}

scene.add(buildRunway());

// Trees scattered around
function addTrees() {
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5c3a1e });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2d6a2d });
  const group = new THREE.Group();
  const rng = mulberry32(42);

  for (let i = 0; i < 300; i++) {
    const x = (rng() - 0.5) * TERRAIN_SIZE * 0.8;
    const z = (rng() - 0.5) * TERRAIN_SIZE * 0.8;
    const dist = Math.sqrt(x * x + z * z);
    if (dist < 700) continue;

    const h = 8 + rng() * 10;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.6, h, 6),
      trunkMat
    );
    const leaves = new THREE.Mesh(
      new THREE.ConeGeometry(4 + rng() * 2, h * 1.2, 7),
      leafMat
    );
    leaves.position.y = h * 0.9;
    const tree = new THREE.Group();
    tree.add(trunk);
    tree.add(leaves);
    tree.position.set(x, h / 2, z);
    tree.castShadow = true;
    group.add(tree);
  }
  scene.add(group);
}

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

addTrees();

// Clouds
function addClouds() {
  const mat = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.85,
  });
  const group = new THREE.Group();
  const rng = mulberry32(99);

  for (let i = 0; i < 60; i++) {
    const cloud = new THREE.Group();
    const numPuffs = 3 + Math.floor(rng() * 5);
    for (let p = 0; p < numPuffs; p++) {
      const r = 40 + rng() * 60;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), mat);
      puff.position.set(
        (rng() - 0.5) * 120,
        (rng() - 0.5) * 30,
        (rng() - 0.5) * 80
      );
      cloud.add(puff);
    }
    cloud.position.set(
      (rng() - 0.5) * 8000,
      600 + rng() * 800,
      (rng() - 0.5) * 8000
    );
    group.add(cloud);
  }
  scene.add(group);
}

addClouds();

// ─── Airplane Model ─────────────────────────────────────────────────────────

function buildAirplane() {
  const plane = new THREE.Group();

  const bodyMat = new THREE.MeshPhongMaterial({ color: 0xddddff, shininess: 80 });
  const wingMat = new THREE.MeshPhongMaterial({ color: 0xccccee, shininess: 60 });
  const engineMat = new THREE.MeshPhongMaterial({ color: 0x888899, shininess: 100 });
  const glassMat = new THREE.MeshPhongMaterial({
    color: 0x88ccff,
    transparent: true,
    opacity: 0.6,
    shininess: 150,
  });
  const propMat = new THREE.MeshPhongMaterial({ color: 0x333333, shininess: 80 });
  const redMat = new THREE.MeshPhongMaterial({ color: 0xcc2222 });

  // Fuselage
  const fuselageGeo = new THREE.CylinderGeometry(0.55, 0.3, 6, 10);
  fuselageGeo.rotateZ(Math.PI / 2);
  const fuselage = new THREE.Mesh(fuselageGeo, bodyMat);
  fuselage.castShadow = true;
  plane.add(fuselage);

  // Nose cone
  const noseGeo = new THREE.ConeGeometry(0.55, 1.6, 10);
  noseGeo.rotateZ(-Math.PI / 2);
  const nose = new THREE.Mesh(noseGeo, bodyMat);
  nose.position.x = 3.8;
  plane.add(nose);

  // Main wings
  const wingGeo = new THREE.BoxGeometry(0.2, 0.08, 8);
  const wing = new THREE.Mesh(wingGeo, wingMat);
  wing.position.set(0.2, -0.1, 0);
  wing.castShadow = true;
  plane.add(wing);

  // Wing taper (leading edge sweep)
  const wingSweepL = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.07, 0.5),
    wingMat
  );
  wingSweepL.position.set(0.6, -0.1, -4.0);
  plane.add(wingSweepL);

  const wingSweepR = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.07, 0.5),
    wingMat
  );
  wingSweepR.position.set(0.6, -0.1, 4.0);
  plane.add(wingSweepR);

  // Wingtip lights
  const ltGeo = new THREE.SphereGeometry(0.12, 6, 6);
  const leftLight = new THREE.Mesh(ltGeo, redMat);
  leftLight.position.set(0.2, -0.1, -4.2);
  plane.add(leftLight);

  const greenMat = new THREE.MeshPhongMaterial({ color: 0x22cc22 });
  const rightLight = new THREE.Mesh(ltGeo, greenMat);
  rightLight.position.set(0.2, -0.1, 4.2);
  plane.add(rightLight);

  // Horizontal tail
  const hTailGeo = new THREE.BoxGeometry(0.12, 0.06, 3.2);
  const hTail = new THREE.Mesh(hTailGeo, wingMat);
  hTail.position.set(-2.6, 0.1, 0);
  plane.add(hTail);

  // Vertical tail
  const vTailGeo = new THREE.BoxGeometry(0.1, 1.4, 0.06);
  const vTailShape = new THREE.Mesh(vTailGeo, wingMat);
  vTailShape.position.set(-2.5, 0.8, 0);
  plane.add(vTailShape);

  // Engine nacelle
  const engineGeo = new THREE.CylinderGeometry(0.35, 0.3, 0.8, 10);
  engineGeo.rotateZ(Math.PI / 2);
  const engine = new THREE.Mesh(engineGeo, engineMat);
  engine.position.set(3.0, -0.2, 0);
  plane.add(engine);

  // Propeller hub
  const hubGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.18, 8);
  hubGeo.rotateZ(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeo, propMat);
  hub.position.set(4.6, -0.2, 0);
  plane.add(hub);

  // Propeller blades
  const propGroup = new THREE.Group();
  propGroup.position.set(4.7, -0.2, 0);

  for (let b = 0; b < 3; b++) {
    const bladeGeo = new THREE.BoxGeometry(0.08, 1.4, 0.12);
    const blade = new THREE.Mesh(bladeGeo, propMat);
    blade.rotation.x = (b / 3) * Math.PI * 2;
    blade.position.y = 0.7;
    const bladeGroup = new THREE.Group();
    bladeGroup.rotation.x = (b / 3) * Math.PI * 2;
    bladeGroup.add(blade);
    propGroup.add(bladeGroup);
  }
  plane.add(propGroup);

  // Landing gear
  const gearMat = new THREE.MeshPhongMaterial({ color: 0x555555 });
  const wheelMat = new THREE.MeshPhongMaterial({ color: 0x222222 });

  function addGear(x, z) {
    const strut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6),
      gearMat
    );
    strut.position.set(x, -0.7, z);
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.15, 10),
      wheelMat
    );
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(x, -1.05, z);
    plane.add(strut);
    plane.add(wheel);
  }

  addGear(0.4, -1.2);
  addGear(0.4, 1.2);

  // Tail wheel
  const tailStrut = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.4, 6),
    gearMat
  );
  tailStrut.position.set(-2.8, -0.45, 0);
  const tailWheel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.1, 8),
    wheelMat
  );
  tailWheel.rotation.x = Math.PI / 2;
  tailWheel.position.set(-2.8, -0.65, 0);
  plane.add(tailStrut);
  plane.add(tailWheel);

  return { plane, propGroup };
}

const { plane: airplane, propGroup } = buildAirplane();
scene.add(airplane);

// ─── Flight State ────────────────────────────────────────────────────────────

const state = {
  position: new THREE.Vector3(0, 2, 0),
  velocity: new THREE.Vector3(0, 0, 0),
  // Euler angles in radians
  pitch: 0,      // nose up/down
  roll: 0,       // bank left/right
  yaw: 0,        // heading
  throttle: 0.3, // 0–1
  speed: 0,      // m/s
  gForce: 1.0,
  onGround: true,
};

const GRAVITY = 9.81;          // m/s²
const MAX_SPEED = 110;         // m/s ≈ 396 km/h
const STALL_SPEED = 20;        // m/s
const LIFT_FACTOR = 0.0038;    // lift accel = speed² * factor; balances gravity at ~51 m/s
const DRAG_FACTOR = 0.0018;    // drag accel = speed² * factor; terminal ~78 m/s at full throttle
const THRUST_ACCEL = 22;       // max thrust acceleration, m/s²
const PITCH_RATE = 1.2;        // rad/s
const ROLL_RATE = 1.6;
const YAW_RATE = 0.5;
const MAX_PITCH = Math.PI / 2.5;
const MAX_ROLL = Math.PI * 0.8;
const ROLL_DAMPING = 0.97;
const PITCH_DAMPING = 0.97;
const GROUND_FRICTION = 0.998;
const GROUND_ANGLE_DAMPING = 0.9;
const CAMERA_LERP = 0.01;      // lower = smoother camera

// ─── Input ───────────────────────────────────────────────────────────────────

const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  e.preventDefault();
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

// ─── Camera ──────────────────────────────────────────────────────────────────

const cameraOffset = new THREE.Vector3(-18, 3, 0); // behind & above
const cameraTarget = new THREE.Vector3();
const cameraCurrent = new THREE.Vector3();

// ─── HUD helpers ─────────────────────────────────────────────────────────────

const hudAlt = document.getElementById('altitude');
const hudSpd = document.getElementById('speed');
const hudHdg = document.getElementById('heading');
const hudThr = document.getElementById('throttle');
const hudVsi = document.getElementById('vsi');
const hudPitch = document.getElementById('pitch');
const hudRoll = document.getElementById('roll');
const hudGforce = document.getElementById('gforce');
const stallWarning = document.getElementById('stall-warning');

const aiCanvas = document.getElementById('attitude-indicator');
const aiCtx = aiCanvas.getContext('2d');

function drawAttitudeIndicator(pitchDeg, rollDeg) {
  const W = aiCanvas.width;
  const H = aiCanvas.height;
  const cx = W / 2;
  const cy = H / 2;
  const r = W / 2 - 2;

  aiCtx.clearRect(0, 0, W, H);
  aiCtx.save();

  // Clip to circle
  aiCtx.beginPath();
  aiCtx.arc(cx, cy, r, 0, Math.PI * 2);
  aiCtx.clip();

  // Horizon
  aiCtx.save();
  aiCtx.translate(cx, cy);
  aiCtx.rotate((-rollDeg * Math.PI) / 180);
  const pitchOffset = (pitchDeg / 90) * r;

  // Sky
  aiCtx.fillStyle = '#1a6fa8';
  aiCtx.fillRect(-r, -r * 2 + pitchOffset, r * 2, r * 2);

  // Ground
  aiCtx.fillStyle = '#7a4e2c';
  aiCtx.fillRect(-r, pitchOffset, r * 2, r * 2);

  // Horizon line
  aiCtx.strokeStyle = '#ffffff';
  aiCtx.lineWidth = 2;
  aiCtx.beginPath();
  aiCtx.moveTo(-r, pitchOffset);
  aiCtx.lineTo(r, pitchOffset);
  aiCtx.stroke();

  aiCtx.restore();

  // Fixed aircraft reference mark
  aiCtx.strokeStyle = '#ffcc00';
  aiCtx.lineWidth = 2;
  aiCtx.beginPath();
  aiCtx.moveTo(cx - 22, cy);
  aiCtx.lineTo(cx - 8, cy);
  aiCtx.moveTo(cx + 8, cy);
  aiCtx.lineTo(cx + 22, cy);
  aiCtx.moveTo(cx, cy - 5);
  aiCtx.lineTo(cx, cy + 5);
  aiCtx.stroke();

  // Border
  aiCtx.strokeStyle = '#00ff88';
  aiCtx.lineWidth = 2;
  aiCtx.beginPath();
  aiCtx.arc(cx, cy, r, 0, Math.PI * 2);
  aiCtx.stroke();

  aiCtx.restore();
}

// ─── Reset ───────────────────────────────────────────────────────────────────

function resetAirplane() {
  state.position.set(0, 2, 0);
  state.velocity.set(0, 0, 0);
  state.pitch = 0;
  state.roll = 0;
  state.yaw = 0;
  state.throttle = 0.3;
  state.speed = 0;
  state.onGround = true;
}

// ─── Update Loop ─────────────────────────────────────────────────────────────

const clock = new THREE.Clock();
let prevAltitude = 0;

function update() {
  const dt = Math.min(clock.getDelta(), 0.05);

  // ── Controls ──────────────────────────────────────────────────────────────

  if (keys['KeyW'])    state.pitch -= PITCH_RATE * dt;
  if (keys['KeyS'])    state.pitch += PITCH_RATE * dt;
  if (keys['KeyA'])    state.roll  -= ROLL_RATE  * dt;
  if (keys['KeyD'])    state.roll  += ROLL_RATE  * dt;
  if (keys['KeyQ'])    state.yaw   += YAW_RATE   * dt;
  if (keys['KeyE'])    state.yaw   -= YAW_RATE   * dt;

  if (keys['ArrowUp'])   state.throttle = Math.min(1, state.throttle + dt * 0.6);
  if (keys['ArrowDown']) state.throttle = Math.max(0, state.throttle - dt * 0.6);

  if (keys['Space']) resetAirplane();

  // Clamp angles
  state.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, state.pitch));
  state.roll  = Math.max(-MAX_ROLL,  Math.min(MAX_ROLL,  state.roll));

  // Yaw coupling from roll (coordinated turn)
  state.yaw += state.roll * 0.35 * dt;

  // Roll auto-level when no input
  if (!keys['KeyA'] && !keys['KeyD']) {
    state.roll *= Math.pow(ROLL_DAMPING, dt * 60);
  }

  // Pitch auto-level
  if (!keys['KeyW'] && !keys['KeyS']) {
    state.pitch *= Math.pow(PITCH_DAMPING, dt * 60);
  }

  // ── Physics ───────────────────────────────────────────────────────────────

  // Build orientation quaternion
  const qYaw   = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), state.yaw);
  const qPitch  = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), state.pitch);
  const qRoll   = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), state.roll);
  const qTotal  = new THREE.Quaternion().multiplyQuaternions(qYaw, qPitch).multiply(qRoll);

  // Forward & up vectors in world space
  const forward = new THREE.Vector3(1, 0, 0).applyQuaternion(qTotal);
  const upWorld  = new THREE.Vector3(0, 1, 0).applyQuaternion(qTotal);

  // Speed (m/s)
  state.speed = state.velocity.length();

  // Stall check
  const isStalled = state.speed < STALL_SPEED && !state.onGround;

  // Acceleration contributions (all in m/s²)
  const acc = new THREE.Vector3();

  // Thrust (along nose direction)
  acc.addScaledVector(forward, state.throttle * THRUST_ACCEL);

  // Lift (along aircraft up, proportional to speed²)
  const liftAcc = isStalled ? 0 : state.speed * state.speed * LIFT_FACTOR;
  acc.addScaledVector(upWorld, liftAcc);

  // Drag (opposes velocity)
  if (state.speed > 0.01) {
    const dragAcc = state.speed * state.speed * DRAG_FACTOR;
    acc.addScaledVector(state.velocity, -dragAcc / state.speed);
  }

  // Gravity
  acc.y -= GRAVITY;

  // Integrate velocity (Euler)
  state.velocity.addScaledVector(acc, dt);

  // Speed cap
  if (state.velocity.length() > MAX_SPEED) {
    state.velocity.setLength(MAX_SPEED);
  }

  // Ground constraint
  const groundY = 1.1; // gear height
  if (state.position.y <= groundY) {
    state.position.y = groundY;
    if (state.velocity.y < 0) state.velocity.y = 0;
    // Rolling friction
    state.velocity.x *= Math.pow(GROUND_FRICTION, dt * 60);
    state.velocity.z *= Math.pow(GROUND_FRICTION, dt * 60);
    state.onGround = true;
    state.pitch *= Math.pow(GROUND_ANGLE_DAMPING, dt * 60);
    state.roll  *= Math.pow(GROUND_ANGLE_DAMPING, dt * 60);
  } else {
    state.onGround = false;
  }

  // Integrate position
  state.position.addScaledVector(state.velocity, dt);

  // G-force estimate
  state.gForce = Math.abs(liftAcc / GRAVITY) + 1.0;

  // ── Position Airplane ─────────────────────────────────────────────────────

  airplane.position.copy(state.position);
  airplane.quaternion.copy(qTotal);

  // ── Propeller spin ────────────────────────────────────────────────────────

  propGroup.rotation.x += state.throttle * 15 * dt;

  // ── Chase Camera ─────────────────────────────────────────────────────────

  const camOffset = cameraOffset.clone().applyQuaternion(
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), state.yaw)
  );
  const desiredCamPos = state.position.clone().add(camOffset);

  // Smooth camera
  cameraCurrent.lerp(desiredCamPos, 1 - Math.pow(CAMERA_LERP, dt));
  camera.position.copy(cameraCurrent);

  cameraTarget.lerp(
    state.position.clone().add(new THREE.Vector3(0, 1, 0)),
    1 - Math.pow(CAMERA_LERP, dt)
  );
  camera.lookAt(cameraTarget);

  // Keep sky centered on camera so it never clips at high altitude
  skyMesh.position.copy(camera.position);

  // ── HUD Update ────────────────────────────────────────────────────────────

  const altM = Math.max(0, state.position.y - 1.1);
  const spdKmh = Math.round(state.speed * 3.6);
  const heading = (((-state.yaw * 180) / Math.PI) % 360 + 360) % 360;
  const vsi = ((state.position.y - prevAltitude) / dt).toFixed(1);
  prevAltitude = state.position.y;

  hudAlt.textContent  = Math.round(altM);
  hudSpd.textContent  = spdKmh;
  hudHdg.textContent  = Math.round(heading);
  hudThr.textContent  = Math.round(state.throttle * 100);
  hudVsi.textContent  = vsi;
  hudPitch.textContent = Math.round(state.pitch * (180 / Math.PI));
  hudRoll.textContent  = Math.round(state.roll  * (180 / Math.PI));
  hudGforce.textContent = state.gForce.toFixed(1);

  stallWarning.style.display = isStalled ? 'block' : 'none';

  drawAttitudeIndicator(
    state.pitch * (180 / Math.PI),
    state.roll  * (180 / Math.PI)
  );
}

// ─── Render Loop ─────────────────────────────────────────────────────────────

function animate() {
  requestAnimationFrame(animate);
  update();
  renderer.render(scene, camera);
}

// Initialize camera position
cameraCurrent.copy(state.position).add(cameraOffset);
camera.position.copy(cameraCurrent);
camera.lookAt(state.position);

animate();

// ─── Resize handler ──────────────────────────────────────────────────────────

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

import * as THREE from "../vendor/three.module.js";

const canvas = document.querySelector("#game-canvas");
const gameShell = document.querySelector("#game-shell");
const scoreEl = document.querySelector("#score");
const waveEl = document.querySelector("#wave");
const healthEl = document.querySelector("#health");
const overlay = document.querySelector("#overlay");
const startButton = document.querySelector("#start-button");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x071015);
scene.fog = new THREE.Fog(0x071015, 24, 118);

let renderer;

const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 220);
camera.position.set(0, 13, 28);
camera.lookAt(0, 3, 0);

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.3);
const skyAimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -13);
const aimPoint = new THREE.Vector3();
const skyAimPoint = new THREE.Vector3();
const reusableVector = new THREE.Vector3();
const projectedAimVector = new THREE.Vector3();
const reusableQuaternion = new THREE.Quaternion();
const reusableLine = new THREE.Line3();

const keys = new Set();
const ufos = [];
const shots = [];
const enemyBolts = [];
const particles = [];
const stars = [];
const clouds = [];

const state = {
  running: false,
  paused: false,
  gameOver: false,
  score: 0,
  wave: 1,
  health: 100,
  spawnTimer: 0,
  spawnEvery: 1.8,
  fireCooldown: 0,
  ufoGoal: 7,
  ufosDestroyedThisWave: 0,
};

async function initRenderer() {
  if (renderer) return true;

  const hasWebGL =
    typeof WebGLRenderingContext !== "undefined" &&
    (canvas.getContext("webgl2") || canvas.getContext("webgl"));

  if (hasWebGL) {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  } else {
    const { SVGRenderer } = await import("../vendor/SVGRenderer.js");
    renderer = new SVGRenderer();
    renderer.domElement.classList.add("svg-renderer");
    renderer.domElement.setAttribute("aria-hidden", "true");
    canvas.style.display = "none";
    document.querySelector("#game-shell").append(renderer.domElement);
  }

  resize();
  return true;
}

const palette = {
  ground: 0x243a2d,
  groundDark: 0x132219,
  tank: 0x5d7b4d,
  tankDark: 0x354733,
  brass: 0xe1b15a,
  plasma: 0x7df4d0,
  warning: 0xff6f61,
  saucer: 0xaab9c6,
  saucerDark: 0x58677a,
  beam: 0xffd36b,
};

const hemi = new THREE.HemisphereLight(0xb8fff1, 0x22301f, 1.7);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff2be, 2.2);
sun.position.set(-18, 28, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -45;
sun.shadow.camera.right = 45;
sun.shadow.camera.top = 45;
sun.shadow.camera.bottom = -45;
scene.add(sun);

const moon = new THREE.DirectionalLight(0x89b7ff, 0.75);
moon.position.set(22, 16, -24);
scene.add(moon);

function flatMaterial(color, roughness = 0.86, metalness = 0.02) {
  return new THREE.MeshLambertMaterial({
    color,
    flatShading: true,
  });
}

function makeMesh(geometry, material, cast = true, receive = true) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

function createWorld() {
  const ground = makeMesh(
    new THREE.CylinderGeometry(55, 62, 4, 9),
    flatMaterial(palette.ground),
    false,
    true,
  );
  ground.position.y = -2.4;
  ground.rotation.y = Math.PI / 9;
  scene.add(ground);

  const pad = makeMesh(
    new THREE.CylinderGeometry(11, 12, 0.55, 12),
    flatMaterial(0x384939),
    false,
    true,
  );
  pad.position.set(0, 0.08, 0);
  scene.add(pad);

  for (let i = 0; i < 42; i += 1) {
    const radius = 18 + Math.random() * 35;
    const angle = Math.random() * Math.PI * 2;
    const rock = makeMesh(
      new THREE.DodecahedronGeometry(0.45 + Math.random() * 1.35, 0),
      flatMaterial(Math.random() > 0.5 ? palette.groundDark : 0x52624a),
      true,
      true,
    );
    rock.position.set(Math.cos(angle) * radius, -0.1, Math.sin(angle) * radius);
    rock.scale.y = 0.45 + Math.random() * 0.85;
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    scene.add(rock);
  }

  for (let i = 0; i < 80; i += 1) {
    const star = makeMesh(
      new THREE.OctahedronGeometry(0.07 + Math.random() * 0.07, 0),
      new THREE.MeshBasicMaterial({ color: Math.random() > 0.25 ? 0xfff7d6 : 0x9bd6c7 }),
      false,
      false,
    );
    star.position.set(
      THREE.MathUtils.randFloatSpread(120),
      22 + Math.random() * 48,
      -60 + Math.random() * 60,
    );
    stars.push(star);
    scene.add(star);
  }

  for (let i = 0; i < 11; i += 1) {
    const cloud = new THREE.Group();
    const puffCount = 3 + Math.floor(Math.random() * 3);
    for (let j = 0; j < puffCount; j += 1) {
      const puff = makeMesh(
        new THREE.DodecahedronGeometry(1.2 + Math.random() * 1.2, 0),
        flatMaterial(0xd9e7dc, 0.96, 0),
        false,
        false,
      );
      puff.position.set(j * 1.55, Math.random() * 0.5, Math.random() * 0.8);
      puff.scale.y = 0.55;
      cloud.add(puff);
    }
    cloud.position.set(THREE.MathUtils.randFloatSpread(70), 17 + Math.random() * 11, -28 - Math.random() * 34);
    cloud.rotation.y = Math.random() * Math.PI;
    cloud.userData.speed = 0.45 + Math.random() * 0.6;
    clouds.push(cloud);
    scene.add(cloud);
  }
}

function createTank() {
  const tank = new THREE.Group();

  const base = makeMesh(
    new THREE.BoxGeometry(4.8, 1.2, 3.2, 1, 1, 1),
    flatMaterial(palette.tank),
  );
  base.position.y = 0.9;
  tank.add(base);

  const leftTrack = makeMesh(
    new THREE.BoxGeometry(5.2, 0.58, 0.72),
    flatMaterial(palette.tankDark),
  );
  leftTrack.position.set(0, 0.46, 1.72);
  tank.add(leftTrack);

  const rightTrack = leftTrack.clone();
  rightTrack.position.z = -1.72;
  tank.add(rightTrack);

  const turret = new THREE.Group();
  const turretBody = makeMesh(
    new THREE.CylinderGeometry(1.42, 1.78, 1.12, 7),
    flatMaterial(0x6f8b58),
  );
  turretBody.rotation.y = Math.PI / 7;
  turretBody.position.y = 1.78;
  turret.add(turretBody);

  const cannon = makeMesh(
    new THREE.CylinderGeometry(0.22, 0.28, 4.65, 8),
    flatMaterial(palette.brass, 0.55, 0.15),
  );
  cannon.rotation.z = Math.PI / 2;
  cannon.position.set(2.88, 1.88, 0);
  turret.add(cannon);

  const muzzle = makeMesh(
    new THREE.CylinderGeometry(0.34, 0.28, 0.45, 8),
    flatMaterial(0x27332b),
  );
  muzzle.rotation.z = Math.PI / 2;
  muzzle.position.set(5.28, 1.88, 0);
  turret.add(muzzle);

  tank.add(turret);
  tank.userData = {
    speed: 13,
    turret,
    muzzle,
    aimAngle: 0,
  };

  scene.add(tank);
  return tank;
}

const tank = createTank();

function createUfo() {
  const ufo = new THREE.Group();
  const upper = makeMesh(
    new THREE.SphereGeometry(1.16, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2),
    flatMaterial(0x9bd6c7, 0.42, 0.25),
  );
  upper.scale.y = 0.5;
  upper.position.y = 0.28;
  ufo.add(upper);

  const saucer = makeMesh(
    new THREE.CylinderGeometry(1.3, 2.35, 0.58, 14),
    flatMaterial(palette.saucer, 0.5, 0.18),
  );
  ufo.add(saucer);

  const underside = makeMesh(
    new THREE.CylinderGeometry(0.7, 1.2, 0.38, 10),
    flatMaterial(palette.saucerDark, 0.5, 0.12),
  );
  underside.position.y = -0.42;
  ufo.add(underside);

  const glow = makeMesh(
    new THREE.CylinderGeometry(0.5, 0.95, 0.18, 12),
    new THREE.MeshBasicMaterial({ color: palette.plasma }),
    false,
    false,
  );
  glow.position.y = -0.7;
  ufo.add(glow);

  const side = Math.random() > 0.5 ? 1 : -1;
  ufo.position.set(side * (22 + Math.random() * 14), 11 + Math.random() * 10, -20 + Math.random() * 18);
  ufo.userData = {
    hp: 1 + Math.floor(state.wave / 3),
    speed: (3.5 + state.wave * 0.55 + Math.random() * 1.4) * -side,
    wobble: Math.random() * Math.PI * 2,
    shootTimer: 2.4 + Math.random() * 2.4,
    radius: 1.9,
  };
  ufos.push(ufo);
  scene.add(ufo);
}

function createShot() {
  if (!state.running || state.paused || state.fireCooldown > 0) return;

  const muzzleWorld = tank.userData.muzzle.getWorldPosition(new THREE.Vector3());
  raycaster.setFromCamera(mouse, camera);
  let targetUfo = null;
  let closestAimDistance = Infinity;

  for (const ufo of ufos) {
    const aimDistance = Math.sqrt(raycaster.ray.distanceSqToPoint(ufo.position));
    const aimAssistRadius = ufo.userData.radius * 2.6;
    projectedAimVector.copy(ufo.position).project(camera);
    const screenDistance = Math.hypot(projectedAimVector.x - mouse.x, projectedAimVector.y - mouse.y);
    const screenAssistRadius = 0.42;
    const assistDistance = Math.min(aimDistance / aimAssistRadius, screenDistance / screenAssistRadius);

    if (
      projectedAimVector.z < 1 &&
      (aimDistance < aimAssistRadius || screenDistance < screenAssistRadius) &&
      assistDistance < closestAimDistance
    ) {
      closestAimDistance = assistDistance;
      targetUfo = ufo;
    }
  }

  const hasSkyAim = raycaster.ray.intersectPlane(skyAimPlane, skyAimPoint);
  const direction = targetUfo
    ? targetUfo.position.clone().sub(muzzleWorld).normalize()
    : hasSkyAim
    ? skyAimPoint.clone().sub(muzzleWorld).normalize()
    : reusableVector
        .set(1, 0.42, 0)
        .applyQuaternion(tank.userData.turret.getWorldQuaternion(reusableQuaternion))
        .normalize()
        .clone();

  const shot = makeMesh(
    new THREE.OctahedronGeometry(0.28, 0),
    new THREE.MeshBasicMaterial({ color: palette.beam }),
    false,
    false,
  );
  shot.position.copy(muzzleWorld);
  shot.userData = {
    velocity: direction.multiplyScalar(42),
    life: 2.2,
    radius: 1.1,
  };
  shots.push(shot);
  scene.add(shot);

  createBurst(muzzleWorld, palette.beam, 5, 0.7);
  state.fireCooldown = 0.19;
}

function createEnemyBolt(from, to) {
  const bolt = makeMesh(
    new THREE.TetrahedronGeometry(0.34, 0),
    new THREE.MeshBasicMaterial({ color: palette.warning }),
    false,
    false,
  );
  bolt.position.copy(from);
  bolt.userData = {
    velocity: to.clone().sub(from).normalize().multiplyScalar(13),
    life: 3.4,
    radius: 0.42,
  };
  enemyBolts.push(bolt);
  scene.add(bolt);
}

function createBurst(position, color, count = 14, power = 1) {
  for (let i = 0; i < count; i += 1) {
    const particle = makeMesh(
      new THREE.TetrahedronGeometry(0.12 + Math.random() * 0.15, 0),
      new THREE.MeshBasicMaterial({ color }),
      false,
      false,
    );
    particle.position.copy(position);
    particle.userData = {
      velocity: new THREE.Vector3(
        THREE.MathUtils.randFloatSpread(1),
        Math.random() * 1.4,
        THREE.MathUtils.randFloatSpread(1),
      )
        .normalize()
        .multiplyScalar((4 + Math.random() * 7) * power),
      life: 0.45 + Math.random() * 0.45,
      maxLife: 0.9,
    };
    particles.push(particle);
    scene.add(particle);
  }
}

function setOverlay(title, copy, buttonText) {
  overlay.querySelector("h1").textContent = title;
  overlay.querySelector(".overlay-panel p:not(.kicker)").textContent = copy;
  startButton.textContent = buttonText;
  overlay.classList.add("visible");
}

function hideOverlay() {
  overlay.classList.remove("visible");
}

async function resetGame() {
  try {
    if (!(await initRenderer())) return;
  } catch (error) {
    console.error(error);
    setOverlay(
      "Renderer Blocked",
      `The fallback renderer could not load: ${error.message}`,
      "Retry Mission",
    );
    return;
  }

  for (const collection of [ufos, shots, enemyBolts, particles]) {
    while (collection.length) {
      scene.remove(collection.pop());
    }
  }

  state.running = true;
  state.paused = false;
  state.gameOver = false;
  state.score = 0;
  state.wave = 1;
  state.health = 100;
  state.spawnTimer = 0.3;
  state.spawnEvery = 1.65;
  state.fireCooldown = 0;
  state.ufoGoal = 7;
  state.ufosDestroyedThisWave = 0;
  tank.position.set(0, 0, 0);
  updateHud();
  hideOverlay();
}

function updateHud() {
  scoreEl.textContent = state.score.toString();
  waveEl.textContent = state.wave.toString();
  healthEl.textContent = Math.max(0, Math.ceil(state.health)).toString();
}

function updateTank(delta) {
  let move = 0;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) move -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) move += 1;
  tank.position.x = THREE.MathUtils.clamp(tank.position.x + move * tank.userData.speed * delta, -20, 20);
  tank.rotation.z = THREE.MathUtils.lerp(tank.rotation.z, -move * 0.055, 0.12);

  raycaster.setFromCamera(mouse, camera);
  raycaster.ray.intersectPlane(aimPlane, aimPoint);
  const dx = aimPoint.x - tank.position.x;
  const dz = aimPoint.z - tank.position.z;
  const desired = Math.atan2(-dz, dx);
  tank.userData.aimAngle = THREE.MathUtils.lerp(tank.userData.aimAngle, desired, 0.22);
  tank.userData.turret.rotation.y = tank.userData.aimAngle;
}

function updateUfos(delta, elapsed) {
  state.spawnTimer -= delta;
  const maxUfos = Math.min(4 + Math.floor(state.wave / 2), 9);
  if (state.spawnTimer <= 0 && ufos.length < maxUfos) {
    createUfo();
    state.spawnTimer = Math.max(0.55, state.spawnEvery - state.wave * 0.06 + Math.random() * 0.65);
  }

  for (let i = ufos.length - 1; i >= 0; i -= 1) {
    const ufo = ufos[i];
    ufo.userData.wobble += delta * 3;
    ufo.position.x += ufo.userData.speed * delta;
    ufo.position.y += Math.sin(ufo.userData.wobble) * delta * 1.25;
    ufo.rotation.y += delta * 2.8;
    ufo.rotation.z = Math.sin(elapsed * 2 + ufo.userData.wobble) * 0.08;
    ufo.userData.shootTimer -= delta;

    if (ufo.userData.shootTimer <= 0) {
      createEnemyBolt(ufo.position.clone().add(new THREE.Vector3(0, -0.8, 0)), tank.position.clone().add(new THREE.Vector3(0, 1, 0)));
      ufo.userData.shootTimer = Math.max(1.35, 3.6 - state.wave * 0.08 + Math.random() * 2);
    }

    if (Math.abs(ufo.position.x) > 42) {
      scene.remove(ufo);
      ufos.splice(i, 1);
    }
  }
}

function updateProjectiles(delta) {
  state.fireCooldown = Math.max(0, state.fireCooldown - delta);

  for (let i = shots.length - 1; i >= 0; i -= 1) {
    const shot = shots[i];
    const previousPosition = shot.position.clone();
    shot.position.addScaledVector(shot.userData.velocity, delta);
    shot.rotation.x += delta * 12;
    shot.userData.life -= delta;
    reusableLine.set(previousPosition, shot.position);

    let hit = false;
    for (let j = ufos.length - 1; j >= 0; j -= 1) {
      const ufo = ufos[j];
      const closestPoint = reusableLine.closestPointToPoint(ufo.position, true, reusableVector);
      if (closestPoint.distanceTo(ufo.position) < ufo.userData.radius + shot.userData.radius) {
        ufo.userData.hp -= 1;
        createBurst(shot.position, palette.plasma, 16, 1.1);
        hit = true;
        if (ufo.userData.hp <= 0) {
          state.score += 150 + state.wave * 20;
          state.ufosDestroyedThisWave += 1;
          createBurst(ufo.position, palette.beam, 28, 1.55);
          scene.remove(ufo);
          ufos.splice(j, 1);
          if (state.ufosDestroyedThisWave >= state.ufoGoal) nextWave();
        }
        break;
      }
    }

    if (hit || shot.userData.life <= 0) {
      scene.remove(shot);
      shots.splice(i, 1);
    }
  }

  for (let i = enemyBolts.length - 1; i >= 0; i -= 1) {
    const bolt = enemyBolts[i];
    bolt.position.addScaledVector(bolt.userData.velocity, delta);
    bolt.rotation.y += delta * 8;
    bolt.userData.life -= delta;

    const tankHit = bolt.position.distanceTo(tank.position.clone().add(new THREE.Vector3(0, 1.1, 0))) < 2.5;
    if (tankHit) {
      state.health -= 7;
      createBurst(bolt.position, palette.warning, 18, 1.1);
      updateHud();
      if (state.health <= 0) endGame();
    }

    if (tankHit || bolt.userData.life <= 0 || bolt.position.y < -1) {
      scene.remove(bolt);
      enemyBolts.splice(i, 1);
    }
  }
}

function updateParticles(delta) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i];
    particle.position.addScaledVector(particle.userData.velocity, delta);
    particle.userData.velocity.y -= 7 * delta;
    particle.userData.life -= delta;
    const scale = Math.max(0.01, particle.userData.life / particle.userData.maxLife);
    particle.scale.setScalar(scale);
    if (particle.userData.life <= 0) {
      scene.remove(particle);
      particles.splice(i, 1);
    }
  }
}

function updateAtmosphere(delta, elapsed) {
  stars.forEach((star, index) => {
    star.rotation.y += delta * (0.5 + index * 0.002);
    star.scale.setScalar(0.8 + Math.sin(elapsed * 2 + index) * 0.18);
  });

  clouds.forEach((cloud) => {
    cloud.position.x += cloud.userData.speed * delta;
    if (cloud.position.x > 46) cloud.position.x = -48;
  });
}

function nextWave() {
  state.wave += 1;
  state.ufosDestroyedThisWave = 0;
  state.ufoGoal += 3;
  state.health = Math.min(100, state.health + 12);
  state.spawnEvery = Math.max(0.72, state.spawnEvery - 0.12);
  updateHud();
}

function endGame() {
  state.running = false;
  state.gameOver = true;
  setOverlay(
    "Mission Failed",
    `Final score: ${state.score}. The saucers punched through the ridge defense, but the tank is ready for another run.`,
    "Restart Mission",
  );
}

function togglePause() {
  if (!state.running || state.gameOver) return;
  state.paused = !state.paused;
  if (state.paused) {
    setOverlay("Paused", "The sky is holding its breath. Resume when you are ready.", "Resume Mission");
  } else {
    hideOverlay();
  }
}

function onPointerMove(event) {
  const rect = gameShell.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (renderer) renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.position.set(0, height < 640 ? 16 : 13, height < 640 ? 34 : 28);
  camera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.04);
  const elapsed = clock.elapsedTime;

  if (state.running && !state.paused) {
    updateTank(delta);
    updateUfos(delta, elapsed);
    updateProjectiles(delta);
    updateParticles(delta);
  }

  updateAtmosphere(delta, elapsed);
  camera.lookAt(tank.position.x * 0.24, 4.2, -1.5);
  if (renderer) renderer.render(scene, camera);
}

window.addEventListener("resize", resize);
window.addEventListener("pointermove", onPointerMove);
window.addEventListener("pointerdown", createShot);
window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (event.code === "Space") {
    event.preventDefault();
    createShot();
  }
  if (event.code === "KeyP") togglePause();
});
window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

startButton.addEventListener("click", () => {
  if (state.paused) {
    state.paused = false;
    hideOverlay();
    return;
  }
  resetGame();
});

createWorld();
resize();
updateHud();
animate();

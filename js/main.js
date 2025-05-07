import * as THREE from 'three'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Variables de control del juego
let gameRunning = false;
let animationId = null;
let gamePaused = false;
let gameStartTime = 0;

// Escena, cámara y renderer
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.1, 1000)
camera.position.set(0, 150, 260) //150 modifica la posición de la camara

const modelPaths = {
  train: 'modeloTren/scene.gltf',
  barrier: 'modeloBarrera/scene.gltf'
};

const trackCount = 3;
const trackWidth = 300;
const trackSpacing = trackWidth / trackCount;

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
renderer.shadowMap.enabled = true
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

// Grupo para la pista
const trackGroup = new THREE.Group();
scene.add(trackGroup);

// FbxLoader y animaciones
const fbxLoader = new FBXLoader()
const gltfLoader = new GLTFLoader();

let mixer
const animationsMap = {}
let currentAction

const animationFiles = {
  'Adelante': 'models/fbx/Adelante.fbx',
  'Izquierdo': 'models/fbx/Izquierdo.fbx',
  'Derecho': 'models/fbx/Derecho.fbx',
  'Saltar': 'models/fbx/Saltar.fbx',
  'Caer': 'models/fbx/Caer.fbx',
  'Alto': 'models/fbx/Alto.fbx',
  'Arrastre': 'models/fbx/Arrastre.fbx',
}

function loadAnimation(name, path) {
  fbxLoader.load(path, (anim) => {
    const action = mixer.clipAction(anim.animations[0]);
    animationsMap[name] = action;

    if (name === 'Alto' && !currentAction) {
      action.play();
      currentAction = action;
    }
  });
}

// Clase Box (colisionador)
class Box extends THREE.Mesh {
  constructor({ width, height, depth, color = '#00ff00',
    velocity = { x: 0, y: 0, z: 0 },
    position = { x: 0, y: 0, z: 0 },
    zAcceleration = false }) {
    super(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({ color })
    )

    this.canJump = false
    this.width = width
    this.height = height
    this.depth = depth
    this.position.set(position.x, position.y, position.z)

    this.velocity = velocity
    this.gravity = -0.25
    this.zAcceleration = zAcceleration

    this.updateSides()
  }

  updateSides() {
    this.right = this.position.x + this.width / 2
    this.left = this.position.x - this.width / 2
    this.bottom = this.position.y - this.height / 2
    this.top = this.position.y + this.height / 2
    this.front = this.position.z + this.depth / 2
    this.back = this.position.z - this.depth / 2
  }

  update(ground) {
    this.updateSides()
    if (this.zAcceleration) this.velocity.z += 0.0003
    this.position.x += this.velocity.x
    this.position.z += this.velocity.z
    this.applyGravity(ground)
  }

  applyGravity(ground) {
    this.velocity.y += this.gravity
    if (boxCollision({ box1: this, box2: ground })) {
      this.velocity.y = 0
      this.canJump = true
      this.position.y = ground.top + this.height / 2
    } else {
      this.canJump = false
      this.position.y += this.velocity.y
    }
  }
}

function boxCollision({ box1, box2 }) { // Colisión
  const xCollision = box1.right >= box2.left && box1.left <= box2.right
  const yCollision = box1.bottom + box1.velocity.y <= box2.top && box1.top >= box2.bottom
  const zCollision = box1.front >= box2.back && box1.back <= box2.front

  return xCollision && yCollision && zCollision
}

const cube = new Box({ // Cubo invisible
  width: 20,
  height: 25,
  depth: 10,
  velocity: { x: 0, y: -0.01, z: 0 },
  position: { x: 0, y: 12.5, z: 100 }
})
cube.visible = false
cube.castShadow = true
scene.add(cube)

const ground = new Box({
  width: trackWidth,
  height: 5,
  depth: 3000,
  color: '#2D1B0E',
  position: { x: 0, y: -5, z: 0 }
})

ground.receiveShadow = true
scene.add(ground)

// Modifica la función createTracks() para agregar el movimiento de las texturas
function createTracks() {
  // Primero cargamos el modelo GLTF original como lo tenías
  const gltfLoader = new GLTFLoader();
  gltfLoader.load('escenario/scene.gltf', (gltf) => {
    const sceneModel = gltf.scene;
    sceneModel.scale.set(60, 100, 100);
    sceneModel.position.set(-258, -25, 10);
    sceneModel.rotation.y = Math.PI / 2;

    sceneModel.traverse((child) => {
      if (child.isMesh) {
        child.receiveShadow = true;
        child.castShadow = true;
      }
    });

    trackGroup.add(sceneModel);

    // Ahora agregamos las vías del tren con tablas de madera
    const railMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.7,
      metalness: 1
    });

    const woodMaterial = new THREE.MeshStandardMaterial({
      color: 0x8B4513,
      roughness: 0.8,
      metalness: 0.1
    });

    // Crear un array para almacenar las tablas de madera
    const woodPlanks = [];

    // Crear las vías (rieles) para cada una de las 3 pistas
    for (let i = 0; i < trackCount; i++) {
      const trackX = -trackWidth / 2 + trackSpacing / 2 + i * trackSpacing;

      // Riél izquierdo
      const leftRail = new THREE.Mesh(
        new THREE.BoxGeometry(5, 2, 3000),
        railMaterial
      );
      leftRail.position.set(trackX - 15, 0.5, 0);
      leftRail.receiveShadow = true;
      leftRail.castShadow = true;
      trackGroup.add(leftRail);

      // Riél derecho
      const rightRail = new THREE.Mesh(
        new THREE.BoxGeometry(5, 2, 3000),
        railMaterial
      );
      rightRail.position.set(trackX + 15, 0.5, 0);
      rightRail.receiveShadow = true;
      rightRail.castShadow = true;
      trackGroup.add(rightRail);

      // Tablas de madera entre los rieles (cada 1.5 unidades en Z)
      for (let z = -1500; z < 1500; z += 10) {
        const woodPlank = new THREE.Mesh(
          new THREE.BoxGeometry(25, 1, 2),
          woodMaterial
        );
        woodPlank.position.set(trackX, 0.25, z);
        woodPlank.receiveShadow = true;
        woodPlank.castShadow = true;
        trackGroup.add(woodPlank);
        woodPlanks.push(woodPlank);
      }
    }

    // Agregar la lógica de movimiento de las tablas en el animate()
    function movePlanks(speed) {
      woodPlanks.forEach(plank => {
        plank.position.z += speed;

        // Si la tabla sale del área visible, la reposicionamos al inicio
        if (plank.position.z > 1500) {
          plank.position.z = -1500;
        }
      });
    }

    // Guardamos la función en el trackGroup para poder acceder a ella
    trackGroup.userData.movePlanks = movePlanks;
  });
}

createTracks();

// Luces
const light = new THREE.DirectionalLight(0xffffff, 0.5)
light.position.set(0, 3, 1)
light.castShadow = true
scene.add(light)
scene.add(new THREE.AmbientLight(0xffffff, 0.5))

const backLight = new THREE.DirectionalLight(0xffffff, 1);
backLight.position.set(0, 50, -100); // Posición inicial detrás del personaje
backLight.castShadow = true;
scene.add(backLight);

backLight.position.set(cube.position.x, 50, cube.position.z - 100);

let playerModel // Modelo y animaciones

fbxLoader.load(animationFiles['Alto'], (fbx) => {
  playerModel = fbx;
  playerModel.scale.set(0.5, 0.5, -0.5);
  playerModel.position.copy(cube.position);
  playerModel.position.y += 0.5;

  playerModel.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.material.transparent = false;
      child.material.opacity = 1;
      child.material.side = THREE.DoubleSide;
      child.material.color = new THREE.Color(0xffffff);
    }
  });

  scene.add(playerModel);
  mixer = new THREE.AnimationMixer(playerModel);

  if (fbx.animations.length > 0) {
    const clip = fbx.animations[0];
    const action = mixer.clipAction(clip);
    action.play();
    currentAction = action;
    animationsMap['Alto'] = action;
  } else {
    loadAnimation('Alto', animationFiles['Alto']);
  }

  Object.entries(animationFiles).forEach(([name, path]) => {
    if (name !== 'Alto') {
      loadAnimation(name, path);
    }
  });

  Object.values(animationsMap).forEach(action => {
    action.clampWhenFinished = true
    action.setLoop(THREE.LoopRepeat, Infinity)
  })

  mixer.update(0);
});

const keys = {
  a: { pressed: false }, // Teclado
  d: { pressed: false },
  w: { pressed: false }
}

window.addEventListener('keydown', (event) => {
  if (!gameRunning || gamePaused) return;

  switch (event.code) {
    case 'KeyA': keys.a.pressed = true; break;
    case 'KeyD': keys.d.pressed = true; break;
    case 'KeyW': keys.w.pressed = true; break;
    case 'Space':
      if (cube.canJump) {
        cube.velocity.y = 6;
        cube.canJump = false;
        playAnimation('Saltar');
      }
      break;
  }
});

window.addEventListener('keyup', (event) => {
  switch (event.code) {
    case 'KeyA': keys.a.pressed = false; break;
    case 'KeyD': keys.d.pressed = false; break;
    case 'KeyW': keys.w.pressed = false; break;
  }
});

function playAnimation(name) {
  if (currentAction === animationsMap[name]) return

  if (!cube.canJump) {
    if (cube.velocity.y > 0 && name !== 'Saltar') return
    if (cube.velocity.y < 0 && name !== 'Caer') return
  }

  if (animationsMap[name]) {
    const toPlay = animationsMap[name]
    if (currentAction) { currentAction.fadeOut(0.1) }
    toPlay.reset().fadeIn(0.1).play()
    currentAction = toPlay
  }
}

const enemies = [] // Enemigos
let frames = 0
let spawnRate = 150   //////// 200
let trackSpeed = 10; //////// 5

function startGame() {
  if (!gameRunning) {
    gameRunning = true;
    gamePaused = false;
    gameStartTime = performance.now(); // Registrar el tiempo de inicio
    document.getElementById('startBtn').disabled = true;
    document.getElementById('pauseBtn').disabled = false;

    playAnimation('Alto'); // Forzar animación "Alto" al inicio
    animate();
  }
}

function togglePause() { // Función para pausar/reanudar el juego
  if (gameRunning) {
    if (gamePaused) {
      gamePaused = false;
      document.getElementById('pauseBtn').textContent = 'Pausar';
      animate();
    } else {
      gamePaused = true;
      document.getElementById('pauseBtn').textContent = 'Reanudar';
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    }
  }
}

function restartGame() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  cube.position.set(0, 12.5, 50);
  cube.velocity = { x: 0, y: -0.01, z: 0 };

  enemies.forEach(enemy => { // Eliminar tanto los colliders como sus modelos asociados
    if (enemy.userData.model) {
      scene.remove(enemy.userData.model);
    }
    scene.remove(enemy);
  });
  enemies.length = 0;

  trackGroup.position.z = 0;
  trackSpeed = 10;

  if (playerModel) {
    playerModel.position.copy(cube.position);
    playerModel.position.y += 0.5;
    playAnimation('Alto');
  }

  frames = 0;
  spawnRate = 200;

  document.getElementById("gameOverMessage").style.display = "none";
  document.getElementById("startBtn").disabled = false;
  document.getElementById("pauseBtn").disabled = true;
  document.getElementById("pauseBtn").textContent = 'Pausar';

  gameRunning = false;
  gamePaused = false;

  startGame();
}

// Event listeners para los botones
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('pauseBtn').addEventListener('click', togglePause);
document.getElementById('restartBtn').addEventListener('click', restartGame);
document.getElementById("retryButton").addEventListener("click", restartGame);

document.querySelectorAll('#startBtn, #pauseBtn, #restartBtn, #retryButton').forEach(button => {
  button.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
    }
  });
});

const clock = new THREE.Clock()

function animate() {
  animationId = requestAnimationFrame(animate);
  if (gamePaused) return;

  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsedTime = (performance.now() - gameStartTime) / 1000;
  renderer.render(scene, camera);

  if (cube) {
    backLight.position.set(
      cube.position.x,           // Seguir en X (izquierda/derecha)
      cube.position.y + 50,      // Mantener altura relativa al personaje (Y)
      cube.position.z - 100      // Posición detrás del personaje (Z)
    );

    // Opcional: Hacer que la luz mire hacia el personaje
    backLight.target.position.copy(cube.position);
    backLight.target.updateMatrixWorld();
  }

  if (mixer) mixer.update(delta);
  if (elapsedTime >= 1) {
    if (trackGroup.userData.movePlanks) {
      trackGroup.userData.movePlanks(trackSpeed * delta * 10);
    }
  }

  if (elapsedTime >= 1 && frames % 1000 === 0) {
    trackSpeed += 0.3;  /////// 0.2
  }

  cube.velocity.x = 0;
  cube.velocity.z = 0;

  if (elapsedTime >= 1) {
    if (cube.canJump) {
      if (keys.a.pressed) {
        cube.velocity.x = -2;
      } else if (keys.d.pressed) {
        cube.velocity.x = 2;
      } else {
        cube.velocity.x = 0;
      }

      if (keys.w.pressed) {
        cube.velocity.x *= 0.5;
        playAnimation('Arrastre');
      }
      else if (keys.a.pressed) {
        playAnimation('Izquierdo');
      } else if (keys.d.pressed) {
        playAnimation('Derecho');
      } else {
        playAnimation('Adelante');
      }
    } else {
      if (cube.velocity.y > 0) {
        playAnimation('Saltar')
      } else {
        playAnimation('Caer')
      }

      if (keys.a.pressed) cube.velocity.x = -2
      else if (keys.d.pressed) cube.velocity.x = 2
    }
  } else {
    playAnimation('Alto');
    cube.velocity.x = 0;
    cube.velocity.z = 0;
  }

  const limitX = (ground.width / 2) - (cube.width / 2) - 15;
  cube.position.x = Math.max(-limitX, Math.min(limitX, cube.position.x))
  cube.update(ground)

  if (playerModel) {
    playerModel.position.lerp(cube.position, 0.3)
  }

  // Actualizar posición de la cámara (seguir al personaje)
  camera.position.x = cube.position.x;
  camera.position.z = cube.position.z + 200; // Mantener el offset en Z
  camera.lookAt(cube.position.x, cube.position.y + 100, cube.position.z); // Mirar hacia el personaje

  // Actualizar posición de la luz trasera (seguir al personaje)
  backLight.position.set(cube.position.x, 50, cube.position.z - 100);

  // Resto del código de animate() permanece igual...
  if (elapsedTime >= 1) {
    enemies.forEach((collider, index) => {
      collider.update(ground);
      collider.position.z += trackSpeed * delta;

      if (collider.userData.model) {
        collider.userData.model.position.copy(collider.position);
        collider.userData.model.position.y = 0;
      }

      if (boxCollision({ box1: cube, box2: collider })) {
        document.getElementById("gameOverMessage").style.display = "block";
        document.getElementById("scoreDisplay").textContent = frames;
        cancelAnimationFrame(animationId);
        gameRunning = false;
      }
    });

    const gltfLoader = new GLTFLoader();

    if (frames % spawnRate === 0 && gameRunning && !gamePaused) {
      if (spawnRate > 50) spawnRate -= 2;

      const trackIndex = Math.floor(Math.random() * trackCount);
      const trackX = -trackWidth / 2 + trackSpacing / 2 + trackIndex * trackSpacing;

      const spawnTrain = Math.random() > 0.5;

      if (spawnTrain) {
        gltfLoader.load(modelPaths.train, (gltf) => {
          const enemyModel = gltf.scene;
          enemyModel.scale.set(30, 30, 30);
          enemyModel.rotation.y = Math.PI;

          const collider = new Box({
            width: 80,
            height: 90,
            depth: 600,
            position: {
              x: trackX + (Math.random() - 0.5) * 5,
              y: 45,
              z: trackGroup.position.z - 1000
            },
            velocity: { x: 0, y: 0, z: trackSpeed },
            color: 'red',
            zAcceleration: false
          });
          collider.visible = false;

          enemyModel.position.copy(collider.position);
          enemyModel.position.y = 0;
          collider.userData.model = enemyModel;

          scene.add(enemyModel);
          scene.add(collider);
          enemies.push(collider);
        });
      } else {
        gltfLoader.load(modelPaths.barrier, (gltf) => {
          const barrierModel = gltf.scene;
          barrierModel.scale.set(40, 40, 40);
          barrierModel.rotation.y = Math.PI;

          const collider = new Box({
            width: 70,
            height: 10,
            depth: 5,
            position: {
              x: trackX + (Math.random() - 0.5) * 5,
              y: 25,
              z: trackGroup.position.z - 1000
            },
            velocity: { x: 0, y: 0, z: trackSpeed },
            color: 'orange',
            zAcceleration: false
          });
          collider.visible = false;

          barrierModel.position.copy(collider.position);
          barrierModel.position.y = 0;
          collider.userData.model = barrierModel;

          scene.add(barrierModel);
          scene.add(collider);
          enemies.push(collider);
        });
      }
    }
  }
  frames++;
}
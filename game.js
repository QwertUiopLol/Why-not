// Game configuration
const CONFIG = {
    BOX_SIZE: 5,
    BLOCK_SIZE: 1,
    PLAYER_HEIGHT: 1.7,
    PLAYER_RADIUS: 0.4,
    MOVE_SPEED: 6,
    JUMP_FORCE: 10,
    GRAVITY: -25,
    LOOK_SENSITIVITY: 0.005,
    JOYSTICK_MAX_DISTANCE: 50
};

// Global variables
let scene, camera, renderer;
let player = {
    position: new THREE.Vector3(0, CONFIG.PLAYER_HEIGHT, 0),
    velocity: new THREE.Vector3(0, 0, 0),
    rotation: { x: 0, y: 0 },
    onGround: false,
    canJump: true
};

let joystickData = {
    active: false,
    centerX: 0,
    centerY: 0,
    currentX: 0,
    currentY: 0,
    deltaX: 0,
    deltaY: 0,
    touchId: null
};

let lookData = {
    active: false,
    lastX: 0,
    lastY: 0,
    touchId: null
};

let blocks = [];
let lastTime = performance.now();
let frameCount = 0;
let fps = 0;
let gameStarted = false;

// Initialize the game
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 10, 50);
    
    // Create camera
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.copy(player.position);
    
    // Create renderer with optimizations for mobile
    renderer = new THREE.WebGLRenderer({ 
        antialias: false,
        powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    document.getElementById('game-container').appendChild(renderer.domElement);
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(10, 20, 10);
    scene.add(directionalLight);
    
    // Create the box room made of blocks
    createBlockRoom();
    
    // Setup controls
    setupControls();
    
    // Handle resize
    window.addEventListener('resize', onWindowResize);
    
    // Start button
    document.getElementById('start-btn').addEventListener('click', function() {
        document.getElementById('instructions').classList.add('hidden');
        gameStarted = true;
    });
    
    // Start game loop
    animate();
}

function createBlockRoom() {
    const blockMaterials = [
        new THREE.MeshLambertMaterial({ color: 0x8B4513 }), // Brown
        new THREE.MeshLambertMaterial({ color: 0xA0522D }), // Sienna
        new THREE.MeshLambertMaterial({ color: 0xCD853F }), // Peru
        new THREE.MeshLambertMaterial({ color: 0xD2691E }), // Chocolate
        new THREE.MeshLambertMaterial({ color: 0xDEB887 })  // Burlywood
    ];
    
    const halfSize = Math.floor(CONFIG.BOX_SIZE / 2);
    const blockSize = CONFIG.BLOCK_SIZE;
    
    // Create floor (5x5 blocks)
    for (let x = -halfSize; x <= halfSize; x++) {
        for (let z = -halfSize; z <= halfSize; z++) {
            const block = createBlock(x * blockSize, -halfSize - 0.5, z * blockSize, blockMaterials[Math.floor(Math.random() * 3)]);
            blocks.push(block);
        }
    }
    
    // Create ceiling (5x5 blocks)
    for (let x = -halfSize; x <= halfSize; x++) {
        for (let z = -halfSize; z <= halfSize; z++) {
            const block = createBlock(x * blockSize, halfSize + 0.5, z * blockSize, blockMaterials[Math.floor(Math.random() * 2)]);
            blocks.push(block);
        }
    }
    
    // Create walls (5 blocks high, 5 blocks wide each)
    // Front wall (z = -halfSize)
    for (let x = -halfSize; x <= halfSize; x++) {
        for (let y = -halfSize; y <= halfSize; y++) {
            const block = createBlock(x * blockSize, y * blockSize, -halfSize - 0.5, blockMaterials[Math.floor(Math.random() * blockMaterials.length)]);
            blocks.push(block);
        }
    }
    
    // Back wall (z = halfSize)
    for (let x = -halfSize; x <= halfSize; x++) {
        for (let y = -halfSize; y <= halfSize; y++) {
            const block = createBlock(x * blockSize, y * blockSize, halfSize + 0.5, blockMaterials[Math.floor(Math.random() * blockMaterials.length)]);
            blocks.push(block);
        }
    }
    
    // Left wall (x = -halfSize)
    for (let z = -halfSize + 1; z <= halfSize - 1; z++) {
        for (let y = -halfSize; y <= halfSize; y++) {
            const block = createBlock(-halfSize - 0.5, y * blockSize, z * blockSize, blockMaterials[Math.floor(Math.random() * blockMaterials.length)]);
            blocks.push(block);
        }
    }
    
    // Right wall (x = halfSize)
    for (let z = -halfSize + 1; z <= halfSize - 1; z++) {
        for (let y = -halfSize; y <= halfSize; y++) {
            const block = createBlock(halfSize + 0.5, y * blockSize, z * blockSize, blockMaterials[Math.floor(Math.random() * blockMaterials.length)]);
            blocks.push(block);
        }
    }
}

function createBlock(x, y, z, material) {
    const geometry = new THREE.BoxGeometry(CONFIG.BLOCK_SIZE, CONFIG.BLOCK_SIZE, CONFIG.BLOCK_SIZE);
    const block = new THREE.Mesh(geometry, material);
    block.position.set(x, y, z);
    
    // Add edges for better block definition
    const edges = new THREE.EdgesGeometry(geometry);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 }));
    block.add(line);
    
    scene.add(block);
    return block;
}

function setupControls() {
    // Joystick controls
    const joystickContainer = document.getElementById('joystick-container');
    const joystickKnob = document.getElementById('joystick-knob');
    
    joystickContainer.addEventListener('touchstart', handleJoystickStart);
    joystickContainer.addEventListener('touchmove', handleJoystickMove);
    joystickContainer.addEventListener('touchend', handleJoystickEnd);
    joystickContainer.addEventListener('touchcancel', handleJoystickEnd);
    
    // Look controls - entire screen
    const lookZone = document.getElementById('look-zone');
    lookZone.addEventListener('touchstart', handleLookStart, { passive: false });
    lookZone.addEventListener('touchmove', handleLookMove, { passive: false });
    lookZone.addEventListener('touchend', handleLookEnd);
    lookZone.addEventListener('touchcancel', handleLookEnd);
    
    // Jump button
    const jumpBtn = document.getElementById('jump-btn');
    jumpBtn.addEventListener('touchstart', handleJump, { passive: false });
    
    // Prevent default touch behaviors
    document.addEventListener('touchmove', (e) => {
        e.preventDefault();
    }, { passive: false });
}

function handleJoystickStart(e) {
    e.preventDefault();
    const touch = e.changedTouches[0];
    joystickData.touchId = touch.identifier;
    
    const rect = e.target.getBoundingClientRect();
    joystickData.centerX = rect.left + rect.width / 2;
    joystickData.centerY = rect.top + rect.height / 2;
    joystickData.currentX = touch.clientX;
    joystickData.currentY = touch.clientY;
    joystickData.active = true;
    
    updateJoystick();
}

function handleJoystickMove(e) {
    if (!joystickData.active) return;
    e.preventDefault();
    
    for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joystickData.touchId) {
            const touch = e.changedTouches[i];
            joystickData.currentX = touch.clientX;
            joystickData.currentY = touch.clientY;
            break;
        }
    }
    
    updateJoystick();
}

function handleJoystickEnd(e) {
    e.preventDefault();
    
    for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joystickData.touchId) {
            joystickData.active = false;
            joystickData.touchId = null;
            joystickData.deltaX = 0;
            joystickData.deltaY = 0;
            
            const joystickKnob = document.getElementById('joystick-knob');
            joystickKnob.style.transform = 'translate(-50%, -50%)';
            break;
        }
    }
}

function updateJoystick() {
    const maxDistance = CONFIG.JOYSTICK_MAX_DISTANCE;
    let dx = joystickData.currentX - joystickData.centerX;
    let dy = joystickData.currentY - joystickData.centerY;
    
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > maxDistance) {
        dx = (dx / distance) * maxDistance;
        dy = (dy / distance) * maxDistance;
    }
    
    joystickData.deltaX = dx / maxDistance;
    joystickData.deltaY = dy / maxDistance;
    
    const joystickKnob = document.getElementById('joystick-knob');
    joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}

function handleLookStart(e) {
    e.preventDefault();
    const touch = e.changedTouches[0];
    
    // Ignore touches on UI elements
    if (touch.target.closest('#joystick-container') || 
        touch.target.closest('#jump-btn') ||
        touch.target.closest('#instructions')) {
        return;
    }
    
    lookData.touchId = touch.identifier;
    lookData.active = true;
    lookData.lastX = touch.clientX;
    lookData.lastY = touch.clientY;
}

function handleLookMove(e) {
    if (!lookData.active || !gameStarted) return;
    e.preventDefault();
    
    for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === lookData.touchId) {
            const touch = e.changedTouches[i];
            const deltaX = touch.clientX - lookData.lastX;
            const deltaY = touch.clientY - lookData.lastY;
            
            player.rotation.y -= deltaX * CONFIG.LOOK_SENSITIVITY;
            player.rotation.x -= deltaY * CONFIG.LOOK_SENSITIVITY;
            
            // Clamp vertical look
            player.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, player.rotation.x));
            
            lookData.lastX = touch.clientX;
            lookData.lastY = touch.clientY;
            break;
        }
    }
}

function handleLookEnd(e) {
    e.preventDefault();
    
    for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === lookData.touchId) {
            lookData.active = false;
            lookData.touchId = null;
            break;
        }
    }
}

function handleJump(e) {
    e.preventDefault();
    if (player.onGround && gameStarted) {
        player.velocity.y = CONFIG.JUMP_FORCE;
        player.onGround = false;
        player.canJump = false;
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function checkCollision(newPos) {
    const halfSize = CONFIG.BOX_SIZE / 2;
    const playerHeight = CONFIG.PLAYER_HEIGHT;
    const radius = CONFIG.PLAYER_RADIUS;
    
    // Check floor and ceiling
    if (newPos.y - playerHeight < -halfSize) {
        newPos.y = -halfSize + playerHeight;
        return true;
    }
    if (newPos.y > halfSize) {
        newPos.y = halfSize;
        return true;
    }
    
    // Check walls
    if (newPos.x - radius < -halfSize) {
        newPos.x = -halfSize + radius;
        return true;
    }
    if (newPos.x + radius > halfSize) {
        newPos.x = halfSize - radius;
        return true;
    }
    if (newPos.z - radius < -halfSize) {
        newPos.z = -halfSize + radius;
        return true;
    }
    if (newPos.z + radius > halfSize) {
        newPos.z = halfSize - radius;
        return true;
    }
    
    return false;
}

function updatePhysics(deltaTime) {
    // Apply gravity with smooth interpolation
    player.velocity.y += CONFIG.GRAVITY * deltaTime;
    
    // Calculate movement based on joystick and camera rotation
    let moveX = 0;
    let moveZ = 0;
    
    if (joystickData.active && gameStarted) {
        const forward = -joystickData.deltaY;
        const right = joystickData.deltaX;
        
        // Smooth movement with deadzone
        const deadzone = 0.1;
        const adjustedForward = Math.abs(forward) > deadzone ? forward : 0;
        const adjustedRight = Math.abs(right) > deadzone ? right : 0;
        
        moveX = adjustedRight * Math.cos(player.rotation.y) - adjustedForward * Math.sin(player.rotation.y);
        moveZ = adjustedRight * Math.sin(player.rotation.y) + adjustedForward * Math.cos(player.rotation.y);
    }
    
    // Apply movement with smoothing
    const moveSpeed = CONFIG.MOVE_SPEED;
    const oldPos = player.position.clone();
    
    player.position.x += moveX * moveSpeed * deltaTime;
    player.position.z += moveZ * moveSpeed * deltaTime;
    
    // Check horizontal collisions
    if (checkCollision(player.position)) {
        player.position.x = oldPos.x;
        player.position.z = oldPos.z;
    }
    
    // Apply vertical movement
    player.position.y += player.velocity.y * deltaTime;
    
    // Check vertical collisions
    const wasAboveGround = player.position.y > -CONFIG.BOX_SIZE/2 + CONFIG.PLAYER_HEIGHT;
    
    if (checkCollision(player.position)) {
        if (player.velocity.y < 0 && wasAboveGround) {
            player.onGround = true;
            player.canJump = true;
        }
        player.velocity.y = 0;
    } else {
        player.onGround = false;
    }
    
    // Update camera position and rotation smoothly
    camera.position.copy(player.position);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = player.rotation.y;
    camera.rotation.x = player.rotation.x;
}

function updateFPS() {
    const currentTime = performance.now();
    frameCount++;
    
    if (currentTime - lastTime >= 1000) {
        fps = frameCount;
        frameCount = 0;
        lastTime = currentTime;
        
        document.getElementById('fps').textContent = fps;
    }
}

function animate() {
    requestAnimationFrame(animate);
    
    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1);
    
    if (gameStarted) {
        updatePhysics(deltaTime);
    }
    updateFPS();
    
    renderer.render(scene, camera);
}

// Start the game when the page loads
window.addEventListener('load', init);

// Game configuration - Minecraft PE style
const CONFIG = {
    BOX_SIZE: 5,
    BLOCK_SIZE: 1,
    PLAYER_HEIGHT: 1.7,
    PLAYER_RADIUS: 0.3,
    MOVE_SPEED: 4.3, // Minecraft walking speed
    JUMP_FORCE: 8.5, // Minecraft jump height
    GRAVITY: -20,
    LOOK_SENSITIVITY: 0.004,
    JOYSTICK_MAX_DISTANCE: 40,
    JOYSTICK_DEADZONE: 0.1,
    JOYSTICK_SMOOTHING: 0.3 // Lower = smoother, less snappy
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
    smoothedX: 0,
    smoothedY: 0,
    touchId: null,
    baseRect: null
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
    
    // Jump button - proper touch handling
    const jumpBtn = document.getElementById('jump-btn');
    jumpBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (player.onGround && gameStarted) {
            player.velocity.y = CONFIG.JUMP_FORCE;
            player.onGround = false;
            // Visual feedback
            jumpBtn.style.transform = 'scale(0.9)';
        }
    }, { passive: false });
    
    jumpBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        jumpBtn.style.transform = 'scale(1)';
    }, { passive: false });
    
    // Prevent default touch behaviors globally only when game started
    document.addEventListener('touchmove', (e) => {
        if (gameStarted) {
            e.preventDefault();
        }
    }, { passive: false });
    
    // Also prevent jump button from stealing focus
    jumpBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
    });
}

function handleJoystickStart(e) {
    e.preventDefault();
    const touch = e.changedTouches[0];
    joystickData.touchId = touch.identifier;
    
    // Get the container rect and store it
    const container = document.getElementById('joystick-container');
    const rect = container.getBoundingClientRect();
    joystickData.baseRect = rect;
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
            joystickData.smoothedX = 0;
            joystickData.smoothedY = 0;
            joystickData.baseRect = null;
            
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
    
    // Normalize to -1 to 1 range with deadzone
    if (distance > maxDistance) {
        dx = (dx / distance) * maxDistance;
        dy = (dy / distance) * maxDistance;
    }
    
    // Apply deadzone - only register movement beyond threshold
    const normalizedX = dx / maxDistance;
    const normalizedY = dy / maxDistance;
    const deadzone = CONFIG.JOYSTICK_DEADZONE;
    
    // Apply deadzone smoothly
    let adjustedX = 0;
    let adjustedY = 0;
    
    if (Math.abs(normalizedX) > deadzone) {
        adjustedX = (Math.abs(normalizedX) - deadzone) / (1 - deadzone);
        adjustedX = Math.sign(normalizedX) * adjustedX;
    }
    
    if (Math.abs(normalizedY) > deadzone) {
        adjustedY = (Math.abs(normalizedY) - deadzone) / (1 - deadzone);
        adjustedY = Math.sign(normalizedY) * adjustedY;
    }
    
    // Apply smoothing for less snappy, more Minecraft-like feel
    joystickData.smoothedX += (adjustedX - joystickData.smoothedX) * CONFIG.JOYSTICK_SMOOTHING;
    joystickData.smoothedY += (adjustedY - joystickData.smoothedY) * CONFIG.JOYSTICK_SMOOTHING;
    
    joystickData.deltaX = joystickData.smoothedX;
    joystickData.deltaY = joystickData.smoothedY;
    
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
    // Apply gravity
    player.velocity.y += CONFIG.GRAVITY * deltaTime;
    
    // Calculate movement based on joystick and camera rotation
    let moveX = 0;
    let moveZ = 0;
    
    if (joystickData.active && gameStarted) {
        // In Minecraft PE: pushing forward (negative Y on screen) moves forward
        // Pushing right (positive X) strafes right
        const forward = -joystickData.deltaY; // Positive = forward
        const right = joystickData.deltaX;     // Positive = right
        
        // Convert to world coordinates based on camera direction
        // Forward/backward movement along the camera's Z axis
        // Left/right strafing perpendicular to camera direction
        moveX = right * Math.cos(player.rotation.y) + forward * Math.sin(player.rotation.y);
        moveZ = right * Math.sin(player.rotation.y) - forward * Math.cos(player.rotation.y);
    }
    
    // Apply movement
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
    
    // Check vertical collisions - ground level is at -BOX_SIZE/2
    const groundLevel = -CONFIG.BOX_SIZE / 2 + CONFIG.PLAYER_HEIGHT;
    
    if (player.position.y <= groundLevel) {
        player.position.y = groundLevel;
        player.velocity.y = 0;
        player.onGround = true;
    } else {
        player.onGround = false;
    }
    
    // Update camera position and rotation
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

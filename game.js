// Game configuration - Minecraft PE style
const CONFIG = {
    BOX_SIZE: 5,
    BLOCK_SIZE: 1,
    PLAYER_HEIGHT: 1.7,
    PLAYER_RADIUS: 0.3,
    MOVE_SPEED: 4.3, // Minecraft walking speed
    JUMP_FORCE: 8.5, // Minecraft jump height
    GRAVITY: -20,
    LOOK_SENSITIVITY: 0.004
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
    direction: 0 // 0=none, 1=up, 2=down, 3=left, 4=right
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

// Fixed timestep for consistent physics regardless of FPS
const FIXED_DELTA_TIME = 1 / 60; // 60 TPS
let physicsAccumulator = 0;

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
    joystickData.active = true;
    updateDpad();
}

function handleJoystickMove(e) {
    if (!joystickData.active) return;
    e.preventDefault();
    updateDpad();
}

function handleJoystickEnd(e) {
    e.preventDefault();
    joystickData.active = false;
    joystickData.direction = 0;
    updateDpadVisual(0, 0);
}

function updateDpad() {
    const container = document.getElementById('joystick-container');
    const rect = container.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Find active touch in the joystick area
    let activeTouch = null;
    for (let i = 0; i < event.touches.length; i++) {
        const touch = event.touches[i];
        const dx = touch.clientX - centerX;
        const dy = touch.clientY - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < rect.width / 2) {
            activeTouch = touch;
            break;
        }
    }
    
    if (!activeTouch) {
        joystickData.direction = 0;
        updateDpadVisual(0, 0);
        return;
    }
    
    const touch = activeTouch;
    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    
    // Determine direction based on which axis has greater magnitude
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const threshold = 15; // Deadzone threshold
    
    let direction = 0;
    let visualX = 0;
    let visualY = 0;
    
    if (absX < threshold && absY < threshold) {
        direction = 0;
    } else if (absY > absX) {
        // Vertical movement dominates
        if (dy < -threshold) {
            direction = 1; // Up/Forward
            visualY = -20;
        } else if (dy > threshold) {
            direction = 2; // Down/Backward
            visualY = 20;
        }
    } else {
        // Horizontal movement dominates
        if (dx < -threshold) {
            direction = 3; // Left
            visualX = -20;
        } else if (dx > threshold) {
            direction = 4; // Right
            visualX = 20;
        }
    }
    
    joystickData.direction = direction;
    updateDpadVisual(visualX, visualY);
}

function updateDpadVisual(x, y) {
    const joystickKnob = document.getElementById('joystick-knob');
    joystickKnob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
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
    
    // Calculate movement based on D-pad and camera rotation
    let moveX = 0;
    let moveZ = 0;
    
    if (joystickData.active && gameStarted && joystickData.direction !== 0) {
        // D-pad directions: 1=forward, 2=backward, 3=left, 4=right
        let forward = 0;
        let right = 0;
        
        switch(joystickData.direction) {
            case 1: forward = 1; break;  // Up/Forward
            case 2: forward = -1; break; // Down/Backward
            case 3: right = -1; break;   // Left
            case 4: right = 1; break;    // Right
        }
        
        // Convert to world coordinates based on camera direction
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
    let deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    
    // Cap delta time to prevent huge jumps
    deltaTime = Math.min(deltaTime, 0.1);
    
    if (gameStarted) {
        // Accumulate time for fixed timestep physics
        physicsAccumulator += deltaTime;
        
        // Update physics at fixed timestep
        while (physicsAccumulator >= FIXED_DELTA_TIME) {
            updatePhysics(FIXED_DELTA_TIME);
            physicsAccumulator -= FIXED_DELTA_TIME;
        }
    }
    updateFPS();
    
    renderer.render(scene, camera);
}

// Start the game when the page loads
window.addEventListener('load', init);

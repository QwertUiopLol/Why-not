// Game configuration
const CONFIG = {
    BOX_SIZE: 5,
    WALL_THICKNESS: 0.5,
    PLAYER_HEIGHT: 1.7,
    PLAYER_RADIUS: 0.5,
    MOVE_SPEED: 5,
    JUMP_FORCE: 8,
    GRAVITY: -20,
    LOOK_SENSITIVITY: 0.004
};

// Global variables
let scene, camera, renderer;
let player = {
    position: new THREE.Vector3(0, CONFIG.PLAYER_HEIGHT, 0),
    velocity: new THREE.Vector3(0, 0, 0),
    rotation: { x: 0, y: 0 },
    onGround: false
};

let joystickData = {
    active: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    deltaX: 0,
    deltaY: 0
};

let lookData = {
    active: false,
    lastX: 0,
    lastY: 0
};

let walls = [];
let lastTime = performance.now();
let frameCount = 0;
let fps = 0;

// Initialize the game
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    
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
        antialias: false, // Disable for better performance on mobile
        powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for performance
    document.getElementById('game-container').appendChild(renderer.domElement);
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    scene.add(directionalLight);
    
    // Create the box room
    createBoxRoom();
    
    // Setup controls
    setupControls();
    
    // Handle resize
    window.addEventListener('resize', onWindowResize);
    
    // Start game loop
    animate();
}

function createBoxRoom() {
    const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
    const floorMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 });
    const ceilingMaterial = new THREE.MeshLambertMaterial({ color: 0xd2b48c });
    
    const halfSize = CONFIG.BOX_SIZE / 2;
    const thickness = CONFIG.WALL_THICKNESS;
    
    // Floor
    const floorGeometry = new THREE.BoxGeometry(CONFIG.BOX_SIZE, thickness, CONFIG.BOX_SIZE);
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.position.set(0, -halfSize - thickness/2, 0);
    scene.add(floor);
    walls.push(floor);
    
    // Ceiling
    const ceilingGeometry = new THREE.BoxGeometry(CONFIG.BOX_SIZE, thickness, CONFIG.BOX_SIZE);
    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
    ceiling.position.set(0, halfSize + thickness/2, 0);
    scene.add(ceiling);
    walls.push(ceiling);
    
    // Wall 1 (front)
    const wall1Geometry = new THREE.BoxGeometry(CONFIG.BOX_SIZE, CONFIG.BOX_SIZE, thickness);
    const wall1 = new THREE.Mesh(wall1Geometry, wallMaterial);
    wall1.position.set(0, 0, -halfSize - thickness/2);
    scene.add(wall1);
    walls.push(wall1);
    
    // Wall 2 (back)
    const wall2 = new THREE.Mesh(wall1Geometry, wallMaterial);
    wall2.position.set(0, 0, halfSize + thickness/2);
    scene.add(wall2);
    walls.push(wall2);
    
    // Wall 3 (left)
    const wall3Geometry = new THREE.BoxGeometry(thickness, CONFIG.BOX_SIZE, CONFIG.BOX_SIZE);
    const wall3 = new THREE.Mesh(wall3Geometry, wallMaterial);
    wall3.position.set(-halfSize - thickness/2, 0, 0);
    scene.add(wall3);
    walls.push(wall3);
    
    // Wall 4 (right)
    const wall4 = new THREE.Mesh(wall3Geometry, wallMaterial);
    wall4.position.set(halfSize + thickness/2, 0, 0);
    scene.add(wall4);
    walls.push(wall4);
    
    // Add some visual markers to help with orientation
    const markerGeometry = new THREE.SphereGeometry(0.2, 8, 8);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    
    for (let i = 0; i < 5; i++) {
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position.set(
            (Math.random() - 0.5) * (CONFIG.BOX_SIZE - 1),
            (Math.random() - 0.5) * (CONFIG.BOX_SIZE - 1),
            (Math.random() - 0.5) * (CONFIG.BOX_SIZE - 1)
        );
        scene.add(marker);
    }
}

function setupControls() {
    // Joystick controls
    const joystickZone = document.getElementById('joystick-zone');
    const joystick = document.getElementById('joystick');
    
    joystickZone.addEventListener('touchstart', handleJoystickStart);
    joystickZone.addEventListener('touchmove', handleJoystickMove);
    joystickZone.addEventListener('touchend', handleJoystickEnd);
    
    // Look controls
    const lookZone = document.getElementById('look-zone');
    lookZone.addEventListener('touchstart', handleLookStart);
    lookZone.addEventListener('touchmove', handleLookMove);
    lookZone.addEventListener('touchend', handleLookEnd);
    
    // Jump button
    const jumpBtn = document.getElementById('jump-btn');
    jumpBtn.addEventListener('touchstart', handleJump);
    
    // Prevent default touch behaviors
    document.addEventListener('touchmove', (e) => {
        e.preventDefault();
    }, { passive: false });
}

function handleJoystickStart(e) {
    e.preventDefault();
    const touch = e.changedTouches[0];
    const rect = e.target.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    joystickData.active = true;
    joystickData.startX = centerX;
    joystickData.startY = centerY;
    joystickData.currentX = touch.clientX;
    joystickData.currentY = touch.clientY;
    
    updateJoystick();
}

function handleJoystickMove(e) {
    if (!joystickData.active) return;
    e.preventDefault();
    
    const touch = e.changedTouches[0];
    joystickData.currentX = touch.clientX;
    joystickData.currentY = touch.clientY;
    
    updateJoystick();
}

function handleJoystickEnd(e) {
    e.preventDefault();
    joystickData.active = false;
    joystickData.deltaX = 0;
    joystickData.deltaY = 0;
    
    const joystick = document.getElementById('joystick');
    joystick.style.transform = 'translate(-50%, -50%)';
}

function updateJoystick() {
    const maxDistance = 45; // Maximum joystick movement
    let dx = joystickData.currentX - joystickData.startX;
    let dy = joystickData.currentY - joystickData.startY;
    
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > maxDistance) {
        dx = (dx / distance) * maxDistance;
        dy = (dy / distance) * maxDistance;
    }
    
    joystickData.deltaX = dx / maxDistance;
    joystickData.deltaY = dy / maxDistance;
    
    const joystick = document.getElementById('joystick');
    joystick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}

function handleLookStart(e) {
    e.preventDefault();
    const touch = e.changedTouches[0];
    lookData.active = true;
    lookData.lastX = touch.clientX;
    lookData.lastY = touch.clientY;
}

function handleLookMove(e) {
    if (!lookData.active) return;
    e.preventDefault();
    
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - lookData.lastX;
    const deltaY = touch.clientY - lookData.lastY;
    
    player.rotation.y -= deltaX * CONFIG.LOOK_SENSITIVITY;
    player.rotation.x -= deltaY * CONFIG.LOOK_SENSITIVITY;
    
    // Clamp vertical look
    player.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, player.rotation.x));
    
    lookData.lastX = touch.clientX;
    lookData.lastY = touch.clientY;
}

function handleLookEnd(e) {
    e.preventDefault();
    lookData.active = false;
}

function handleJump(e) {
    e.preventDefault();
    if (player.onGround) {
        player.velocity.y = CONFIG.JUMP_FORCE;
        player.onGround = false;
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
    
    if (joystickData.active) {
        const forward = -joystickData.deltaY;
        const right = joystickData.deltaX;
        
        moveX = right * Math.cos(player.rotation.y) - forward * Math.sin(player.rotation.y);
        moveZ = right * Math.sin(player.rotation.y) + forward * Math.cos(player.rotation.y);
    }
    
    // Apply movement
    const moveSpeed = CONFIG.MOVE_SPEED * deltaTime;
    const oldPos = player.position.clone();
    
    player.position.x += moveX * moveSpeed;
    player.position.z += moveZ * moveSpeed;
    
    // Check horizontal collisions
    if (checkCollision(player.position)) {
        player.position.x = oldPos.x;
        player.position.z = oldPos.z;
    }
    
    // Apply vertical movement
    player.position.y += player.velocity.y * deltaTime;
    
    // Check vertical collisions
    if (checkCollision(player.position)) {
        if (player.velocity.y < 0) {
            player.onGround = true;
        }
        player.velocity.y = 0;
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

function updatePositionDisplay() {
    const pos = player.position;
    document.getElementById('position').textContent = 
        `${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}`;
}

function animate() {
    requestAnimationFrame(animate);
    
    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1); // Cap delta time
    
    updatePhysics(deltaTime);
    updateFPS();
    updatePositionDisplay();
    
    renderer.render(scene, camera);
}

// Start the game when the page loads
window.addEventListener('load', init);

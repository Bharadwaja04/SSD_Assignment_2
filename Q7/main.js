import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// ========== GAME CONFIGURATION ==========
const CONFIG = {
    BALL_RADIUS: 0.2,  // Increased from 0.108
    BALL_MASS: 7.0,
    PIN_RADIUS: 0.06,
    PIN_HEIGHT: 0.381,
    PIN_MASS: 1.5,
    LANE_LENGTH: 25,
    LANE_WIDTH: 1.5,  // Increased from 1.05
    GRAVITY: -30,
    FOUL_LINE_Z: 12,
    
    GAME_MODES: {
        'singles': { players: 1, maxScore: 300 },
        'unified-doubles': { players: 2, maxScore: 600 },
        'unified-team': { players: 4, maxScore: 1200 }
    }
};

// ========== SCENE SETUP ==========
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0a);
scene.fog = new THREE.Fog(0x0a0a0a, 15, 50);

const camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(0, 3, 14);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// ========== LIGHTING ==========
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
mainLight.position.set(0, 15, 5);
mainLight.castShadow = true;
mainLight.shadow.mapSize.width = 4096;
mainLight.shadow.mapSize.height = 4096;
mainLight.shadow.camera.near = 0.5;
mainLight.shadow.camera.far = 50;
mainLight.shadow.camera.left = -12;
mainLight.shadow.camera.right = 12;
mainLight.shadow.camera.top = 12;
mainLight.shadow.camera.bottom = -12;
scene.add(mainLight);

// Spotlights for atmosphere
const createSpotlight = (color, x, y, z) => {
    const light = new THREE.SpotLight(color, 1.5);
    light.position.set(x, y, z);
    light.angle = 0.6;
    light.penumbra = 0.5;
    light.castShadow = true;
    scene.add(light);
    return light;
};

createSpotlight(0xff1493, -4, 10, -5);
createSpotlight(0x00bfff, 4, 10, -5);
createSpotlight(0xffd700, 0, 12, 0);

// ========== BOWLING LANE ==========
const laneGroup = new THREE.Group();

// Main lane surface
const laneGeometry = new THREE.BoxGeometry(CONFIG.LANE_WIDTH, 0.1, CONFIG.LANE_LENGTH);
const laneMaterial = new THREE.MeshStandardMaterial({
    color: 0xd2691e,
    roughness: 0.05,
    metalness: 0.3
});
const lane = new THREE.Mesh(laneGeometry, laneMaterial);
lane.position.y = 0;
lane.receiveShadow = true;
laneGroup.add(lane);

// Lane markings
for (let i = 0; i < 7; i++) {
    const marking = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.01, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x000000 })
    );
    marking.position.set(0, 0.06, 8 - i * 2);
    laneGroup.add(marking);
}

// Foul line (RED - important!)
const foulLineGeometry = new THREE.BoxGeometry(CONFIG.LANE_WIDTH + 0.1, 0.03, 0.1);
const foulLineMaterial = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 0.5
});
const foulLine = new THREE.Mesh(foulLineGeometry, foulLineMaterial);
foulLine.position.set(0, 0.07, CONFIG.FOUL_LINE_Z);
laneGroup.add(foulLine);

// Gutters (NO BUMPERS per rules!)
const gutterGeometry = new THREE.BoxGeometry(0.3, 0.15, CONFIG.LANE_LENGTH);
const gutterMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });

const leftGutter = new THREE.Mesh(gutterGeometry, gutterMaterial);
leftGutter.position.set(-(CONFIG.LANE_WIDTH/2 + 0.15), 0, 0);
laneGroup.add(leftGutter);

const rightGutter = new THREE.Mesh(gutterGeometry, gutterMaterial);
rightGutter.position.set((CONFIG.LANE_WIDTH/2 + 0.15), 0, 0);
laneGroup.add(rightGutter);

scene.add(laneGroup);

// Floor
const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 50),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.95 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.1;
floor.receiveShadow = true;
scene.add(floor);

// ========== BOWLING BALL ==========
const ball = new THREE.Mesh(
    new THREE.SphereGeometry(CONFIG.BALL_RADIUS, 32, 32),
    new THREE.MeshStandardMaterial({
        color: 0x1e40af,
        metalness: 0.9,
        roughness: 0.1,
        emissive: 0x3b82f6,
        emissiveIntensity: 0.3
    })
);
ball.castShadow = true;
ball.position.set(0, CONFIG.BALL_RADIUS + 0.05, 11);
scene.add(ball);

let ballVelocity = new THREE.Vector3();
let ballRotation = new THREE.Vector3();

// ========== BOWLING PINS ==========
const pins = [];
const pinPositions = [
    [0, 0, -8],
    [-0.12, 0, -8.35], [0.12, 0, -8.35],
    [-0.24, 0, -8.7], [0, 0, -8.7], [0.24, 0, -8.7],
    [-0.36, 0, -9.05], [-0.12, 0, -9.05], [0.12, 0, -9.05], [0.36, 0, -9.05]
];

let pinModel = null;

function loadPinModel() {
    const loader = new GLTFLoader();
    return new Promise((resolve, reject) => {
        loader.load(
            './models/Bowling_pin.glb',
            (gltf) => {
                pinModel = gltf.scene;
                pinModel.scale.set(1, 1, 1); // Adjust scale if needed
                pinModel.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                resolve(pinModel);
            },
            undefined,
            (error) => {
                console.error('Error loading pin model:', error);
                reject(error);
            }
        );
    });
}

function createPin(x, y, z) {
    const pinGroup = new THREE.Group();
    
    if (pinModel) {
        const pinClone = pinModel.clone();
        pinGroup.add(pinClone);
    } else {
        // Fallback to basic geometry if model not loaded
        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(CONFIG.PIN_RADIUS * 0.4, CONFIG.PIN_RADIUS, CONFIG.PIN_HEIGHT, 16),
            new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
        );
        body.castShadow = true;
        body.receiveShadow = true;
        pinGroup.add(body);
        
        // Red stripes
        [0.25, -0.1].forEach(offset => {
            const stripe = new THREE.Mesh(
                new THREE.CylinderGeometry(
                    CONFIG.PIN_RADIUS * 0.45,
                    CONFIG.PIN_RADIUS * 1.05,
                    CONFIG.PIN_HEIGHT * 0.1,
                    16
                ),
                new THREE.MeshStandardMaterial({ color: 0xff0000 })
            );
            stripe.position.y = CONFIG.PIN_HEIGHT * offset;
            stripe.castShadow = true;
            pinGroup.add(stripe);
        });
    }
    
    pinGroup.position.set(x, CONFIG.PIN_HEIGHT / 2 + 0.05, z);
    pinGroup.userData = {
        velocity: new THREE.Vector3(),
        angularVelocity: new THREE.Vector3(),
        standing: true,
        originalPos: new THREE.Vector3(x, CONFIG.PIN_HEIGHT / 2 + 0.05, z),
        mass: CONFIG.PIN_MASS,
        centerOfMass: new THREE.Vector3(0, -CONFIG.PIN_HEIGHT * 0.15, 0),
        restitution: 0.3,
        friction: 0.6,
        timeOnGround: 0
    };
    
    scene.add(pinGroup);
    return pinGroup;
}

async function resetPins() {
    // Remove existing pins
    pins.forEach(pin => {
        scene.remove(pin);
        pin.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
    });
    pins.length = 0;
    
    // Ensure pin model is loaded
    if (!pinModel) {
        try {
            await loadPinModel();
        } catch (error) {
            console.warn('Using fallback pin geometry');
        }
    }
    
    // Create new pins
    pinPositions.forEach(([x, y, z]) => {
        pins.push(createPin(x, y, z));
    });
    
    console.log('🎳 Pins reset! Total pins:', pins.length);
}

// Initialize pins on load
resetPins();

// ========== GAME STATE ==========
const gameState = {
    started: false,
    throwing: false,
    gameMode: 'singles',
    currentGame: 1,
    currentFrame: 1,
    currentBall: 1,
    frames: [],
    seriesScores: [],
    
    // Settings
    soundEnabled: true,
    rampEnabled: false,
    foulLineEnabled: true,
    
    // Throw parameters
    throwPower: 0.5,
    throwAim: 0,
    
    // Tracking
    pinsStandingBefore: 10,
    foulCommitted: false
};

// Initialize frames for game 1
function initializeFrames() {
    return Array(10).fill(null).map(() => ({
        rolls: [],
        score: null,
        isStrike: false,
        isSpare: false
    }));
}
gameState.frames = initializeFrames();

// ========== UI ELEMENTS ==========
const ui = {
    hud: document.getElementById('hud'),
    startMenu: document.getElementById('startMenu'),
    rulesModal: document.getElementById('rulesModal'),
    gameModeSelect: document.getElementById('gameModeSelect'),
    
    currentMode: document.getElementById('currentMode'),
    maxScore: document.getElementById('maxScore'),
    
    powerFill: document.getElementById('powerFill'),
    powerIndicator: document.getElementById('powerIndicator'),
    aimIndicator: document.getElementById('aimIndicator'),
    
    gameInfo: document.getElementById('gameInfo'),
    scoreDisplay: document.getElementById('scoreDisplay'),
    frameInfo: document.getElementById('frameInfo'),
    
    gamesCompleted: document.getElementById('gamesCompleted'),
    currentAverage: document.getElementById('currentAverage'),
    bestGame: document.getElementById('bestGame'),
    
    foulWarning: document.getElementById('foulWarning')
};

// ========== POWER METER ==========
let powerMeterActive = false;
let powerValue = 0;
let powerDirection = 1;

function updatePowerMeter(delta) {
    if (!gameState.started || gameState.throwing || !powerMeterActive) return;
    
    powerValue += powerDirection * 150 * delta;
    
    if (powerValue >= 100) {
        powerValue = 100;
        powerDirection = -1;
    } else if (powerValue <= 0) {
        powerValue = 0;
        powerDirection = 1;
    }
    
    ui.powerFill.style.width = powerValue + '%';
    gameState.throwPower = powerValue / 100;
}

// ========== AIM SYSTEM ==========
let aimValue = 50;

function updateAim(direction) {
    aimValue += direction * 2;
    aimValue = Math.max(0, Math.min(100, aimValue));
    
    ui.aimIndicator.style.left = aimValue + '%';
    gameState.throwAim = (aimValue - 50) / 50;
}

// ========== SCORING FUNCTIONS ==========
function countStandingPins() {
    let count = 0;
    pins.forEach(pin => {
        const tilt = Math.sqrt(
            pin.rotation.x * pin.rotation.x + 
            pin.rotation.z * pin.rotation.z
        );
        const yPos = pin.position.y;
        const velocity = pin.userData.velocity.length();
        
        if (tilt < 0.8 && yPos > 0.03 && yPos < 0.5 && velocity < 0.3) {
            count++;
            pin.userData.standing = true;
        } else {
            pin.userData.standing = false;
        }
    });
    return count;
}

function calculateScore() {
    const frames = gameState.frames;
    
    for (let i = 0; i < 10; i++) {
        const frame = frames[i];
        let frameScore = 0;
        
        if (i < 9) {
            // Frames 1-9
            if (frame.isStrike) {
                frameScore = 10;
                // Add next 2 rolls
                if (frames[i + 1]) {
                    frameScore += frames[i + 1].rolls[0] || 0;
                    if (frames[i + 1].isStrike && frames[i + 2]) {
                        // Double strike - add first roll of frame i+2
                        frameScore += frames[i + 2].rolls[0] || 0;
                    } else if (frames[i + 1].rolls.length > 1) {
                        // Not a strike - add second roll of frame i+1
                        frameScore += frames[i + 1].rolls[1] || 0;
                    }
                }
            } else if (frame.isSpare) {
                frameScore = 10;
                // Add next 1 roll
                if (frames[i + 1] && frames[i + 1].rolls.length > 0) {
                    frameScore += frames[i + 1].rolls[0] || 0;
                }
            } else {
                // Open frame
                frameScore = (frame.rolls[0] || 0) + (frame.rolls[1] || 0);
            }
        } else {
            // 10th frame - just add all rolls
            frameScore = frame.rolls.reduce((sum, roll) => sum + (roll || 0), 0);
        }
        
        // Calculate cumulative score
        const previousScore = i > 0 ? (frames[i - 1].score || 0) : 0;
        frame.score = previousScore + frameScore;
    }
    
    // Return final score
    return frames[9].score || 0;
}

function updateScoreboard() {
    ui.gameInfo.textContent = `Game ${gameState.currentGame}/3 - Frame ${gameState.currentFrame}`;
    ui.frameInfo.textContent = `Ball ${gameState.currentBall}`;
    
    let html = '';
    gameState.frames.forEach((frame, idx) => {
        const frameNum = idx + 1;
        const isCurrent = frameNum === gameState.currentFrame;
        
        let display = '';
        
        if (idx === 9) {
            // 10th frame special display
            if (frame.rolls.length > 0) {
                display = frame.rolls.map((r, i) => {
                    if (r === 10) return '<span style="color:#22c55e; font-weight:bold;">X</span>';
                    if (r === 0) return '-';
                    if (i > 0 && frame.rolls[i-1] !== 10 && frame.rolls[i-1] + r === 10) {
                        return '<span style="color:#3b82f6; font-weight:bold;">/</span>';
                    }
                    return r;
                }).join(' ');
            } else {
                display = '—';
            }
        } else {
            // Frames 1-9
            if (frame.isStrike) {
                display = '<span style="color:#22c55e; font-weight:bold;">X</span>';
            } else if (frame.isSpare) {
                display = `${frame.rolls[0]} <span style="color:#3b82f6; font-weight:bold;">/</span>`;
            } else if (frame.rolls.length > 0) {
                const roll1 = frame.rolls[0] === 0 ? '-' : (frame.rolls[0] || '—');
                const roll2 = frame.rolls.length > 1 ? (frame.rolls[1] === 0 ? '-' : frame.rolls[1]) : '';
                display = roll2 ? `${roll1} ${roll2}` : roll1;
            } else {
                display = '—';
            }
        }
        
        // Show score immediately when available (simplified logic)
        const scoreText = frame.score !== null ? 
            `<span style="color:#ffd700; font-weight:bold;">${frame.score}</span>` : '—';
        
        html += `<div class="frame-score ${isCurrent ? 'current' : ''}">
                    <span>F${frameNum}: ${display}</span>
                    <span>${scoreText}</span>
                </div>`;
    });
    
    ui.scoreDisplay.innerHTML = html;
    
    console.log('📊 Scoreboard updated');
    console.log('Current frame:', gameState.currentFrame);
    console.log('Frame scores:', gameState.frames.map((f, i) => `F${i+1}: ${f.score || '—'}`).join(', '));
}

function updateSeriesStats() {
    const completed = gameState.seriesScores.length;
    ui.gamesCompleted.textContent = `${completed}/3`;
    
    if (completed > 0) {
        const avg = gameState.seriesScores.reduce((a, b) => a + b, 0) / completed;
        ui.currentAverage.textContent = avg.toFixed(1);
        
        const best = Math.max(...gameState.seriesScores);
        ui.bestGame.textContent = best;
    } else {
        ui.currentAverage.textContent = '—';
        ui.bestGame.textContent = '—';
    }
}

// ========== PHYSICS ENGINE ==========
function updatePhysics(delta) {
    // Ball physics
    if (ball.position.y > CONFIG.BALL_RADIUS + 0.05) {
        ballVelocity.y += CONFIG.GRAVITY * delta;
    } else {
        ball.position.y = CONFIG.BALL_RADIUS + 0.05;
        if (ballVelocity.y < 0) {
            ballVelocity.y *= -0.2;
        }
        
        const rollingFriction = 0.985;
        ballVelocity.x *= rollingFriction;
        ballVelocity.z *= rollingFriction;
    }
    
    ball.position.add(ballVelocity.clone().multiplyScalar(delta));
    
    if (ballVelocity.length() > 0.05) {
        const rotSpeed = ballVelocity.length() / CONFIG.BALL_RADIUS;
        const rotAxis = new THREE.Vector3(-ballVelocity.z, 0, ballVelocity.x).normalize();
        ball.rotateOnAxis(rotAxis, rotSpeed * delta);
    }
    
    if (Math.abs(ball.position.x) > CONFIG.LANE_WIDTH / 2) {
        ballVelocity.x *= 0.3;
        ballVelocity.z *= 0.7;
    }
    
    // Ball-pin collisions
    pins.forEach(pin => {
        const dist = ball.position.distanceTo(pin.position);
        const collisionDist = CONFIG.BALL_RADIUS + CONFIG.PIN_RADIUS;
        
        if (dist < collisionDist && dist > 0.01) {
            playSound('hit');
            
            const normal = new THREE.Vector3()
                .subVectors(pin.position, ball.position)
                .normalize();
            
            const overlap = collisionDist - dist;
            const ballMass = CONFIG.BALL_MASS;
            const pinMass = pin.userData.mass;
            const totalMass = ballMass + pinMass;
            
            pin.position.add(normal.clone().multiplyScalar(overlap * (ballMass / totalMass)));
            ball.position.sub(normal.clone().multiplyScalar(overlap * (pinMass / totalMass)));
            
            const relativeVelocity = ballVelocity.clone().sub(pin.userData.velocity);
            const velocityAlongNormal = relativeVelocity.dot(normal);
            
            if (velocityAlongNormal < 0) return;
            
            const restitution = pin.userData.restitution;
            const impulseScalar = -(1 + restitution) * velocityAlongNormal;
            const impulse = impulseScalar / (1/ballMass + 1/pinMass);
            
            const pinImpulse = normal.clone().multiplyScalar(impulse / pinMass);
            pin.userData.velocity.add(pinImpulse);
            
            const ballImpulse = normal.clone().multiplyScalar(-impulse / ballMass);
            ballVelocity.add(ballImpulse);
            
            const hitPoint = ball.position.clone().sub(pin.position);
            const torqueAxis = hitPoint.clone().cross(ballVelocity).normalize();
            const torqueMagnitude = ballVelocity.length() * 15;
            
            pin.userData.angularVelocity.add(
                torqueAxis.multiplyScalar(torqueMagnitude)
            );
            
            pin.userData.angularVelocity.x += (Math.random() - 0.5) * 10;
            pin.userData.angularVelocity.z += (Math.random() - 0.5) * 10;
        }
    });
    
    // Update pins with realistic falling physics
    pins.forEach(pin => {
        const p = pin.userData;
        
        if (pin.position.y > CONFIG.PIN_HEIGHT / 2 + 0.05) {
            p.velocity.y += CONFIG.GRAVITY * delta;
            p.timeOnGround = 0;
        } else {
            pin.position.y = CONFIG.PIN_HEIGHT / 2 + 0.05;
            
            if (p.velocity.y < 0) {
                p.velocity.y *= -p.restitution;
                
                if (Math.abs(p.velocity.y) < 0.5) {
                    p.velocity.y = 0;
                    p.timeOnGround += delta;
                }
            }
        }
        
        pin.position.add(p.velocity.clone().multiplyScalar(delta));
        
        pin.rotation.x += p.angularVelocity.x * delta;
        pin.rotation.y += p.angularVelocity.y * delta;
        pin.rotation.z += p.angularVelocity.z * delta;
        
        const tilt = Math.sqrt(pin.rotation.x * pin.rotation.x + pin.rotation.z * pin.rotation.z);
        
        // Limit rotation to prevent upside-down flipping
        const maxTilt = Math.PI / 2; // 90 degrees max
        if (tilt > maxTilt) {
            // Pin has fallen - lock it down
            const tiltDirection = Math.atan2(pin.rotation.z, pin.rotation.x);
            pin.rotation.x = Math.cos(tiltDirection) * maxTilt;
            pin.rotation.z = Math.sin(tiltDirection) * maxTilt;
            
            // Stop all rotation when fully fallen
            p.angularVelocity.set(0, 0, 0);
            
            // Keep pin on ground
            pin.position.y = CONFIG.PIN_HEIGHT / 2 + 0.05;
            p.velocity.y = 0;
            
            // Slow down horizontal movement dramatically when fallen
            p.velocity.x *= 0.8;
            p.velocity.z *= 0.8;
        } else {
            // Pin is still standing or falling - apply rotation
            if (tilt > 0.1) {
                const gravityTorque = Math.sin(tilt) * 25;
                
                if (Math.abs(pin.rotation.x) > 0.01) {
                    p.angularVelocity.x += Math.sign(pin.rotation.x) * gravityTorque * delta;
                }
                if (Math.abs(pin.rotation.z) > 0.01) {
                    p.angularVelocity.z += Math.sign(pin.rotation.z) * gravityTorque * delta;
                }
            }
        }
        
        p.velocity.multiplyScalar(0.98);
        
        if (p.timeOnGround > 0) {
            const groundFriction = Math.pow(p.friction, delta * 60);
            p.velocity.x *= groundFriction;
            p.velocity.z *= groundFriction;
            p.angularVelocity.multiplyScalar(0.85);
        } else {
            p.angularVelocity.multiplyScalar(0.98);
        }
        
        if (p.velocity.length() < 0.02 && p.timeOnGround > 0.1) {
            p.velocity.set(0, 0, 0);
        }
        if (p.angularVelocity.length() < 0.15) {
            p.angularVelocity.set(0, 0, 0);
        }
        
        pin.position.x = Math.max(-2, Math.min(2, pin.position.x));
        pin.position.z = Math.max(-12, Math.min(0, pin.position.z));
    });
    
    // Pin-pin collisions
    for (let i = 0; i < pins.length; i++) {
        for (let j = i + 1; j < pins.length; j++) {
            const p1 = pins[i];
            const p2 = pins[j];
            const dist = p1.position.distanceTo(p2.position);
            const minDist = CONFIG.PIN_RADIUS * 2.5;
            
            if (dist < minDist && dist > 0.01) {
                const normal = new THREE.Vector3()
                    .subVectors(p2.position, p1.position)
                    .normalize();
                
                const overlap = minDist - dist;
                p1.position.sub(normal.clone().multiplyScalar(overlap * 0.5));
                p2.position.add(normal.clone().multiplyScalar(overlap * 0.5));
                
                const relVel = p1.userData.velocity.clone().sub(p2.userData.velocity);
                const velAlongNormal = relVel.dot(normal);
                
                if (velAlongNormal < 0) continue;
                
                const restitution = 0.4;
                const impulse = -(1 + restitution) * velAlongNormal / 2;
                
                const impulseVec = normal.clone().multiplyScalar(impulse);
                p1.userData.velocity.sub(impulseVec);
                p2.userData.velocity.add(impulseVec);
                
                const angularTransfer = 0.3;
                const angVel1 = p1.userData.angularVelocity.clone();
                const angVel2 = p2.userData.angularVelocity.clone();
                
                p1.userData.angularVelocity.lerp(angVel2, angularTransfer);
                p2.userData.angularVelocity.lerp(angVel1, angularTransfer);
                
                if (Math.random() < 0.3) playSound('hit');
            }
        }
    }
}

// ========== SOUND SYSTEM ==========
function playSound(type) {
    if (!gameState.soundEnabled) return;
    
    try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        const sounds = {
            'roll': { freq: 200, duration: 0.2 },
            'hit': { freq: 450, duration: 0.1 },
            'strike': { freq: 880, duration: 0.3 },
            'spare': { freq: 660, duration: 0.3 },
            'foul': { freq: 150, duration: 0.4 }
        };
        
        const sound = sounds[type] || sounds['hit'];
        osc.frequency.value = sound.freq;
        gain.gain.value = 0.08;
        
        osc.start();
        osc.stop(ctx.currentTime + sound.duration);
    } catch(e) {}
}

// ========== THROW MECHANICS ==========
function throwBall() {
    if (gameState.throwing) return;
    
    console.log('=== THROW START ===');
    console.log('Frame:', gameState.currentFrame, 'Ball:', gameState.currentBall);
    
    gameState.throwing = true;
    gameState.pinsStandingBefore = countStandingPins();
    gameState.foulCommitted = false;
    powerMeterActive = false;
    
    console.log('Pins standing before throw:', gameState.pinsStandingBefore);
    
    const power = gameState.throwPower;
    const aim = gameState.throwAim;
    const speed = 12 + power * 20;
    
    const startZ = gameState.rampEnabled ? 12 : 11;
    ball.position.set(aim * 0.3, CONFIG.BALL_RADIUS + 0.05, startZ);
    
    ballVelocity.set(aim * 2, 0, -speed);
    
    playSound('roll');
    
    console.log('Ball speed:', speed.toFixed(2), 'Power:', (power * 100).toFixed(0) + '%');
    
    animateCamera();
    setTimeout(checkThrowComplete, 4000);
}

function animateCamera() {
    let progress = 0;
    
    function animate() {
        if (!gameState.throwing) return;
        
        progress += 0.015;
        const targetY = 3 + Math.sin(progress * Math.PI) * 1.5;
        const targetZ = ball.position.z + 8;
        
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, 0.1);
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, 0.08);
        camera.lookAt(ball.position);
        
        if (progress < 1) requestAnimationFrame(animate);
    }
    
    animate();
}

function checkThrowComplete() {
    if (!gameState.throwing) return;
    
    const stopped = ballVelocity.length() < 0.15;
    const outOfBounds = ball.position.z < -12 || ball.position.z > 13;
    
    if (stopped || outOfBounds) {
        completeThrow();
    } else {
        setTimeout(checkThrowComplete, 400);
    }
}

function completeThrow() {
    gameState.throwing = false;
    
    console.log('=== THROW COMPLETE ===');
    
    // Wait for pins to settle
    setTimeout(() => {
        let pinsKnocked = 0;
        
        if (gameState.foulCommitted) {
            pinsKnocked = 0;
            console.log('FOUL! Pins knocked = 0');
        } else {
            const pinsNow = countStandingPins();
            pinsKnocked = gameState.pinsStandingBefore - pinsNow;
            console.log('Pins before:', gameState.pinsStandingBefore);
            console.log('Pins now standing:', pinsNow);
            console.log('Pins knocked:', pinsKnocked);
        }
        
        processRoll(pinsKnocked);
        
        camera.position.set(0, 3, 14);
        camera.lookAt(0, 0, 0);
        
        ball.position.set(0, CONFIG.BALL_RADIUS + 0.05, 11);
        ballVelocity.set(0, 0, 0);
        
        powerMeterActive = true;
    }, 2500); // Increased wait time for pins to settle
}

function processRoll(pinsKnocked) {
    console.log('=== PROCESSING ROLL ===');
    console.log('Pins knocked:', pinsKnocked);
    
    const frame = gameState.frames[gameState.currentFrame - 1];
    frame.rolls.push(pinsKnocked);
    
    console.log('Frame rolls:', frame.rolls);
    
    if (gameState.currentFrame < 10) {
        if (gameState.currentBall === 1) {
            if (pinsKnocked === 10) {
                frame.isStrike = true;
                playSound('strike');
                console.log('STRIKE! - Resetting pins for next frame');
                advanceFrame();
            } else {
                gameState.currentBall = 2;
                console.log('Moving to ball 2 - keeping pins as they are');
            }
        } else {
            if (frame.rolls[0] + pinsKnocked === 10) {
                frame.isSpare = true;
                playSound('spare');
                console.log('SPARE! - Resetting pins for next frame');
            } else {
                console.log('Open frame - Resetting pins for next frame');
            }
            advanceFrame();
        }
    } else {
        console.log('10th frame processing...');
        if (frame.rolls.length === 1) {
            if (pinsKnocked === 10) {
                frame.isStrike = true;
                playSound('strike');
                gameState.currentBall = 2;
                console.log('10th frame strike! Resetting pins...');
                setTimeout(() => resetPins(), 500);
            } else {
                gameState.currentBall = 2;
                console.log('10th frame - Moving to ball 2, keeping pins');
            }
        } else if (frame.rolls.length === 2) {
            const total = frame.rolls[0] + pinsKnocked;
            if (frame.rolls[0] === 10 || total === 10) {
                gameState.currentBall = 3;
                if (total === 10 && !frame.isStrike) {
                    frame.isSpare = true;
                    playSound('spare');
                }
                console.log('10th frame bonus ball! Resetting pins...');
                setTimeout(() => resetPins(), 500);
            } else {
                console.log('10th frame complete - ending game');
                endGame();
                return;
            }
        } else if (frame.rolls.length === 3) {
            console.log('10th frame complete - ending game');
            endGame();
            return;
        }
    }
    
    calculateScore();
    updateScoreboard();
}

function advanceFrame() {
    console.log('=== ADVANCING FRAME ===');
    console.log('From frame', gameState.currentFrame, 'to', gameState.currentFrame + 1);
    
    gameState.currentFrame++;
    gameState.currentBall = 1;
    
    if (gameState.currentFrame <= 10) {
        setTimeout(() => {
            resetPins();
            updateScoreboard();
        }, 500);
    }
}

function endGame() {
    const finalScore = gameState.frames[9].score;
    gameState.seriesScores.push(finalScore);
    
    console.log('=== GAME COMPLETE ===');
    console.log('Final score:', finalScore);
    console.log('Series scores:', gameState.seriesScores);
    
    updateSeriesStats();
    
    if (gameState.seriesScores.length < 3) {
        setTimeout(() => {
            alert(`🎳 Game ${gameState.currentGame} Complete!\n\nScore: ${finalScore}\n\nStarting Game ${gameState.currentGame + 1}...`);
            startNewGame();
        }, 1500);
    } else {
        const total = gameState.seriesScores.reduce((a, b) => a + b, 0);
        const average = (total / 3).toFixed(1);
        const maxPossible = CONFIG.GAME_MODES[gameState.gameMode].maxScore;
        
        setTimeout(() => {
            alert(
                `🏆 Series Complete!\n\n` +
                `Game 1: ${gameState.seriesScores[0]}\n` +
                `Game 2: ${gameState.seriesScores[1]}\n` +
                `Game 3: ${gameState.seriesScores[2]}\n\n` +
                `3-Game Average: ${average}\n` +
                `Max Possible: ${maxPossible}`
            );
            
            resetGame();
        }, 1500);
    }
}

function startNewGame() {
    console.log('=== STARTING NEW GAME ===');
    gameState.currentGame++;
    gameState.currentFrame = 1;
    gameState.currentBall = 1;
    gameState.frames = initializeFrames();
    
    resetPins();
    ball.position.set(0, CONFIG.BALL_RADIUS + 0.05, 11);
    ballVelocity.set(0, 0, 0);
    
    updateScoreboard();
    updateSeriesStats();
    powerMeterActive = true;
}

function resetGame() {
    console.log('=== RESETTING ENTIRE GAME ===');
    
    gameState.seriesScores = [];
    gameState.currentGame = 1;
    gameState.currentFrame = 1;
    gameState.currentBall = 1;
    gameState.frames = initializeFrames();
    gameState.started = false;
    gameState.throwing = false;
    
    ui.hud.classList.remove('active');
    ui.startMenu.style.display = 'flex';
    
    resetPins();
    ball.position.set(0, CONFIG.BALL_RADIUS + 0.05, 11);
    ballVelocity.set(0, 0, 0);
    
    camera.position.set(0, 3, 14);
    camera.lookAt(0, 0, 0);
    
    powerMeterActive = false;
    powerValue = 0;
    aimValue = 50;
    
    updateScoreboard();
    updateSeriesStats();
    
    console.log('✅ Game reset complete');
}

// ========== EVENT HANDLERS ==========
document.getElementById('startGameBtn').addEventListener('click', () => {
    gameState.started = true;
    gameState.gameMode = ui.gameModeSelect.value;
    gameState.soundEnabled = document.getElementById('enableSound').checked;
    gameState.rampEnabled = document.getElementById('enableRamp').checked;
    gameState.foulLineEnabled = document.getElementById('foulLineEnabled').checked;
    
    const mode = CONFIG.GAME_MODES[gameState.gameMode];
    ui.currentMode.textContent = ui.gameModeSelect.options[ui.gameModeSelect.selectedIndex].text;
    ui.maxScore.textContent = `Max: ${mode.maxScore}`;
    
    ui.startMenu.style.display = 'none';
    ui.hud.classList.add('active');
    
    updateScoreboard();
    updateSeriesStats();
    powerMeterActive = true;
    
    console.log('🎳 Game Started!');
    console.log('Mode:', gameState.gameMode);
});

document.getElementById('rulesBtn').addEventListener('click', () => {
    ui.rulesModal.style.display = 'flex';
});

document.getElementById('closeRulesBtn').addEventListener('click', () => {
    ui.rulesModal.style.display = 'none';
});

document.getElementById('resetBtn').addEventListener('click', () => {
    if (confirm('Reset entire series? All progress will be lost.')) {
        resetGame();
    }
});

document.getElementById('viewRulesBtn').addEventListener('click', () => {
    ui.rulesModal.style.display = 'flex';
});

window.addEventListener('keydown', (e) => {
    if (!gameState.started) return;
    
    if (e.code === 'Space' && !gameState.throwing) {
        e.preventDefault();
        throwBall();
    }
    
    if (e.code === 'ArrowLeft') {
        e.preventDefault();
        updateAim(-1);
    }
    
    if (e.code === 'ArrowRight') {
        e.preventDefault();
        updateAim(1);
    }
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ========== ANIMATION LOOP ==========
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    
    const delta = Math.min(clock.getDelta(), 0.05);
    
    if (gameState.started) {
        updatePowerMeter(delta);
        updatePhysics(delta);
    }
    
    renderer.render(scene, camera);
}

animate();

console.log('🎳 Official Bowling Alley Game Loaded!');
console.log('🎯 Using realistic 3D pin models with advanced physics');

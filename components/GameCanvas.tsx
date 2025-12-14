import React, { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import { GameState, EntityType, Entity, Particle } from '../types';
import { 
  PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_X_OFFSET,
  INITIAL_SPEED, MAX_SPEED, SUPPLY_SPEED_REDUCTION, FEVER_DURATION_MS,
  COLOR_SKY_NORMAL, COLOR_SKY_FEVER, COLOR_GROUND,
  SCORE_ITEM, SCORE_BELIEVER,
  MOVEMENT_STIFFNESS, MOVEMENT_DAMPING,
  DASH_DURATION_MS, DASH_COOLDOWN_MS, DASH_SPEED_MULTIPLIER
} from '../constants';
import { audioService } from '../services/audioService';

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  setScore: (score: number) => void;
  setHighScore: React.Dispatch<React.SetStateAction<number>>;
  setFeverMode: (active: boolean) => void;
}

export interface GameCanvasHandle {
  triggerDash: () => boolean;
}

// Local interface for purely visual elements
interface Cloud {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
}

// Ghost trail for dash effect
interface Ghost {
  x: number;
  y: number;
  alpha: number;
  timestamp: number;
}

const GameCanvas = forwardRef<GameCanvasHandle, GameCanvasProps>(({ 
  gameState, setGameState, setScore, setHighScore, setFeverMode 
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Dynamic Dimensions State
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Game State Refs
  const scoreRef = useRef(0);
  const speedRef = useRef(INITIAL_SPEED);
  
  // Movement Refs (Physics)
  const playerYRef = useRef(window.innerHeight / 2); // Current visual position
  const playerVyRef = useRef(0); // Velocity Y
  const targetPlayerYRef = useRef(window.innerHeight / 2); // Target position from input
  
  // Dash State
  const isDashingRef = useRef(false);
  const dashEndTimeRef = useRef(0);
  const lastDashTimeRef = useRef(0);
  const ghostTrailRef = useRef<Ghost[]>([]);
  
  const entitiesRef = useRef<Entity[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const cloudsRef = useRef<Cloud[]>([]);
  const frameCountRef = useRef(0);
  const feverEndTimeRef = useRef(0);
  const isFeverRef = useRef(false);

  // Expose Dash Trigger
  useImperativeHandle(ref, () => ({
    triggerDash: () => {
      const now = Date.now();
      if (gameState === GameState.PLAYING && 
          !isDashingRef.current && 
          now - lastDashTimeRef.current > DASH_COOLDOWN_MS) {
        
        isDashingRef.current = true;
        dashEndTimeRef.current = now + DASH_DURATION_MS;
        lastDashTimeRef.current = now;
        audioService.playFeverStart(); // Re-use powerup sound for dash
        createParticles(PLAYER_X_OFFSET, playerYRef.current, '#FFFFFF', 20, 'explosion');
        return true;
      }
      return false;
    }
  }));
  
  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setDimensions({ width: w, height: h });
      // Keep player on screen if resized
      targetPlayerYRef.current = Math.min(h - 90, Math.max(90, targetPlayerYRef.current));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- Spawning Logic ---
  const spawnEntity = useCallback(() => {
    const isFever = isFeverRef.current;
    const { width, height } = dimensions;
    
    // Dynamic Y range based on current height
    // Top buffer: 90px, Bottom buffer: 90px (Sidewalks)
    const minY = 90;
    const maxY = height - 90;
    const y = Math.random() * (maxY - minY) + minY; 
    
    const size = 50;
    
    let type: EntityType = EntityType.OBSTACLE;
    let subtype: Entity['subtype'] = 'firecracker';
    let widthEnt = size;
    let heightEnt = size;

    if (isFever) {
      type = EntityType.BELIEVER;
      widthEnt = 80; // Wider for prostrating person
      heightEnt = 40;
    } else {
      const rand = Math.random();
      if (rand < 0.05) {
        type = EntityType.ITEM_FEVER; // 5% chance
        widthEnt = 60; heightEnt = 60;
      } else if (rand < 0.1) {
        type = EntityType.ITEM_SUPPLY; // 5% chance
        // Randomize Snack Type
        const snackRand = Math.random();
        subtype = snackRand < 0.33 ? 'rice_ball' : snackRand < 0.66 ? 'drink' : 'watermelon';
        widthEnt = 50; heightEnt = 50;
      } else if (rand < 0.6) { // 50% chance
        type = EntityType.ITEM_SCORE; 
        const subRand = Math.random();
        subtype = subRand < 0.33 ? 'lantern' : subRand < 0.66 ? 'peach' : 'envelope';
        widthEnt = 40; heightEnt = 40; // Items are slightly smaller
      } else {
        type = EntityType.OBSTACLE; // 40% chance
        subtype = Math.random() > 0.5 ? 'firecracker' : 'roadblock';
        if (subtype === 'roadblock') { widthEnt = 60; heightEnt = 40; }
        if (subtype === 'firecracker') { widthEnt = 40; heightEnt = 70; } 
      }
    }

    // Spawn further away on narrow screens (Portrait mode fix)
    // Ensures players have roughly the same reaction time regardless of screen width
    const minSpawnX = 600; 
    const spawnX = Math.max(width, minSpawnX) + 100;

    const entity: Entity = {
      id: Date.now() + Math.random(),
      type,
      x: spawnX, 
      y,
      width: widthEnt,
      height: heightEnt,
      subtype
    };
    
    entitiesRef.current.push(entity);
  }, [dimensions]);

  const createParticles = (x: number, y: number, color: string, count: number, type: 'explosion' | 'sparkle' | 'smoke' = 'explosion') => {
    for (let i = 0; i < count; i++) {
      let vx = (Math.random() - 0.5) * 10;
      let vy = (Math.random() - 0.5) * 10;
      let size = 4;
      let life = 1.0;

      if (type === 'sparkle') {
         vx = (Math.random() - 0.5) * 5;
         vy = (Math.random() - 0.5) * 5;
         size = Math.random() * 3 + 2; // Varied size 2-5
      } else if (type === 'smoke') {
         vx = (Math.random() - 0.5) * 2; // Horizontal drift
         vy = -Math.random() * 2 - 0.5; // Upward float
         size = Math.random() * 5 + 5; // Larger puff 5-10
         life = 0.8;
      }

      particlesRef.current.push({
        id: Math.random(),
        x,
        y,
        vx,
        vy,
        life,
        color,
        size
      });
    }
  };

  const spawnCloud = useCallback(() => {
    cloudsRef.current.push({
      id: Math.random(),
      x: dimensions.width + 100,
      y: Math.random() * (dimensions.height / 2),
      size: 30 + Math.random() * 50,
      speed: 0.5 + Math.random() * 1.5,
      opacity: 0.3 + Math.random() * 0.3
    });
  }, [dimensions]);

  const resetGame = useCallback(() => {
    scoreRef.current = 0;
    speedRef.current = INITIAL_SPEED;
    playerYRef.current = dimensions.height / 2;
    playerVyRef.current = 0;
    targetPlayerYRef.current = dimensions.height / 2;
    entitiesRef.current = [];
    particlesRef.current = [];
    cloudsRef.current = [];
    ghostTrailRef.current = [];
    isFeverRef.current = false;
    isDashingRef.current = false;
    setScore(0);
    setFeverMode(false);
    
    // Pre-populate some clouds
    for(let i=0; i<5; i++) {
        spawnCloud();
        cloudsRef.current[i].x = Math.random() * dimensions.width;
    }
  }, [setScore, setFeverMode, dimensions, spawnCloud]);

  // --- Update Loop ---
  const update = useCallback((time: number) => {
    if (gameState !== GameState.PLAYING) return;

    frameCountRef.current++;
    const now = Date.now();

    // 1. Dash Logic
    if (isDashingRef.current) {
      if (now > dashEndTimeRef.current) {
        isDashingRef.current = false;
      } else {
        // Add ghost trail
        if (frameCountRef.current % 3 === 0) {
          ghostTrailRef.current.push({
            x: PLAYER_X_OFFSET,
            y: playerYRef.current,
            alpha: 0.8,
            timestamp: now
          });
        }
      }
    }
    // Clean ghost trails
    for (let i = ghostTrailRef.current.length - 1; i >= 0; i--) {
      ghostTrailRef.current[i].alpha -= 0.05;
      if (ghostTrailRef.current[i].alpha <= 0) ghostTrailRef.current.splice(i, 1);
    }
    
    // 2. Physics Movement (Spring System)
    const displacement = targetPlayerYRef.current - playerYRef.current;
    const springForce = displacement * MOVEMENT_STIFFNESS;
    const dampingForce = playerVyRef.current * MOVEMENT_DAMPING;
    // const acceleration = springForce - dampingForce; 
    
    // Update Velocity
    playerVyRef.current += springForce; // Add force
    playerVyRef.current *= MOVEMENT_DAMPING; // Apply drag
    
    // Update Position
    playerYRef.current += playerVyRef.current;

    // 3. Difficulty & Speed
    const speedLevel = Math.floor(scoreRef.current / 50);
    let currentSpeed = Math.min(MAX_SPEED, INITIAL_SPEED + speedLevel);
    
    if (isDashingRef.current) currentSpeed *= DASH_SPEED_MULTIPLIER;
    else if (isFeverRef.current) currentSpeed *= 1.5;

    // Lerp actual speed reference for smoothness
    speedRef.current += (currentSpeed - speedRef.current) * 0.1;

    // 4. Fever Expiry
    if (isFeverRef.current && now > feverEndTimeRef.current) {
       isFeverRef.current = false;
       setFeverMode(false);
    }

    // 5. Cloud Logic
    if (frameCountRef.current % 120 === 0) spawnCloud();
    for (let i = cloudsRef.current.length - 1; i >= 0; i--) {
        const c = cloudsRef.current[i];
        c.x -= c.speed * (isDashingRef.current ? 3 : 1);
        if (c.x < -200) cloudsRef.current.splice(i, 1);
    }

    // 6. Entity Spawning
    const spawnInterval = isFeverRef.current || isDashingRef.current ? 20 : Math.max(30, 80 - speedRef.current * 2); 
    if (frameCountRef.current % Math.floor(spawnInterval) === 0) {
      spawnEntity();
    }

    // 7. Collision & Entity Move
    const playerRect = {
      x: PLAYER_X_OFFSET + 10, 
      y: playerYRef.current - PLAYER_HEIGHT / 2 + 15,
      w: PLAYER_WIDTH - 20,
      h: PLAYER_HEIGHT - 20
    };

    for (let i = entitiesRef.current.length - 1; i >= 0; i--) {
      const ent = entitiesRef.current[i];
      ent.x -= speedRef.current;

      // Simple AABB Collision
      const entRect = { x: ent.x - ent.width/2, y: ent.y - ent.height/2, w: ent.width, h: ent.height };
      
      // Hitbox tweak
      if (ent.type === EntityType.ITEM_SCORE) {
          entRect.x += 5; entRect.w -= 10;
          entRect.y += 5; entRect.h -= 10;
      }

      const isColliding = 
        playerRect.x < entRect.x + entRect.w &&
        playerRect.x + playerRect.w > entRect.x &&
        playerRect.y < entRect.y + entRect.h &&
        playerRect.y + playerRect.h > entRect.y;

      if (isColliding) {
        // HIT HANDLER
        if (ent.type === EntityType.OBSTACLE) {
          if (isFeverRef.current || isDashingRef.current) {
            // Invincible Destruction
            createParticles(ent.x, ent.y, '#555', 8, 'explosion');
            createParticles(ent.x, ent.y, '#FF4500', 5, 'sparkle');
            entitiesRef.current.splice(i, 1);
            audioService.playCrash();
            if (isDashingRef.current) {
                // Bonus points for smashing while dashing
                scoreRef.current += 5;
                setScore(scoreRef.current);
            }
          } else {
            // Game Over
            audioService.playCrash();
            setGameState(GameState.GAME_OVER);
            setHighScore(prev => Math.max(prev, scoreRef.current));
            return;
          }
        } else if (ent.type === EntityType.ITEM_SCORE) {
          scoreRef.current += SCORE_ITEM;
          setScore(scoreRef.current);
          audioService.playScore();
          const color = ent.subtype === 'peach' ? '#FF69B4' : (ent.subtype === 'lantern' ? '#FF4500' : '#FFD700');
          createParticles(ent.x, ent.y, color, 8, 'sparkle');
          entitiesRef.current.splice(i, 1);
        } else if (ent.type === EntityType.ITEM_FEVER) {
          isFeverRef.current = true;
          feverEndTimeRef.current = now + FEVER_DURATION_MS;
          setFeverMode(true);
          audioService.playFeverStart();
          createParticles(ent.x, ent.y, '#FFD700', 20, 'sparkle');
          entitiesRef.current.splice(i, 1);
        } else if (ent.type === EntityType.ITEM_SUPPLY) {
          scoreRef.current += 5;
          setScore(scoreRef.current);
          speedRef.current = Math.max(INITIAL_SPEED, speedRef.current - SUPPLY_SPEED_REDUCTION);
          audioService.playSupply();
          
          // Different colors for different snacks
          let particleColor = '#FFF';
          if (ent.subtype === 'watermelon') particleColor = '#FF6347'; // Tomato/Red
          else if (ent.subtype === 'drink') particleColor = '#00BFFF'; // Deep Sky Blue

          createParticles(ent.x, ent.y, particleColor, 12, 'sparkle');
          entitiesRef.current.splice(i, 1);
        } else if (ent.type === EntityType.BELIEVER) {
           scoreRef.current += SCORE_BELIEVER;
           setScore(scoreRef.current);
           audioService.playScore();
           createParticles(ent.x, ent.y, '#FFFFFF', 5, 'sparkle');
           entitiesRef.current.splice(i, 1);
        }
      }
      else if (ent.x + ent.width < -100) {
        entitiesRef.current.splice(i, 1);
      }
    }

    // 8. Particles
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.05;
      if (p.life <= 0) particlesRef.current.splice(i, 1);
    }

  }, [gameState, setScore, setGameState, setHighScore, setFeverMode, spawnEntity, spawnCloud, dimensions]);


  // --- Drawing Helpers ---

  const drawShadow = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number) => {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.beginPath();
      ctx.ellipse(x, y + 40, w / 2, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
  };

  const drawCarrier = (ctx: CanvasRenderingContext2D, x: number, y: number, isFront: boolean, isDashing: boolean) => {
    const speed = isDashing ? 1.5 : 0.3;
    const legSwing = Math.sin(frameCountRef.current * speed);
    
    ctx.save();
    ctx.translate(x, y);

    const uniformColor = '#FFD700';
    const pantsColor = '#FFD700';
    const skinColor = '#FFCCAA';

    // Legs
    ctx.strokeStyle = pantsColor;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(legSwing * 10, 25); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(-legSwing * 10, 25); ctx.stroke();

    // Torso
    ctx.fillStyle = uniformColor;
    ctx.beginPath(); ctx.roundRect(-6, -10, 12, 20, 3); ctx.fill();

    // Head
    ctx.fillStyle = skinColor;
    ctx.beginPath(); ctx.arc(0, -15, 6, 0, Math.PI * 2); ctx.fill();

    // Hat
    ctx.fillStyle = '#FFF';
    ctx.beginPath(); ctx.moveTo(-7, -18); ctx.lineTo(7, -18); ctx.arc(0, -18, 7, Math.PI, 0); ctx.fill();

    // Arms
    ctx.strokeStyle = skinColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    if (isFront) { ctx.moveTo(0, -5); ctx.lineTo(-10, 0); } 
    else { ctx.moveTo(0, -5); ctx.lineTo(10, 0); }
    ctx.stroke();

    ctx.restore();
  };

  const drawPalanquin = (ctx: CanvasRenderingContext2D, x: number, y: number, isDashing: boolean = false) => {
    const bobbing = Math.sin(frameCountRef.current * (isDashing ? 0.6 : 0.2)) * (isDashing ? 2 : 4);
    const sway = Math.sin(frameCountRef.current * (isDashing ? 0.3 : 0.1)) * 0.05;
    
    ctx.save();
    ctx.translate(x, y + bobbing);
    ctx.rotate(sway);

    // --- Holy Aura (Backlight) ---
    const time = frameCountRef.current * 0.05;
    const auraGradient = ctx.createRadialGradient(0, 0, 30, 0, 0, 90);
    auraGradient.addColorStop(0, 'rgba(255, 215, 0, 0.6)'); // Inner Gold
    auraGradient.addColorStop(0.5, 'rgba(255, 223, 150, 0.3)');
    auraGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = auraGradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, 80, 80, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Rotating Rays
    ctx.save();
    ctx.rotate(time);
    for(let i=0; i<8; i++) {
        ctx.rotate(Math.PI/4);
        ctx.fillStyle = 'rgba(255, 215, 0, 0.1)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(20, 100);
        ctx.lineTo(-20, 100);
        ctx.fill();
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';


    // --- Shadows ---
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 50, 60, 8, 0, 0, Math.PI * 2); ctx.fill();

    // --- Poles ---
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(-60, 20, 170, 5); 
    ctx.fillRect(-60, -20, 170, 5); 
    
    // --- Carriers ---
    drawCarrier(ctx, -55, 10, false, isDashing);
    drawCarrier(ctx, -45, -5, false, isDashing);
    drawCarrier(ctx, 105, 10, true, isDashing);
    drawCarrier(ctx, 95, -5, true, isDashing);

    // --- The Sedan Chair Body ---
    const grdBody = ctx.createLinearGradient(0, -30, 0, 30);
    grdBody.addColorStop(0, '#FFD700'); // Gold
    grdBody.addColorStop(0.5, '#DAA520'); // Darker Gold
    grdBody.addColorStop(1, '#B8860B'); // Bronze-ish
    ctx.fillStyle = grdBody;
    
    // Main Box
    ctx.beginPath(); ctx.roundRect(-15, -30, 75, 60, 5); ctx.fill();
    
    // Detailed Embroidery (Window/Mesh)
    ctx.fillStyle = '#800000'; // Maroon background for embroidery
    ctx.beginPath(); ctx.roundRect(-10, -25, 65, 50, 3); ctx.fill();
    
    // Gold Lattice Pattern
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let i=-20; i<30; i+=10) {
        ctx.moveTo(-10, i); ctx.lineTo(55, i); // Horizontal
    }
    for(let i=-5; i<60; i+=10) {
        ctx.moveTo(i, -25); ctx.lineTo(i, 25); // Vertical
    }
    ctx.stroke();

    // Front Window (Where Mazu sits)
    ctx.fillStyle = '#DC143C';
    ctx.beginPath(); ctx.arc(22, -5, 18, 0, Math.PI*2); ctx.fill();
    // Inner Glow
    const innerGlow = ctx.createRadialGradient(22, -5, 5, 22, -5, 18);
    innerGlow.addColorStop(0, 'rgba(255,255,255,0.8)');
    innerGlow.addColorStop(1, 'rgba(220,20,60,0)');
    ctx.fillStyle = innerGlow;
    ctx.fill();

    // Mazu Silhouette
    ctx.fillStyle = '#000';
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(22, -2, 10, 0, Math.PI, true); // Head/shoulders
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // --- The Pink Roof (Canvas Top) ---
    // Soft, fabric-like curve
    const pinkColor = '#FF69B4'; // Hot Pink
    
    ctx.fillStyle = pinkColor;
    ctx.beginPath();
    // Front overhang
    ctx.moveTo(70, -30);
    ctx.quadraticCurveTo(85, -28, 80, -20); // Front tip
    ctx.lineTo(-5, -20); // Bottom edge of roof
    ctx.lineTo(-20, -30); // Back overhang
    // Top curve
    ctx.bezierCurveTo(0, -65, 50, -65, 70, -30);
    ctx.fill();
    
    // Roof Folds/Shading
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(10, -55); ctx.quadraticCurveTo(20, -40, 10, -25);
    ctx.moveTo(40, -55); ctx.quadraticCurveTo(50, -40, 40, -25);
    ctx.stroke();

    // --- Decorations ---
    // Red Flower Ball on top
    ctx.fillStyle = '#FF0000';
    ctx.beginPath(); ctx.arc(25, -60, 6, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 1; ctx.stroke();
    // Ribbons from flower ball
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 2;
    ctx.beginPath(); 
    ctx.moveTo(25, -60); ctx.quadraticCurveTo(10, -50, 5, -40);
    ctx.moveTo(25, -60); ctx.quadraticCurveTo(40, -50, 45, -40);
    ctx.stroke();

    // LED Lights on Roof Edge (Blinking)
    const blink = Math.floor(frameCountRef.current / (isDashing ? 2 : 5)) % 2 === 0;
    const lightColor = blink ? '#00FF00' : '#FFFF00';
    ctx.fillStyle = lightColor;
    for(let i=0; i<5; i++) {
        ctx.beginPath();
        const lx = -5 + i * 18;
        ctx.arc(lx, -22, 2, 0, Math.PI*2);
        ctx.fill();
    }

    // Tassels (Animated)
    ctx.strokeStyle = '#DC143C';
    ctx.lineWidth = 2;
    const tasselSway = Math.sin(frameCountRef.current * (isDashing ? 0.6 : 0.3)) * (isDashing ? 8 : 5);
    const drawTassel = (tx: number, ty: number) => {
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + tasselSway, ty + 15, tx, ty + 25); ctx.stroke();
        // Tassel knot
        ctx.fillStyle = '#FFD700'; ctx.beginPath(); ctx.arc(tx, ty, 2, 0, Math.PI*2); ctx.fill();
    };
    drawTassel(-5, -20); 
    drawTassel(75, -20); 
    drawTassel(35, -20);

    ctx.restore();
  };

  const drawLantern = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.strokeStyle = '#FFF'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(0, -25); ctx.stroke();
    const grad = ctx.createRadialGradient(-5, -5, 2, 0, 0, 25);
    grad.addColorStop(0, '#FF6347'); grad.addColorStop(1, '#8B0000');
    ctx.fillStyle = grad; ctx.beginPath(); ctx.ellipse(0, 0, 22, 28, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)'; ctx.lineWidth = 1.5;
    for(let i=1; i<=3; i++) { ctx.beginPath(); ctx.ellipse(0, 0, 6 * i, 28, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = '#333'; ctx.fillRect(-12, -28, 24, 6); ctx.fillRect(-12, 24, 24, 6);
    ctx.fillStyle = '#FFD700'; ctx.font = 'bold 20px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('福', 0, 2);
    ctx.strokeStyle = '#DC143C'; ctx.lineWidth = 2;
    const swing = Math.sin(frameCountRef.current * 0.1) * 3;
    ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(swing, 50); ctx.stroke();
  };

  const drawPeach = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
      ctx.shadowBlur = 10; ctx.shadowColor = 'pink';
      const grad = ctx.createRadialGradient(0, -5, 2, 0, 0, 25);
      grad.addColorStop(0, '#FFC0CB'); grad.addColorStop(0.6, '#FF69B4'); grad.addColorStop(1, '#FFF');
      ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(0, 20);
      ctx.bezierCurveTo(20, 10, 25, -15, 0, -20); ctx.bezierCurveTo(-25, -15, -20, 10, 0, 20); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = '#228B22';
      ctx.beginPath(); ctx.ellipse(5, -18, 8, 4, Math.PI/4, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-5, -18, 8, 4, -Math.PI/4, 0, Math.PI*2); ctx.fill();
  };

  const drawEnvelope = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
      ctx.save(); ctx.rotate(Math.sin(frameCountRef.current * 0.1) * 0.1);
      ctx.fillStyle = '#D7000F'; ctx.beginPath(); ctx.roundRect(-15, -20, 30, 40, 2); ctx.fill();
      ctx.fillStyle = '#FFD700'; ctx.beginPath(); ctx.moveTo(-15, -10); ctx.quadraticCurveTo(0, 0, 15, -10); ctx.lineTo(15, -20); ctx.lineTo(-15, -20); ctx.fill();
      ctx.fillStyle = '#FFD700'; ctx.font = '16px serif'; ctx.textAlign = 'center'; ctx.fillText('吉', 0, 15);
      ctx.restore();
  };

  const drawIncenseBurner = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      const s1 = (frameCountRef.current * 2) % 40; const s2 = (frameCountRef.current * 2 + 20) % 40;
      ctx.beginPath(); ctx.arc(Math.sin(s1*0.1)*5, -25 - s1, 5 + s1/5, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(Math.sin(s2*0.1)*-5, -25 - s2, 5 + s2/5, 0, Math.PI*2); ctx.fill();
      const grad = ctx.createLinearGradient(-20, 0, 20, 0);
      grad.addColorStop(0, '#DAA520'); grad.addColorStop(0.5, '#FFD700'); grad.addColorStop(1, '#B8860B');
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI, false); ctx.lineTo(-20, -5); ctx.lineTo(20, -5); ctx.closePath(); ctx.fill();
      ctx.fillRect(-15, 15, 5, 10); ctx.fillRect(10, 15, 5, 10);
      ctx.strokeStyle = '#DAA520'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-20, -5, 6, 0, Math.PI*2); ctx.stroke(); ctx.beginPath(); ctx.arc(20, -5, 6, 0, Math.PI*2); ctx.stroke();
      ctx.fillStyle = '#8B0000'; ctx.fillRect(-2, -15, 2, 10); ctx.fillRect(2, -18, 2, 13);
  };

  // --- NEW SNACK DRAWING FUNCTIONS ---

  const drawWatermelon = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.save();
    ctx.rotate(Math.sin(frameCountRef.current * 0.05) * 0.1);
    // Rind
    ctx.fillStyle = '#228B22';
    ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI, false); ctx.fill();
    // Flesh
    ctx.fillStyle = '#FF4500'; // Red
    ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI, false); ctx.fill();
    // Seeds
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(-8, 8, 2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 12, 2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(8, 8, 2, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  };

  const drawDrink = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.save();
    // Bottle Shape
    const grad = ctx.createLinearGradient(-10, 0, 10, 0);
    grad.addColorStop(0, '#1E90FF'); // DodgerBlue
    grad.addColorStop(0.5, '#87CEFA'); // LightSkyBlue
    grad.addColorStop(1, '#1E90FF');
    ctx.fillStyle = grad;
    
    // Main body
    ctx.beginPath(); ctx.roundRect(-10, -20, 20, 35, 3); ctx.fill();
    // Label
    ctx.fillStyle = '#FFF';
    ctx.fillRect(-10, -10, 20, 15);
    ctx.fillStyle = '#0000CD';
    ctx.fillRect(-10, -8, 20, 5); // Brand stripe
    // Cap
    ctx.fillStyle = '#EEE';
    ctx.fillRect(-8, -25, 16, 5);

    ctx.restore();
  };

  const drawRiceBall = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.save();
    // Triangle Rice
    ctx.fillStyle = '#FFF8DC'; // Cornsilk (Rice color)
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(18, 15);
    ctx.quadraticCurveTo(0, 20, -18, 15);
    ctx.closePath();
    ctx.fill();
    
    // Nori (Seaweed)
    ctx.fillStyle = '#2F4F4F';
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(12, 16);
    ctx.quadraticCurveTo(0, 20, -12, 16);
    ctx.closePath();
    ctx.fill();

    // Texture (Rice grains)
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.beginPath(); ctx.arc(-5, -10, 1, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, -5, 1, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  };

  const drawFirecracker = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
      ctx.save();
      // Slight wobble
      ctx.rotate(Math.sin(frameCountRef.current * 0.1) * 0.05);

      // Main Cylinder Body (Red)
      const grad = ctx.createLinearGradient(-15, 0, 15, 0);
      grad.addColorStop(0, '#8B0000');
      grad.addColorStop(0.4, '#FF0000');
      grad.addColorStop(1, '#8B0000');
      ctx.fillStyle = grad;
      ctx.fillRect(-15, -30, 30, 60);

      // Gold Rims (Top and Bottom)
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(-17, -32, 34, 8); // Top Cap
      ctx.fillRect(-17, 24, 34, 8);  // Bottom Cap
      
      // Label / Character
      ctx.fillStyle = '#FFD700'; // Gold text
      ctx.font = 'bold 20px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('爆', 0, 0);

      // Fuse string
      ctx.strokeStyle = '#8B4513';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -32);
      ctx.quadraticCurveTo(5, -45, 0, -50);
      ctx.stroke();

      // Spark at fuse tip
      if (frameCountRef.current % 4 === 0) {
        ctx.fillStyle = '#FFFF00';
        ctx.beginPath();
        ctx.arc(0, -50, 3, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(0 + (Math.random()-0.5)*4, -50 + (Math.random()-0.5)*4, 2, 0, Math.PI*2);
        ctx.fill();
      }

      ctx.restore();
  };

  const drawRoadblock = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
      ctx.fillStyle = '#333'; ctx.beginPath(); ctx.moveTo(-25, 20); ctx.lineTo(-20, -15); ctx.moveTo(25, 20); ctx.lineTo(20, -15);
      ctx.lineWidth = 4; ctx.strokeStyle = '#333'; ctx.stroke();
      ctx.fillStyle = '#F0E68C'; ctx.fillRect(-30, -10, 60, 20);
      ctx.fillStyle = '#000'; ctx.beginPath();
      ctx.moveTo(-20, -10); ctx.lineTo(-10, 10); ctx.lineTo(-20, 10); ctx.lineTo(-30, -10);
      ctx.moveTo(0, -10); ctx.lineTo(10, 10); ctx.lineTo(0, 10); ctx.lineTo(-10, -10);
      ctx.moveTo(20, -10); ctx.lineTo(30, 10); ctx.lineTo(20, 10); ctx.lineTo(10, -10); ctx.fill();
      const blink = Math.floor(frameCountRef.current / 20) % 2 === 0; ctx.fillStyle = blink ? '#FF4500' : '#8B0000'; ctx.beginPath(); ctx.arc(0, -15, 4, 0, Math.PI*2); ctx.fill();
  };

  const drawBeliever = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath(); ctx.ellipse(0, 8, 30, 6, 0, 0, Math.PI*2); ctx.fill();

      ctx.save();
      ctx.translate(0, 10);

      ctx.fillStyle = '#F4A460'; // Skin
      ctx.beginPath(); 
      ctx.roundRect(-25, 0, 15, 4, 2); 
      ctx.roundRect(-25, -6, 15, 4, 2); 
      ctx.fill();

      ctx.fillStyle = '#F4A460'; 
      ctx.beginPath(); ctx.arc(-15, -3, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(-14, -4, 7, 0, Math.PI, true); ctx.fill();

      ctx.fillStyle = '#FFF';
      ctx.beginPath(); 
      ctx.ellipse(0, -5, 16, 8, 0, 0, Math.PI*2); 
      ctx.fill();
      
      ctx.fillStyle = '#191970';
      ctx.beginPath(); 
      ctx.ellipse(15, -4, 12, 9, 0, 0, Math.PI*2); 
      ctx.fill();
      
      ctx.fillStyle = '#333'; 
      ctx.beginPath(); ctx.ellipse(28, -2, 4, 6, 0, 0, Math.PI*2); ctx.fill();

      ctx.restore();
  };


  // --- Main Draw ---
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = dimensions;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Sky Background
    const bgColor = isFeverRef.current ? COLOR_SKY_FEVER : COLOR_SKY_NORMAL;
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, bgColor);
    gradient.addColorStop(1, isFeverRef.current ? '#FFFACD' : '#E0FFFF'); // Light yellow or Light Cyan
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Clouds
    cloudsRef.current.forEach(c => {
        ctx.fillStyle = `rgba(255, 255, 255, ${c.opacity})`;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2);
        ctx.arc(c.x + c.size * 0.7, c.y - c.size * 0.5, c.size * 0.8, 0, Math.PI * 2);
        ctx.arc(c.x + c.size * 1.4, c.y, c.size * 0.9, 0, Math.PI * 2);
        ctx.fill();
    });

    // Road Area
    ctx.fillStyle = '#8FBC8F'; // Dark Sea Green
    ctx.fillRect(0, 0, width, 50); // Top
    ctx.fillRect(0, height - 50, width, 50); // Bottom
    
    // Road Asphalt
    ctx.fillStyle = COLOR_GROUND;
    ctx.fillRect(0, 50, width, height - 100);
    
    // Road Lines (Moving)
    ctx.strokeStyle = '#FFFFFF';
    ctx.setLineDash([40, 60]);
    ctx.lineWidth = 4;
    const offset = (frameCountRef.current * speedRef.current) % 100;
    
    const roadTop = 50;
    const roadBottom = height - 50;
    const roadH = roadBottom - roadTop;

    ctx.beginPath();
    ctx.moveTo(-offset, roadTop + roadH / 3);
    ctx.lineTo(width, roadTop + roadH / 3);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(-offset, roadTop + (roadH / 3) * 2);
    ctx.lineTo(width, roadTop + (roadH / 3) * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Crowd Suggestions
    if (frameCountRef.current % 2 === 0) { 
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        for(let i=0; i<Math.ceil(width/80); i++) {
             ctx.beginPath(); ctx.arc(i * 80 + offset/2, 25, 10, 0, Math.PI*2); ctx.fill();
             ctx.beginPath(); ctx.arc(i * 80 - offset/2 + 40, height-25, 10, 0, Math.PI*2); ctx.fill();
        }
    }

    // Draw Ghost Trails (Before entities so it's behind)
    ghostTrailRef.current.forEach(ghost => {
       ctx.save();
       ctx.globalAlpha = ghost.alpha * 0.5;
       ctx.translate(ghost.x, ghost.y);
       // Simple ghost silhouette
       ctx.fillStyle = '#FFF';
       ctx.beginPath(); ctx.roundRect(-20, -20, 40, 40, 5); ctx.fill();
       ctx.restore();
       ctx.globalAlpha = 1.0;
    });

    // Entities
    entitiesRef.current.forEach(ent => {
      ctx.save();
      ctx.translate(ent.x, ent.y);
      if (ent.type !== EntityType.BELIEVER) drawShadow(ctx, 0, ent.height/2 - 30, ent.width);
      if (ent.type === EntityType.ITEM_SCORE) {
        if (ent.subtype === 'lantern') drawLantern(ctx, 0, 0);
        else if (ent.subtype === 'peach') drawPeach(ctx, 0, 0);
        else drawEnvelope(ctx, 0, 0);
      } else if (ent.type === EntityType.ITEM_FEVER) drawIncenseBurner(ctx, 0, 0);
      else if (ent.type === EntityType.ITEM_SUPPLY) {
          // Draw random snacks
          if (ent.subtype === 'watermelon') drawWatermelon(ctx, 0, 0);
          else if (ent.subtype === 'drink') drawDrink(ctx, 0, 0);
          else drawRiceBall(ctx, 0, 0); // Default/Rice Ball
      }
      else if (ent.type === EntityType.OBSTACLE) {
        if (ent.subtype === 'firecracker') drawFirecracker(ctx, 0, 0);
        else drawRoadblock(ctx, 0, 0);
      } else if (ent.type === EntityType.BELIEVER) drawBeliever(ctx, 0, 0);
      ctx.restore();
    });

    // Particles
    particlesRef.current.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size || 4, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    });

    // Player
    drawPalanquin(ctx, PLAYER_X_OFFSET, playerYRef.current, isDashingRef.current);

    // Speed Lines
    if (speedRef.current > 10 || isFeverRef.current || isDashingRef.current) {
      ctx.strokeStyle = '#FFFFFF'; 
      ctx.globalAlpha = isDashingRef.current ? 0.4 : 0.2; 
      ctx.lineWidth = isDashingRef.current ? 4 : 2;
      for (let i = 0; i < 5; i++) {
        const lx = (frameCountRef.current * (isDashingRef.current ? 40 : 20) + i * 100) % width;
        const ly = 60 + (i * 100) % (height - 120);
        ctx.beginPath(); ctx.moveTo(width - lx, ly); ctx.lineTo(width - lx - (isDashingRef.current ? 200 : 100), ly); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

  }, [gameState, dimensions]);


  // --- Animation Loop ---
  useEffect(() => {
    let animationFrameId: number;
    const render = (time: number) => {
      update(time);
      draw();
      animationFrameId = requestAnimationFrame(render);
    };
    render(0);
    return () => cancelAnimationFrame(animationFrameId);
  }, [update, draw]);

  // Initial setup
  useEffect(() => {
    if (gameState === GameState.START) {
      resetGame();
      draw();
    }
  }, [gameState, resetGame, draw]);

  // --- Input ---
  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault(); // Prevent scrolling
    e.stopPropagation();
    if (gameState !== GameState.PLAYING) return;
    const touch = e.touches[0];
    targetPlayerYRef.current = Math.max(90, Math.min(dimensions.height - 90, touch.clientY));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    // e.preventDefault(); // Removed to allow clicks on UI buttons if they bubble? No, usually safer to prevent defaults on canvas.
    if (gameState !== GameState.PLAYING) return;
     const touch = e.touches[0];
     targetPlayerYRef.current = Math.max(90, Math.min(dimensions.height - 90, touch.clientY));
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== GameState.PLAYING) return;
      const speed = 40; // Increased key speed for feel
      if (e.key === 'ArrowUp') {
        targetPlayerYRef.current = Math.max(90, targetPlayerYRef.current - speed);
      } else if (e.key === 'ArrowDown') {
        targetPlayerYRef.current = Math.min(dimensions.height - 90, targetPlayerYRef.current + speed);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, dimensions]);

  return (
    <canvas
      ref={canvasRef}
      width={dimensions.width}
      height={dimensions.height}
      className="block touch-none cursor-crosshair active:cursor-grabbing"
      style={{ width: '100%', height: '100%' }}
      onTouchMove={handleTouchMove}
      onTouchStart={handleTouchStart}
    />
  );
});

export default GameCanvas;
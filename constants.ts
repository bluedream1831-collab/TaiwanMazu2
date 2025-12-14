
// Removed fixed dimensions to support dynamic full-screen
// export const CANVAS_WIDTH = 800;
// export const CANVAS_HEIGHT = 600;

export const PLAYER_WIDTH = 80;
export const PLAYER_HEIGHT = 70;
export const PLAYER_X_OFFSET = 50; // Fixed X position

export const INITIAL_SPEED = 3; // Reduced from 5
export const MAX_SPEED = 10;    // Reduced from 15
export const SPEED_INCREMENT_STEP = 50; // Increase speed every 50 points
export const SUPPLY_SPEED_REDUCTION = 2;
export const FEVER_DURATION_MS = 6000;

// Physics & Movement
export const MOVEMENT_STIFFNESS = 0.08; // Spring stiffness (Higher = snappier, Lower = heavier)
export const MOVEMENT_DAMPING = 0.82;   // Friction (Lower = slippery, Higher = strict)

// Dash Ability
export const DASH_DURATION_MS = 1000;
export const DASH_COOLDOWN_MS = 5000;
export const DASH_SPEED_MULTIPLIER = 2.5;

// Scoring
export const SCORE_ITEM = 10;
export const SCORE_BELIEVER = 20;

// Colors
export const COLOR_SKY_NORMAL = '#87CEEB'; // Light Blue
export const COLOR_SKY_FEVER = '#FFD700';  // Gold
export const COLOR_GROUND = '#505050';     // Asphalt
export const COLOR_PALANQUIN_ROOF = '#FF69B4'; // Hot Pink
export const COLOR_PALANQUIN_BODY = '#FFD700'; // Gold
export const COLOR_PALANQUIN_TRIM = '#DC143C'; // Crimson
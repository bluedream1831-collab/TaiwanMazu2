export enum GameState {
  START = 'START',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
}

export enum EntityType {
  OBSTACLE = 'OBSTACLE',      // Firecrackers, Roadblocks
  ITEM_SCORE = 'ITEM_SCORE',  // Lantern, Peach, Red Envelope
  ITEM_FEVER = 'ITEM_FEVER',  // Incense Burner
  ITEM_SUPPLY = 'ITEM_SUPPLY',// Food/Water
  BELIEVER = 'BELIEVER',      // Fever mode score object
}

export interface Entity {
  id: number;
  type: EntityType;
  x: number;
  y: number;
  width: number;
  height: number;
  // Added rice_ball, drink, watermelon to subtype
  subtype?: 'lantern' | 'peach' | 'envelope' | 'firecracker' | 'roadblock' | 'rice_ball' | 'drink' | 'watermelon'; 
  speedOffset?: number; // Some items might move slightly differently
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size?: number;
}

export interface GameConfig {
  baseSpeed: number;
  spawnRate: number;
}
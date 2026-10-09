// World + gameplay constants

export const CHUNK_SIZE = 32;
export const VOXEL = 1;
export const STREAM_RADIUS = 3;
export const VERT_LAYERS = 2;
export const WORLD_HEIGHT = VERT_LAYERS * CHUNK_SIZE;

export const WATER_LEVEL = 9;

export const GRAVITY = 24;
export const WALK_SPEED = 4.4;
export const JUMP_SPEED = 8.2;
export const EYE_HEIGHT = 1.62;
export const PLAYER_RADIUS = 0.34;
export const PLAYER_HEIGHT = 1.8;

export const MAX_WEIGHT = 25;
export const PICKUP_RANGE = 2.4;
export const DIG_RADIUS = 2.6;
export const REACH = 6.0;

export const DAY_START_HOUR = 7;
export const DAY_END_HOUR = 20;
export const DAY_REAL_SECONDS = 15 * 60;

export const CABIN = { x: -26, z: -12 };
export const TOWER = { x: 78, z: -74 };

export const SPAWN = { x: -14, z: -2, yaw: 0.9 };

export const EDGE_SOLID = 50;
export const EDGE_AIR = -50;

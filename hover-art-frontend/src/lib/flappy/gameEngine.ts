const BASE_W = 620;
export const GRAVITY = 1150;
export const JUMP_VY = -360;
export const BIRD_X = 72;
export const BIRD_R = 9;
export const PIPE_W = 42;
export const PIPE_GAP = 128;
export const PIPE_SPEED = 195;
export const SPAWN_EVERY_SEC = 2.35;
export const MARGIN = 80;
export type Pipe = {
    x: number;
    gapCenterY: number;
    scored: boolean;
};
export type FlappyState = {
    birdY: number;
    birdVy: number;
    pipes: Pipe[];
    spawnCountdown: number;
    score: number;
    running: boolean;
    gameOver: boolean;
    rng: () => number;
};
export function mulberry32(seed: number): () => number {
    let state = seed >>> 0 || 123456789;
    return () => {
        state |= 0;
        state = (state + 0x6d2b79f5) | 0;
        let r = Math.imul(state ^ (state >>> 15), state | 1);
        r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}
export function roomSeedFromCode(code: string): number {
    let h = 2166136261;
    for (let i = 0; i < code.length; i++) {
        h ^= code.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0 || 7331;
}
function defaultRng() {
    return Math.random;
}
export function createInitialState(canvasH: number, roomCode?: string | null): FlappyState {
    const mid = canvasH / 2;
    const rng = roomCode && roomCode.length > 0 ? mulberry32(roomSeedFromCode(roomCode)) : defaultRng();
    return {
        birdY: mid,
        birdVy: 0,
        pipes: [],
        spawnCountdown: 1.2,
        score: 0,
        running: false,
        gameOver: false,
        rng
    };
}
export function scaleFor(canvasW: number): number {
    return canvasW / BASE_W;
}
export function startGame(state: FlappyState, canvasH: number) {
    state.birdY = canvasH / 2;
    state.birdVy = 0;
    state.pipes = [];
    state.spawnCountdown = 1.2;
    state.score = 0;
    state.running = true;
    state.gameOver = false;
}
export function jump(state: FlappyState, canvasW: number) {
    if (state.gameOver)
        return;
    if (!state.running) {
        state.running = true;
    }
    const s = scaleFor(canvasW);
    state.birdVy = JUMP_VY * s;
}
function randomGapY(canvasH: number, s: number, rng: () => number) {
    const margin = MARGIN * s;
    const gapHalf = (PIPE_GAP * s) / 2;
    const min = margin + gapHalf;
    const max = canvasH - margin - gapHalf;
    return min + rng() * (max - min);
}
export function updateGame(state: FlappyState, dt: number, canvasW: number, canvasH: number): void {
    if (!state.running || state.gameOver)
        return;
    const s = scaleFor(canvasW);
    const birdX = BIRD_X * s;
    const birdR = BIRD_R * s;
    const pipeW = PIPE_W * s;
    const pipeGap = PIPE_GAP * s;
    const pipeSpeed = PIPE_SPEED * s;
    const gravity = GRAVITY * s;
    const gapHalf = pipeGap / 2;
    state.birdVy += gravity * dt;
    state.birdY += state.birdVy * dt;
    if (state.birdY < birdR) {
        state.birdY = birdR;
        state.gameOver = true;
        state.running = false;
        return;
    }
    if (state.birdY > canvasH - birdR) {
        state.birdY = canvasH - birdR;
        state.gameOver = true;
        state.running = false;
        return;
    }
    state.spawnCountdown -= dt;
    if (state.spawnCountdown <= 0) {
        state.pipes.push({
            x: canvasW + pipeW,
            gapCenterY: randomGapY(canvasH, s, state.rng),
            scored: false
        });
        state.spawnCountdown = SPAWN_EVERY_SEC;
    }
    for (const p of state.pipes) {
        p.x -= pipeSpeed * dt;
        const birdLeft = birdX - birdR;
        const birdRight = birdX + birdR;
        const pipeLeft = p.x;
        const pipeRight = p.x + pipeW;
        if (birdRight > pipeLeft && birdLeft < pipeRight) {
            const topWall = p.gapCenterY - gapHalf;
            const botWall = p.gapCenterY + gapHalf;
            if (state.birdY - birdR < topWall || state.birdY + birdR > botWall) {
                state.gameOver = true;
                state.running = false;
                return;
            }
        }
        if (!p.scored && pipeRight < birdLeft) {
            p.scored = true;
            state.score += 1;
        }
    }
    state.pipes = state.pipes.filter((p) => p.x > -pipeW - 20 * s);
}

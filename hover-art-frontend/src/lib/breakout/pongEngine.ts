const BASE_W = 720;
export function scaleFor(canvasW: number): number {
    return canvasW / BASE_W;
}
export type FacePongState = {
    ballX: number;
    ballY: number;
    ballVx: number;
    ballVy: number;
    paddleTopNx: number;
    paddleBottomNx: number;
    scoreTop: number;
    scoreBot: number;
    running: boolean;
};
const BASE_SPEED = 280;
const SPEED_UP = 1.02;
const MAX_SPEED = 620;
function paddleGeom(canvasW: number, canvasH: number) {
    const s = scaleFor(canvasW);
    const margin = 14 * s;
    const paddleW = 78 * s;
    const paddleH = 8 * s;
    const topY = 42 * s + paddleH / 2;
    const botY = canvasH - 42 * s - paddleH / 2;
    return { s, margin, paddleW, paddleH, topY, botY, ballR: 8 * s };
}
function nxToPaddleCenterX(nx: number, canvasW: number, paddleW: number, margin: number) {
    const nxCl = Math.min(1, Math.max(0, nx));
    const half = paddleW / 2;
    return margin + half + nxCl * (canvasW - 2 * margin - paddleW);
}
export function createPongState(canvasW: number, canvasH: number): FacePongState {
    const { margin, ballR, topY } = paddleGeom(canvasW, canvasH);
    const sp = BASE_SPEED * scaleFor(canvasW);
    return {
        ballX: canvasW / 2,
        ballY: topY + ballR * 8,
        ballVx: (Math.random() > 0.5 ? 1 : -1) * sp * 0.45,
        ballVy: Math.abs(sp) * 0.82,
        paddleTopNx: 0.5,
        paddleBottomNx: 0.5,
        scoreTop: 0,
        scoreBot: 0,
        running: true
    };
}
function resetServe(state: FacePongState, canvasW: number, canvasH: number) {
    const { margin, ballR, topY } = paddleGeom(canvasW, canvasH);
    const sp = BASE_SPEED * scaleFor(canvasW);
    state.ballX = canvasW / 2;
    state.ballY = topY + ballR * 8;
    state.ballVx = (Math.random() > 0.5 ? 1 : -1) * sp * 0.45;
    state.ballVy = Math.abs(sp) * 0.82;
    state.running = true;
}
export function restartPong(state: FacePongState, canvasW: number, canvasH: number) {
    state.scoreTop = 0;
    state.scoreBot = 0;
    state.paddleTopNx = 0.5;
    state.paddleBottomNx = 0.5;
    resetServe(state, canvasW, canvasH);
}
function clampSpeed(vx: number, vy: number, max: number) {
    const m = Math.hypot(vx, vy);
    if (m <= max)
        return { vx, vy };
    const f = max / m;
    return { vx: vx * f, vy: vy * f };
}
export function stepPong(state: FacePongState, dt: number, canvasW: number, canvasH: number): void {
    if (!state.running)
        return;
    const { margin, paddleW, paddleH, topY, botY, ballR } = paddleGeom(canvasW, canvasH);
    const maxSp = MAX_SPEED * scaleFor(canvasW);
    let { ballX, ballY, ballVx, ballVy } = state;
    const topCx = nxToPaddleCenterX(state.paddleTopNx, canvasW, paddleW, margin);
    const botCx = nxToPaddleCenterX(state.paddleBottomNx, canvasW, paddleW, margin);
    const steps = Math.min(8, 2 + Math.floor((Math.hypot(ballVx, ballVy) * dt) / (ballR + 1)));
    const sub = dt / steps;
    for (let i = 0; i < steps; i++) {
        ballX += ballVx * sub;
        ballY += ballVy * sub;
        if (ballX < margin + ballR) {
            ballX = margin + ballR;
            ballVx = Math.abs(ballVx);
        }
        else if (ballX > canvasW - margin - ballR) {
            ballX = canvasW - margin - ballR;
            ballVx = -Math.abs(ballVx);
        }
        const tL = topCx - paddleW / 2;
        const tT = topY - paddleH / 2;
        if (ballVy < 0 &&
            ballY - ballR <= tT + paddleH &&
            ballY >= tT - ballR &&
            ballX >= tL - ballR &&
            ballX <= tL + paddleW + ballR) {
            ballY = tT + paddleH + ballR + 1;
            const hit = (ballX - tL) / paddleW - 0.5;
            const ang = hit * Math.PI * 0.38;
            let sp = Math.hypot(ballVx, ballVy) * SPEED_UP;
            sp = Math.min(sp, maxSp);
            ballVx = Math.sin(ang) * sp;
            ballVy = Math.abs(Math.cos(ang) * sp);
        }
        const bL = botCx - paddleW / 2;
        const bT = botY - paddleH / 2;
        if (ballVy > 0 &&
            ballY + ballR >= bT &&
            ballY <= bT + paddleH + ballR &&
            ballX >= bL - ballR &&
            ballX <= bL + paddleW + ballR) {
            ballY = bT - ballR - 1;
            const hit = (ballX - bL) / paddleW - 0.5;
            const ang = hit * Math.PI * 0.38;
            let sp = Math.hypot(ballVx, ballVy) * SPEED_UP;
            sp = Math.min(sp, maxSp);
            ballVx = Math.sin(ang) * sp;
            ballVy = -Math.abs(Math.cos(ang) * sp);
        }
        const cl = clampSpeed(ballVx, ballVy, maxSp);
        ballVx = cl.vx;
        ballVy = cl.vy;
        if (ballY < -ballR * 2) {
            state.scoreBot += 1;
            resetServe(state, canvasW, canvasH);
            return;
        }
        if (ballY > canvasH + ballR * 2) {
            state.scoreTop += 1;
            resetServe(state, canvasW, canvasH);
            return;
        }
    }
    state.ballX = ballX;
    state.ballY = ballY;
    state.ballVx = ballVx;
    state.ballVy = ballVy;
}
export type PongSerialized = {
    bx: number;
    by: number;
    bvx: number;
    bvy: number;
    pTop: number;
    pBot: number;
    sTop: number;
    sBot: number;
};
export function serializePong(state: FacePongState): PongSerialized {
    return {
        bx: state.ballX,
        by: state.ballY,
        bvx: state.ballVx,
        bvy: state.ballVy,
        pTop: state.paddleTopNx,
        pBot: state.paddleBottomNx,
        sTop: state.scoreTop,
        sBot: state.scoreBot
    };
}
export function applyPongSerialized(state: FacePongState, p: PongSerialized) {
    state.ballX = p.bx;
    state.ballY = p.by;
    state.ballVx = p.bvx;
    state.ballVy = p.bvy;
    state.paddleTopNx = p.pTop;
    state.paddleBottomNx = p.pBot;
    state.scoreTop = p.sTop;
    state.scoreBot = p.sBot;
}
export function drawPongFace(ctx: CanvasRenderingContext2D, state: FacePongState, canvasW: number, canvasH: number, faceNx: number | null, iAmTop: boolean, opts?: {
    topNxDraw?: number;
    bottomNxDraw?: number;
}) {
    const s = scaleFor(canvasW);
    const { margin, paddleW, paddleH, topY, botY, ballR } = paddleGeom(canvasW, canvasH);
    const paddleTopNx = opts?.topNxDraw ?? state.paddleTopNx;
    const paddleBotNx = opts?.bottomNxDraw ?? state.paddleBottomNx;
    ctx.fillStyle = '#07070d';
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.strokeStyle = '#ffffff22';
    ctx.setLineDash([12 * s, 14 * s]);
    ctx.beginPath();
    ctx.moveTo(canvasW / 2, 0);
    ctx.lineTo(canvasW / 2, canvasH);
    ctx.stroke();
    ctx.setLineDash([]);
    const topCx = nxToPaddleCenterX(paddleTopNx, canvasW, paddleW, margin);
    const botCx = nxToPaddleCenterX(paddleBotNx, canvasW, paddleW, margin);
    const drawPad = (cx: number, cy: number, accent: string) => {
        const pL = cx - paddleW / 2;
        const pT = cy - paddleH / 2;
        ctx.fillStyle = '#0d0d14';
        ctx.strokeStyle = accent + 'aa';
        ctx.lineWidth = Math.max(1, 2 * s);
        ctx.setLineDash([6 * s, 8 * s]);
        ctx.beginPath();
        ctx.rect(pL, pT, paddleW, paddleH);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
    };
    drawPad(topCx, topY, iAmTop && faceNx != null ? '#34d399' : '#ff4ecd');
    drawPad(botCx, botY, !iAmTop && faceNx != null ? '#34d399' : '#00f5ff');
    ctx.fillStyle = '#00f5ff';
    ctx.beginPath();
    ctx.arc(state.ballX, state.ballY, ballR, 0, Math.PI * 2);
    ctx.fill();
    const hudH = Math.round(28 * s);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, canvasW, hudH);
    ctx.fillStyle = '#ffffffaa';
    ctx.font = `${Math.max(11, Math.round(12 * s))}px monospace`;
    ctx.fillText(`${iAmTop ? 'YOU (top)' : 'Friend (top)'} ${state.scoreTop} — ${state.scoreBot} ${!iAmTop ? 'YOU (bottom)' : 'Friend (bottom)'}`, 10 * s, 18 * s);
}

/**
 * Wider virtual width than flappy → breakout feels more zoomed out on the same monitor.
 * BALL_R in the same coordinate system as flappy’s bird (logical radius before scale).
 */
const BASE_W = 720;

export const BALL_R = 8;

export function scaleFor(canvasW: number): number {
	return canvasW / BASE_W;
}

export type BlockCell = {
	alive: boolean;
	explosive: boolean;
	colorIdx: number;
};

export type BreakoutState = {
	cols: number;
	rows: number;
	cells: BlockCell[];
	ballX: number;
	ballY: number;
	ballVx: number;
	ballVy: number;
	/** Multiplier applied to base speed; grows on each block hit. */
	speedMul: number;
	paddleX: number;
	score: number;
	running: boolean;
	gameOver: boolean;
	won: boolean;
	/** Seconds until ball auto-launches from paddle (new round). */
	launchDelay: number;
	ballStuckToPaddle: boolean;
};

const BLOCK_COLORS = ['#00f5ff', '#a855f7', '#22c55e', '#facc15', '#f97316', '#ec4899'];

const SPEED_STEP = 1.028;
const MAX_SPEED_MUL = 2.75;
const EXPLOSIVE_FRACTION = 0.12;
const LAUNCH_DELAY_SEC = 0.55;

function cellIndex(c: number, r: number, cols: number) {
	return r * cols + c;
}

function buildGrid(cols: number, rows: number): BlockCell[] {
	const cells: BlockCell[] = [];
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const explosive = Math.random() < EXPLOSIVE_FRACTION;
			cells.push({
				alive: true,
				explosive,
				colorIdx: (c + r * 3) % BLOCK_COLORS.length
			});
		}
	}
	return cells;
}

export function blockStrokeColor(idx: number): string {
	return BLOCK_COLORS[idx % BLOCK_COLORS.length];
}

export function createInitialState(canvasW: number, canvasH: number): BreakoutState {
	const s = scaleFor(canvasW);
	const cols = 10;
	const rows = 5;
	const cells = buildGrid(cols, rows);
	const paddleX = canvasW / 2;
	const { ballX, ballY } = ballOnPaddlePos(paddleX, canvasW, canvasH, s);
	return {
		cols,
		rows,
		cells,
		ballX,
		ballY,
		ballVx: 0,
		ballVy: 0,
		speedMul: 1,
		paddleX,
		score: 0,
		running: true,
		gameOver: false,
		won: false,
		launchDelay: LAUNCH_DELAY_SEC,
		ballStuckToPaddle: true
	};
}

export function startGame(state: BreakoutState, canvasW: number, canvasH: number) {
	const s = scaleFor(canvasW);
	state.cells = buildGrid(state.cols, state.rows);
	state.paddleX = canvasW / 2;
	const pos = ballOnPaddlePos(state.paddleX, canvasW, canvasH, s);
	state.ballX = pos.ballX;
	state.ballY = pos.ballY;
	state.ballVx = 0;
	state.ballVy = 0;
	state.speedMul = 1;
	state.score = 0;
	state.running = true;
	state.gameOver = false;
	state.won = false;
	state.launchDelay = LAUNCH_DELAY_SEC;
	state.ballStuckToPaddle = true;
}

function paddleDims(s: number) {
	return { paddleW: 68 * s, paddleH: 7 * s };
}

function ballOnPaddlePos(paddleX: number, canvasW: number, canvasH: number, s: number) {
	const paddleY = paddleYCanvas(canvasH, s);
	const { paddleH } = paddleDims(s);
	const r = BALL_R * s;
	return { ballX: paddleX, ballY: paddleY - paddleH / 2 - r - 0.5 };
}

export function paddleMetrics(canvasW: number, canvasH: number) {
	const s = scaleFor(canvasW);
	const margin = 14 * s;
	const { paddleW, paddleH } = paddleDims(s);
	const paddleY = paddleYCanvas(canvasH, s);
	return { margin, paddleW, paddleH, paddleY, ballR: BALL_R * s };
}

function paddleYCanvas(canvasH: number, s: number) {
	return canvasH - 18 * s;
}

function blockLayout(canvasW: number, canvasH: number, cols: number, rows: number) {
	const s = scaleFor(canvasW);
	const margin = 14 * s;
	const hud = 32 * s;
	const top = Math.max(hud, 8);
	const paddleY = paddleYCanvas(canvasH, s);
	const { paddleH } = paddleDims(s);
	const ballR = BALL_R * s;
	/** Extra clearance: grid sits higher, playfield feels more open. */
	const minOpen = Math.max(200 * s, canvasH * 0.36);
	const maxBlockBottom = paddleY - paddleH / 2 - ballR - minOpen;
	const gap = 12 * s;
	const availH = Math.max(40 * s, maxBlockBottom - top);
	const availW = canvasW - margin * 2 - gap * (cols - 1);
	const bw = availW / cols;

	let bh =
		rows > 0 ? (availH - (rows - 1) * gap) / rows : 18 * s;
	bh = Math.max(8 * s, Math.min(19 * s, bh));
	if (rows > 0 && rows * bh + (rows - 1) * gap > availH) {
		bh = Math.max(7 * s, (availH - (rows - 1) * gap) / rows);
	}

	return { margin, top, gap, bw, bh };
}

function blockRect(
	c: number,
	r: number,
	canvasW: number,
	canvasH: number,
	cols: number,
	rows: number
) {
	const { margin, top, gap, bw, bh } = blockLayout(canvasW, canvasH, cols, rows);
	const left = margin + c * (bw + gap);
	return { left, top: top + r * (bh + gap), w: bw, h: bh };
}

function baseSpeed(canvasW: number) {
	return 188 * scaleFor(canvasW);
}

function neighbors4(c: number, r: number, cols: number, rows: number) {
	const out: { c: number; r: number }[] = [];
	if (c > 0) out.push({ c: c - 1, r });
	if (c < cols - 1) out.push({ c: c + 1, r });
	if (r > 0) out.push({ c, r: r - 1 });
	if (r < rows - 1) out.push({ c, r: r + 1 });
	return out;
}

/** Explosive block plus all alive blocks sharing an edge (4-neighbors only). */
function explodeCluster(
	cells: BlockCell[],
	cols: number,
	rows: number,
	sc: number,
	sr: number
): number {
	const start = cellIndex(sc, sr, cols);
	if (!cells[start]?.alive) return 0;

	const toDestroy = new Set<number>([start]);
	for (const n of neighbors4(sc, sr, cols, rows)) {
		const i = cellIndex(n.c, n.r, cols);
		if (cells[i]?.alive) toDestroy.add(i);
	}

	let removed = 0;
	for (const i of toDestroy) {
		if (cells[i].alive) {
			cells[i].alive = false;
			removed++;
		}
	}
	return removed;
}

function circleRectResolve(
	bx: number,
	by: number,
	r: number,
	left: number,
	top: number,
	w: number,
	h: number
): { hit: boolean; nx: number; ny: number; pen: number } {
	const cx = Math.max(left, Math.min(bx, left + w));
	const cy = Math.max(top, Math.min(by, top + h));
	const dx = bx - cx;
	const dy = by - cy;
	const d2 = dx * dx + dy * dy;
	if (d2 >= r * r) return { hit: false, nx: 0, ny: 0, pen: 0 };
	const d = Math.sqrt(d2) || 0.0001;
	const pen = r - d;
	const nx = dx / d;
	const ny = dy / d;
	return { hit: true, nx, ny, pen };
}

function reflectVelocity(vx: number, vy: number, nx: number, ny: number) {
	const dot = vx * nx + vy * ny;
	if (dot >= 0) return { vx, vy };
	return { vx: vx - 2 * dot * nx, vy: vy - 2 * dot * ny };
}

function countAlive(cells: BlockCell[]) {
	return cells.filter((c) => c.alive).length;
}

export function updateGame(
	state: BreakoutState,
	dt: number,
	canvasW: number,
	canvasH: number,
	facePaddle01: number | null
): void {
	if (!state.running || state.gameOver || state.won) return;

	const s = scaleFor(canvasW);
	const { margin, paddleW, paddleH, paddleY, ballR } = paddleMetrics(canvasW, canvasH);

	// Paddle follows face (smoothed in UI); here clamp center X
	const halfPad = paddleW / 2;
	if (facePaddle01 != null) {
		state.paddleX = margin + halfPad + facePaddle01 * (canvasW - 2 * margin - paddleW);
	}
	state.paddleX = Math.min(canvasW - margin - halfPad, Math.max(margin + halfPad, state.paddleX));

	if (state.ballStuckToPaddle) {
		const pos = ballOnPaddlePos(state.paddleX, canvasW, canvasH, s);
		state.ballX = pos.ballX;
		state.ballY = pos.ballY;
		state.launchDelay -= dt;
		if (state.launchDelay <= 0) {
			state.ballStuckToPaddle = false;
			const sp = baseSpeed(canvasW) * state.speedMul;
			const angle = (Math.random() - 0.5) * 0.35;
			state.ballVx = Math.sin(angle) * sp;
			state.ballVy = -Math.cos(angle) * sp;
		}
		return;
	}

	const sp = baseSpeed(canvasW) * state.speedMul;
	let { ballX, ballY, ballVx, ballVy } = state;
	let abortedWin = false;

	// Substeps to reduce tunneling
	const steps = Math.min(8, 2 + Math.floor(sp * dt / (ballR * 0.9)));
	const subDt = dt / steps;
	for (let step = 0; step < steps; step++) {
		if (abortedWin) break;
		ballX += ballVx * subDt;
		ballY += ballVy * subDt;

		// Walls
		if (ballX < margin + ballR) {
			ballX = margin + ballR;
			ballVx = Math.abs(ballVx);
		} else if (ballX > canvasW - margin - ballR) {
			ballX = canvasW - margin - ballR;
			ballVx = -Math.abs(ballVx);
		}
		if (ballY < margin + ballR) {
			ballY = margin + ballR;
			ballVy = Math.abs(ballVy);
		}

		// Paddle
		const pLeft = state.paddleX - paddleW / 2;
		const pTop = paddleY - paddleH / 2;
		if (
			ballVy > 0 &&
			ballY + ballR >= pTop &&
			ballY - ballR <= pTop + paddleH &&
			ballX >= pLeft - ballR &&
			ballX <= pLeft + paddleW + ballR
		) {
			const hit = circleRectResolve(ballX, ballY, ballR, pLeft, pTop, paddleW, paddleH);
			if (hit.hit) {
				ballY = pTop - ballR - 0.5;
				const hitPos = (ballX - pLeft) / paddleW;
				const maxAng = Math.PI * 0.33;
				const ang = (hitPos - 0.5) * maxAng * 2;
				const speed = Math.hypot(ballVx, ballVy);
				const newSp = Math.max(sp * 0.98, speed);
				ballVx = Math.sin(ang) * newSp;
				ballVy = -Math.abs(Math.cos(ang) * newSp);
			}
		}

		// Blocks (one hit per substep max — closest penetration)
		let best: {
			pen: number;
			c: number;
			r: number;
			nx: number;
			ny: number;
		} | null = null;
		for (let r = 0; r < state.rows; r++) {
			for (let c = 0; c < state.cols; c++) {
				const i = cellIndex(c, r, state.cols);
				if (!state.cells[i].alive) continue;
				const rect = blockRect(c, r, canvasW, canvasH, state.cols, state.rows);
				const hit = circleRectResolve(ballX, ballY, ballR, rect.left, rect.top, rect.w, rect.h);
				if (hit.hit && (!best || hit.pen > best.pen)) {
					best = { pen: hit.pen, c, r, nx: hit.nx, ny: hit.ny };
				}
			}
		}

		if (best) {
			const i = cellIndex(best.c, best.r, state.cols);
			const cell = state.cells[i];
			ballX += best.nx * (best.pen + 0.5);
			ballY += best.ny * (best.pen + 0.5);
			const ref = reflectVelocity(ballVx, ballVy, best.nx, best.ny);
			ballVx = ref.vx;
			ballVy = ref.vy;

			let gained = 0;
			if (cell.explosive) {
				gained = explodeCluster(state.cells, state.cols, state.rows, best.c, best.r);
				state.speedMul = Math.min(MAX_SPEED_MUL, state.speedMul * Math.pow(SPEED_STEP, gained));
			} else {
				cell.alive = false;
				gained = 1;
				state.speedMul = Math.min(MAX_SPEED_MUL, state.speedMul * SPEED_STEP);
			}
			state.score += gained * 10;

			if (countAlive(state.cells) === 0) {
				state.won = true;
				state.running = false;
				state.ballVx = 0;
				state.ballVy = 0;
				abortedWin = true;
				break;
			}
		}
	}

	state.ballX = ballX;
	state.ballY = ballY;
	state.ballVx = ballVx;
	state.ballVy = ballVy;

	if (ballY - ballR > canvasH + 4) {
		state.gameOver = true;
		state.running = false;
		state.ballStuckToPaddle = false;
	}
}

export function drawBreakout(
	ctx: CanvasRenderingContext2D,
	state: BreakoutState,
	canvasW: number,
	canvasH: number,
	faceDebug01: number | null
) {
	const s = scaleFor(canvasW);
	const { margin, paddleW, paddleH, paddleY, ballR } = paddleMetrics(canvasW, canvasH);

	ctx.fillStyle = '#07070d';
	ctx.fillRect(0, 0, canvasW, canvasH);

	for (let r = 0; r < state.rows; r++) {
		for (let c = 0; c < state.cols; c++) {
			const i = cellIndex(c, r, state.cols);
			const cell = state.cells[i];
			if (!cell.alive) continue;
			const rect = blockRect(c, r, canvasW, canvasH, state.cols, state.rows);
			const stroke = blockStrokeColor(cell.colorIdx);
			ctx.fillStyle = '#0d0d14';
			ctx.setLineDash([8 * s, 10 * s]);
			ctx.strokeStyle = cell.explosive ? '#ff444488' : stroke + '88';
			ctx.lineWidth = Math.max(1, 2 * s);
			ctx.beginPath();
			ctx.rect(rect.left, rect.top, rect.w, rect.h);
			ctx.fill();
			ctx.stroke();
			ctx.setLineDash([]);
			if (cell.explosive) {
				ctx.fillStyle = '#ff4444aa';
				ctx.font = `${Math.max(10, 12 * s)}px monospace`;
				ctx.textAlign = 'center';
				ctx.fillText('!', rect.left + rect.w / 2, rect.top + rect.h / 2 + 4 * s);
				ctx.textAlign = 'left';
			}
		}
	}

	// Paddle (dashed outline like flappy aesthetic)
	const pLeft = state.paddleX - paddleW / 2;
	const pTop = paddleY - paddleH / 2;
	ctx.fillStyle = '#0d0d14';
	ctx.setLineDash([6 * s, 8 * s]);
	ctx.strokeStyle = '#00f5ffaa';
	ctx.lineWidth = Math.max(1, 2 * s);
	ctx.beginPath();
	ctx.rect(pLeft, pTop, paddleW, paddleH);
	ctx.fill();
	ctx.stroke();
	ctx.setLineDash([]);

	// Ball — same as flappy (cyan circle)
	ctx.fillStyle = state.gameOver ? '#ff4444' : '#00f5ff';
	ctx.beginPath();
	ctx.arc(state.ballX, state.ballY, ballR, 0, Math.PI * 2);
	ctx.fill();

	const hudH = Math.round(28 * s);
	ctx.fillStyle = 'rgba(0,0,0,0.35)';
	ctx.fillRect(0, 0, canvasW, hudH);
	ctx.fillStyle = '#ffffff88';
	ctx.font = `${Math.max(11, Math.round(12 * s))}px monospace`;
	const faceHint =
		faceDebug01 != null ? ` face ${(faceDebug01 * 100).toFixed(0)}%` : ' face —';
	ctx.fillText(`score ${state.score}${faceHint}`, 10 * s, 18 * s);

	if (state.won) {
		ctx.fillStyle = 'rgba(0,0,0,0.55)';
		ctx.fillRect(0, 0, canvasW, canvasH);
		ctx.fillStyle = '#fff';
		ctx.font = `bold ${Math.max(14, Math.round(16 * s))}px monospace`;
		ctx.textAlign = 'center';
		ctx.fillText('cleared', canvasW / 2, canvasH / 2 - 12 * s);
		ctx.font = `${Math.max(11, Math.round(12 * s))}px monospace`;
		ctx.fillText(`score ${state.score} — restart to play again`, canvasW / 2, canvasH / 2 + 12 * s);
		ctx.textAlign = 'left';
	} else if (state.gameOver) {
		ctx.fillStyle = 'rgba(0,0,0,0.55)';
		ctx.fillRect(0, 0, canvasW, canvasH);
		ctx.fillStyle = '#fff';
		ctx.font = `bold ${Math.max(14, Math.round(16 * s))}px monospace`;
		ctx.textAlign = 'center';
		ctx.fillText('game over', canvasW / 2, canvasH / 2 - 12 * s);
		ctx.font = `${Math.max(11, Math.round(12 * s))}px monospace`;
		ctx.fillText(`score ${state.score} — restart`, canvasW / 2, canvasH / 2 + 12 * s);
		ctx.textAlign = 'left';
	} else if (state.ballStuckToPaddle) {
		ctx.fillStyle = 'rgba(0,245,255,0.12)';
		ctx.font = `${Math.max(10, 11 * s)}px monospace`;
		ctx.textAlign = 'center';
		ctx.fillText('move face to steer paddle — ball launches…', canvasW / 2, canvasH - 12 * s);
		ctx.textAlign = 'left';
	}
}

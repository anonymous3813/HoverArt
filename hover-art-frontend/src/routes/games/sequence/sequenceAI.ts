import { BOARD_ROWS, CORNER, type BoardCard, type DeckCard, isJack, isRemoveJack, isWildJack } from './boardConfig.ts';
import {
	type SequenceGameState,
	type SequenceAction,
	type Location,
	createSequenceGame,
	getCurrentPlayer,
	isCardDead,
	getValidPlacements,
	getValidRemovals,
	applyAction
} from './sequenceEngine.ts';

export const AI_PLAYER_ID = 'ai';
export const HUMAN_PLAYER_ID = 'human';

export type AiDifficulty = 'easy' | 'medium' | 'hard';

const DIFFICULTY = {
	easy: { noise: 0.45, bestBoost: 0.6 },
	medium: { noise: 0.2, bestBoost: 1.0 },
	hard: { noise: 0.05, bestBoost: 1.4 }
} as const;

export function isAiPlayer(playerId: string): boolean {
	return playerId === AI_PLAYER_ID;
}

function weightedPick<T>(options: { value: T; weight: number }[]): T | null {
	const filtered = options.filter((o) => o.weight > 0);
	if (!filtered.length) return null;
	const total = filtered.reduce((s, o) => s + o.weight, 0);
	let r = Math.random() * total;
	for (const o of filtered) {
		r -= o.weight;
		if (r <= 0) return o.value;
	}
	return filtered[filtered.length - 1].value;
}

function getLinesThrough(row: number, col: number): Location[][] {
	const lines: Location[][] = [];
	for (let dc = -4; dc <= 0; dc++) {
		const line: Location[] = [];
		for (let i = 0; i < 5; i++) line.push([row, col + dc + i]);
		if (line.every(([r, c]) => r >= 0 && r < 10 && c >= 0 && c < 10)) lines.push(line);
	}
	for (let dr = -4; dr <= 0; dr++) {
		const line: Location[] = [];
		for (let i = 0; i < 5; i++) line.push([row + dr + i, col]);
		if (line.every(([r, c]) => r >= 0 && r < 10 && c >= 0 && c < 10)) lines.push(line);
	}
	for (let d = -4; d <= 0; d++) {
		const line: Location[] = [];
		for (let i = 0; i < 5; i++) line.push([row + d + i, col + d + i]);
		if (line.every(([r, c]) => r >= 0 && r < 10 && c >= 0 && c < 10)) lines.push(line);
	}
	for (let d = -4; d <= 0; d++) {
		const line: Location[] = [];
		for (let i = 0; i < 5; i++) line.push([row + d + i, col + d - i]);
		if (line.every(([r, c]) => r >= 0 && r < 10 && c >= 0 && c < 10)) lines.push(line);
	}
	return lines;
}

function lineProgress(state: SequenceGameState, line: Location[], team: number) {
	let mine = 0;
	let theirs = 0;
	let cornerUsed = false;

	for (const [r, c] of line) {
		if (BOARD_ROWS[r][c] === CORNER) {
			cornerUsed = true;
			continue;
		}
		const chip = state.board[r][c];
		if (chip === null) continue;
		else if (chip === team) mine++;
		else theirs++;
	}

	return { mine, theirs, cornerUsed };
}

function scorePlacement(state: SequenceGameState, team: number, loc: Location): number {
	const [row, col] = loc;
	let score = 1;

	for (const line of getLinesThrough(row, col)) {
		const prog = lineProgress(state, line, team);
		if (prog.theirs > 0) continue;

		const effective = prog.mine + 1 + (prog.cornerUsed ? 1 : 0);
		if (effective >= 5) score += 500;
		else if (effective === 4) score += 120;
		else if (effective === 3) score += 45;
		else if (effective === 2) score += 15;

		if (prog.cornerUsed && effective >= 3) score += 20;
	}

	return score;
}

function scoreOpponentChip(state: SequenceGameState, aiTeam: number, loc: Location): number {
	const [row, col] = loc;
	const oppTeam = state.board[row][col];
	if (oppTeam === null || oppTeam === aiTeam) return 0;

	let score = 5;
	for (const line of getLinesThrough(row, col)) {
		const prog = lineProgress(state, line, oppTeam);
		if (prog.theirs > 0) continue;

		const effective = prog.mine + 1 + (prog.cornerUsed ? 1 : 0);
		if (effective >= 5) score += 400;
		else if (effective === 4) score += 100;
		else if (effective === 3) score += 35;
		else if (effective === 2) score += 10;
	}
	return score;
}

function boardLocationsForCard(card: BoardCard): Location[] {
	const locs: Location[] = [];
	for (let r = 0; r < 10; r++) {
		for (let c = 0; c < 10; c++) {
			if (BOARD_ROWS[r][c] === card) locs.push([r, c]);
		}
	}
	return locs;
}

function applyDifficulty(raw: number, difficulty: AiDifficulty): number {
	const { noise, bestBoost } = DIFFICULTY[difficulty];
	const jitter = 1 + (Math.random() * 2 - 1) * noise;
	return Math.max(0.1, raw * bestBoost * jitter);
}

function pickPlacement(
	state: SequenceGameState,
	team: number,
	locs: Location[],
	difficulty: AiDifficulty
): Location | null {
	return weightedPick(
		locs.map((loc) => ({
			value: loc,
			weight: applyDifficulty(scorePlacement(state, team, loc), difficulty)
		}))
	);
}

function pickRemoval(
	state: SequenceGameState,
	team: number,
	locs: Location[],
	difficulty: AiDifficulty
): Location | null {
	return weightedPick(
		locs.map((loc) => ({
			value: loc,
			weight: applyDifficulty(scoreOpponentChip(state, team, loc), difficulty)
		}))
	);
}

function scoreCardChoice(
	state: SequenceGameState,
	team: number,
	card: DeckCard,
	difficulty: AiDifficulty
): number {
	if (!isJack(card) && isCardDead(state, card as BoardCard)) {
		return applyDifficulty(8, difficulty);
	}

	if (isRemoveJack(card)) {
		const removals = getValidRemovals(state, team);
		if (!removals.length) return 0.5;
		const best = Math.max(...removals.map((loc) => scoreOpponentChip(state, team, loc)));
		return applyDifficulty(15 + best, difficulty);
	}

	if (isWildJack(card)) {
		const open: Location[] = [];
		for (let r = 0; r < 10; r++) {
			for (let c = 0; c < 10; c++) {
				if (BOARD_ROWS[r][c] !== CORNER && state.board[r][c] === null) open.push([r, c]);
			}
		}
		if (!open.length) return 0;
		const best = Math.max(...open.map((loc) => scorePlacement(state, team, loc)));
		return applyDifficulty(best > 80 ? best : best * 0.35, difficulty);
	}

	const locs = boardLocationsForCard(card as BoardCard).filter(
		([r, c]) => state.board[r][c] === null
	);
	if (!locs.length) return 0;
	const best = Math.max(...locs.map((loc) => scorePlacement(state, team, loc)));
	return applyDifficulty(best, difficulty);
}

/** Pick the next action for the AI given the current phase. */
export function chooseAiAction(
	state: SequenceGameState,
	aiPlayerId: string,
	difficulty: AiDifficulty = 'medium'
): SequenceAction | null {
	const player = getCurrentPlayer(state);
	if (player.id !== aiPlayerId) return null;

	const team = player.team;
	const hand = state.hands[aiPlayerId] ?? [];

	if (state.phase === 'select-card') {
		const deadIdx = hand.findIndex((c) => !isJack(c) && isCardDead(state, c as BoardCard));
		if (deadIdx >= 0) {
			return { type: 'declare-dead', cardIndex: deadIdx };
		}

		const cardIdx = weightedPick(
			hand.map((card, i) => ({
				value: i,
				weight: scoreCardChoice(state, team, card, difficulty)
			}))
		);
		if (cardIdx === null) return null;
		return { type: 'play-card', cardIndex: cardIdx };
	}

	if (state.phase === 'place-chip' || state.phase === 'wild-place') {
		const locs = getValidPlacements(state);
		const loc = pickPlacement(state, team, locs, difficulty);
		if (!loc) return null;
		return { type: 'place-chip', row: loc[0], col: loc[1] };
	}

	if (state.phase === 'remove-chip') {
		const locs = getValidRemovals(state, team);
		const loc = pickRemoval(state, team, locs, difficulty);
		if (!loc) return null;
		return { type: 'remove-chip', row: loc[0], col: loc[1] };
	}

	return null;
}

export function createSoloVsAiGame(humanName: string) {
	return createSequenceGame([
		{ id: HUMAN_PLAYER_ID, name: humanName || 'You' },
		{ id: AI_PLAYER_ID, name: 'AI Opponent' }
	]);
}

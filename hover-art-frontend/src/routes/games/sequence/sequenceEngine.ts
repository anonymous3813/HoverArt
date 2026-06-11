import {
	BOARD_ROWS,
	CORNER,
	type BoardCard,
	type DeckCard,
	cardsPerPlayer,
	isJack,
	isRemoveJack,
	isWildJack,
	sequencesToWin,
	teamCountForPlayers,
	teamForPlayer
} from './boardConfig.ts';

export type ChipTeam = 0 | 1 | 2 | null;
export type Location = [number, number];

export type TurnPhase =
	| 'select-card'
	| 'place-chip'
	| 'wild-place'
	| 'remove-chip'
	| 'dead-card'
	| 'waiting';

export interface PlayerInfo {
	id: string;
	name: string;
	index: number;
	team: number;
}

export interface SequenceCompletion {
	team: number;
	locs: Location[];
	path: 'row' | 'col' | 'diag0' | 'diag1';
}

export interface SequenceGameState {
	board: ChipTeam[][];
	boardCards: (BoardCard | typeof CORNER)[][];
	locked: boolean[][];
	deck: DeckCard[];
	discardPiles: Record<string, DeckCard[]>;
	hands: Record<string, DeckCard[]>;
	players: PlayerInfo[];
	currentPlayerIndex: number;
	phase: TurnPhase;
	playedCard: DeckCard | null;
	completions: SequenceCompletion[];
	teamScores: number[];
	sequencesNeeded: number;
	winner: number | null;
	message: string;
	deckCount: number;
}

export type SequenceAction =
	| { type: 'play-card'; cardIndex: number }
	| { type: 'place-chip'; row: number; col: number }
	| { type: 'remove-chip'; row: number; col: number }
	| { type: 'declare-dead'; cardIndex: number };

function shuffle<T>(arr: T[]): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

function buildDeck(): DeckCard[] {
	const boardCards: BoardCard[] = [];
	for (const row of BOARD_ROWS) {
		for (const cell of row) {
			if (cell !== CORNER && !boardCards.includes(cell)) boardCards.push(cell);
		}
	}
	const deck: DeckCard[] = [];
	for (const c of boardCards) deck.push(c, c);
	deck.push('JC-W', 'JC-W', 'JD-W', 'JD-W', 'JS-R', 'JS-R', 'JH-R', 'JH-R');
	return shuffle(deck);
}

function initBoard(): {
	chips: ChipTeam[][];
	cards: (BoardCard | typeof CORNER)[][];
	locked: boolean[][];
} {
	const chips: ChipTeam[][] = [];
	const cards: (BoardCard | typeof CORNER)[][] = [];
	const locked: boolean[][] = [];
	for (let r = 0; r < 10; r++) {
		chips[r] = [];
		cards[r] = [];
		locked[r] = [];
		for (let c = 0; c < 10; c++) {
			cards[r][c] = BOARD_ROWS[r][c];
			chips[r][c] = null;
			locked[r][c] = false;
		}
	}
	return { chips, cards, locked };
}

export function createSequenceGame(
	players: { id: string; name: string }[]
): SequenceGameState {
	const deck = buildDeck();
	const count = players.length;
	const perHand = cardsPerPlayer(count);
	const teams = teamCountForPlayers(count);

	const playerInfos: PlayerInfo[] = players.map((p, i) => ({
		id: p.id,
		name: p.name,
		index: i,
		team: teamForPlayer(i, count)
	}));

	const hands: Record<string, DeckCard[]> = {};
	const discardPiles: Record<string, DeckCard[]> = {};
	for (const p of playerInfos) {
		hands[p.id] = deck.splice(0, perHand);
		discardPiles[p.id] = [];
	}

	const { chips, cards, locked } = initBoard();

	const state: SequenceGameState = {
		board: chips,
		boardCards: cards,
		locked,
		deck,
		discardPiles,
		hands,
		players: playerInfos,
		currentPlayerIndex: 0,
		phase: 'select-card',
		playedCard: null,
		completions: [],
		teamScores: Array.from({ length: teams }, () => 0),
		sequencesNeeded: sequencesToWin(teams),
		winner: null,
		message: '',
		deckCount: deck.length
	};
	state.message = turnMessage(state, playerInfos[0]);
	return state;
}

export function getCurrentPlayer(state: SequenceGameState): PlayerInfo {
	return state.players[state.currentPlayerIndex];
}

export function isPlayerTurn(state: SequenceGameState, playerId: string): boolean {
	return getCurrentPlayer(state).id === playerId && state.winner === null;
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

export function isCardDead(state: SequenceGameState, card: BoardCard): boolean {
	const locs = boardLocationsForCard(card);
	return locs.length > 0 && locs.every(([r, c]) => state.board[r][c] !== null);
}

export function getValidPlacements(state: SequenceGameState): Location[] {
	const card = state.playedCard;
	if (!card) return [];
	if (isWildJack(card)) {
		const locs: Location[] = [];
		for (let r = 0; r < 10; r++) {
			for (let c = 0; c < 10; c++) {
				if (BOARD_ROWS[r][c] !== CORNER && state.board[r][c] === null) locs.push([r, c]);
			}
		}
		return locs;
	}
	if (isRemoveJack(card)) return [];
	return boardLocationsForCard(card as BoardCard).filter(([r, c]) => state.board[r][c] === null);
}

export function getValidRemovals(state: SequenceGameState, team: number): Location[] {
	const locs: Location[] = [];
	for (let r = 0; r < 10; r++) {
		for (let c = 0; c < 10; c++) {
			const chip = state.board[r][c];
			if (chip !== null && chip !== team && !state.locked[r][c]) locs.push([r, c]);
		}
	}
	return locs;
}

function getChunks([x, y]: Location, kind: 'row' | 'col' | 'diag0' | 'diag1'): Location[][] {
	const chunks: Location[][] = [];
	for (let i = 0; i < 5; i++) {
		let minX = x - 4 + i;
		let maxX = x + i;
		let minY = y - 4 + i;
		let maxY = y + i;

		if (kind === 'row') {
			if (minY < 0 || maxY > 9) continue;
		} else if (kind === 'col') {
			if (minX < 0 || maxX > 9) continue;
		} else if (kind === 'diag0') {
			if (minX < 0 || maxX > 9 || minY < 0 || maxY > 9) continue;
		} else if (kind === 'diag1') {
			minY = y + 4 - i;
			maxY = y - i;
			if (minX < 0 || maxX > 9 || minY < 0 || minY > 9 || maxY < 0 || maxY > 9) continue;
		}

		const chunk: Location[] = [];
		switch (kind) {
			case 'row':
				for (let j = minY; j <= maxY; j++) chunk.push([x, j]);
				break;
			case 'col':
				for (let j = minX; j <= maxX; j++) chunk.push([j, y]);
				break;
			case 'diag0':
				for (let j = minX, k = minY; j <= maxX && k <= maxY; j++, k++) chunk.push([j, k]);
				break;
			case 'diag1':
				for (let j = minX, k = minY; j <= maxX && k >= maxY; j++, k--) chunk.push([j, k]);
				break;
		}
		chunks.push(chunk);
	}
	return chunks;
}

function getCompletion(
	state: SequenceGameState,
	chunks: Location[][],
	path: SequenceCompletion['path']
): SequenceCompletion | undefined {
	chunks.sort((a, b) => {
		const aCorner = a.some(([r, c]) => BOARD_ROWS[r][c] === CORNER);
		const bCorner = b.some(([r, c]) => BOARD_ROWS[r][c] === CORNER);
		if (aCorner && !bCorner) return -1;
		if (bCorner && !aCorner) return 1;
		return 0;
	});

	for (const chunk of chunks) {
		let winner: number | null = null;
		for (const loc of chunk) {
			const [r, c] = loc;
			const isCorner = BOARD_ROWS[r][c] === CORNER;
			const team = state.board[r][c];
			if (!isCorner && team === null) {
				winner = null;
				break;
			}
			if (isCorner) continue;
			if (winner === null) winner = team;
			else if (team !== winner) {
				winner = null;
				break;
			}
		}
		if (winner !== null) return { team: winner, locs: chunk, path };
	}
	return undefined;
}

function updateCompletions(state: SequenceGameState, loc: Location): void {
	const frozen = new Set(state.completions.flatMap((c) => c.locs.map((l) => `${l[0]},${l[1]}`)));

	const candidates = [
		getCompletion(state, getChunks(loc, 'row'), 'row'),
		getCompletion(state, getChunks(loc, 'col'), 'col'),
		getCompletion(state, getChunks(loc, 'diag0'), 'diag0'),
		getCompletion(state, getChunks(loc, 'diag1'), 'diag1')
	].filter(Boolean) as SequenceCompletion[];

	for (const completion of candidates) {
		const overlap = completion.locs.filter((l) => frozen.has(`${l[0]},${l[1]}`)).length;
		if (overlap < 2) {
			const exists = state.completions.some(
				(c) =>
					c.path === completion.path &&
					c.locs.length === completion.locs.length &&
					c.locs.every((l, i) => l[0] === completion.locs[i][0] && l[1] === completion.locs[i][1])
			);
			if (!exists) {
				state.completions.push(completion);
				for (const [r, c] of completion.locs) {
					if (BOARD_ROWS[r][c] !== CORNER) state.locked[r][c] = true;
				}
			}
		}
	}

	state.teamScores = state.teamScores.map((_, i) =>
		state.completions.filter((c) => c.team === i).length
	);

	if (state.teamScores.some((s) => s >= state.sequencesNeeded)) {
		state.winner = state.teamScores.findIndex((s) => s >= state.sequencesNeeded);
		state.phase = 'waiting';
		state.message = `Team wins!`;
	}
}

function drawCard(state: SequenceGameState, playerId: string): void {
	if (state.deck.length > 0) {
		state.hands[playerId].push(state.deck.pop()!);
	}
	state.deckCount = state.deck.length;
}

function turnMessage(state: SequenceGameState, player: PlayerInfo): string {
	if (player.id === 'ai') return `${player.name} is thinking…`;
	return 'Pinch a card in your hand to play';
}

function advanceTurn(state: SequenceGameState): void {
	state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
	state.phase = 'select-card';
	state.playedCard = null;
	const next = getCurrentPlayer(state);
	state.message = turnMessage(state, next);
}

export function applyAction(
	state: SequenceGameState,
	playerId: string,
	action: SequenceAction
): { ok: boolean; error?: string } {
	if (state.winner !== null) return { ok: false, error: 'Game is over' };
	if (!isPlayerTurn(state, playerId)) return { ok: false, error: 'Not your turn' };

	const player = getCurrentPlayer(state);
	const hand = state.hands[playerId];

	if (action.type === 'play-card') {
		if (state.phase !== 'select-card') return { ok: false, error: 'Select a card first' };
		const card = hand[action.cardIndex];
		if (!card) return { ok: false, error: 'Invalid card' };

		hand.splice(action.cardIndex, 1);
		state.discardPiles[playerId].push(card);
		state.playedCard = card;

		if (isWildJack(card)) {
			state.phase = 'wild-place';
			state.message = 'Pinch a board spot to place your chip';
		} else if (isRemoveJack(card)) {
			state.phase = 'remove-chip';
			state.message = 'Pinch an opponent chip to remove';
		} else if (isCardDead(state, card as BoardCard)) {
			drawCard(state, playerId);
			state.message = 'Dead card — drew a replacement';
			advanceTurn(state);
		} else {
			state.phase = 'place-chip';
			state.message = 'Pinch a highlighted board spot to place your chip';
		}
		return { ok: true };
	}

	if (action.type === 'declare-dead') {
		if (state.phase !== 'select-card') return { ok: false, error: 'Cannot declare dead now' };
		const card = hand[action.cardIndex];
		if (!card || isJack(card)) return { ok: false, error: 'Invalid dead card' };
		if (!isCardDead(state, card as BoardCard)) return { ok: false, error: 'Card is not dead' };

		hand.splice(action.cardIndex, 1);
		state.discardPiles[playerId].push(card);
		drawCard(state, playerId);
		state.message = 'Dead card discarded — drew replacement';
		advanceTurn(state);
		return { ok: true };
	}

	if (action.type === 'place-chip') {
		if (state.phase !== 'place-chip' && state.phase !== 'wild-place')
			return { ok: false, error: 'Cannot place chip now' };

		const { row, col } = action;
		if (BOARD_ROWS[row][col] === CORNER) return { ok: false, error: 'Cannot place on corner' };
		if (state.board[row][col] !== null) return { ok: false, error: 'Space occupied' };

		if (state.phase === 'place-chip') {
			const card = state.playedCard as BoardCard;
			if (state.boardCards[row][col] !== card) return { ok: false, error: 'Wrong card space' };
		}

		state.board[row][col] = player.team as ChipTeam;
		updateCompletions(state, [row, col]);
		drawCard(state, playerId);
		if (state.winner === null) advanceTurn(state);
		return { ok: true };
	}

	if (action.type === 'remove-chip') {
		if (state.phase !== 'remove-chip') return { ok: false, error: 'Cannot remove now' };
		const { row, col } = action;
		const chip = state.board[row][col];
		if (chip === null || chip === player.team) return { ok: false, error: 'Invalid target' };
		if (state.locked[row][col]) return { ok: false, error: 'Chip is in a completed sequence' };

		state.board[row][col] = null;
		drawCard(state, playerId);
		advanceTurn(state);
		return { ok: true };
	}

	return { ok: false, error: 'Unknown action' };
}

/** Public view — hides other players' hands */
export function getPublicState(state: SequenceGameState, forPlayerId: string) {
	const opponentHandCounts: Record<string, number> = {};
	for (const p of state.players) {
		if (p.id !== forPlayerId) opponentHandCounts[p.id] = state.hands[p.id]?.length ?? 0;
	}
	return {
		...structuredClone(state),
		hands: { [forPlayerId]: [...(state.hands[forPlayerId] ?? [])] },
		deck: [],
		myHand: [...(state.hands[forPlayerId] ?? [])],
		opponentHandCounts
	};
}

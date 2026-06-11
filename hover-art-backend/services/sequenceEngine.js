/** Server-side Sequence game engine (mirrors frontend sequenceEngine.ts) */

const CORNER = 'CORNER';

const BOARD_ROWS = [
	[CORNER, 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', CORNER],
	['C6', 'C5', 'C4', 'C3', 'C2', 'HA', 'HK', 'HQ', 'H10', 'S10'],
	['C7', 'SA', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'H9', 'SQ'],
	['C8', 'SK', 'C6', 'C5', 'C4', 'C3', 'C2', 'D8', 'H8', 'SK'],
	['C9', 'SQ', 'C7', 'H6', 'H5', 'H4', 'HA', 'D9', 'H7', 'SA'],
	['C10', 'S10', 'C8', 'H7', 'H2', 'H3', 'HK', 'D10', 'H6', 'D2'],
	['CQ', 'S9', 'C9', 'H8', 'H9', 'H10', 'HQ', 'DQ', 'H5', 'D3'],
	['CK', 'S8', 'C10', 'CQ', 'CK', 'CA', 'DA', 'DK', 'H4', 'D4'],
	['CA', 'S7', 'S6', 'S5', 'S4', 'S3', 'S2', 'H2', 'H3', 'D5'],
	[CORNER, 'DA', 'DK', 'DQ', 'D10', 'D9', 'D8', 'D7', 'D6', CORNER]
];

function cardsPerPlayer(count) {
	if (count <= 2) return 7;
	if (count <= 4) return 6;
	if (count <= 6) return 5;
	return 3;
}

function sequencesToWin(teamCount) {
	return teamCount === 3 ? 1 : 2;
}

function teamForPlayer(playerIndex, playerCount) {
	if (playerCount <= 3) return playerIndex;
	return playerIndex % 2;
}

function teamCountForPlayers(playerCount) {
	if (playerCount <= 3) return playerCount;
	return 2;
}

function isWildJack(card) {
	return card === 'JC-W' || card === 'JD-W';
}

function isRemoveJack(card) {
	return card === 'JS-R' || card === 'JH-R';
}

function isJack(card) {
	return isWildJack(card) || isRemoveJack(card);
}

function shuffle(arr) {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

function buildDeck() {
	const boardCards = [];
	for (const row of BOARD_ROWS) {
		for (const cell of row) {
			if (cell !== CORNER && !boardCards.includes(cell)) boardCards.push(cell);
		}
	}
	const deck = [];
	for (const c of boardCards) deck.push(c, c);
	deck.push('JC-W', 'JC-W', 'JD-W', 'JD-W', 'JS-R', 'JS-R', 'JH-R', 'JH-R');
	return shuffle(deck);
}

function initBoard() {
	const chips = [];
	const cards = [];
	const locked = [];
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

export function createSequenceGame(players) {
	const deck = buildDeck();
	const count = players.length;
	const perHand = cardsPerPlayer(count);
	const teams = teamCountForPlayers(count);

	const playerInfos = players.map((p, i) => ({
		id: p.id,
		name: p.name,
		index: i,
		team: teamForPlayer(i, count)
	}));

	const hands = {};
	const discardPiles = {};
	for (const p of playerInfos) {
		hands[p.id] = deck.splice(0, perHand);
		discardPiles[p.id] = [];
	}

	const { chips, cards, locked } = initBoard();

	return {
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
		message: `${playerInfos[0].name}'s turn — pinch a card to play`,
		deckCount: deck.length
	};
}

function getCurrentPlayer(state) {
	return state.players[state.currentPlayerIndex];
}

function isPlayerTurn(state, playerId) {
	return getCurrentPlayer(state).id === playerId && state.winner === null;
}

function boardLocationsForCard(card) {
	const locs = [];
	for (let r = 0; r < 10; r++) {
		for (let c = 0; c < 10; c++) {
			if (BOARD_ROWS[r][c] === card) locs.push([r, c]);
		}
	}
	return locs;
}

function isCardDead(state, card) {
	const locs = boardLocationsForCard(card);
	return locs.length > 0 && locs.every(([r, c]) => state.board[r][c] !== null);
}

function getChunks([x, y], kind) {
	const chunks = [];
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

		const chunk = [];
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

function getCompletion(state, chunks, path) {
	chunks.sort((a, b) => {
		const aCorner = a.some(([r, c]) => BOARD_ROWS[r][c] === CORNER);
		const bCorner = b.some(([r, c]) => BOARD_ROWS[r][c] === CORNER);
		if (aCorner && !bCorner) return -1;
		if (bCorner && !aCorner) return 1;
		return 0;
	});

	for (const chunk of chunks) {
		let winner = null;
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

function updateCompletions(state, loc) {
	const frozen = new Set(state.completions.flatMap((c) => c.locs.map((l) => `${l[0]},${l[1]}`)));

	const candidates = [
		getCompletion(state, getChunks(loc, 'row'), 'row'),
		getCompletion(state, getChunks(loc, 'col'), 'col'),
		getCompletion(state, getChunks(loc, 'diag0'), 'diag0'),
		getCompletion(state, getChunks(loc, 'diag1'), 'diag1')
	].filter(Boolean);

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
		state.message = 'Team wins!';
	}
}

function drawCard(state, playerId) {
	if (state.deck.length > 0) {
		state.hands[playerId].push(state.deck.pop());
	}
	state.deckCount = state.deck.length;
}

function advanceTurn(state) {
	state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
	state.phase = 'select-card';
	state.playedCard = null;
	const next = getCurrentPlayer(state);
	state.message = `${next.name}'s turn — pinch a card to play`;
}

export function applyAction(state, playerId, action) {
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
			state.message = 'Two-eyed Jack — pinch an open space';
		} else if (isRemoveJack(card)) {
			state.phase = 'remove-chip';
			state.message = 'One-eyed Jack — pinch an opponent chip to remove';
		} else if (isCardDead(state, card)) {
			drawCard(state, playerId);
			state.message = 'Dead card — drew a replacement';
			advanceTurn(state);
		} else {
			state.phase = 'place-chip';
			state.message = 'Place chip on matching card';
		}
		return { ok: true };
	}

	if (action.type === 'declare-dead') {
		if (state.phase !== 'select-card') return { ok: false, error: 'Cannot declare dead now' };
		const card = hand[action.cardIndex];
		if (!card || isJack(card)) return { ok: false, error: 'Invalid dead card' };
		if (!isCardDead(state, card)) return { ok: false, error: 'Card is not dead' };

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
			const card = state.playedCard;
			if (state.boardCards[row][col] !== card) return { ok: false, error: 'Wrong card space' };
		}

		state.board[row][col] = player.team;
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

export function getPublicState(state, forPlayerId) {
	const opponentHandCounts = {};
	for (const p of state.players) {
		if (p.id !== forPlayerId) opponentHandCounts[p.id] = state.hands[p.id]?.length ?? 0;
	}
	return {
		...JSON.parse(JSON.stringify(state)),
		hands: { [forPlayerId]: [...(state.hands[forPlayerId] ?? [])] },
		deck: [],
		myHand: [...(state.hands[forPlayerId] ?? [])],
		opponentHandCounts
	};
}

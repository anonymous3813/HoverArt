/** Standard Sequence board layout (MIT reference: boopathi/sequence) */

export const CORNER = 'CORNER';

export type BoardCard =
	| 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7' | 'S8' | 'S9' | 'S10' | 'SQ' | 'SK' | 'SA'
	| 'C2' | 'C3' | 'C4' | 'C5' | 'C6' | 'C7' | 'C8' | 'C9' | 'C10' | 'CQ' | 'CK' | 'CA'
	| 'D2' | 'D3' | 'D4' | 'D5' | 'D6' | 'D7' | 'D8' | 'D9' | 'D10' | 'DQ' | 'DK' | 'DA'
	| 'H2' | 'H3' | 'H4' | 'H5' | 'H6' | 'H7' | 'H8' | 'H9' | 'H10' | 'HQ' | 'HK' | 'HA';

export type BoardCell = typeof CORNER | BoardCard;

export const BOARD_ROWS: BoardCell[][] = [
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

export type DeckCard = BoardCard | 'JC-W' | 'JD-W' | 'JS-R' | 'JH-R';

export const TEAM_COLORS = ['#3b82f6', '#22c55e', '#ef4444'] as const;
export const TEAM_NAMES = ['Blue', 'Green', 'Red'] as const;

export function cardLabel(card: DeckCard | BoardCell): string {
	if (card === CORNER) return '★';
	if (card.endsWith('-W')) return 'J★';
	if (card.endsWith('-R')) return 'J✕';
	const suit = card[0];
	const rank = card.slice(1);
	const suitSym = { S: '♠', C: '♣', D: '♦', H: '♥' }[suit] ?? '';
	return `${rank}${suitSym}`;
}

export function cardDisplayName(card: DeckCard): string {
	switch (card) {
		case 'JC-W':
			return 'Jack of Clubs (Wild)';
		case 'JD-W':
			return 'Jack of Diamonds (Wild)';
		case 'JS-R':
			return 'Jack of Spades (Remove)';
		case 'JH-R':
			return 'Jack of Hearts (Remove)';
		default: {
			const suit = card[0];
			const rank = card.slice(1);
			const suitName = { S: 'Spades', C: 'Clubs', D: 'Diamonds', H: 'Hearts' }[suit] ?? '';
			const rankName =
				rank === 'A' ? 'Ace' : rank === 'K' ? 'King' : rank === 'Q' ? 'Queen' : rank;
			return `${rankName} of ${suitName}`;
		}
	}
}

export function isWildJack(card: DeckCard): boolean {
	return card === 'JC-W' || card === 'JD-W';
}

export function isRemoveJack(card: DeckCard): boolean {
	return card === 'JS-R' || card === 'JH-R';
}

export function isJack(card: DeckCard): boolean {
	return isWildJack(card) || isRemoveJack(card);
}

export function cardsPerPlayer(count: number): number {
	if (count <= 2) return 7;
	if (count <= 4) return 6;
	if (count <= 6) return 5;
	return 3;
}

export function sequencesToWin(teamCount: number): number {
	return teamCount === 3 ? 1 : 2;
}

export function teamForPlayer(playerIndex: number, playerCount: number): number {
	if (playerCount <= 3) return playerIndex;
	return playerIndex % 2;
}

export function teamCountForPlayers(playerCount: number): number {
	if (playerCount <= 3) return playerCount;
	return 2;
}

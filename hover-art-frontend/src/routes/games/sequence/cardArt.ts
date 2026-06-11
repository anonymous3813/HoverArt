import { CORNER, type BoardCell, type DeckCard } from './boardConfig.ts';

export type SuitName = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export interface CardFace {
	rank: string;
	suit: SuitName | null;
	suitSymbol: string;
	red: boolean;
	wild?: boolean;
	remove?: boolean;
	corner?: boolean;
	label: string;
}

const SUIT_MAP: Record<string, { name: SuitName; symbol: string; red: boolean }> = {
	S: { name: 'spades', symbol: '♠', red: false },
	H: { name: 'hearts', symbol: '♥', red: true },
	D: { name: 'diamonds', symbol: '♦', red: true },
	C: { name: 'clubs', symbol: '♣', red: false }
};

export function parseCard(card: DeckCard | BoardCell): CardFace {
	if (card === CORNER) {
		return {
			rank: '★',
			suit: null,
			suitSymbol: '',
			red: false,
			corner: true,
			label: 'Free'
		};
	}

	if (card.endsWith('-W')) {
		const s = SUIT_MAP[card[0]];
		return {
			rank: 'J',
			suit: s?.name ?? 'clubs',
			suitSymbol: s?.symbol ?? '♣',
			red: s?.red ?? false,
			wild: true,
			label: 'Wild Jack'
		};
	}

	if (card.endsWith('-R')) {
		const s = SUIT_MAP[card[0]];
		return {
			rank: 'J',
			suit: s?.name ?? 'spades',
			suitSymbol: s?.symbol ?? '♠',
			red: s?.red ?? false,
			remove: true,
			label: 'Remove Jack'
		};
	}

	const suitKey = card[0];
	const rank = card.slice(1);
	const s = SUIT_MAP[suitKey];
	const rankLabel =
		rank === 'A' ? 'A' : rank === 'K' ? 'K' : rank === 'Q' ? 'Q' : rank === 'J' ? 'J' : rank;

	return {
		rank: rankLabel,
		suit: s?.name ?? 'spades',
		suitSymbol: s?.symbol ?? '♠',
		red: s?.red ?? false,
		label: `${rankLabel}${s?.symbol ?? ''}`
	};
}

/** SVG pip layout for number cards (simplified center pattern) */
export function pipCount(rank: string): number {
	const n = parseInt(rank, 10);
	return Number.isNaN(n) ? 0 : n;
}

export function isFaceCard(rank: string): boolean {
	return rank === 'J' || rank === 'Q' || rank === 'K' || rank === 'A';
}

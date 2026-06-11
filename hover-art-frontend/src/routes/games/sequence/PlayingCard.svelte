<script lang="ts">
	import { parseCard, isFaceCard } from './cardArt.ts';
	import type { BoardCell, DeckCard } from './boardConfig.ts';

	interface Props {
		card: DeckCard | BoardCell;
		size?: 'board' | 'hand';
	}

	let { card, size = 'board' }: Props = $props();

	const face = $derived(parseCard(card));
</script>

{#if face.corner}
	<div class="playing-card corner {size}" aria-label="Free corner space">
		<div class="corner-star">★</div>
		<span class="corner-text">FREE</span>
	</div>
{:else if face.wild}
	<div class="playing-card jack wild {size}" class:red={face.red} aria-label={face.label}>
		<div class="corner-tl"><span class="rank">J</span><span class="suit">{face.suitSymbol}</span></div>
		<div class="center-art">
			<span class="jack-icon">👀</span>
			<span class="jack-tag">WILD</span>
		</div>
		<div class="corner-br"><span class="rank">J</span><span class="suit">{face.suitSymbol}</span></div>
	</div>
{:else if face.remove}
	<div class="playing-card jack remove {size}" class:red={face.red} aria-label={face.label}>
		<div class="corner-tl"><span class="rank">J</span><span class="suit">{face.suitSymbol}</span></div>
		<div class="center-art">
			<span class="jack-icon">🎯</span>
			<span class="jack-tag">REMOVE</span>
		</div>
		<div class="corner-br"><span class="rank">J</span><span class="suit">{face.suitSymbol}</span></div>
	</div>
{:else}
	<div class="playing-card {size}" class:red={face.red} aria-label={face.label}>
		<div class="corner-tl">
			<span class="rank">{face.rank}</span>
			<span class="suit">{face.suitSymbol}</span>
		</div>

		<div class="center-art">
			{#if isFaceCard(face.rank) && face.rank !== 'A'}
				<span class="face-letter">{face.rank}</span>
				<span class="face-suit">{face.suitSymbol}</span>
			{:else if face.rank === 'A'}
				<span class="ace-suit">{face.suitSymbol}</span>
			{:else}
				<span class="pip-suit">{face.suitSymbol}</span>
				<span class="pip-rank">{face.rank}</span>
			{/if}
		</div>

		<div class="corner-br">
			<span class="rank">{face.rank}</span>
			<span class="suit">{face.suitSymbol}</span>
		</div>
	</div>
{/if}

<style>
	.playing-card {
		position: relative;
		width: 100%;
		height: 100%;
		background: linear-gradient(145deg, #fffef8 0%, #f5f0e6 100%);
		border: 1px solid #c9b896;
		border-radius: 4px;
		box-shadow:
			inset 0 0 0 1px rgba(255, 255, 255, 0.8),
			0 1px 3px rgba(0, 0, 0, 0.35);
		color: #1a1a1a;
		overflow: hidden;
		font-family: Georgia, 'Times New Roman', serif;
	}

	.playing-card.red {
		color: #c41e3a;
	}

	.playing-card.hand {
		border-radius: 6px;
		border-width: 2px;
	}

	.playing-card.corner {
		background: linear-gradient(145deg, #fff8dc, #f0d878);
		border-color: #c9a227;
		color: #8b6914;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
	}

	.corner-star {
		font-size: 1.1em;
		line-height: 1;
	}

	.corner-text {
		font-size: 0.45em;
		font-family: 'Space Mono', monospace;
		letter-spacing: 0.08em;
		font-weight: 700;
	}

	.corner-tl,
	.corner-br {
		position: absolute;
		display: flex;
		flex-direction: column;
		align-items: center;
		line-height: 1;
	}

	.corner-tl {
		top: 2px;
		left: 3px;
	}

	.corner-br {
		bottom: 2px;
		right: 3px;
		transform: rotate(180deg);
	}

	.board .rank {
		font-size: clamp(0.45rem, 2vw, 0.55rem);
		font-weight: 700;
	}

	.board .suit {
		font-size: clamp(0.4rem, 1.8vw, 0.5rem);
	}

	.hand .rank {
		font-size: 0.85rem;
		font-weight: 700;
	}

	.hand .suit {
		font-size: 0.75rem;
	}

	.center-art {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}

	.board .pip-suit {
		font-size: clamp(0.9rem, 3.5vw, 1.1rem);
		opacity: 0.85;
	}

	.board .pip-rank {
		display: none;
	}

	.hand .pip-suit {
		font-size: 1.6rem;
		opacity: 0.9;
	}

	.hand .pip-rank {
		font-size: 0.6rem;
		opacity: 0.5;
		margin-top: -2px;
	}

	.face-letter {
		font-size: clamp(1rem, 4vw, 1.3rem);
		font-weight: 700;
		line-height: 1;
	}

	.hand .face-letter {
		font-size: 1.8rem;
	}

	.face-suit {
		font-size: clamp(0.55rem, 2.2vw, 0.7rem);
		margin-top: 1px;
	}

	.hand .face-suit {
		font-size: 1rem;
	}

	.ace-suit {
		font-size: clamp(1rem, 4vw, 1.25rem);
	}

	.hand .ace-suit {
		font-size: 1.8rem;
	}

	.jack .center-art {
		gap: 1px;
	}

	.jack-icon {
		font-size: clamp(0.55rem, 2.2vw, 0.7rem);
		line-height: 1;
	}

	.hand .jack-icon {
		font-size: 1.1rem;
	}

	.jack-tag {
		font-family: 'Space Mono', monospace;
		font-size: clamp(0.28rem, 1.1vw, 0.35rem);
		font-weight: 700;
		letter-spacing: 0.05em;
		opacity: 0.75;
	}

	.hand .jack-tag {
		font-size: 0.45rem;
	}

	.jack.wild {
		background: linear-gradient(145deg, #fffef0, #ffe9a8);
		border-color: #d4a017;
	}

	.jack.remove {
		background: linear-gradient(145deg, #fff5f5, #ffd6d6);
		border-color: #c44;
	}
</style>

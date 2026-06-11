<script lang="ts">
	const games = [
		{ href: '/whiteboard', title: 'HoverCanvas', desc: 'Gesture-powered drawing canvas with multiplayer rooms.' },
		{ href: '/games/beatsaber', title: 'Beat Slash', desc: 'Slash blocks with hand flicks. Rhythm score attack.' },
		{ href: '/games/boxing', title: 'Shadow Box', desc: 'Punch training with pose tracking.' },
		{ href: '/games/boxing2', title: 'Shadow Box 2', desc: 'Two-player boxing bout.' },
		{ href: '/games/breakout', title: 'Hand Breakout', desc: 'Brick breaker controlled by hand position.' },
		{ href: '/games/flappy', title: 'Flappy Hand', desc: 'Flap by moving your hand.' },
		{ href: '/games/skribbl', title: 'Hand Skribbl', desc: 'Draw and guess with gesture controls.' },
		{ href: '/games/two-truths', title: 'Two Truths', desc: 'Party game — spot the lie with gestures.' },
		{ href: '/games/sequence', title: 'Sequence', desc: 'Board game vs AI or online multiplayer.' },
		{ href: '/tutorial', title: 'Gesture Guide', desc: 'Learn the hand controls.' }
	];
</script>

<svelte:head>
	<title>HoverArt — Games</title>
	<link
		href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=Space+Mono:wght@400;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="page">
	<header class="header">
		<a href="/" class="home-link">← Home</a>
		<h1>Games</h1>
		<p>All HoverArt games in one place. No touch required.</p>
	</header>

	<ul class="game-list">
		{#each games as g}
			<li>
				<a href={g.href} class="game-row">
					<span class="game-title">{g.title}</span>
					<span class="game-desc">{g.desc}</span>
					<span class="arrow">→</span>
				</a>
			</li>
		{/each}
	</ul>
</div>

<style>
	.page {
		min-height: 100vh;
		background: #070710;
		color: #e0e0f0;
		font-family: 'Space Mono', monospace;
		max-width: 720px;
		margin: 0 auto;
		padding: 2rem 1.25rem 3rem;
	}

	.header {
		margin-bottom: 2rem;
	}

	.home-link {
		display: inline-block;
		font-size: 0.75rem;
		color: rgba(0, 245, 255, 0.8);
		text-decoration: none;
		margin-bottom: 1rem;
	}

	.home-link:hover {
		color: #00f5ff;
	}

	h1 {
		font-family: 'Syne', sans-serif;
		font-size: 2rem;
		font-weight: 800;
		margin: 0 0 0.5rem;
		color: #fff;
	}

	.header p {
		margin: 0;
		font-size: 0.8rem;
		color: rgba(255, 255, 255, 0.45);
		line-height: 1.5;
	}

	.game-list {
		list-style: none;
		margin: 0;
		padding: 0;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		overflow: hidden;
	}

	.game-row {
		display: grid;
		grid-template-columns: 1fr auto;
		grid-template-rows: auto auto;
		gap: 0.25rem 1rem;
		padding: 1rem 1.1rem;
		text-decoration: none;
		color: inherit;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		transition: background 0.15s;
	}

	.game-list li:last-child .game-row {
		border-bottom: none;
	}

	.game-row:hover {
		background: rgba(255, 255, 255, 0.03);
	}

	.game-title {
		font-family: 'Syne', sans-serif;
		font-size: 1rem;
		font-weight: 700;
		color: #fff;
		grid-column: 1;
	}

	.game-desc {
		font-size: 0.72rem;
		color: rgba(255, 255, 255, 0.4);
		line-height: 1.4;
		grid-column: 1;
	}

	.arrow {
		grid-column: 2;
		grid-row: 1 / span 2;
		align-self: center;
		color: rgba(0, 245, 255, 0.6);
		font-size: 1rem;
	}
</style>

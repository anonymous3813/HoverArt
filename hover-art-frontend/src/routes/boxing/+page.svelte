<script>
	let counter = 0;
</script>

<svelte:head>
	<title>Style Test</title>
</svelte:head>

<div class="container">
	<h1>Style Test Page</h1>

	<p>This page is for verifying whether global styles or layouts are breaking UI styles.</p>

	<button on:click={() => counter++}>Click me</button>

	<div class="card">
		<h2>Card Component</h2>
		<p>Some text inside a styled card.</p>
	</div>

	<div class="grid">
		<div class="box red">Red</div>
		<div class="box green">Green</div>
		<div class="box blue">Blue</div>
	</div>

	<input type="text" placeholder="Type something…" />

	<p class="footer-text">End of test page.</p>
</div>

<style>

	.container {
		max-width: 800px;
		margin: 40px auto;
		background: white;
		padding: 2rem;
		border-radius: 12px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	h1 {
		color: #333;
		margin-bottom: 0.5rem;
	}

	p {
		color: #555;
	}

	button {
		background: #0078ff;
		color: white;
		border: none;
		padding: 0.6rem 1.2rem;
		border-radius: 6px;
		cursor: pointer;
		font-size: 1rem;
		margin-bottom: 1rem;
	}
	button:hover {
		background: #005fcc;
	}

	.card {
		border: 1px solid #ddd;
		padding: 1rem;
		border-radius: 10px;
		margin-top: 1rem;
		background: #fafafa;
	}

	.grid {
		margin-top: 2rem;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
	}

	.box {
		border-radius: 8px;
		color: white;
		font-weight: bold;
		padding: 2rem;
		text-align: center;
	}

	.red {
		background: #e74c3c;
	}

	.green {
		background: #27ae60;
	}

	.blue {
		background: #3498db;
	}

	input {
		margin-top: 2rem;
		padding: 0.6rem;
		width: 100%;
		border: 1px solid #ccc;
		border-radius: 6px;
		font-size: 1rem;
	}

	.footer-text {
		margin-top: 2rem;
		text-align: center;
		color: #888;
		font-size: 0.9rem;
	}
</style>
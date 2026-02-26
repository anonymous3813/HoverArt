<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { setAuth, isLoggedIn } from '$lib/auth.svelte.ts';

	const BACKEND_URL = 'http://localhost:3001';

	let username = $state('');
	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	onMount(() => {
		if (isLoggedIn()) goto('/whiteboard');
	});

	async function submit() {
		error = '';
		if (!username.trim() || !email.trim() || !password) {
			error = 'Please fill in all fields.';
			return;
		}
		if (password.length < 6) {
			error = 'Password must be at least 6 characters.';
			return;
		}
		loading = true;
		try {
			const res = await fetch(`${BACKEND_URL}/auth/register`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username: username.trim(), email: email.trim(), password })
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? 'Registration failed.');
			setAuth(data.token, data.user);
			goto('/whiteboard');
		} catch (err: any) {
			error = err.message;
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>HoverArt — Create Account</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;700;800&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<main class="flex min-h-screen items-center justify-center px-4" style="font-family: 'Space Mono', monospace;">
	<div class="w-full max-w-sm">
		<div class="mb-8 text-center">
			<h1
				class="m-0 text-4xl font-extrabold tracking-tight text-white"
				style="font-family: 'Syne', sans-serif;"
			>
				Hover<span class="text-[#00f5ff]">Art</span>
			</h1>
			<p class="mt-2 text-xs tracking-widest text-white/30 uppercase">Create your account</p>
		</div>

		<div class="rounded-2xl border border-white/10 bg-[#111118] p-7">
			<form onsubmit={(e) => { e.preventDefault(); submit(); }} class="flex flex-col gap-4">
				<div class="flex flex-col gap-1.5">
					<label class="text-[0.65rem] tracking-widest text-white/25 uppercase">Username</label>
					<input
						type="text"
						placeholder="yourname"
						bind:value={username}
						autocomplete="username"
						class="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/30 transition-colors"
					/>
				</div>

				<div class="flex flex-col gap-1.5">
					<label class="text-[0.65rem] tracking-widest text-white/25 uppercase">Email</label>
					<input
						type="email"
						placeholder="you@example.com"
						bind:value={email}
						autocomplete="email"
						class="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/30 transition-colors"
					/>
				</div>

				<div class="flex flex-col gap-1.5">
					<label class="text-[0.65rem] tracking-widest text-white/25 uppercase">Password</label>
					<input
						type="password"
						placeholder="min. 6 characters"
						bind:value={password}
						autocomplete="new-password"
						class="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/30 transition-colors"
					/>
				</div>

				{#if error}
					<p class="text-xs text-red-400">{error}</p>
				{/if}

				<button
					type="submit"
					disabled={loading}
					class="mt-1 cursor-pointer rounded-lg border border-[#00f5ff]/30 bg-[#00f5ff]/10 py-2.5 text-sm font-bold text-[#00f5ff] transition-colors hover:border-[#00f5ff]/60 hover:bg-[#00f5ff]/20 disabled:opacity-40"
				>
					{loading ? 'Creating account…' : 'Create Account'}
				</button>
			</form>
		</div>

		<p class="mt-5 text-center text-xs text-white/30">
			Already have an account?
			<a href="/login" class="text-[#00f5ff] hover:underline">Sign in</a>
		</p>
	</div>
</main>

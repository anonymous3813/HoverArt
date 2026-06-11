<script lang="ts">
	export let show = false;
	export let shareEmail = '';
	export let shareMessage = '';
	export let shareStatus: 'idle' | 'sending' | 'sent' | 'error' = 'idle';
	export let shareError = '';
	export let onClose: () => void = () => {};
	export let onSendEmail: () => Promise<void> = async () => {};
</script>

{#if show}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[4px]"
		role="dialog" aria-modal="true"
		onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
		<div class="w-[420px] max-w-[calc(100vw-2rem)] bg-[#0d0d1a] border border-white/10 rounded-2xl">
			<div class="flex items-start justify-between px-5 pt-5 pb-4 border-b border-white/[0.07]">
				<div>
					<h2 class="m-0 text-[15px] font-bold text-white/90" style="font-family:'Syne',sans-serif;">Share via email</h2>
					<p class="m-0 mt-0.5 text-[11px] text-white/30">Your canvas will be sent as an image</p>
				</div>
				<button class="w-7 h-7 flex items-center justify-center rounded-lg border border-white/10
				               bg-white/5 text-xs text-white/30 hover:text-white/70 cursor-pointer transition-colors"
					onclick={onClose}>✕</button>
			</div>
			<div class="px-5 py-4 flex flex-col gap-3">
				<div class="flex flex-col gap-1.5">
					<label class="text-[9px] tracking-[0.1em] text-white/25 uppercase">Recipient</label>
					<input type="email" class="px-3 py-2 rounded-lg border border-white/10 bg-white/[0.04] text-[13px]
					       text-white/80 outline-none focus:border-[#00f5ff]/30 transition-colors placeholder:text-white/20"
						style="font-family:'Space Mono',monospace;"
						placeholder="friend@example.com" bind:value={shareEmail} />
				</div>
				<div class="flex flex-col gap-1.5">
					<label class="text-[9px] tracking-[0.1em] text-white/25 uppercase">Message (optional)</label>
					<textarea class="px-3 py-2 rounded-lg border border-white/10 bg-white/[0.04] text-[13px]
					          text-white/80 outline-none focus:border-[#00f5ff]/30 transition-colors
					          placeholder:text-white/20 resize-none"
						style="font-family:'Space Mono',monospace;" rows="3"
						placeholder="Check out what I made!" bind:value={shareMessage}></textarea>
				</div>
				{#if shareStatus === 'error'}<p class="text-[11px] text-red-400/80 m-0">{shareError}</p>{/if}
				{#if shareStatus === 'sent'}<p class="text-[11px] text-green-400 m-0">✓ Email sent!</p>{/if}
			</div>
			<div class="flex justify-end gap-2 px-5 pb-5">
				<button class="px-4 py-2 rounded-lg border border-white/10 bg-white/[0.04] text-xs text-white/40
				               hover:bg-white/[0.07] disabled:opacity-40 cursor-pointer transition-colors"
					style="font-family:'Space Mono',monospace;"
					onclick={onClose} disabled={shareStatus === 'sending'}>Cancel</button>
				<button class="px-4 py-2 rounded-lg border border-[#00f5ff]/20 bg-[#00f5ff]/5 text-xs
				               text-[#00f5ff]/80 hover:bg-[#00f5ff]/10 disabled:opacity-40 cursor-pointer transition-colors"
					style="font-family:'Space Mono',monospace;" onclick={onSendEmail}
					disabled={shareStatus === 'sending' || shareStatus === 'sent' || !shareEmail.trim()}>
					{shareStatus === 'sending' ? 'Sending…' : 'Send ✉'}</button>
			</div>
		</div>
	</div>
{/if}

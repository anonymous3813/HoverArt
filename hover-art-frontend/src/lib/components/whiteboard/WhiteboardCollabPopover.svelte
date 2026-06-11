<script lang="ts">
	export let show = false;
	export let room: any;
	export let copied = false;
	export let onClose: () => void = () => {};
	export let onCopyCode: () => Promise<void> = async () => {};
</script>

{#if show}
	<div class="fixed top-14 right-3 z-40 w-[260px] bg-[#0d0d1a] border border-white/10
	            rounded-xl shadow-2xl shadow-black/60">
		<div class="flex items-center justify-between px-4 py-3 border-b border-white/10">
			<span class="text-[13px] font-bold text-white/80" style="font-family:'Syne',sans-serif;">Collaborate</span>
			<button class="w-6 h-6 flex items-center justify-center rounded text-xs text-white/30
			               hover:bg-white/5 hover:text-white/60 cursor-pointer transition-colors"
				onclick={onClose}>✕</button>
		</div>
		<div class="p-4 flex flex-col gap-2.5">
			{#if !room.isInRoom}
				<button class="px-3.5 py-2 rounded-lg border border-[#00f5ff]/20 bg-[#00f5ff]/5 text-xs
				               text-[#00f5ff]/80 hover:bg-[#00f5ff]/10 transition-colors cursor-pointer"
					style="font-family:'Space Mono',monospace;" onclick={room.createRoom}>Create room</button>
				<div class="flex gap-1.5">
					<input class="flex-1 px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.04]
					              text-xs text-white/80 outline-none focus:border-[#00f5ff]/30 placeholder:text-white/20"
						style="font-family:'Space Mono',monospace;"
						placeholder="Room code" bind:value={room.joinInput}
						onkeydown={(e) => e.key === 'Enter' && room.joinRoom()} />
					<button class="px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-xs
					               text-white/50 hover:bg-white/[0.07] transition-colors cursor-pointer"
						style="font-family:'Space Mono',monospace;" onclick={room.joinRoom}>Join</button>
				</div>
				{#if room.roomError}<p class="text-[11px] text-red-400/80 m-0">{room.roomError}</p>{/if}
			{:else}
				<div class="flex items-center gap-2 text-xs text-green-400">
					<span class="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0"></span>
					{room.peerCount} {room.peerCount === 1 ? 'person' : 'people'} in room
				</div>
				<div class="flex items-center gap-2">
					<span class="flex-1 px-2.5 py-1.5 bg-white/[0.04] border border-white/10 rounded-lg
					             text-sm font-bold tracking-[0.15em] text-white/80">{room.roomCode}</span>
					<button class="px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-xs
					               hover:bg-white/[0.07] transition-colors cursor-pointer
					               {copied ? 'text-green-400' : 'text-white/50'}"
						style="font-family:'Space Mono',monospace;" onclick={onCopyCode}>
						{copied ? '✓ Copied' : 'Copy'}</button>
				</div>
				<button class="px-3.5 py-2 rounded-lg border border-red-500/20 bg-red-500/5 text-xs
				               text-red-400/80 hover:bg-red-500/10 transition-colors cursor-pointer"
					style="font-family:'Space Mono',monospace;" onclick={room.leaveRoom}>Leave room</button>
			{/if}
		</div>
	</div>
{/if}

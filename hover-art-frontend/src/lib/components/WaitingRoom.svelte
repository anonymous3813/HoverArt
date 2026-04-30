<script lang="ts">import { createEventDispatcher } from 'svelte';
import { gameSocket } from '$lib/services/gameSocket';
const dispatch = createEventDispatcher();
export let roomCode: string;
export let players: any[] = [];
export let isHost: boolean = false;
export let gameType: 'flappy' | 'breakout';
let isReady = false;
let copied = false;
function toggleReady() {
    isReady = !isReady;
    gameSocket.setReady(isReady);
}
function copyRoomCode() {
    navigator.clipboard.writeText(roomCode);
    copied = true;
    setTimeout(() => copied = false, 2000);
}
function leaveRoom() {
    gameSocket.leaveRoom();
    dispatch('leave');
}
</script>

<div class="waiting-room">
  <div class="room-header">
    <h2>Waiting Room</h2>
    <button class="leave-btn" on:click={leaveRoom}>Leave</button>
  </div>
  
  <div class="room-code-display">
    <div class="code-label">Room Code</div>
    <div class="code-value">{roomCode}</div>
    <button class="copy-btn" on:click={copyRoomCode}>
      {copied ? '✓ Copied!' : '📋 Copy'}
    </button>
  </div>
  
  <div class="room-info">
    <p>Share this code with your friend to play together!</p>
    <p class="player-count">Players: {players.length}/2</p>
  </div>
  
  <div class="players-list">
    {#each players as player}
      <div class="player-card" class:ready={player.ready}>
        <div class="player-icon">
          {player.id === gameSocket.playerId ? '👤' : '👥'}
        </div>
        <div class="player-info">
          <div class="player-name">
            {player.name}
            {#if player.id === gameSocket.playerId}
              <span class="you-badge">You</span>
            {/if}
          </div>
          <div class="player-status">
            {#if player.ready}
              <span class="status-ready">✓ Ready</span>
            {:else}
              <span class="status-waiting">Waiting...</span>
            {/if}
          </div>
        </div>
      </div>
    {/each}
    
    {#if players.length < 2}
      <div class="player-card empty">
        <div class="player-icon">⏳</div>
        <div class="player-info">
          <div class="player-name">Waiting for player...</div>
        </div>
      </div>
    {/if}
  </div>
  
  <div class="ready-section">
    <button 
      class="ready-btn" 
      class:active={isReady}
      on:click={toggleReady}
      disabled={players.length < 2}
    >
      {isReady ? '✓ Ready!' : 'Ready to Play'}
    </button>
    
    {#if players.length < 2}
      <p class="wait-message">Waiting for another player to join...</p>
    {:else if !players.every(p => p.ready)}
      <p class="wait-message">Waiting for all players to be ready...</p>
    {/if}
  </div>
  
  <div class="game-info">
    <h3>Game: {gameType === 'flappy' ? 'Flappy Mouth' : 'Face Breakout'}</h3>
    <p>
      {#if gameType === 'flappy'}
        Race to see who can get the highest score! Open your mouth to flap.
      {:else}
        Compete to break all the blocks first! Move your head to control the paddle.
      {/if}
    </p>
  </div>
</div>

<style>
  .waiting-room {
    position: fixed;
    inset: 0;
    background: #070710;
    padding: 2rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    z-index: 100;
  }

  .room-header {
    width: 100%;
    max-width: 600px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  .room-header h2 {
    font-family: 'Syne', sans-serif;
    font-size: 2rem;
    font-weight: 900;
    color: white;
  }

  .leave-btn {
    padding: 0.5rem 1rem;
    background: transparent;
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 6px;
    color: rgba(255,255,255,0.6);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .leave-btn:hover {
    border-color: #ff4e4e;
    color: #ff4e4e;
  }

  .room-code-display {
    width: 100%;
    max-width: 600px;
    background: rgba(0,245,255,0.05);
    border: 2px solid rgba(0,245,255,0.3);
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .code-label {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(255,255,255,0.5);
  }

  .code-value {
    font-family: 'Syne', sans-serif;
    font-size: 3rem;
    font-weight: 900;
    color: #00f5ff;
    letter-spacing: 0.3em;
  }

  .copy-btn {
    padding: 0.5rem 1.5rem;
    background: rgba(0,245,255,0.1);
    border: 1px solid rgba(0,245,255,0.3);
    border-radius: 6px;
    color: #00f5ff;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .copy-btn:hover {
    background: rgba(0,245,255,0.2);
    border-color: rgba(0,245,255,0.6);
  }

  .room-info {
    width: 100%;
    max-width: 600px;
    text-align: center;
    margin-bottom: 2rem;
  }

  .room-info p {
    color: rgba(255,255,255,0.5);
    font-size: 0.9rem;
    margin-bottom: 0.5rem;
  }

  .player-count {
    font-weight: 700;
    color: #00f5ff !important;
  }

  .players-list {
    width: 100%;
    max-width: 600px;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .player-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    padding: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    transition: all 0.3s;
  }

  .player-card.ready {
    border-color: rgba(52,211,153,0.5);
    background: rgba(52,211,153,0.05);
  }

  .player-card.empty {
    opacity: 0.4;
  }

  .player-icon {
    font-size: 2.5rem;
  }

  .player-info {
    flex: 1;
  }

  .player-name {
    font-size: 1.1rem;
    font-weight: 700;
    color: white;
    margin-bottom: 0.25rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .you-badge {
    padding: 0.15rem 0.5rem;
    background: rgba(0,245,255,0.2);
    border: 1px solid rgba(0,245,255,0.4);
    border-radius: 10px;
    font-size: 0.7rem;
    color: #00f5ff;
  }

  .player-status {
    font-size: 0.85rem;
  }

  .status-ready {
    color: #34d399;
    font-weight: 600;
  }

  .status-waiting {
    color: rgba(255,255,255,0.4);
  }

  .ready-section {
    width: 100%;
    max-width: 600px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .ready-btn {
    width: 100%;
    padding: 1.25rem 2rem;
    background: rgba(0,245,255,0.1);
    border: 2px solid rgba(0,245,255,0.3);
    border-radius: 12px;
    color: #00f5ff;
    font-family: 'Space Mono', monospace;
    font-size: 1.1rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.3s;
  }

  .ready-btn:hover:not(:disabled) {
    background: rgba(0,245,255,0.2);
    border-color: rgba(0,245,255,0.6);
    transform: translateY(-2px);
  }

  .ready-btn.active {
    background: rgba(52,211,153,0.2);
    border-color: rgba(52,211,153,0.6);
    color: #34d399;
  }

  .ready-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .wait-message {
    text-align: center;
    color: rgba(255,255,255,0.5);
    font-size: 0.85rem;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }

  .game-info {
    width: 100%;
    max-width: 600px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    padding: 1.5rem;
  }

  .game-info h3 {
    font-family: 'Syne', sans-serif;
    font-size: 1.2rem;
    font-weight: 800;
    color: white;
    margin-bottom: 0.5rem;
  }

  .game-info p {
    color: rgba(255,255,255,0.6);
    font-size: 0.9rem;
    line-height: 1.6;
  }

  @media (max-width: 640px) {
    .waiting-room {
      padding: 1rem;
    }

    .room-header h2 {
      font-size: 1.5rem;
    }

    .code-value {
      font-size: 2rem;
    }

    .player-icon {
      font-size: 2rem;
    }
  }
</style>

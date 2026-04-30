<script lang="ts">import { createEventDispatcher } from 'svelte';
import { gameSocket } from '$lib/services/gameSocket';
const dispatch = createEventDispatcher();
export let gameType: 'flappy' | 'breakout';
let mode: 'menu' | 'create' | 'join' = 'menu';
let playerName = '';
let roomCode = '';
let loading = false;
let error = '';
async function handleCreateRoom() {
    if (!playerName.trim()) {
        error = 'Please enter your name';
        return;
    }
    loading = true;
    error = '';
    try {
        const { code, playerId } = await gameSocket.createRoom(gameType, playerName);
        dispatch('roomCreated', { code, playerId, playerName });
    }
    catch (err: any) {
        error = err.message || 'Failed to create room';
    }
    finally {
        loading = false;
    }
}
async function handleJoinRoom() {
    if (!playerName.trim()) {
        error = 'Please enter your name';
        return;
    }
    if (!roomCode.trim()) {
        error = 'Please enter room code';
        return;
    }
    loading = true;
    error = '';
    try {
        const data = await gameSocket.joinRoom(roomCode.toUpperCase(), playerName);
        dispatch('roomJoined', { ...data, playerName });
    }
    catch (err: any) {
        error = err.message || 'Failed to join room';
    }
    finally {
        loading = false;
    }
}
function handlePlaySolo() {
    dispatch('playSolo');
}
</script>

<div class="lobby-container">
  <div class="lobby-card">
    {#if mode === 'menu'}
      <div class="lobby-header">
        <h2>{gameType === 'flappy' ? 'Flappy Mouth' : 'Face Breakout'}</h2>
        <p>Choose your game mode</p>
      </div>
      
      <div class="mode-buttons">
        <button class="mode-btn solo" on:click={handlePlaySolo}>
          <span class="mode-icon">👤</span>
          <span class="mode-title">Play Solo</span>
          <span class="mode-desc">Practice alone</span>
        </button>
        
        <button class="mode-btn create" on:click={() => mode = 'create'}>
          <span class="mode-icon">➕</span>
          <span class="mode-title">Create Room</span>
          <span class="mode-desc">Host a multiplayer game</span>
        </button>
        
        <button class="mode-btn join" on:click={() => mode = 'join'}>
          <span class="mode-icon">🔗</span>
          <span class="mode-title">Join Room</span>
          <span class="mode-desc">Join a friend's game</span>
        </button>
      </div>
    {:else if mode === 'create'}
      <div class="lobby-header">
        <button class="back-btn" on:click={() => mode = 'menu'}>← Back</button>
        <h2>Create Room</h2>
        <p>Enter your name to create a room</p>
      </div>
      
      <div class="form-container">
        <div class="input-group">
          <label for="playerName">Your Name</label>
          <input
            id="playerName"
            type="text"
            bind:value={playerName}
            placeholder="Enter your name"
            maxlength="20"
            on:keypress={(e) => e.key === 'Enter' && handleCreateRoom()}
          />
        </div>
        
        {#if error}
          <div class="error-message">{error}</div>
        {/if}
        
        <button 
          class="action-btn primary" 
          on:click={handleCreateRoom}
          disabled={loading}
        >
          {loading ? 'Creating...' : 'Create Room'}
        </button>
      </div>
    {:else if mode === 'join'}
      <div class="lobby-header">
        <button class="back-btn" on:click={() => mode = 'menu'}>← Back</button>
        <h2>Join Room</h2>
        <p>Enter room code to join</p>
      </div>
      
      <div class="form-container">
        <div class="input-group">
          <label for="joinName">Your Name</label>
          <input
            id="joinName"
            type="text"
            bind:value={playerName}
            placeholder="Enter your name"
            maxlength="20"
          />
        </div>
        
        <div class="input-group">
          <label for="roomCode">Room Code</label>
          <input
            id="roomCode"
            type="text"
            bind:value={roomCode}
            placeholder="Enter 6-digit code"
            maxlength="6"
            style="text-transform: uppercase;"
            on:keypress={(e) => e.key === 'Enter' && handleJoinRoom()}
          />
        </div>
        
        {#if error}
          <div class="error-message">{error}</div>
        {/if}
        
        <button 
          class="action-btn primary" 
          on:click={handleJoinRoom}
          disabled={loading}
        >
          {loading ? 'Joining...' : 'Join Room'}
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .lobby-container {
    position: fixed;
    inset: 0;
    background: #070710;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    z-index: 100;
  }

  .lobby-card {
    width: 100%;
    max-width: 500px;
    background: rgba(13,13,26,0.95);
    border: 1px solid rgba(0,245,255,0.3);
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  }

  .lobby-header {
    text-align: center;
    margin-bottom: 2rem;
    position: relative;
  }

  .back-btn {
    position: absolute;
    left: 0;
    top: 0;
    background: transparent;
    border: none;
    color: rgba(255,255,255,0.5);
    font-size: 0.9rem;
    cursor: pointer;
    transition: color 0.2s;
  }

  .back-btn:hover {
    color: #00f5ff;
  }

  .lobby-header h2 {
    font-family: 'Syne', sans-serif;
    font-size: 2rem;
    font-weight: 900;
    color: white;
    margin-bottom: 0.5rem;
  }

  .lobby-header p {
    font-size: 0.9rem;
    color: rgba(255,255,255,0.5);
  }

  .mode-buttons {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .mode-btn {
    padding: 1.5rem;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    text-align: center;
  }

  .mode-btn:hover {
    transform: translateY(-2px);
    border-color: rgba(0,245,255,0.5);
    background: rgba(0,245,255,0.05);
  }

  .mode-btn.create:hover {
    border-color: rgba(52,211,153,0.5);
    background: rgba(52,211,153,0.05);
  }

  .mode-btn.join:hover {
    border-color: rgba(167,139,250,0.5);
    background: rgba(167,139,250,0.05);
  }

  .mode-icon {
    font-size: 2.5rem;
  }

  .mode-title {
    font-family: 'Syne', sans-serif;
    font-size: 1.2rem;
    font-weight: 800;
    color: white;
  }

  .mode-desc {
    font-size: 0.8rem;
    color: rgba(255,255,255,0.5);
  }

  .form-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .input-group label {
    font-size: 0.85rem;
    font-weight: 700;
    color: rgba(255,255,255,0.7);
  }

  .input-group input {
    padding: 0.75rem 1rem;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 6px;
    color: white;
    font-family: 'Space Mono', monospace;
    font-size: 0.95rem;
    transition: border-color 0.2s;
  }

  .input-group input:focus {
    outline: none;
    border-color: #00f5ff;
  }

  .error-message {
    padding: 0.75rem;
    background: rgba(255,78,78,0.1);
    border: 1px solid rgba(255,78,78,0.3);
    border-radius: 6px;
    color: #ff4e4e;
    font-size: 0.85rem;
    text-align: center;
  }

  .action-btn {
    padding: 1rem 2rem;
    border: none;
    border-radius: 6px;
    font-family: 'Space Mono', monospace;
    font-size: 0.9rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-btn.primary {
    background: #00f5ff;
    color: #070710;
    box-shadow: 0 0 30px rgba(0,245,255,0.3);
  }

  .action-btn.primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 0 40px rgba(0,245,255,0.5);
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 640px) {
    .lobby-card {
      padding: 1.5rem;
    }

    .lobby-header h2 {
      font-size: 1.5rem;
    }

    .mode-icon {
      font-size: 2rem;
    }
  }
</style>

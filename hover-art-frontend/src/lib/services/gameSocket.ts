import { io } from 'socket.io-client';
import { getBackendUrl } from '$lib/backendUrl';
class GameSocketService {
    constructor() {
        this.socket = null;
        this.roomCode = null;
        this.playerId = null;
        this.gameType = null;
    }
    connect() {
        if (this.socket?.connected)
            return this.socket;
        const backendUrl = getBackendUrl();
        this.socket = io(backendUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });
        return this.socket;
    }
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.roomCode = null;
            this.playerId = null;
        }
    }
    createRoom(gameType, playerName) {
        return new Promise((resolve, reject) => {
            if (!this.socket)
                this.connect();
            this.gameType = gameType;
            this.socket.emit('create-game-room', { gameType, playerName });
            this.socket.once('game-room-created', ({ code, playerId }) => {
                this.roomCode = code;
                this.playerId = playerId;
                resolve({ code, playerId });
            });
            this.socket.once('game-room-error', ({ message }) => {
                reject(new Error(message));
            });
        });
    }
    joinRoom(code, playerName) {
        return new Promise((resolve, reject) => {
            if (!this.socket)
                this.connect();
            this.socket.emit('join-game-room', { code, playerName });
            this.socket.once('game-room-joined', ({ code, playerId, gameType, gameState }) => {
                this.roomCode = code;
                this.playerId = playerId;
                this.gameType = gameType;
                resolve({ code, playerId, gameType, gameState });
            });
            this.socket.once('game-room-error', ({ message }) => {
                reject(new Error(message));
            });
        });
    }
    setReady(ready) {
        if (this.socket && this.roomCode) {
            this.socket.emit('player-ready', { ready });
        }
    }
    sendPlayerAction(action, data) {
        if (this.socket && this.roomCode) {
            this.socket.emit('player-action', { action, data });
        }
    }
    sendBirdPosition(y, velocity, score) {
        if (this.socket && this.roomCode) {
            this.socket.emit('flappy-bird-position', { y, velocity, score });
        }
    }
    sendBreakoutPosition(paddleX, ballX, ballY, score, blocks) {
        if (this.socket && this.roomCode) {
            this.socket.emit('breakout-position', { paddleX, ballX, ballY, score, blocks });
        }
    }
    sendBreakoutPongPaddle(nx: number) {
        if (this.socket && this.roomCode) {
            this.socket.emit('breakout-pong-paddle', { nx });
        }
    }
    sendBreakoutPongState(payload: unknown) {
        if (this.socket && this.roomCode) {
            this.socket.emit('breakout-pong-state', payload);
        }
    }
    sendFlappyJump() {
        if (this.socket && this.roomCode) {
            this.socket.emit('flappy-jump-sync', {});
        }
    }
    leaveRoom() {
        if (this.socket && this.roomCode) {
            this.socket.emit('leave-game-room');
            this.roomCode = null;
            this.playerId = null;
            this.gameType = null;
        }
    }
    onPlayersUpdate(callback) {
        if (this.socket) {
            this.socket.on('players-update', callback);
        }
    }
    onGameStart(callback) {
        if (this.socket) {
            this.socket.on('game-start', callback);
        }
    }
    onGameStateUpdate(callback) {
        if (this.socket) {
            this.socket.on('game-state-update', callback);
        }
    }
    onPeerAction(callback) {
        if (this.socket) {
            this.socket.on('peer-action', callback);
        }
    }
    onPeerBirdPosition(callback) {
        if (this.socket) {
            this.socket.on('peer-bird-position', callback);
        }
    }
    onFlappyJumpSync(callback: () => void) {
        if (this.socket) {
            this.socket.on('flappy-jump-sync', callback);
        }
    }
    onBreakoutPongPeerPaddle(callback: (data: {
        idx: number;
        nx: number;
    }) => void) {
        if (this.socket) {
            this.socket.on('breakout-pong-peer-paddle', callback);
        }
    }
    onBreakoutPongStateSync(callback: (payload: unknown) => void) {
        if (this.socket) {
            this.socket.on('breakout-pong-state-sync', callback);
        }
    }
    offBreakoutPongHandlers(onPeer?: (data: {
        idx: number;
        nx: number;
    }) => void, onSync?: (payload: unknown) => void) {
        if (!this.socket)
            return;
        if (onPeer)
            this.socket.off('breakout-pong-peer-paddle', onPeer);
        if (onSync)
            this.socket.off('breakout-pong-state-sync', onSync);
    }
    offFlappyMpHandlers(onJump?: () => void, onBird?: (data: unknown) => void) {
        if (!this.socket)
            return;
        if (onJump)
            this.socket.off('flappy-jump-sync', onJump);
        if (onBird)
            this.socket.off('peer-bird-position', onBird as any);
    }
    onPeerBreakoutPosition(callback) {
        if (this.socket) {
            this.socket.on('peer-breakout-position', callback);
        }
    }
    onPlayerLeft(callback) {
        if (this.socket) {
            this.socket.on('player-left', callback);
        }
    }
    onGameOver(callback) {
        if (this.socket) {
            this.socket.on('game-over', callback);
        }
    }
    offAll() {
        if (this.socket) {
            this.socket.off('players-update');
            this.socket.off('game-start');
            this.socket.off('game-state-update');
            this.socket.off('peer-action');
            this.socket.off('peer-bird-position');
            this.socket.off('peer-breakout-position');
            this.socket.off('breakout-pong-peer-paddle');
            this.socket.off('breakout-pong-state-sync');
            this.socket.off('flappy-jump-sync');
            this.socket.off('player-left');
            this.socket.off('game-over');
        }
    }
}
export const gameSocket = new GameSocketService();

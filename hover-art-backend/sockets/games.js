import { createGameRoom, getGameRoom, deleteGameRoom, updateGameState, addPlayer } from '../services/roomService.js';
export function registerGameHandlers(io, socket) {
    let currentRoom = null;
    let playerId = null;
    function getRoomSize(code) {
        return io.sockets.adapter.rooms.get(code)?.size ?? 0;
    }
    socket.on('create-game-room', ({ gameType, playerName }) => {
        const code = createGameRoom(gameType);
        currentRoom = code;
        playerId = socket.id;
        const room = getGameRoom(code);
        addPlayer(code, {
            id: socket.id,
            name: playerName || 'Player 1',
            score: 0,
            ready: false
        });
        socket.join(code);
        socket.emit('game-room-created', {
            code,
            gameType,
            playerId: socket.id
        });
        io.to(code).emit('players-update', { players: room.players });
    });
    socket.on('join-game-room', ({ code, playerName }) => {
        const normalized = code.toUpperCase().trim();
        const room = getGameRoom(normalized);
        if (!room) {
            socket.emit('game-room-error', { message: 'Room not found. Check the code and try again.' });
            return;
        }
        if (room.players.length >= 2) {
            socket.emit('game-room-error', { message: 'Room is full. Maximum 2 players.' });
            return;
        }
        currentRoom = normalized;
        playerId = socket.id;
        addPlayer(currentRoom, {
            id: socket.id,
            name: playerName || `Player ${room.players.length + 1}`,
            score: 0,
            ready: false
        });
        socket.join(currentRoom);
        socket.emit('game-room-joined', {
            code: currentRoom,
            gameType: room.gameType,
            playerId: socket.id,
            gameState: room.gameState
        });
        io.to(currentRoom).emit('players-update', { players: room.players });
    });
    socket.on('player-ready', ({ ready }) => {
        if (!currentRoom)
            return;
        const room = getGameRoom(currentRoom);
        if (!room)
            return;
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
            player.ready = ready;
            io.to(currentRoom).emit('players-update', { players: room.players });
            const allReady = room.players.length === 2 && room.players.every(p => p.ready);
            if (allReady && !room.gameState.started) {
                room.gameState.started = true;
                room.gameState.startTime = Date.now();
                io.to(currentRoom).emit('game-start', { gameState: room.gameState });
            }
        }
    });
    socket.on('update-game-state', ({ gameState }) => {
        if (!currentRoom)
            return;
        updateGameState(currentRoom, gameState);
        socket.to(currentRoom).emit('game-state-update', { gameState });
    });
    socket.on('player-action', ({ action, data }) => {
        if (!currentRoom)
            return;
        const room = getGameRoom(currentRoom);
        if (!room)
            return;
        const player = room.players.find(p => p.id === socket.id);
        if (player && data.score !== undefined) {
            player.score = data.score;
        }
        socket.to(currentRoom).emit('peer-action', {
            playerId: socket.id,
            action,
            data
        });
        if (data.gameOver) {
            room.gameState.gameOver = true;
            room.gameState.winner = socket.id;
            io.to(currentRoom).emit('game-over', {
                winner: socket.id,
                players: room.players
            });
        }
    });
    socket.on('flappy-bird-position', ({ y, velocity, score }) => {
        if (!currentRoom)
            return;
        const room = getGameRoom(currentRoom);
        if (!room)
            return;
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
            player.score = score;
            player.position = { y, velocity };
        }
        socket.to(currentRoom).emit('peer-bird-position', {
            playerId: socket.id,
            y,
            velocity,
            score
        });
    });
    socket.on('flappy-jump-sync', () => {
        if (!currentRoom)
            return;
        const room = getGameRoom(currentRoom);
        if (!room || room.gameType !== 'flappy')
            return;
        socket.to(currentRoom).emit('flappy-jump-sync', {});
    });
    socket.on('breakout-pong-paddle', ({ nx }) => {
        if (currentRoom == null || typeof nx !== 'number')
            return;
        const room = getGameRoom(currentRoom);
        if (!room || room.gameType !== 'breakout')
            return;
        const idx = room.players.findIndex((p) => p.id === socket.id);
        if (idx < 0 || idx > 1)
            return;
        socket.to(currentRoom).emit('breakout-pong-peer-paddle', { idx, nx });
    });
    socket.on('breakout-pong-state', (payload) => {
        if (currentRoom == null || !payload)
            return;
        const room = getGameRoom(currentRoom);
        if (!room || room.gameType !== 'breakout')
            return;
        const hostId = room.players[0]?.id;
        if (hostId !== socket.id)
            return;
        socket.to(currentRoom).emit('breakout-pong-state-sync', payload);
    });
    socket.on('breakout-position', ({ paddleX, ballX, ballY, score, blocks }) => {
        if (!currentRoom)
            return;
        const room = getGameRoom(currentRoom);
        if (!room)
            return;
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
            player.score = score;
            player.position = { paddleX, ballX, ballY };
        }
        socket.to(currentRoom).emit('peer-breakout-position', {
            playerId: socket.id,
            paddleX,
            ballX,
            ballY,
            score,
            blocks
        });
    });
    socket.on('leave-game-room', () => {
        if (!currentRoom)
            return;
        socket.leave(currentRoom);
        const room = getGameRoom(currentRoom);
        if (room) {
            room.players = room.players.filter(p => p.id !== socket.id);
            if (room.players.length === 0) {
                deleteGameRoom(currentRoom);
            }
            else {
                io.to(currentRoom).emit('players-update', { players: room.players });
                io.to(currentRoom).emit('player-left', { playerId: socket.id });
            }
        }
        currentRoom = null;
        playerId = null;
        socket.emit('game-room-left');
    });
    socket.on('disconnect', () => {
        if (!currentRoom)
            return;
        const room = getGameRoom(currentRoom);
        if (room) {
            room.players = room.players.filter(p => p.id !== socket.id);
            if (room.players.length === 0) {
                deleteGameRoom(currentRoom);
            }
            else {
                io.to(currentRoom).emit('players-update', { players: room.players });
                io.to(currentRoom).emit('player-left', { playerId: socket.id });
            }
        }
    });
}

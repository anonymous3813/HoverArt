const rooms = new Map();
const gameRooms = new Map();
export function generateCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}
export function createRoom() {
    let code;
    do {
        code = generateCode();
    } while (rooms.has(code));
    rooms.set(code, { strokes: [] });
    return code;
}
export function getRoom(code) {
    return rooms.get(code);
}
export function deleteRoom(code) {
    rooms.delete(code);
}
export function addStroke(code, stroke) {
    const room = rooms.get(code);
    if (room)
        room.strokes.push(stroke);
}
export function clearStrokes(code) {
    const room = rooms.get(code);
    if (room)
        room.strokes = [];
}
export function createGameRoom(gameType) {
    let code;
    do {
        code = generateCode();
    } while (gameRooms.has(code));
    gameRooms.set(code, {
        gameType,
        players: [],
        gameState: {
            started: false,
            paused: false,
            gameOver: false,
            startTime: null,
            winner: null
        },
        createdAt: Date.now()
    });
    return code;
}
export function getGameRoom(code) {
    return gameRooms.get(code);
}
export function deleteGameRoom(code) {
    gameRooms.delete(code);
}
export function addPlayer(code, player) {
    const room = gameRooms.get(code);
    if (room && room.players.length < 2) {
        room.players.push(player);
    }
}
export function updateGameState(code, newState) {
    const room = gameRooms.get(code);
    if (room) {
        room.gameState = { ...room.gameState, ...newState };
    }
}
setInterval(() => {
    const now = Date.now();
    for (const [code, room] of gameRooms.entries()) {
        if (now - room.createdAt > 3600000) {
            deleteGameRoom(code);
        }
    }
}, 300000);

import { createRoom, getRoom, deleteRoom, addStroke, clearStrokes } from '../services/roomService.js';
export function registerCanvasHandlers(io, socket) {
    let currentRoom = null;
    function getRoomSize(code) {
        return io.sockets.adapter.rooms.get(code)?.size ?? 0;
    }
    socket.on('create-room', () => {
        const code = createRoom();
        currentRoom = code;
        socket.join(code);
        socket.emit('room-created', { code });
        io.to(code).emit('peer-count', { count: getRoomSize(code) });
    });
    socket.on('join-room', ({ code }) => {
        const normalized = code.toUpperCase().trim();
        const room = getRoom(normalized);
        if (!room) {
            socket.emit('room-error', { message: 'Room not found. Check the code and try again.' });
            return;
        }
        currentRoom = normalized;
        socket.join(currentRoom);
        socket.emit('room-joined', { strokes: room.strokes, code: currentRoom });
        io.to(currentRoom).emit('peer-count', { count: getRoomSize(currentRoom) });
    });
    socket.on('stroke', ({ stroke }) => {
        if (!currentRoom)
            return;
        addStroke(currentRoom, stroke);
        socket.to(currentRoom).emit('peer-stroke', { stroke });
    });
    socket.on('clear-canvas', () => {
        if (!currentRoom)
            return;
        clearStrokes(currentRoom);
        socket.to(currentRoom).emit('peer-clear');
    });
    socket.on('leave-room', () => {
        if (!currentRoom)
            return;
        socket.leave(currentRoom);
        const size = getRoomSize(currentRoom);
        if (size === 0) {
            deleteRoom(currentRoom);
        }
        else {
            io.to(currentRoom).emit('peer-count', { count: size });
        }
        currentRoom = null;
        socket.emit('room-left');
    });
    socket.on('disconnect', () => {
        if (!currentRoom)
            return;
        const size = getRoomSize(currentRoom);
        if (size === 0) {
            deleteRoom(currentRoom);
        }
        else {
            io.to(currentRoom).emit('peer-count', { count: size });
        }
    });
}

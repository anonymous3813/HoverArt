import { io, type Socket } from 'socket.io-client';
import { getBackendUrl } from '$lib/backendUrl.ts';

const BACKEND_URL = getBackendUrl();

export interface RoomStore {
    socket: Socket | null;
    roomCode: string;
    isInRoom: boolean;
    peerCount: number;
    roomError: string;
}

export function createRoomStore() {
    let socket = $state<Socket | null>(null);
    let roomCode = $state('');
    let joinInput = $state('');
    let isInRoom = $state(false);
    let peerCount = $state(0);
    let roomError = $state('');

    // Callback wired up by the page to replay peer strokes onto the canvas
    let onPeerStroke: ((stroke: any) => void) | null = null;
    let onPeerClear: (() => void) | null = null;

    function init(
        strokeHandler: (stroke: any) => void,
        clearHandler: () => void,
    ) {
        onPeerStroke = strokeHandler;
        onPeerClear = clearHandler;

        socket = io(BACKEND_URL, { autoConnect: true });

        socket.on('room-created', ({ code }: { code: string }) => {
            roomCode = code;
            isInRoom = true;
            roomError = '';
        });

        socket.on('room-joined', ({ strokes, code }: { strokes: any[]; code: string }) => {
            roomCode = code;
            isInRoom = true;
            roomError = '';
            strokes.forEach((s) => onPeerStroke?.(s));
        });

        socket.on('room-error', ({ message }: { message: string }) => {
            roomError = message;
        });

        socket.on('room-left', () => {
            roomCode = '';
            isInRoom = false;
            peerCount = 0;
        });

        socket.on('peer-count', ({ count }: { count: number }) => {
            peerCount = count;
        });

        socket.on('peer-stroke', ({ stroke }: { stroke: any }) => {
            onPeerStroke?.(stroke);
        });

        socket.on('peer-clear', () => {
            onPeerClear?.();
        });
    }

    function destroy() {
        socket?.disconnect();
        socket = null;
    }

    function createRoom() {
        roomError = '';
        socket?.emit('create-room');
    }

    function joinRoom() {
        if (!joinInput.trim()) return;
        roomError = '';
        socket?.emit('join-room', { code: joinInput.trim() });
    }

    function leaveRoom() {
        socket?.emit('leave-room');
        joinInput = '';
    }

    function emitStroke(stroke: { points: { x: number; y: number }[]; color: string; width: number }) {
        if (!isInRoom || !socket) return;
        socket.emit('stroke', { stroke });
    }

    function emitClear() {
        if (!isInRoom || !socket) return;
        socket.emit('clear-canvas');
    }

    return {
        get socket() { return socket; },
        get roomCode() { return roomCode; },
        get joinInput() { return joinInput; },
        set joinInput(v: string) { joinInput = v; },
        get isInRoom() { return isInRoom; },
        get peerCount() { return peerCount; },
        get roomError() { return roomError; },
        init,
        destroy,
        createRoom,
        joinRoom,
        leaveRoom,
        emitStroke,
        emitClear,
    };
}
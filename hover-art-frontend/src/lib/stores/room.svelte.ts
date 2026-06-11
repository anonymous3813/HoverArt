import { io, type Socket } from 'socket.io-client';
import { getBackendUrl } from '$lib/backendUrl.ts';
import type { CanvasObject } from '$lib/whiteboard/types.ts';

const BACKEND_URL = getBackendUrl();

export function createRoomStore() {
	let socket = $state<Socket | null>(null);
	let roomCode = $state('');
	let joinInput = $state('');
	let isInRoom = $state(false);
	let peerCount = $state(0);
	let roomError = $state('');

	let onPeerObject: ((obj: CanvasObject) => void) | null = null;
	let onPeerRemove: ((id: string) => void) | null = null;
	let onPeerClear: (() => void) | null = null;
	let onPeerScene: ((objects: CanvasObject[]) => void) | null = null;

	function init(handlers: {
		onPeerObject: (obj: CanvasObject) => void;
		onPeerRemove: (id: string) => void;
		onPeerClear: () => void;
		/** Fired on room-joined with the full current scene from the server */
		onPeerScene: (objects: CanvasObject[]) => void;
	}) {
		onPeerObject = handlers.onPeerObject;
		onPeerRemove = handlers.onPeerRemove;
		onPeerClear = handlers.onPeerClear;
		onPeerScene = handlers.onPeerScene;

		socket = io(BACKEND_URL, { autoConnect: true });

		socket.on('room-created', ({ code }: { code: string }) => {
			roomCode = code;
			isInRoom = true;
			roomError = '';
		});

		socket.on('room-joined', ({ objects, code }: { objects: CanvasObject[]; code: string }) => {
			roomCode = code;
			isInRoom = true;
			roomError = '';
			onPeerScene?.(objects);
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

		// A peer added a single object (e.g. committed a stroke or shape)
		socket.on('peer-object', ({ object }: { object: CanvasObject }) => {
			onPeerObject?.(object);
		});

		// A peer removed an object by id (erase)
		socket.on('peer-remove', ({ id }: { id: string }) => {
			onPeerRemove?.(id);
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

	/** Broadcast a newly committed object to all peers. */
	function emitObject(obj: CanvasObject) {
		if (!isInRoom || !socket) return;
		socket.emit('object', { object: obj });
	}

	/** Broadcast an erase by object id. */
	function emitRemove(id: string) {
		if (!isInRoom || !socket) return;
		socket.emit('remove', { id });
	}

	function emitClear() {
		if (!isInRoom || !socket) return;
		socket.emit('clear-canvas');
	}

	return {
		get socket() {
			return socket;
		},
		get roomCode() {
			return roomCode;
		},
		get joinInput() {
			return joinInput;
		},
		set joinInput(v: string) {
			joinInput = v;
		},
		get isInRoom() {
			return isInRoom;
		},
		get peerCount() {
			return peerCount;
		},
		get roomError() {
			return roomError;
		},
		init,
		destroy,
		createRoom,
		joinRoom,
		leaveRoom,
		emitObject,
		emitRemove,
		emitClear
	};
}

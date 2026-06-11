import type { CanvasObject, Command, Transform } from './types.ts';
import { DEFAULT_TRANSFORM } from './types.ts';

export function createScene() {
	let objects   = $state<CanvasObject[]>([]);
	let transform = $state<Transform>({ ...DEFAULT_TRANSFORM });

	const past:   Command[] = [];
	const future: Command[] = [];

	function execute(cmd: Command) {
		cmd.do();
		past.push(cmd);
		future.length = 0;
	}

	function undo() { const cmd = past.pop();   if (cmd) { cmd.undo(); future.push(cmd); } }
	function redo() { const cmd = future.pop();  if (cmd) { cmd.do();   past.push(cmd);  } }

	// ── Undoable mutations (local user actions) ───────────────────────────────

	function addObject(obj: CanvasObject) {
		execute({
			label: `Add ${obj.kind}`,
			do:   () => { objects = [...objects, obj]; },
			undo: () => { objects = objects.filter(o => o.id !== obj.id); },
		});
	}

	function removeObject(id: string) {
		const snap = objects.find(o => o.id === id);
		if (!snap) return;
		execute({
			label: `Remove ${snap.kind}`,
			do:   () => { objects = objects.filter(o => o.id !== id); },
			undo: () => { objects = [...objects, snap]; },
		});
	}

	function removeObjects(ids: Set<string>) {
		const removed = objects.filter(o => ids.has(o.id));
		if (!removed.length) return;
		execute({
			label: 'Erase',
			do:   () => { objects = objects.filter(o => !ids.has(o.id)); },
			undo: () => { objects = [...objects, ...removed]; },
		});
	}

	function clearAll() {
		const snap = [...objects];
		execute({
			label: 'Clear',
			do:   () => { objects = []; },
			undo: () => { objects = snap; },
		});
	}

	// ── Silent mutations (peer events + page switching — skip command stack) ──
	// These bypass undo history intentionally:
	//   - Peer actions are already undone on the peer's side; applying them
	//     to the local command stack would corrupt local undo history.
	//   - Page switching replaces the whole scene; it's navigation not editing.

	function addObjectSilent(obj: CanvasObject) {
		objects = [...objects, obj];
	}

	function removeObjectSilent(id: string) {
		objects = objects.filter(o => o.id !== id);
	}

	function clearAllSilent() {
		objects = [];
	}

	/**
	 * Replace the entire scene with a new page's content.
	 * Clears the command stack so undo doesn't cross page boundaries.
	 */
	function loadPage(newObjects: CanvasObject[], newTransform: Transform) {
		objects   = [...newObjects];
		transform = { ...newTransform };
		past.length   = 0;
		future.length = 0;
	}

	// ── Transform (navigation, not undoable) ──────────────────────────────────

	function setTransform(t: Transform) { transform = t; }

	return {
		get objects()   { return objects; },
		get transform() { return transform; },
		get canUndo()   { return past.length > 0; },
		get canRedo()   { return future.length > 0; },
		// Undoable
		addObject,
		removeObject,
		removeObjects,
		clearAll,
		undo,
		redo,
		// Silent (peer + page load)
		addObjectSilent,
		removeObjectSilent,
		clearAllSilent,
		loadPage,
		// Transform
		setTransform,
	};
}

export type Scene = ReturnType<typeof createScene>;
// ─── Geometry ─────────────────────────────────────────────────────────────────

export interface Point {
	x: number;
	y: number;
}

export interface Transform {
	x: number;
	y: number;
	scale: number;
}

export const DEFAULT_TRANSFORM: Transform = { x: 0, y: 0, scale: 1 };

// ─── Canvas objects ───────────────────────────────────────────────────────────

export interface StrokeObject {
	kind: 'stroke';
	id: string;
	points: Point[];
	color: string;
	width: number;
}
export interface RectObject {
	kind: 'rect';
	id: string;
	x: number;
	y: number;
	w: number;
	h: number;
	color: string;
	strokeWidth: number;
	fill: string | null;
}
export interface LineObject {
	kind: 'line';
	id: string;
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	color: string;
	width: number;
	arrow: boolean;
}
export interface TextObject {
	kind: 'text';
	id: string;
	x: number;
	y: number;
	content: string;
	fontSize: number;
	color: string;
}

export type CanvasObject = StrokeObject | RectObject | LineObject | TextObject;

// ─── Commands ────────────────────────────────────────────────────────────────

export interface Command {
	label: string;
	do(): void;
	undo(): void;
}

// ─── Tools ───────────────────────────────────────────────────────────────────

export type Tool = 'pan' | 'select' | 'rect' | 'line' | 'arrow' | 'text' | 'draw' | 'erase';
export const TOOLS: Tool[] = ['pan', 'select', 'rect', 'line', 'arrow', 'text', 'draw', 'erase'];
export const TOOL_ICONS: Record<Tool, string> = {
	pan: '✋',
	select: '↖',
	rect: '⬜',
	line: '╱',
	arrow: '→',
	text: 'T',
	draw: '✏',
	erase: '◻'
};
export const TOOL_LABELS: Record<Tool, string> = {
	pan: 'Pan',
	select: 'Select',
	rect: 'Rectangle',
	line: 'Line',
	arrow: 'Arrow',
	text: 'Text',
	draw: 'Draw',
	erase: 'Erase'
};

// ─── Worker message protocol ──────────────────────────────────────────────────
//
// DESIGN: objects and transform are separate messages so a pan/zoom gesture
// doesn't re-serialise the entire object array on every frame.
//
// Hot-path messages (sent every camera frame):
//   transform  — pan/zoom only, ~24 bytes, no object serialisation
//   cursor     — finger position + state, ~20 bytes
//   stroke_point — single new world-space point appended to preview stroke
//
// Cold-path messages (sent once per committed action):
//   objects    — full scene replacement (add/remove/clear/page-switch/room-join)
//   preview    — set/clear the in-progress shape preview (rect/line/arrow)
//   stroke_begin / stroke_end — bracket a freehand stroke
//
// init and resize are one-time setup messages.

export type WorkerInbound =
	// ── Setup ────────────────────────────────────────────────────────────────
	| {
			type: 'init';
			canvas: OffscreenCanvas;
			landmarkBuffer: SharedArrayBuffer;
			gestureBuffer: SharedArrayBuffer;
	  }
	| { type: 'resize'; width: number; height: number }

	// ── Cold path — full scene replacement ───────────────────────────────────
	| { type: 'objects'; objects: CanvasObject[] }

	// ── Hot path — transform only (pan / zoom) ────────────────────────────────
	| { type: 'transform'; transform: Transform }

	// ── Hot path — freehand stroke preview (incremental) ─────────────────────
	| { type: 'stroke_begin'; color: string; width: number }
	| { type: 'stroke_point'; x: number; y: number } // single world-space point
	| { type: 'stroke_end' } // discard preview (commit sent via 'objects')

	// ── Hot path — shape preview (rect / line / arrow while dragging) ─────────
	| { type: 'preview'; object: CanvasObject | null }

	// ── Hot path — cursor ─────────────────────────────────────────────────────
	| { type: 'cursor'; x: number; y: number; pinching: boolean; toolbarHit: boolean };

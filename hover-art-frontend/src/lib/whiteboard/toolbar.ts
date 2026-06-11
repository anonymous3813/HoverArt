import type { Tool } from '../whiteboard/types.ts';
import { TOOLS } from '../whiteboard/types.ts';

/**
 * Toolbar hit-testing.
 *
 * The toolbar is a fixed overlay rendered in the DOM (HTML/Svelte).
 * We hit-test the fingertip screen position against each tool slot
 * to decide which tool the cursor is hovering and whether a pinch
 * should activate that tool.
 *
 * Slot layout is computed from a known anchor position + item size/gap.
 * These constants must match the actual CSS in +page.svelte.
 */

export interface ToolbarLayout {
	/** Top-left corner of the toolbar pill in screen px */
	x: number;
	y: number;
	/** Width and height of each individual tool button */
	itemW: number;
	itemH: number;
	/** Gap between items */
	gap: number;
	/** Padding inside the toolbar container */
	padX: number;
	padY: number;
}

export interface ToolbarHitResult {
	hoveredTool: Tool | null;
	/** Index into TOOLS array, or -1 */
	hoveredIndex: number;
}

/**
 * Given the fingertip position in screen space and the toolbar layout,
 * return which tool (if any) the finger is hovering.
 */
export function hitTestToolbar(
	fingerX: number,
	fingerY: number,
	layout: ToolbarLayout
): ToolbarHitResult {
	for (let i = 0; i < TOOLS.length; i++) {
		const itemX = layout.x + layout.padX + i * (layout.itemW + layout.gap);
		const itemY = layout.y + layout.padY;

		if (
			fingerX >= itemX &&
			fingerX <= itemX + layout.itemW &&
			fingerY >= itemY &&
			fingerY <= itemY + layout.itemH
		) {
			return { hoveredTool: TOOLS[i], hoveredIndex: i };
		}
	}
	return { hoveredTool: null, hoveredIndex: -1 };
}

/**
 * Reads the actual bounding rect of the toolbar DOM element at runtime.
 * Call this in onMount and on resize, cache the result, pass to hitTestToolbar.
 */
export function getToolbarLayout(el: HTMLElement): ToolbarLayout {
	const rect = el.getBoundingClientRect();
	// Each item is a 40x40 button with 4px gap, 8px pad — must match CSS
	return {
		x: rect.left,
		y: rect.top,
		itemW: 40,
		itemH: 40,
		gap: 4,
		padX: 8,
		padY: 6
	};
}

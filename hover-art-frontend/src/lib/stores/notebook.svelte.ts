import type { CanvasObject, Transform } from '$lib/whiteboard/types.ts';
import { DEFAULT_TRANSFORM } from '$lib/whiteboard/types.ts';

export interface Page {
	id: string;
	name: string;
	/** Serialized scene objects for this page */
	objects: CanvasObject[];
	/** Saved transform (pan/zoom) so each page remembers where you were */
	transform: Transform;
	/** Low-res thumbnail data URL for the sidebar preview */
	thumbnail: string;
}

export function createNotebookStore(callbacks: {
	/** Called when switching pages — load these objects + transform onto the canvas */
	onPageLoad: (objects: CanvasObject[], transform: Transform) => void;
	/** Called to snapshot the current canvas state before leaving a page */
	getSnapshot: () => { objects: CanvasObject[]; transform: Transform; thumbnail: string };
}) {
	let pages = $state<Page[]>([
		{
			id: crypto.randomUUID(),
			name: 'Page 1',
			objects: [],
			transform: { ...DEFAULT_TRANSFORM },
			thumbnail: ''
		}
	]);
	let currentPageId = $state(pages[0].id);
	let sidebarOpen = $state(false);
	let editingPageId = $state<string | null>(null);
	let editingName = $state('');

	function currentPageIndex() {
		return pages.findIndex((p) => p.id === currentPageId);
	}

	function currentPage() {
		return pages.find((p) => p.id === currentPageId);
	}

	function switchToPage(id: string) {
		if (id === currentPageId) return;

		// Snapshot current page before leaving
		const snap = callbacks.getSnapshot();
		pages = pages.map((p) =>
			p.id === currentPageId
				? { ...p, objects: snap.objects, transform: snap.transform, thumbnail: snap.thumbnail }
				: p
		);

		// Load target page
		currentPageId = id;
		const target = pages.find((p) => p.id === id)!;
		callbacks.onPageLoad(target.objects, target.transform);
	}

	function addPage() {
		const p: Page = {
			id: crypto.randomUUID(),
			name: `Page ${pages.length + 1}`,
			objects: [],
			transform: { ...DEFAULT_TRANSFORM },
			thumbnail: ''
		};
		pages = [...pages, p];
		switchToPage(p.id);
	}

	function deletePage(id: string) {
		if (pages.length === 1) return;
		const idx = pages.findIndex((p) => p.id === id);
		const next = pages[idx === 0 ? 1 : idx - 1];
		pages = pages.filter((p) => p.id !== id);
		if (id === currentPageId) switchToPage(next.id);
	}

	function commitEdit() {
		if (editingPageId && editingName.trim())
			pages = pages.map((p) => (p.id === editingPageId ? { ...p, name: editingName.trim() } : p));
		editingPageId = null;
	}

	function navigatePages(dir: 'up' | 'down') {
		const idx = currentPageIndex();
		if (dir === 'up' && idx > 0) switchToPage(pages[idx - 1].id);
		if (dir === 'down' && idx < pages.length - 1) switchToPage(pages[idx + 1].id);
	}

	return {
		get pages() {
			return pages;
		},
		get currentPageId() {
			return currentPageId;
		},
		get sidebarOpen() {
			return sidebarOpen;
		},
		set sidebarOpen(v: boolean) {
			sidebarOpen = v;
		},
		get editingPageId() {
			return editingPageId;
		},
		get editingName() {
			return editingName;
		},
		set editingName(v: string) {
			editingName = v;
		},
		currentPageIndex,
		currentPage,
		switchToPage,
		addPage,
		deletePage,
		startEditing: (page: Page) => {
			editingPageId = page.id;
			editingName = page.name;
		},
		commitEdit,
		navigatePages
	};
}

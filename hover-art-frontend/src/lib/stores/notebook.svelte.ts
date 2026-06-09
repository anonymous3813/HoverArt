export interface Page {
    id: string;
    name: string;
    snapshot: string;
}

// HandCanvas interface subset we need for page switching
export interface CanvasHandle {
    getCanvasDataUrl: () => string;
    clearCanvas: (emitToRoom?: boolean) => void;
    loadSnapshot: (dataUrl: string) => void;
}

export function createNotebookStore(getCanvas: () => CanvasHandle | null) {
    let pages = $state<Page[]>([{ id: crypto.randomUUID(), name: 'Page 1', snapshot: '' }]);
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
        const snap = getCanvas()?.getCanvasDataUrl() ?? '';
        pages = pages.map((p) => (p.id === currentPageId ? { ...p, snapshot: snap } : p));
        currentPageId = id;
        setTimeout(() => {
            const canvas = getCanvas();
            canvas?.clearCanvas(false);
            const target = pages.find((p) => p.id === id);
            if (target?.snapshot) canvas?.loadSnapshot(target.snapshot);
        }, 30);
    }

    function addPage() {
        const newPage: Page = {
            id: crypto.randomUUID(),
            name: `Page ${pages.length + 1}`,
            snapshot: '',
        };
        pages = [...pages, newPage];
        switchToPage(newPage.id);
    }

    function deletePage(id: string) {
        if (pages.length === 1) return;
        const idx = pages.findIndex((p) => p.id === id);
        const next = pages[idx === 0 ? 1 : idx - 1];
        pages = pages.filter((p) => p.id !== id);
        if (id === currentPageId) switchToPage(next.id);
    }

    function startEditing(page: Page) {
        editingPageId = page.id;
        editingName = page.name;
    }

    function cancelEditing() {
        editingPageId = null;
        editingName = '';
    }

    function commitEdit() {
        if (editingPageId && editingName.trim()) {
            pages = pages.map((p) =>
                p.id === editingPageId ? { ...p, name: editingName.trim() } : p,
            );
        }
        editingPageId = null;
    }

    function navigatePages(direction: 'up' | 'down') {
        const idx = currentPageIndex();
        if (direction === 'up' && idx > 0) switchToPage(pages[idx - 1].id);
        if (direction === 'down' && idx < pages.length - 1) switchToPage(pages[idx + 1].id);
    }

    return {
        get pages() { return pages; },
        get currentPageId() { return currentPageId; },
        get sidebarOpen() { return sidebarOpen; },
        set sidebarOpen(v: boolean) { sidebarOpen = v; },
        get editingPageId() { return editingPageId; },
        get editingName() { return editingName; },
        set editingName(v: string) { editingName = v; },
        currentPageIndex,
        currentPage,
        switchToPage,
        addPage,
        deletePage,
        startEditing,
        cancelEditing,
        commitEdit,
        navigatePages,
    };
}
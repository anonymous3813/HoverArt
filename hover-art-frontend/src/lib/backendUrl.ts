/** Base URL for REST + Socket.IO (no trailing slash). Set `VITE_BACKEND_URL` in `.env` — restart dev server after changes. */
export function getBackendUrl(): string {
	const raw = import.meta.env.VITE_BACKEND_URL;
	if (typeof raw === 'string' && raw.trim().length > 0) {
		return raw.trim().replace(/\/+$/, '');
	}
	return 'http://localhost:3001';
}

export type AuthUser = {
    id: number;
    username: string;
    email: string;
};
function parseToken(token: string): AuthUser | null {
    try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (!payload?.id || !payload?.username || !payload?.email)
            return null;
        if (payload.exp && payload.exp * 1000 < Date.now())
            return null;
        return { id: payload.id, username: payload.username, email: payload.email };
    }
    catch {
        return null;
    }
}
function loadFromStorage(): {
    token: string | null;
    user: AuthUser | null;
} {
    if (typeof localStorage === 'undefined')
        return { token: null, user: null };
    const token = localStorage.getItem('hoverart_token');
    if (!token)
        return { token: null, user: null };
    const user = parseToken(token);
    if (!user) {
        localStorage.removeItem('hoverart_token');
        return { token: null, user: null };
    }
    return { token, user };
}
const initial = loadFromStorage();
export const auth = $state({ token: initial.token, user: initial.user });
export function setAuth(token: string, user: AuthUser) {
    if (typeof window !== 'undefined') {
        localStorage.setItem('hoverart_token', token);
        document.cookie = `hoverart_token=${token}; path=/; max-age=86400; SameSite=Lax`;
    }
    auth.token = token;
    auth.user = user;
}
export function clearAuth() {
    if (typeof window !== 'undefined') {
        localStorage.removeItem('hoverart_token');
        document.cookie = 'hoverart_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    }
    auth.token = null;
    auth.user = null;
}
export function isLoggedIn(): boolean {
    return auth.token !== null && auth.user !== null;
}

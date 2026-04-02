import { redirect, type Handle } from '@sveltejs/kit';

function parseToken(token: string) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload?.id || !payload?.username || !payload?.email) return null;
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return { id: payload.id, username: payload.username, email: payload.email };
  } catch {
    return null;
  }
}

export const handle: Handle = async ({ event, resolve }) => {
  const token = event.cookies.get('hoverart_token');
  if (token) {
    const user = parseToken(token);
    if (user) {
      event.locals.user = user;
    } else {
      event.locals.user = null;
      event.cookies.delete('hoverart_token', { path: '/' });
    }
  } else {
    event.locals.user = null;
  }

  return resolve(event);
};
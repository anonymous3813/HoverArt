import bcrypt from 'bcryptjs';

const users = new Map();
let nextId = 1;

export async function registerUser({ username, email, password }) {
  const normalizedEmail = email.toLowerCase().trim();

  if (users.has(normalizedEmail)) {
    throw new Error('An account with that email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = { id: nextId++, username: username.trim(), email: normalizedEmail, passwordHash };
  users.set(normalizedEmail, user);

  return { id: user.id, username: user.username, email: user.email };
}

export async function loginUser({ email, password }) {
  const normalizedEmail = email.toLowerCase().trim();
  const user = users.get(normalizedEmail);

  if (!user) throw new Error('Invalid email or password.');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error('Invalid email or password.');

  return { id: user.id, username: user.username, email: user.email };
}

export function getUserById(id) {
  for (const user of users.values()) {
    if (user.id === id) return { id: user.id, username: user.username, email: user.email };
  }
  return null;
}

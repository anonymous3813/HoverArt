import bcrypt from 'bcryptjs';
import { query } from './db.js';

export async function registerUser({ username, email, password }) {
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
  if (existing.rows.length > 0) {
    throw new Error('An account with that email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await query(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
    [username.trim(), normalizedEmail, passwordHash]
  );

  return result.rows[0];
}

export async function loginUser({ email, password }) {
  const normalizedEmail = email.toLowerCase().trim();
  const result = await query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);

  if (result.rows.length === 0) throw new Error('Invalid email or password.');

  const user = result.rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new Error('Invalid email or password.');

  return { id: user.id, username: user.username, email: user.email };
}

export async function getUserById(id) {
  const result = await query(
    'SELECT id, username, email FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0] ?? null;
}

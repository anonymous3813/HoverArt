import { Router } from 'express';
import { registerUser, loginUser, getUserById } from '../services/authService.js';
import { signToken, requireAuth } from '../middleware/auth.js';
const router = Router();
router.post('/register', async (req, res) => {
    const { username, email, password } = req.body ?? {};
    if (!username?.trim() || !email?.trim() || !password) {
        res.status(400).json({ error: 'Username, email, and password are all required.' });
        return;
    }
    if (password.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters.' });
        return;
    }
    try {
        const user = await registerUser({ username, email, password });
        const token = signToken({ id: user.id, username: user.username, email: user.email });
        res.status(201).json({ token, user });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.post('/login', async (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email?.trim() || !password) {
        res.status(400).json({ error: 'Email and password are required.' });
        return;
    }
    try {
        const user = await loginUser({ email, password });
        const token = signToken({ id: user.id, username: user.username, email: user.email });
        res.json({ token, user });
    }
    catch (err) {
        res.status(401).json({ error: err.message });
    }
});
router.get('/me', requireAuth, (req, res) => {
    const user = getUserById(req.user.id);
    if (!user) {
        res.status(404).json({ error: 'User not found.' });
        return;
    }
    res.json({ user });
});
export default router;

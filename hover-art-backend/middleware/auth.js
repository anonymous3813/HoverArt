import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET ?? 'hoverart-dev-secret';
export function signToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
export function verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
}
export function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    try {
        req.user = verifyToken(header.slice(7));
        next();
    }
    catch {
        res.status(401).json({ error: 'Invalid or expired token.' });
    }
}

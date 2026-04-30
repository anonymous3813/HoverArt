import './bootstrap-env.js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import express from 'express';
import emailRouter from './routes/email.js';
import authRouter from './routes/auth.js';
import twoTruthsRouter from './routes/twoTruths.js';
import omniRouter from './routes/omni.js';
import { registerCanvasHandlers } from './sockets/canvas.js';
import { registerGameHandlers } from './sockets/games.js';
import { initDb } from './services/db.js';
import { isOpenAiConfigured } from './services/openaiTwoTruthsService.js';
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});
app.use(express.json({ limit: '15mb' }));
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
    }
    next();
});
app.use('/', emailRouter);
app.use('/auth', authRouter);
app.use('/games', twoTruthsRouter);
app.use('/api/omni', omniRouter);
io.on('connection', (socket) => {
    registerCanvasHandlers(io, socket);
    registerGameHandlers(io, socket);
});
const PORT = process.env.PORT || 3001;
initDb()
    .then(() => httpServer.listen(PORT, () => {
    console.log(`HoverArt backend running on :${PORT}`);
    console.log(isOpenAiConfigured()
        ? 'OpenAI: key loaded — Two Truths + Omni (/api/omni/plan) enabled.'
        : 'OpenAI: MISSING — add OPENAI_SECRET to hover-art-backend/.env, save the file, restart.');
}))
    .catch((err) => { console.error('Failed to initialise database:', err.message); process.exit(1); });

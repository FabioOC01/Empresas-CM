require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use((req, res, next) => { req.io = io; next(); });

app.use('/api/actividades', require('./routes/actividades'));
app.use('/api/vendedores',  require('./routes/vendedores'));
app.get('/health', (req, res) => res.json({ ok: true, ts: new Date() }));

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`[CRM-API] http://localhost:${PORT}`);
});

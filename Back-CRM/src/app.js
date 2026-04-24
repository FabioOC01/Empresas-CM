require('dotenv').config();
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors    = require('cors');
const jwt     = require('jsonwebtoken');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

const auth = require('./middleware/auth');

app.use(cors());
app.use(express.json());
app.use((req, res, next) => { req.io = io; next(); });

app.use('/api/auth',        require('./routes/auth'));
app.use('/api/empresas',    auth, require('./routes/empresas'));
app.use('/api/actividades', auth, require('./routes/actividades'));
app.use('/api/vendedores',  auth, require('./routes/vendedores'));
app.use('/api/clientes',   auth, require('./routes/clientes'));
app.use('/api/config',     auth, require('./routes/config'));
app.use('/api/asistencia', auth, require('./routes/asistencia'));
app.use('/webhook',        require('./routes/webhooks'));
app.get('/health', (req, res) => res.json({ ok: true, ts: new Date() }));

// Socket.io: autenticar y unir al room de la empresa
io.use((socket, next) => {
    try {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error('Token requerido'));
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        // Superadmin sin empresa seleccionada → no entra a ningún room de datos
        socket.empresa_id = payload.empresa_id || null;
        next();
    } catch {
        next(new Error('Token inválido'));
    }
});

io.on('connection', socket => {
    socket.join(socket.empresa_id);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`[CRM-API] http://localhost:${PORT}`);
});

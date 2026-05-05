// Cliente HTTP minimal para BioTime 7 (ZKBio). Usa node:https nativo
// para evitar dependencias adicionales y manejar el cert autofirmado.

const https = require('node:https');
const http = require('node:http');
const { URL } = require('node:url');

const TOKEN_TTL_MS = 20 * 60 * 60 * 1000; // 20h (BioTime expira en 24h aprox)

let cachedToken = null;
let cachedAt = 0;

function getConfig() {
    const url = (process.env.ZKBIO_API_URL || '').trim();
    if (!url) {
        const err = new Error('Falta ZKBIO_API_URL para conectarse a BioTime.');
        err.status = 503;
        throw err;
    }
    return {
        url: url.replace(/\/+$/, ''),
        user: process.env.ZKBIO_API_USER || '',
        pass: process.env.ZKBIO_API_PASS || '',
        insecure: String(process.env.ZKBIO_API_INSECURE || '').toLowerCase() === 'true',
        pageSize: Number(process.env.ZKBIO_API_PAGE_SIZE) || 200,
    };
}

function buildAgent(target, insecure) {
    if (target.protocol === 'https:') {
        return new https.Agent({ rejectUnauthorized: !insecure });
    }
    return new http.Agent();
}

function doRequest({ url, method = 'GET', headers = {}, body = null, insecure = false }) {
    return new Promise((resolve, reject) => {
        const target = new URL(url);
        const lib = target.protocol === 'https:' ? https : http;
        const options = {
            method,
            hostname: target.hostname,
            port: target.port || (target.protocol === 'https:' ? 443 : 80),
            path: `${target.pathname}${target.search}`,
            headers: { ...headers },
            agent: buildAgent(target, insecure),
        };
        if (body) {
            options.headers['Content-Type'] = options.headers['Content-Type'] || 'application/json';
            options.headers['Content-Length'] = Buffer.byteLength(body);
        }

        const req = lib.request(options, (res) => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                const text = Buffer.concat(chunks).toString('utf8');
                let json = null;
                try { json = text ? JSON.parse(text) : null; } catch { /* keep raw */ }
                resolve({ status: res.statusCode, body: text, json });
            });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

async function login() {
    const cfg = getConfig();
    const res = await doRequest({
        url: `${cfg.url}/jwt-api-token-auth/`,
        method: 'POST',
        body: JSON.stringify({ username: cfg.user, password: cfg.pass }),
        insecure: cfg.insecure,
    });
    if (res.status !== 200 || !res.json?.token) {
        const err = new Error(`Login BioTime falló (${res.status}): ${res.body?.slice(0, 200)}`);
        err.status = res.status === 401 ? 401 : 502;
        throw err;
    }
    cachedToken = res.json.token;
    cachedAt = Date.now();
    return cachedToken;
}

async function getToken(forceRefresh = false) {
    if (!forceRefresh && cachedToken && (Date.now() - cachedAt) < TOKEN_TTL_MS) {
        return cachedToken;
    }
    return login();
}

async function apiGet(path) {
    const cfg = getConfig();
    let token = await getToken();
    let res = await doRequest({
        url: `${cfg.url}${path}`,
        headers: { Authorization: `JWT ${token}` },
        insecure: cfg.insecure,
    });
    if (res.status === 401) {
        // Token vencido o inválido — reintentar una vez con login fresco
        token = await getToken(true);
        res = await doRequest({
            url: `${cfg.url}${path}`,
            headers: { Authorization: `JWT ${token}` },
            insecure: cfg.insecure,
        });
    }
    if (res.status >= 400) {
        const err = new Error(`BioTime ${res.status} en ${path}: ${res.body?.slice(0, 200)}`);
        err.status = 502;
        throw err;
    }
    return res.json;
}

// BioTime espera "YYYY-MM-DD HH:mm:ss" (no ISO)
function toBiotimeDateTime(value) {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    const pad = n => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

// Si llega una fecha "YYYY-MM-DD" (típico desde el front), expandir a inicio/fin de día
function expandDateRange(desde, hasta) {
    const onlyDate = /^\d{4}-\d{2}-\d{2}$/;
    const desdeStr = onlyDate.test(String(desde || ''))
        ? `${desde} 00:00:00`
        : (toBiotimeDateTime(desde) || '');
    const hastaStr = onlyDate.test(String(hasta || ''))
        ? `${hasta} 23:59:59`
        : (toBiotimeDateTime(hasta) || '');
    return { desdeStr, hastaStr };
}

async function fetchTransactions({ desde, hasta }) {
    const cfg = getConfig();
    const { desdeStr, hastaStr } = expandDateRange(desde, hasta);
    if (!desdeStr || !hastaStr) {
        const err = new Error('Rango de fechas inválido para sync BioTime.');
        err.status = 400;
        throw err;
    }

    const all = [];
    let page = 1;
    // BioTime devuelve paginación tipo Django REST: { count, next, previous, data }
    // o { count, results } según endpoint. Manejamos ambos.
    while (true) {
        const qs = new URLSearchParams({
            start_time: desdeStr,
            end_time: hastaStr,
            page: String(page),
            page_size: String(cfg.pageSize),
        }).toString();

        const json = await apiGet(`/iclock/api/transactions/?${qs}`);
        const rows = Array.isArray(json?.data)
            ? json.data
            : (Array.isArray(json?.results) ? json.results : []);
        all.push(...rows);

        const hasMore = !!json?.next || (rows.length >= cfg.pageSize);
        if (!hasMore || rows.length === 0) break;
        page += 1;
        if (page > 200) break; // hard guard: 200 * 200 = 40k registros
    }
    return all;
}

module.exports = {
    login,
    getToken,
    fetchTransactions,
};

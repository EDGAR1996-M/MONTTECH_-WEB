'use strict';

require('dotenv').config();

const crypto = require('node:crypto');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const connectPgSimple = require('connect-pg-simple');
const express = require('express');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const helmet = require('helmet');
const { Pool } = require('pg');

const app = express();
const port = Number(process.env.PORT) || 3000;
const production = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET || '';
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) throw new Error('DATABASE_URL must be configured.');
if (sessionSecret.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters.');

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: true } : undefined,
  max: 10,
  idleTimeoutMillis: 30000
});

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'https://images.unsplash.com', 'data:', 'blob:'],
      connectSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
      workerSrc: ["'self'", 'blob:', 'https://cdnjs.cloudflare.com'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'", 'https://wa.me']
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(express.json({ limit: '32kb' }));
app.use((req, res, next) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) req.body = {};
  next();
});
app.use(session({
  name: 'monttech.sid',
  store: new (connectPgSimple(session))({
    pool,
    tableName: 'web_sessions',
    createTableIfMissing: true
  }),
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: production,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000
  }
}));

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const asyncRoute = handler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos e inténtalo otra vez.' }
});

const requestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Se alcanzó el límite de solicitudes. Inténtalo más tarde.' }
});

function textField(value, name, maxLength, { required = false, minLength = 0 } = {}) {
  if (value == null && !required) return '';
  if (typeof value !== 'string') {
    throw new HttpError(400, `${name} debe ser texto.`);
  }
  const result = value.replace(/\u0000/g, '').trim();
  if (required && result.length < minLength) throw new HttpError(400, `${name} es obligatorio.`);
  if (result.length > maxLength) throw new HttpError(400, `${name} excede el máximo permitido.`);
  return result;
}

function validEmail(value, required = false) {
  const email = textField(value, 'Correo electrónico', 254, { required });
  if (!email && !required) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'El correo electrónico no es válido.');
  return email.toLowerCase();
}

function validId(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new HttpError(400, 'El identificador no es válido.');
  }
  return value;
}

function csrfMatches(req) {
  const expected = req.session.csrfToken;
  const supplied = req.get('x-csrf-token');
  if (typeof expected !== 'string' || typeof supplied !== 'string') return false;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function requireCsrf(req, res, next) {
  if (!csrfMatches(req)) return res.status(403).json({ error: 'La sesión expiró. Recarga la página e inténtalo otra vez.' });
  next();
}

const requireAdmin = asyncRoute(async (req, res, next) => {
  if (!req.session.adminId) throw new HttpError(401, 'Inicia sesión para continuar.');
  const result = await pool.query('SELECT id, email FROM admins WHERE id = $1', [req.session.adminId]);
  if (!result.rowCount) {
    req.session.destroy(() => {});
    throw new HttpError(401, 'La sesión ya no es válida.');
  }
  req.admin = result.rows[0];
  next();
});

function validateClient(body) {
  return {
    name: textField(body.name, 'Nombre', 100, { required: true, minLength: 2 }),
    email: validEmail(body.email),
    phone: textField(body.phone, 'Teléfono', 40),
    company: textField(body.company, 'Empresa', 120),
    notes: textField(body.notes, 'Notas', 2000)
  };
}

const projectStatuses = new Set(['planned', 'in_progress', 'completed', 'paused']);

function validateProject(body) {
  const status = textField(body.status || 'planned', 'Estado', 20, { required: true });
  if (!projectStatuses.has(status)) throw new HttpError(400, 'El estado del proyecto no es válido.');
  const rawTechnologies = Array.isArray(body.technologies)
    ? body.technologies
    : textField(body.technologies, 'Tecnologías', 500).split(',');
  if (rawTechnologies.length > 20) throw new HttpError(400, 'Puedes indicar hasta 20 tecnologías.');
  const technologies = rawTechnologies
    .map(item => textField(item, 'Tecnología', 40))
    .filter(Boolean);
  const clientId = body.clientId ? validId(body.clientId) : null;
  return {
    name: textField(body.name, 'Nombre del proyecto', 120, { required: true, minLength: 2 }),
    description: textField(body.description, 'Descripción', 5000),
    status,
    technologies: [...new Set(technologies)],
    clientId
  };
}

const requestStatuses = new Set(['new', 'contacted', 'quoted', 'closed']);

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS clients (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT NOT NULL DEFAULT '',
      company TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS clients_email_unique
      ON clients (lower(email)) WHERE email IS NOT NULL AND email <> '';
    CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY,
      client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'planned'
        CHECK (status IN ('planned', 'in_progress', 'completed', 'paused')),
      technologies TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS requests (
      id UUID PRIMARY KEY,
      client_name TEXT NOT NULL,
      email TEXT,
      service TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'contacted', 'quoted', 'closed')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS requests_created_at_idx ON requests (created_at DESC);
    CREATE INDEX IF NOT EXISTS projects_updated_at_idx ON projects (updated_at DESC);
  `);

  const configuredEmail = process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.trim().toLowerCase() : '';
  const configuredPassword = process.env.ADMIN_PASSWORD || '';
  if (Boolean(configuredEmail) !== Boolean(configuredPassword)) {
    throw new Error('Configure both ADMIN_EMAIL and ADMIN_PASSWORD to create the initial administrator.');
  }

  const adminCount = await pool.query('SELECT count(*)::int AS count FROM admins');
  if (adminCount.rows[0].count === 0) {
    if (!configuredEmail || configuredPassword.length < 12) {
      throw new Error('No administrator exists. Set ADMIN_EMAIL and an ADMIN_PASSWORD with at least 12 characters.');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredEmail)) throw new Error('ADMIN_EMAIL is not valid.');
    const passwordHash = await bcrypt.hash(configuredPassword, 12);
    await pool.query(
      'INSERT INTO admins (id, email, password_hash) VALUES ($1, $2, $3)',
      [crypto.randomUUID(), configuredEmail, passwordHash]
    );
    console.log(`Created initial administrator ${configuredEmail}.`);
  }
}

app.get('/api/health', asyncRoute(async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok' });
}));

app.get('/api/csrf', (req, res) => {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  res.json({ token: req.session.csrfToken });
});

app.post('/api/auth/login', loginLimiter, requireCsrf, asyncRoute(async (req, res) => {
  const email = validEmail(req.body.email, true);
  const password = textField(req.body.password, 'Contraseña', 128, { required: true });
  const result = await pool.query('SELECT id, email, password_hash FROM admins WHERE email = $1', [email]);
  const admin = result.rows[0];
  const passwordMatches = admin
    ? await bcrypt.compare(password, admin.password_hash)
    : await bcrypt.compare(password, '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');
  if (!admin || !passwordMatches) throw new HttpError(401, 'Correo o contraseña incorrectos.');

  await new Promise((resolve, reject) => {
    req.session.regenerate(error => error ? reject(error) : resolve());
  });
  req.session.adminId = admin.id;
  req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  await new Promise((resolve, reject) => {
    req.session.save(error => error ? reject(error) : resolve());
  });
  res.json({ admin: { id: admin.id, email: admin.email }, csrfToken: req.session.csrfToken });
}));

app.get('/api/auth/me', requireAdmin, (req, res) => {
  res.json({ admin: req.admin, csrfToken: req.session.csrfToken });
});

app.post('/api/auth/logout', requireAdmin, requireCsrf, (req, res, next) => {
  req.session.destroy(error => {
    if (error) return next(error);
    res.clearCookie('monttech.sid', { httpOnly: true, secure: production, sameSite: 'lax' });
    res.status(204).end();
  });
});

app.post('/api/public/requests', requestLimiter, requireCsrf, asyncRoute(async (req, res) => {
  const name = textField(req.body.name, 'Nombre', 100, { required: true, minLength: 2 });
  const email = validEmail(req.body.email);
  const service = textField(req.body.service, 'Servicio', 100, { required: true, minLength: 2 });
  const message = textField(req.body.message, 'Mensaje', 2000, { required: true, minLength: 10 });
  const result = await pool.query(
    `INSERT INTO requests (id, client_name, email, service, message)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
    [crypto.randomUUID(), name, email, service, message]
  );
  res.status(201).json({ id: result.rows[0].id, createdAt: result.rows[0].created_at });
}));

app.get('/api/admin/summary', requireAdmin, asyncRoute(async (req, res) => {
  const [counts, requestsByStatus, recentRequests, projectStatusesResult] = await Promise.all([
    pool.query(`SELECT
      (SELECT count(*)::int FROM clients) AS clients,
      (SELECT count(*)::int FROM projects) AS projects,
      (SELECT count(*)::int FROM requests) AS requests,
      (SELECT count(*)::int FROM requests WHERE status = 'new') AS new_requests`),
    pool.query('SELECT status, count(*)::int AS count FROM requests GROUP BY status'),
    pool.query(`SELECT id, client_name, email, service, status, created_at
      FROM requests ORDER BY created_at DESC LIMIT 5`),
    pool.query('SELECT status, count(*)::int AS count FROM projects GROUP BY status')
  ]);
  res.json({
    counts: counts.rows[0],
    requestsByStatus: requestsByStatus.rows,
    projectsByStatus: projectStatusesResult.rows,
    recentRequests: recentRequests.rows
  });
}));

app.get('/api/admin/clients', requireAdmin, asyncRoute(async (req, res) => {
  const search = textField(req.query.q || '', 'Búsqueda', 100);
  const result = await pool.query(
    `SELECT id, name, email, phone, company, notes, created_at, updated_at
     FROM clients
     WHERE $1 = '' OR name ILIKE $2 OR coalesce(email, '') ILIKE $2 OR company ILIKE $2
     ORDER BY updated_at DESC LIMIT 500`,
    [search, `%${search}%`]
  );
  res.json({ clients: result.rows });
}));

app.post('/api/admin/clients', requireAdmin, requireCsrf, asyncRoute(async (req, res) => {
  const client = validateClient(req.body);
  const result = await pool.query(
    `INSERT INTO clients (id, name, email, phone, company, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, email, phone, company, notes, created_at, updated_at`,
    [crypto.randomUUID(), client.name, client.email, client.phone, client.company, client.notes]
  );
  res.status(201).json({ client: result.rows[0] });
}));

app.put('/api/admin/clients/:id', requireAdmin, requireCsrf, asyncRoute(async (req, res) => {
  const id = validId(req.params.id);
  const client = validateClient(req.body);
  const result = await pool.query(
    `UPDATE clients SET name=$2, email=$3, phone=$4, company=$5, notes=$6, updated_at=now()
     WHERE id=$1
     RETURNING id, name, email, phone, company, notes, created_at, updated_at`,
    [id, client.name, client.email, client.phone, client.company, client.notes]
  );
  if (!result.rowCount) throw new HttpError(404, 'No se encontró el cliente.');
  res.json({ client: result.rows[0] });
}));

app.delete('/api/admin/clients/:id', requireAdmin, requireCsrf, asyncRoute(async (req, res) => {
  const result = await pool.query('DELETE FROM clients WHERE id=$1', [validId(req.params.id)]);
  if (!result.rowCount) throw new HttpError(404, 'No se encontró el cliente.');
  res.status(204).end();
}));

app.get('/api/admin/projects', requireAdmin, asyncRoute(async (req, res) => {
  const result = await pool.query(
    `SELECT p.id, p.client_id AS "clientId", c.name AS "clientName", p.name,
      p.description, p.status, p.technologies, p.created_at AS "createdAt",
      p.updated_at AS "updatedAt"
     FROM projects p LEFT JOIN clients c ON c.id=p.client_id
     ORDER BY p.updated_at DESC LIMIT 500`
  );
  res.json({ projects: result.rows });
}));

app.post('/api/admin/projects', requireAdmin, requireCsrf, asyncRoute(async (req, res) => {
  const project = validateProject(req.body);
  const result = await pool.query(
    `INSERT INTO projects (id, client_id, name, description, status, technologies)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, client_id AS "clientId", name, description, status, technologies,
       created_at AS "createdAt", updated_at AS "updatedAt"`,
    [crypto.randomUUID(), project.clientId, project.name, project.description, project.status, project.technologies]
  );
  res.status(201).json({ project: result.rows[0] });
}));

app.put('/api/admin/projects/:id', requireAdmin, requireCsrf, asyncRoute(async (req, res) => {
  const id = validId(req.params.id);
  const project = validateProject(req.body);
  const result = await pool.query(
    `UPDATE projects SET client_id=$2, name=$3, description=$4, status=$5,
      technologies=$6, updated_at=now()
     WHERE id=$1
     RETURNING id, client_id AS "clientId", name, description, status, technologies,
       created_at AS "createdAt", updated_at AS "updatedAt"`,
    [id, project.clientId, project.name, project.description, project.status, project.technologies]
  );
  if (!result.rowCount) throw new HttpError(404, 'No se encontró el proyecto.');
  res.json({ project: result.rows[0] });
}));

app.delete('/api/admin/projects/:id', requireAdmin, requireCsrf, asyncRoute(async (req, res) => {
  const result = await pool.query('DELETE FROM projects WHERE id=$1', [validId(req.params.id)]);
  if (!result.rowCount) throw new HttpError(404, 'No se encontró el proyecto.');
  res.status(204).end();
}));

app.get('/api/admin/requests', requireAdmin, asyncRoute(async (req, res) => {
  const status = req.query.status ? textField(req.query.status, 'Estado', 20) : '';
  if (status && !requestStatuses.has(status)) throw new HttpError(400, 'El estado de solicitud no es válido.');
  const search = textField(req.query.q || '', 'Búsqueda', 100);
  const result = await pool.query(
    `SELECT id, client_name AS name, email, service, message, status,
      created_at AS "createdAt", updated_at AS "updatedAt"
     FROM requests
     WHERE ($1 = '' OR status = $1)
       AND ($2 = '' OR client_name ILIKE $3 OR coalesce(email, '') ILIKE $3 OR service ILIKE $3)
     ORDER BY created_at DESC LIMIT 500`,
    [status, search, `%${search}%`]
  );
  res.json({ requests: result.rows });
}));

app.patch('/api/admin/requests/:id', requireAdmin, requireCsrf, asyncRoute(async (req, res) => {
  const status = textField(req.body.status, 'Estado', 20, { required: true });
  if (!requestStatuses.has(status)) throw new HttpError(400, 'El estado de solicitud no es válido.');
  const result = await pool.query(
    `UPDATE requests SET status=$2, updated_at=now()
     WHERE id=$1 RETURNING id, status, updated_at AS "updatedAt"`,
    [validId(req.params.id), status]
  );
  if (!result.rowCount) throw new HttpError(404, 'No se encontró la solicitud.');
  res.json({ request: result.rows[0] });
}));

function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\t\r\n ]*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

app.get('/api/admin/reports.csv', requireAdmin, asyncRoute(async (req, res) => {
  const result = await pool.query(`
    SELECT created_at AS date, 'Cliente' AS type, name AS title, coalesce(email, '') AS email,
      company AS status, phone AS detail FROM clients
    UNION ALL
    SELECT p.created_at, 'Proyecto', p.name, coalesce(c.email, ''), p.status, p.description
      FROM projects p LEFT JOIN clients c ON c.id=p.client_id
    UNION ALL
    SELECT created_at, 'Solicitud', client_name, coalesce(email, ''), status, service || ': ' || message
      FROM requests
    ORDER BY date DESC
  `);
  const rows = [
    ['Fecha', 'Tipo', 'Nombre', 'Correo', 'Estado / empresa', 'Detalle'],
    ...result.rows.map(row => [row.date.toISOString(), row.type, row.title, row.email, row.status, row.detail])
  ];
  const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n');
  res.type('text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="monttech-informe-administrativo.csv"');
  res.send(csv);
}));

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.use((req, res, next) => {
  const privateFiles = new Set(['/server.js', '/package.json', '/package-lock.json', '/README.md', '/.env.example', '/.gitignore']);
  if (privateFiles.has(req.path) || req.path.startsWith('/node_modules/')) return res.sendStatus(404);
  next();
});
app.use(express.static(__dirname, { dotfiles: 'deny', index: 'index.html', maxAge: production ? '1h' : 0 }));
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta de API no encontrada.' }));

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
  if (error.code === '23505') return res.status(409).json({ error: 'Ya existe un registro con esos datos.' });
  if (error.code === '23503') return res.status(400).json({ error: 'El cliente seleccionado ya no existe.' });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'El cuerpo de la solicitud no es JSON válido.' });
  console.error('Request failed:', error);
  res.status(500).json({ error: 'Ocurrió un error interno. Inténtalo de nuevo más tarde.' });
});

async function start() {
  await initializeDatabase();
  app.listen(port, '0.0.0.0', () => console.log(`MONTTECH server listening on port ${port}.`));
}

start().catch(error => {
  console.error('Server startup failed:', error);
  process.exitCode = 1;
});

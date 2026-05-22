require('dotenv').config();

const express    = require('express');
const session    = require('express-session');
const multer     = require('multer');
const bcrypt     = require('bcryptjs');
const { v4: uuid } = require('uuid');
const { Resend } = require('resend');
const path       = require('path');
const fs         = require('fs');

const app = express();
const getResend = () => new Resend(process.env.RESEND_API_KEY);

// When DATA_DIR is set (Railway volume), all mutable files live there.
// Locally it falls back to the repo root / public/uploads as before.
const DATA_DIR      = process.env.DATA_DIR || null;
const CONTENT_FILE  = DATA_DIR ? path.join(DATA_DIR, 'content.json') : path.join(__dirname, 'content.json');
const AUTH_FILE     = DATA_DIR ? path.join(DATA_DIR, 'auth.json')    : path.join(__dirname, 'auth.json');
const UPLOADS_DIR   = DATA_DIR ? path.join(DATA_DIR, 'uploads')      : path.join(__dirname, 'public', 'uploads');
const ADMIN_EMAIL   = 'hello@jameswhitingstudio.com';

// ── Init data files ───────────────────────────────────────────────────────────

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// On first deploy to a fresh volume, seed content.json from the repo default
if (DATA_DIR && !fs.existsSync(CONTENT_FILE)) {
  fs.copyFileSync(path.join(__dirname, 'content.json'), CONTENT_FILE);
}

if (!fs.existsSync(AUTH_FILE)) {
  const defaultPassword = 'changeme123';
  fs.writeFileSync(AUTH_FILE, JSON.stringify({
    passwordHash: bcrypt.hashSync(defaultPassword, 12),
    resetToken:   null,
    resetExpiry:  null
  }, null, 2));
  console.log('\n⚠️  First run detected.');
  console.log(`    Default admin password: ${defaultPassword}`);
  console.log('    Change this immediately at /admin\n');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const readContent = () => JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'));
const writeContent = d => fs.writeFileSync(CONTENT_FILE, JSON.stringify(d, null, 2));
const readAuth = ()    => JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
const writeAuth = d    => fs.writeFileSync(AUTH_FILE, JSON.stringify(d, null, 2));

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret:            process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave:            false,
  saveUninitialized: false,
  cookie:            { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, 'public')));

// ── Multer ────────────────────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename:    (req, file, cb) => cb(null, uuid() + path.extname(file.originalname).toLowerCase())
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
  limits: { fileSize: 20 * 1024 * 1024 }
});

// ── Auth middleware ───────────────────────────────────────────────────────────

const requireAuth = (req, res, next) =>
  req.session.authenticated ? next() : res.status(401).json({ error: 'Unauthorized' });

// ── Public API ────────────────────────────────────────────────────────────────

app.get('/api/content', (req, res) => res.json(readContent()));

app.post('/api/contact', async (req, res) => {
  const { from, message } = req.body;
  if (!from || !message) return res.status(400).json({ error: 'Missing fields' });

  try {
    await getResend().emails.send({
      from:     'website@jameswhitingstudio.com',
      to:       ADMIN_EMAIL,
      reply_to: from,
      subject:  'New enquiry from jameswhiting.studio',
      html:     `<p><strong>From:</strong> ${from}</p><p>${message.replace(/\n/g, '<br>')}</p>`
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ── Admin — public routes ────────────────────────────────────────────────────

app.use('/admin', express.static(path.join(__dirname, 'admin')));

app.get('/admin/api/check', (req, res) =>
  res.json({ authenticated: !!req.session.authenticated }));

app.post('/admin/login', async (req, res) => {
  const { password } = req.body;
  const auth = readAuth();
  const valid = await bcrypt.compare(password, auth.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Incorrect password' });
  req.session.authenticated = true;
  res.json({ success: true });
});

app.post('/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.post('/admin/api/reset-request', async (req, res) => {
  const token  = uuid();
  const expiry = Date.now() + 60 * 60 * 1000;
  const auth   = readAuth();
  auth.resetToken  = token;
  auth.resetExpiry = expiry;
  writeAuth(auth);

  const url = `${req.protocol}://${req.get('host')}/admin/reset.html?token=${token}`;

  try {
    await getResend().emails.send({
      from:    'noreply@jameswhitingstudio.com',
      to:      ADMIN_EMAIL,
      subject: 'Password reset — James Whiting Studio',
      html:    `<p>Click the link below to reset your admin password. It expires in 1 hour.</p><p><a href="${url}">${url}</a></p>`
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to send email' });
  }
});

app.post('/admin/api/reset-password', async (req, res) => {
  const { token, password } = req.body;
  const auth = readAuth();

  if (!auth.resetToken || auth.resetToken !== token || Date.now() > auth.resetExpiry)
    return res.status(400).json({ error: 'Invalid or expired link' });

  auth.passwordHash = await bcrypt.hash(password, 12);
  auth.resetToken   = null;
  auth.resetExpiry  = null;
  writeAuth(auth);
  res.json({ success: true });
});

// ── Admin — protected routes ─────────────────────────────────────────────────

app.get('/admin/api/content', requireAuth, (req, res) => res.json(readContent()));

app.put('/admin/api/content', requireAuth, (req, res) => {
  const current = readContent();
  // Deep merge top-level keys
  const updated = {
    ...current,
    ...req.body,
    info:       { ...current.info,       ...(req.body.info       || {}) },
    gallery:    { ...current.gallery,    ...(req.body.gallery    || {}) },
    typography: { ...current.typography, ...(req.body.typography || {}) }
  };
  writeContent(updated);
  res.json({ success: true });
});

app.put('/admin/api/content/password', requireAuth, async (req, res) => {
  const { current, next } = req.body;
  const auth  = readAuth();
  const valid = await bcrypt.compare(current, auth.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
  auth.passwordHash = await bcrypt.hash(next, 12);
  writeAuth(auth);
  res.json({ success: true });
});

app.post('/admin/api/images', requireAuth, upload.array('images'), (req, res) => {
  const content   = readContent();
  const nextOrder = content.gallery.images.length;
  const added     = req.files.map((file, i) => ({
    id:       path.basename(file.filename, path.extname(file.filename)),
    filename: file.filename,
    order:    nextOrder + i
  }));
  content.gallery.images.push(...added);
  writeContent(content);
  res.json({ images: added });
});

app.delete('/admin/api/images/:id', requireAuth, (req, res) => {
  const content = readContent();
  const image   = content.gallery.images.find(i => i.id === req.params.id);
  if (!image) return res.status(404).json({ error: 'Not found' });

  try { fs.unlinkSync(path.join(UPLOADS_DIR, image.filename)); } catch {}

  content.gallery.images = content.gallery.images
    .filter(i => i.id !== req.params.id)
    .map((img, idx) => ({ ...img, order: idx }));
  writeContent(content);
  res.json({ success: true });
});

app.put('/admin/api/images/reorder', requireAuth, (req, res) => {
  const { order } = req.body; // ordered array of ids
  const content   = readContent();
  const map       = Object.fromEntries(content.gallery.images.map(img => [img.id, img]));
  content.gallery.images = order.filter(id => map[id]).map((id, idx) => ({ ...map[id], order: idx }));
  writeContent(content);
  res.json({ success: true });
});

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running → http://localhost:${PORT}`));

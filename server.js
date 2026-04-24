require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'wr-plus-secret-change-me';

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 8 * 60 * 60 * 1000 }, // 8h
}));

// Auth routes (public)
app.use('/api/auth', require('./routes/auth'));

// Login page (public)
app.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Static assets (public — CSS, JS, fonts)
app.use(express.static(path.join(__dirname, 'public')));

// Everything below requires authentication
app.use(requireAuth);

app.use('/api/whois',     require('./routes/whois'));
app.use('/api/ip',        require('./routes/ip'));
app.use('/api/dns',       require('./routes/dns'));
app.use('/api/redirect',  require('./routes/redirect'));
app.use('/api/validator', require('./routes/validator'));
app.use('/api/admin',     require('./routes/admin'));
app.use('/api/cfemail',   require('./routes/cfemail'));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// JSON error handler — prevents Express sending HTML error pages for API routes
app.use((err, req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  }
  next(err);
});

app.listen(PORT, () => {
  console.log(`\n  WebRadar Plus v1.1.3 — by json arishem`);
  console.log(`  Running on http://localhost:${PORT}\n`);
});

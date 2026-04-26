const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const totpLib = require('../lib/totp');
const QRCode = require('qrcode');
const { readUsers, readRoles, saveUsers } = require('../lib/data');

// Seed default admin if no users exist
function ensureDefaultAdmin() {
  const users = readUsers();
  if (users.length === 0) {
    const hash = bcrypt.hashSync('Admin@123', 10);
    users.push({ id: Date.now().toString(), username: 'admin', passwordHash: hash, role: 'admin', tfaSecret: null, tfaEnabled: false, createdAt: new Date().toISOString() });
    saveUsers(users);
    console.log('\n  [Auth] Default admin created — username: admin  password: Admin@123\n');
  }
}
ensureDefaultAdmin();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password, totp, rememberMe } = req.body;
  const users = readUsers();
  const user = users.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  if (user.tfaEnabled) {
    if (!totp) return res.json({ require2fa: true });
    const ok = totpLib.verify(user.tfaSecret, totp);
    if (!ok) return res.status(401).json({ error: 'Invalid 2FA code' });
  }
  const roles = readRoles();
  const role = roles.find(r => r.name === user.role) || { features: [], canManageUsers: false };
  // Extend cookie lifetime if Remember Me is checked (1 day vs default 8 h)
  if (rememberMe) req.session.cookie.maxAge = 24 * 60 * 60 * 1000;

  req.session.userId   = user.id;
  req.session.username = user.username;
  req.session.role     = user.role;
  req.session.features = role.features;
  req.session.canManageUsers = role.canManageUsers;
  res.json({ ok: true, username: user.username, role: user.role, features: role.features, canManageUsers: role.canManageUsers });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  const users = readUsers();
  const user = users.find(u => u.id === req.session.userId);
  res.json({ username: req.session.username, role: req.session.role, features: req.session.features, canManageUsers: req.session.canManageUsers, tfaEnabled: user ? user.tfaEnabled : false });
});

// POST /api/auth/setup-2fa  — generate secret + QR
router.post('/setup-2fa', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const secret = totpLib.generateSecret();
  const otpauth = totpLib.keyUri(req.session.username, 'WebRadar Plus', secret);
  QRCode.toDataURL(otpauth, (err, qr) => {
    if (err) return res.status(500).json({ error: 'QR error' });
    // Store secret temporarily in session until confirmed
    req.session.pending2faSecret = secret;
    res.json({ secret, qr });
  });
});

// POST /api/auth/confirm-2fa  — verify code then enable
router.post('/confirm-2fa', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const { totp } = req.body;
  const secret = req.session.pending2faSecret;
  if (!secret) return res.status(400).json({ error: 'No pending 2FA setup' });
  if (!totpLib.verify(secret, totp)) return res.status(400).json({ error: 'Invalid code — try again' });
  const users = readUsers();
  const user = users.find(u => u.id === req.session.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.tfaSecret  = secret;
  user.tfaEnabled = true;
  saveUsers(users);
  delete req.session.pending2faSecret;
  res.json({ ok: true });
});

// POST /api/auth/disable-2fa
router.post('/disable-2fa', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const users = readUsers();
  const user = users.find(u => u.id === req.session.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.tfaSecret  = null;
  user.tfaEnabled = false;
  saveUsers(users);
  res.json({ ok: true });
});

// POST /api/auth/change-password
router.post('/change-password', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  const { current, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const users = readUsers();
  const user = users.find(u => u.id === req.session.userId);
  if (!user || !bcrypt.compareSync(current, user.passwordHash)) return res.status(401).json({ error: 'Current password is wrong' });
  user.passwordHash = bcrypt.hashSync(newPassword, 10);
  saveUsers(users);
  res.json({ ok: true });
});

module.exports = router;

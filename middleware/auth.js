function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  if (req.xhr || req.path.startsWith('/api/')) return res.status(401).json({ error: 'Unauthorized' });
  res.redirect('/login');
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.role === 'admin') return next();
  res.status(403).json({ error: 'Admin only' });
}

module.exports = { requireAuth, requireAdmin };

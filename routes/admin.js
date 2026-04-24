const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { requireAdmin } = require('../middleware/auth');

const USERS_FILE    = path.join(__dirname, '..', 'data', 'users.json');
const ROLES_FILE    = path.join(__dirname, '..', 'data', 'roles.json');
const MAPPINGS_FILE = path.join(__dirname, '..', 'data', 'cf-mappings.json');

const ALL_FEATURES = ['whois','ip','dns','redirect','textcalc','password','caseconv','validator','cfemail'];

function readUsers() { try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch { return []; } }
function saveUsers(u) { fs.writeFileSync(USERS_FILE, JSON.stringify(u, null, 2)); }
function readRoles() { try { return JSON.parse(fs.readFileSync(ROLES_FILE, 'utf8')); } catch { return []; } }
function saveRoles(r) { fs.writeFileSync(ROLES_FILE, JSON.stringify(r, null, 2)); }
function readMappings() { try { return JSON.parse(fs.readFileSync(MAPPINGS_FILE, 'utf8')); } catch { return []; } }
function saveMappings(m) { fs.writeFileSync(MAPPINGS_FILE, JSON.stringify(m, null, 2)); }

function safeUser(u) {
  return { id: u.id, username: u.username, role: u.role, tfaEnabled: u.tfaEnabled, createdAt: u.createdAt };
}

router.use(requireAdmin);

// ── Users ─────────────────────────────────────────────────────────────────

router.get('/users', (req, res) => {
  res.json(readUsers().map(safeUser));
});

router.post('/users', (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) return res.status(400).json({ error: 'username, password and role are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const users = readUsers();
  if (users.find(u => u.username === username)) return res.status(409).json({ error: 'Username already exists' });
  const roles = readRoles();
  if (!roles.find(r => r.name === role)) return res.status(400).json({ error: 'Role does not exist' });
  const newUser = { id: Date.now().toString(), username, passwordHash: bcrypt.hashSync(password, 10), role, tfaSecret: null, tfaEnabled: false, createdAt: new Date().toISOString() };
  users.push(newUser);
  saveUsers(users);
  res.json(safeUser(newUser));
});

router.put('/users/:id', (req, res) => {
  const { role, password } = req.body;
  const users = readUsers();
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (role) {
    const roles = readRoles();
    if (!roles.find(r => r.name === role)) return res.status(400).json({ error: 'Role does not exist' });
    user.role = role;
  }
  if (password) {
    if (password.length < 6) return res.status(400).json({ error: 'Password too short' });
    user.passwordHash = bcrypt.hashSync(password, 10);
  }
  saveUsers(users);
  res.json(safeUser(user));
});

router.delete('/users/:id', (req, res) => {
  // Prevent deleting last admin
  let users = readUsers();
  const target = users.find(u => u.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  const admins = users.filter(u => u.role === 'admin');
  if (target.role === 'admin' && admins.length <= 1) return res.status(400).json({ error: 'Cannot delete the last admin' });
  users = users.filter(u => u.id !== req.params.id);
  saveUsers(users);
  res.json({ ok: true });
});

router.post('/users/:id/reset-2fa', (req, res) => {
  const users = readUsers();
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.tfaSecret = null;
  user.tfaEnabled = false;
  saveUsers(users);
  res.json({ ok: true });
});

// ── Roles ─────────────────────────────────────────────────────────────────

router.get('/roles', (req, res) => {
  res.json(readRoles());
});

router.post('/roles', (req, res) => {
  const { name, label, features } = req.body;
  if (!name || !label) return res.status(400).json({ error: 'name and label are required' });
  const roles = readRoles();
  if (roles.find(r => r.name === name)) return res.status(409).json({ error: 'Role already exists' });
  const validFeatures = (features || []).filter(f => ALL_FEATURES.includes(f));
  const newRole = { name, label, features: validFeatures, canManageUsers: false };
  roles.push(newRole);
  saveRoles(roles);
  res.json(newRole);
});

router.put('/roles/:name', (req, res) => {
  const { label, features, canManageUsers } = req.body;
  const roles = readRoles();
  const role = roles.find(r => r.name === req.params.name);
  if (!role) return res.status(404).json({ error: 'Role not found' });
  if (req.params.name === 'admin' && canManageUsers === false) return res.status(400).json({ error: 'Admin must retain canManageUsers' });
  if (label) role.label = label;
  if (features) role.features = features.filter(f => ALL_FEATURES.includes(f));
  if (canManageUsers !== undefined) role.canManageUsers = !!canManageUsers;
  saveRoles(roles);
  res.json(role);
});

router.delete('/roles/:name', (req, res) => {
  if (req.params.name === 'admin') return res.status(400).json({ error: 'Cannot delete admin role' });
  const users = readUsers();
  if (users.find(u => u.role === req.params.name)) return res.status(400).json({ error: 'Role is assigned to users — reassign first' });
  const roles = readRoles().filter(r => r.name !== req.params.name);
  saveRoles(roles);
  res.json({ ok: true });
});

router.get('/features', (req, res) => res.json(ALL_FEATURES));

// ── CF Email Mappings ──────────────────────────────────────────────────────

router.get('/cf-mappings', (req, res) => {
  res.json(readMappings());
});

router.post('/cf-mappings', (req, res) => {
  const { label, nameservers, email } = req.body;
  if (!label || !email || !Array.isArray(nameservers) || !nameservers.length) {
    return res.status(400).json({ error: 'label, email and nameservers[] are required' });
  }
  const mappings = readMappings();
  const entry = { id: Date.now().toString(), label, nameservers: nameservers.map(n => n.toLowerCase().replace(/\.$/, '').trim()), email };
  mappings.push(entry);
  saveMappings(mappings);
  res.json(entry);
});

router.put('/cf-mappings/:id', (req, res) => {
  const { label, nameservers, email } = req.body;
  const mappings = readMappings();
  const entry = mappings.find(m => m.id === req.params.id);
  if (!entry) return res.status(404).json({ error: 'Mapping not found' });
  if (label) entry.label = label;
  if (email) entry.email = email;
  if (Array.isArray(nameservers)) entry.nameservers = nameservers.map(n => n.toLowerCase().replace(/\.$/, '').trim());
  saveMappings(mappings);
  res.json(entry);
});

router.delete('/cf-mappings/:id', (req, res) => {
  let mappings = readMappings();
  if (!mappings.find(m => m.id === req.params.id)) return res.status(404).json({ error: 'Mapping not found' });
  mappings = mappings.filter(m => m.id !== req.params.id);
  saveMappings(mappings);
  res.json({ ok: true });
});

module.exports = router;

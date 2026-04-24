const express = require('express');
const router  = express.Router();
const https   = require('https');
const axios   = require('axios');
const fs      = require('fs');
const path    = require('path');

const MAPPINGS_FILE = path.join(__dirname, '..', 'data', 'cf-mappings.json');
const agent = new https.Agent({ rejectUnauthorized: false });

function readMappings() {
  try { return JSON.parse(fs.readFileSync(MAPPINGS_FILE, 'utf8')); } catch { return []; }
}

function normalizeNS(ns) {
  return ns.toLowerCase().replace(/\.$/, '').trim();
}

// GET /api/cfemail?domain=example.com
router.get('/', async (req, res) => {
  const domain = (req.query.domain || '').trim().toLowerCase().replace(/^https?:\/\//,'').replace(/\/.*/,'');
  if (!domain) return res.status(400).json({ error: 'domain is required' });

  // Resolve NS records via Google DoH
  let nameservers = [];
  try {
    const r = await axios.get('https://dns.google/resolve', {
      params: { name: domain, type: 'NS' },
      headers: { Accept: 'application/dns-json' },
      httpsAgent: agent,
      timeout: 8000,
    });
    const answers = r.data?.Answer || [];
    nameservers = answers.map(a => normalizeNS(a.data));
  } catch (e) {
    return res.status(502).json({ error: 'DNS lookup failed: ' + e.message });
  }

  if (!nameservers.length) {
    return res.json({ found: false, domain, nameservers, message: 'No NS records found for this domain.' });
  }

  const mappings = readMappings();
  for (const m of mappings) {
    const mappedNS = (m.nameservers || []).map(normalizeNS);
    const match = nameservers.some(ns => mappedNS.includes(ns));
    if (match) {
      return res.json({ found: true, domain, nameservers, email: m.email, label: m.label });
    }
  }

  res.json({
    found: false,
    domain,
    nameservers,
    message: 'Unknown — not our server. If it is our server, please contact json Arishem to add it in.',
  });
});

module.exports = router;

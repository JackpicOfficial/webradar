const express = require('express');
const router = express.Router();
const whois = require('whois');
const https = require('https');
const http = require('http');

const tlsAgent = new https.Agent({ rejectUnauthorized: false });

const RDAP_ENDPOINTS = [
  d => `https://rdap.org/domain/${d}`,
  d => `https://www.rdap.net/domain/${d}`,
  d => `https://rdap.iana.org/domain/${d}`,
];

function rdapFetch(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      agent: tlsAgent,
      headers: { 'User-Agent': 'Mozilla/5.0 WebRadar/1.0', 'Accept': 'application/rdap+json, application/json' },
    }, (res) => {
      // follow one redirect manually
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        return rdapFetch(res.headers.location).then(resolve).catch(reject);
      }
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`RDAP HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function rdapLookup(domain) {
  let lastErr;
  for (const endpointFn of RDAP_ENDPOINTS) {
    try {
      return await rdapFetch(endpointFn(domain));
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

function parseRdap(data) {
  const result = {};
  const nameServers = [];
  const statuses = [];

  if (data.ldhName) result.domainName = data.ldhName.toLowerCase();

  (data.events || []).forEach(e => {
    if (e.eventAction === 'registration') result.createdOn = e.eventDate;
    if (e.eventAction === 'expiration') result.expiresOn = e.eventDate;
    if (e.eventAction === 'last changed') result.lastUpdated = e.eventDate;
  });

  (data.status || []).forEach(s => statuses.push(s));
  if (statuses.length) result.status = statuses;

  (data.nameservers || []).forEach(ns => {
    const name = (ns.ldhName || '').toLowerCase();
    if (name) nameServers.push(name);
  });
  if (nameServers.length) result.nameServers = nameServers;

  const entities = data.entities || [];
  const registrar = entities.find(e => (e.roles || []).includes('registrar'));
  if (registrar) {
    const vcard = registrar.vcardArray?.[1] || [];
    const fnEntry = vcard.find(v => v[0] === 'fn');
    if (fnEntry) result.registrar = fnEntry[3];
  }
  const registrant = entities.find(e => (e.roles || []).includes('registrant'));
  if (registrant) {
    const vcard = registrant.vcardArray?.[1] || [];
    const fnEntry = vcard.find(v => v[0] === 'fn');
    const emailEntry = vcard.find(v => v[0] === 'email');
    const adrEntry = vcard.find(v => v[0] === 'adr');
    if (fnEntry) result.registrantName = fnEntry[3];
    if (emailEntry) result.registrantEmail = emailEntry[3];
    if (adrEntry) {
      const adr = adrEntry[3];
      if (Array.isArray(adr)) result.registrantCountry = adr[adr.length - 1];
    }
  }

  return result;
}

function whoisLookup(domain, options) {
  return new Promise((resolve, reject) => {
    whois.lookup(domain, options, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

function parseWhois(raw) {
  if (!raw) return {};
  const lines = raw.split('\n');
  const result = {};
  const nameServers = [];
  const statuses = [];

  const fieldMap = {
    'domain name': 'domainName',
    'domain': 'domainName',
    'creation date': 'createdOn',
    'created': 'createdOn',
    'registered': 'createdOn',
    'registration date': 'createdOn',
    'registry expiry date': 'expiresOn',
    'expiration date': 'expiresOn',
    'registrar registration expiration date': 'expiresOn',
    'expires': 'expiresOn',
    'expiry date': 'expiresOn',
    'paid-till': 'expiresOn',
    'updated date': 'lastUpdated',
    'last updated': 'lastUpdated',
    'last-update': 'lastUpdated',
    'modified': 'lastUpdated',
    'registrar': 'registrar',
    'sponsoring registrar': 'registrar',
    'registrar name': 'registrar',
    'registrant name': 'registrantName',
    'registrant organization': 'registrantOrg',
    'registrant email': 'registrantEmail',
    'registrant country': 'registrantCountry',
    'registrant': 'registrantName',
  };

  lines.forEach(line => {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) return;
    const key = line.substring(0, colonIdx).trim().toLowerCase();
    const value = line.substring(colonIdx + 1).trim();
    if (!value || value.startsWith('//')) return;

    if (key === 'name server' || key === 'nserver') {
      const ns = value.toLowerCase().split(' ')[0];
      if (ns && !nameServers.includes(ns)) nameServers.push(ns);
    } else if (key === 'domain status') {
      const code = value.split(' ')[0];
      if (code && !statuses.includes(code)) statuses.push(code);
    } else {
      const mapped = fieldMap[key];
      if (mapped && !result[mapped]) result[mapped] = value;
    }
  });

  if (nameServers.length) result.nameServers = nameServers;
  if (statuses.length) result.status = statuses;
  return result;
}

router.post('/', async (req, res) => {
  const { domains } = req.body;
  if (!domains || !Array.isArray(domains) || domains.length === 0) {
    return res.status(400).json({ error: 'Provide an array of domains' });
  }
  if (domains.length > 10) {
    return res.status(400).json({ error: 'Max 10 domains per request' });
  }

  const results = await Promise.allSettled(
    domains.map(async (domain) => {
      const clean = domain.trim()
        .replace(/^https?:\/\//i, '')
        .replace(/\/.*$/, '')
        .toLowerCase();
      try {
        const raw = await whoisLookup(clean, { follow: 3, timeout: 15000 });
        const isTldError = /TLD.*not supported|no whois server/i.test(raw);
        const isEmpty = !raw || raw.trim().length < 20;
        if (isTldError || isEmpty) throw new Error(isTldError ? 'whois_tld' : 'whois_empty');
        const parsed = parseWhois(raw);
        // If parsed result has almost no fields, try RDAP for richer data
        const fieldCount = Object.keys(parsed).length;
        if (fieldCount < 2) throw new Error('whois_empty');
        return { domain: clean, status: 'success', data: parsed, raw };
      } catch (err) {
        // Fall back to RDAP
        try {
          const rdapData = await rdapLookup(clean);
          const data = parseRdap(rdapData);
          return { domain: clean, status: 'success', source: 'rdap', data, raw: JSON.stringify(rdapData, null, 2) };
        } catch (rdapErr) {
          return { domain: clean, status: 'error', error: err.message === 'whois_tld' ? `TLD not supported — RDAP also failed: ${rdapErr.message}` : `Lookup failed: ${rdapErr.message}` };
        }
      }
    })
  );

  res.json(results.map(r => r.value || { status: 'error', error: r.reason?.message }));
});

module.exports = router;

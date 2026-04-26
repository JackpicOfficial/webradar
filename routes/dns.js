const express = require('express');
const router = express.Router();
const axios = require('axios');
const https = require('https');

const tlsAgent = new https.Agent({ rejectUnauthorized: false });

const DNS_RESOLVERS = [
  { id: 'google',        name: 'Google',          country: 'United States', flag: '🇺🇸', url: 'https://dns.google/resolve' },
  { id: 'cloudflare',   name: 'Cloudflare',       country: 'United States', flag: '🇺🇸', url: 'https://cloudflare-dns.com/dns-query' },
  { id: 'cloudflare2',  name: 'Cloudflare-2',     country: 'United States', flag: '🇺🇸', url: 'https://1.0.0.1/dns-query' },
  { id: 'mozilla',      name: 'Mozilla',           country: 'United States', flag: '🇺🇸', url: 'https://mozilla.cloudflare-dns.com/dns-query' },
  { id: 'google2',      name: 'Google-2',          country: 'United States', flag: '🇺🇸', url: 'https://8.8.4.4/resolve' },
  { id: 'dnssb',        name: 'DNS.SB',            country: 'Germany',       flag: '🇩🇪', url: 'https://doh.dns.sb/dns-query' },
  { id: 'alidns',       name: 'AliDNS',            country: 'China',         flag: '🇨🇳', url: 'https://dns.alidns.com/resolve' },
  { id: 'nextdns',      name: 'NextDNS',           country: 'United States', flag: '🇺🇸', url: 'https://dns.nextdns.io/dns-query' },
  { id: 'quad9',        name: 'Quad9',             country: 'Switzerland',   flag: '🇨🇭', url: 'https://dns.quad9.net:5053/dns-query' },
  { id: 'opendns',      name: 'OpenDNS',           country: 'United States', flag: '🇺🇸', url: 'https://doh.opendns.com/dns-query' },
  { id: 'adguard',      name: 'AdGuard',           country: 'Cyprus',        flag: '🇨🇾', url: 'https://dns.adguard-dns.com/resolve' },
  { id: 'cleanbrowsing',name: 'CleanBrowsing',     country: 'United States', flag: '🇺🇸', url: 'https://doh.cleanbrowsing.org/doh/family-filter/' },
  { id: 'dnspod',       name: 'DNSPod',            country: 'China',         flag: '🇨🇳', url: 'https://doh.pub/dns-query' },
  { id: 'tiarap',       name: 'Tiar.ap',           country: 'Singapore',     flag: '🇸🇬', url: 'https://doh.tiar.app/dns-query' },
];

const RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'NS', 'MX', 'TXT', 'SOA', 'PTR', 'SRV', 'CAA'];

const DNS_TYPE_NAMES = {
  1: 'A', 2: 'NS', 5: 'CNAME', 6: 'SOA', 12: 'PTR',
  15: 'MX', 16: 'TXT', 28: 'AAAA', 33: 'SRV', 257: 'CAA',
};

function friendlyError(err) {
  if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) return 'Request timed out';
  if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') return 'Resolver unreachable (DNS lookup failed)';
  if (err.code === 'ECONNREFUSED') return 'Connection refused by resolver';
  if (err.response) {
    const s = err.response.status;
    if (s === 400) return 'Bad request — JSON format not supported by this resolver';
    if (s === 403) return 'Blocked — this resolver does not allow queries from this server';
    if (s === 429) return 'Rate limited — too many requests';
    if (s === 500) return 'Resolver internal server error';
    if (s === 501) return 'Not implemented by this resolver';
    if (s === 502 || s === 503) return 'Resolver temporarily unavailable';
    return `HTTP ${s} error`;
  }
  return err.message || 'Unknown error';
}

async function queryDoH(resolver, domain, type) {
  try {
    const response = await axios.get(resolver.url, {
      params: { name: domain, type },
      headers: { Accept: 'application/dns-json' },
      timeout: 8000,
      httpsAgent: tlsAgent,
    });
    const data = response.data;
    const rcode = data.Status;
    const answers = (data.Answer || []).map(a => ({
      name: a.name,
      type: DNS_TYPE_NAMES[a.type] || String(a.type),
      ttl: a.TTL,
      data: a.data,
    }));
    return {
      id: resolver.id, resolver: resolver.name, country: resolver.country, flag: resolver.flag,
      status: 'success', rcode: rcode === 0 ? 'NOERROR' : `RCODE:${rcode}`,
      answers,
    };
  } catch (err) {
    return {
      id: resolver.id, resolver: resolver.name, country: resolver.country, flag: resolver.flag,
      status: 'error', error: friendlyError(err),
      httpStatus: err.response?.status || null,
    };
  }
}

// Health check — test each resolver with a known domain
router.get('/resolvers', async (req, res) => {
  const testDomain = 'example.com';
  const results = await Promise.all(
    DNS_RESOLVERS.map(async (r) => {
      const result = await queryDoH(r, testDomain, 'A');
      return {
        id: r.id,
        name: r.name,
        country: r.country,
        flag: r.flag,
        url: r.url,
        online: result.status === 'success',
        error: result.status === 'error' ? result.error : null,
        httpStatus: result.httpStatus || null,
      };
    })
  );
  res.json(results);
});

router.post('/', async (req, res) => {
  const { domains, recordType, resolverIds } = req.body;
  if (!domains || !Array.isArray(domains) || domains.length === 0) {
    return res.status(400).json({ error: 'Provide an array of domains' });
  }
  if (domains.length > 5) {
    return res.status(400).json({ error: 'Max 5 domains per request' });
  }

  const type = RECORD_TYPES.includes(recordType?.toUpperCase()) ? recordType.toUpperCase() : 'A';

  // Filter resolvers if specific IDs requested; otherwise use all
  const selected = (Array.isArray(resolverIds) && resolverIds.length > 0)
    ? DNS_RESOLVERS.filter(r => resolverIds.includes(r.id))
    : DNS_RESOLVERS;

  const resolversToUse = selected.length > 0 ? selected : DNS_RESOLVERS;

  const results = await Promise.all(
    domains.map(async (domain) => {
      const clean = domain.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();
      const resolverResults = await Promise.all(
        resolversToUse.map(r => queryDoH(r, clean, type))
      );
      return { domain: clean, recordType: type, resolvers: resolverResults };
    })
  );

  res.json(results);
});

module.exports = router;

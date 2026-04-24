const express = require('express');
const router = express.Router();
const axios = require('axios');
const https = require('https');

const tlsAgent = new https.Agent({ rejectUnauthorized: false });

const DNS_RESOLVERS = [
  { name: 'Google',      country: 'United States', flag: '🇺🇸', url: 'https://dns.google/resolve' },
  { name: 'Cloudflare',  country: 'United States', flag: '🇺🇸', url: 'https://cloudflare-dns.com/dns-query' },
  { name: 'Mozilla',     country: 'United States', flag: '🇺🇸', url: 'https://mozilla.cloudflare-dns.com/dns-query' },
  { name: 'Cloudflare-2',country: 'United States', flag: '🇺🇸', url: 'https://1.0.0.1/dns-query' },
  { name: 'Google-2',    country: 'United States', flag: '🇺🇸', url: 'https://8.8.4.4/resolve' },
  { name: 'DNS.SB',      country: 'Germany',       flag: '🇩🇪', url: 'https://doh.dns.sb/dns-query' },
  { name: 'AliDNS',      country: 'China',         flag: '🇨🇳', url: 'https://dns.alidns.com/resolve' },
  { name: 'NextDNS',     country: 'United States', flag: '🇺🇸', url: 'https://dns.nextdns.io/dns-query' },
];

const RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'NS', 'MX', 'TXT', 'SOA', 'PTR', 'SRV', 'CAA'];

const DNS_TYPE_NAMES = {
  1: 'A', 2: 'NS', 5: 'CNAME', 6: 'SOA', 12: 'PTR',
  15: 'MX', 16: 'TXT', 28: 'AAAA', 33: 'SRV', 257: 'CAA',
};

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
      resolver: resolver.name, country: resolver.country, flag: resolver.flag,
      status: 'success', rcode: rcode === 0 ? 'NOERROR' : `RCODE:${rcode}`,
      answers,
    };
  } catch (err) {
    return {
      resolver: resolver.name, country: resolver.country, flag: resolver.flag,
      status: 'error', error: err.code === 'ECONNABORTED' ? 'Timeout' : err.message,
    };
  }
}

router.post('/', async (req, res) => {
  const { domains, recordType } = req.body;
  if (!domains || !Array.isArray(domains) || domains.length === 0) {
    return res.status(400).json({ error: 'Provide an array of domains' });
  }
  if (domains.length > 5) {
    return res.status(400).json({ error: 'Max 5 domains per request' });
  }

  const type = RECORD_TYPES.includes(recordType?.toUpperCase()) ? recordType.toUpperCase() : 'A';

  const results = await Promise.all(
    domains.map(async (domain) => {
      const clean = domain.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();
      const resolverResults = await Promise.all(
        DNS_RESOLVERS.map(r => queryDoH(r, clean, type))
      );
      return { domain: clean, recordType: type, resolvers: resolverResults };
    })
  );

  res.json(results);
});

module.exports = router;

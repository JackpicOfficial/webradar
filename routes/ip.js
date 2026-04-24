const express = require('express');
const router = express.Router();
const axios = require('axios');

const PROVIDERS = [
  {
    name: 'ipinfo.io',
    url: (ip) => `https://ipinfo.io/${ip}/json`,
    parse: (d) => ({
      ip: d.ip, hostname: d.hostname, city: d.city, region: d.region,
      country: d.country, location: d.loc, org: d.org,
      postal: d.postal, timezone: d.timezone, anycast: d.anycast,
    }),
  },
  {
    name: 'DB-IP',
    url: (ip) => `https://api.db-ip.com/v2/free/${ip}`,
    parse: (d) => ({
      ip: d.ipAddress, city: d.city, region: d.stateProv,
      country: d.countryCode, countryName: d.countryName,
      continent: d.continentCode, isp: d.isp,
    }),
  },
  {
    name: 'ipapi.co',
    url: (ip) => `https://ipapi.co/${ip}/json/`,
    parse: (d) => ({
      ip: d.ip, city: d.city, region: d.region,
      country: d.country_code, countryName: d.country_name,
      continent: d.continent_code, latitude: d.latitude, longitude: d.longitude,
      timezone: d.timezone, utcOffset: d.utc_offset,
      org: d.org, asn: d.asn, currency: d.currency, languages: d.languages,
    }),
  },
  {
    name: 'ip-api.com',
    url: (ip) => `http://ip-api.com/json/${ip}?fields=66846719`,
    parse: (d) => ({
      ip: d.query, city: d.city, region: d.regionName,
      country: d.countryCode, countryName: d.country,
      continent: d.continent, latitude: d.lat, longitude: d.lon,
      timezone: d.timezone, isp: d.isp, org: d.org, asn: d.as,
      mobile: d.mobile, proxy: d.proxy, hosting: d.hosting, reverse: d.reverse,
    }),
  },
  {
    name: 'ipwho.is',
    url: (ip) => `https://ipwho.is/${ip}`,
    parse: (d) => ({
      ip: d.ip, type: d.type, city: d.city, region: d.region,
      country: d.country_code, countryName: d.country,
      continent: d.continent_code, latitude: d.latitude, longitude: d.longitude,
      postal: d.postal, callingCode: d.calling_code,
      isp: d.connection?.isp, org: d.connection?.org,
      asn: d.connection?.asn, domain: d.connection?.domain,
      timezone: d.timezone?.id, utc: d.timezone?.utc,
    }),
  },
  {
    name: 'freeipapi.com',
    url: (ip) => `https://freeipapi.com/api/json/${ip}`,
    parse: (d) => ({
      ip: d.ipAddress, city: d.cityName, region: d.regionName,
      country: d.countryCode, countryName: d.countryName,
      continent: d.continentCode, latitude: d.latitude, longitude: d.longitude,
      timezone: d.timeZone, language: d.languageCode,
      currency: d.currencyCode, currencyName: d.currencyName,
      proxy: d.isProxy,
    }),
  },
  {
    name: 'ip.sb',
    url: (ip) => `https://api.ip.sb/geoip/${ip}`,
    parse: (d) => ({
      ip: d.ip, city: d.city, region: d.region,
      country: d.country_code, countryName: d.country,
      continent: d.continent_code, latitude: d.latitude, longitude: d.longitude,
      isp: d.isp, org: d.organization, asn: d.asn,
      asnOrg: d.asn_organization, timezone: d.timezone,
    }),
  },
];

router.post('/', async (req, res) => {
  const { ips } = req.body;
  if (!ips || !Array.isArray(ips) || ips.length === 0) {
    return res.status(400).json({ error: 'Provide an array of IPs' });
  }
  if (ips.length > 10) {
    return res.status(400).json({ error: 'Max 10 IPs per request' });
  }

  const results = await Promise.all(
    ips.map(async (ip) => {
      const cleanIp = ip.trim();
      const providerResults = await Promise.allSettled(
        PROVIDERS.map(async (provider) => {
          try {
            const response = await axios.get(provider.url(cleanIp), {
              timeout: 8000,
              headers: { 'User-Agent': 'WebRadar/1.0', ...(provider.headers || {}) },
            });
            if (response.data?.error) throw new Error(response.data.error);
            return { provider: provider.name, status: 'success', data: provider.parse(response.data) };
          } catch (err) {
            return {
              provider: provider.name, status: 'error',
              error: err.response?.data?.message || err.response?.data?.reason || err.message,
            };
          }
        })
      );
      return {
        ip: cleanIp,
        providers: providerResults.map(r => r.value || { provider: 'unknown', status: 'error', error: r.reason?.message }),
      };
    })
  );

  res.json(results);
});

module.exports = router;

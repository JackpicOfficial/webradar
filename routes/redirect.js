const express = require('express');
const router = express.Router();
const axios = require('axios');

async function followRedirects(startUrl) {
  const chain = [];
  let currentUrl = startUrl;
  const maxHops = 20;

  for (let i = 0; i < maxHops; i++) {
    try {
      const response = await axios.get(currentUrl, {
        maxRedirects: 0,
        validateStatus: () => true,
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WebRadar/1.0; +https://webradar.app)' },
      });

      const step = {
        url: currentUrl,
        status: response.status,
        statusText: response.statusText,
        server: response.headers['server'] || null,
        contentType: response.headers['content-type'] || null,
      };

      const location = response.headers['location'];
      if (location) {
        let nextUrl = location;
        if (nextUrl.startsWith('/')) {
          const u = new URL(currentUrl);
          nextUrl = `${u.protocol}//${u.host}${nextUrl}`;
        } else if (!nextUrl.startsWith('http')) {
          const u = new URL(currentUrl);
          nextUrl = `${u.protocol}//${u.host}/${nextUrl}`;
        }
        step.redirectTo = nextUrl;
        chain.push(step);
        currentUrl = nextUrl;
      } else {
        chain.push(step);
        break;
      }
    } catch (err) {
      chain.push({ url: currentUrl, status: 'error', error: err.message });
      break;
    }
  }

  return chain;
}

router.post('/', async (req, res) => {
  const { urls } = req.body;
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'Provide an array of URLs' });
  }
  if (urls.length > 10) {
    return res.status(400).json({ error: 'Max 10 URLs per request' });
  }

  const results = await Promise.all(
    urls.map(async (url) => {
      const raw = url.trim();
      const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      try {
        const chain = await followRedirects(withProto);
        const last = chain[chain.length - 1];
        return {
          url: withProto, status: 'success',
          finalUrl: last?.url || withProto,
          finalStatus: last?.status,
          hops: chain.length,
          chain,
        };
      } catch (err) {
        return { url: withProto, status: 'error', error: err.message };
      }
    })
  );

  res.json(results);
});

module.exports = router;

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Titansoft.Crypto.TiCrypto — 3DES CBC PKCS7
// Key and IV extracted from Crypto.dll (TripleDESCryptoServiceProvider)
const DES_KEY = Buffer.from('JWtud2lANGthc2RZamplJiU2S210ZS4w', 'base64');
const DES_IV  = Buffer.from('Jndkc0A1XiY=', 'base64');

function tiEncrypt(plaintext) {
  const cipher = crypto.createCipheriv('des-ede3-cbc', DES_KEY, DES_IV);
  cipher.setAutoPadding(true); // PKCS7
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return enc.toString('base64');
}

function tiDecrypt(ciphertext) {
  const decipher = crypto.createDecipheriv('des-ede3-cbc', DES_KEY, DES_IV);
  decipher.setAutoPadding(true);
  const dec = Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]);
  return dec.toString('utf8');
}

router.post('/', (req, res) => {
  const { mode, text } = req.body;
  if (!['encrypt', 'decrypt'].includes(mode))
    return res.status(400).json({ error: 'Mode must be encrypt or decrypt' });
  if (!text || typeof text !== 'string')
    return res.status(400).json({ error: 'Text is required' });

  try {
    const result = mode === 'encrypt' ? tiEncrypt(text) : tiDecrypt(text);
    res.json({ result });
  } catch (err) {
    res.status(400).json({ error: 'Crypto error: ' + err.message });
  }
});

module.exports = router;

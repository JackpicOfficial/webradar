# WebRadar Plus

**WebRadar Plus** is a self-hosted network intelligence dashboard built for infrastructure and security teams. It combines multiple network diagnostic tools into a single, clean interface — protected by session-based authentication with role-based access control and optional 2FA.

> Powered & Built by **JackpicOfficial**

[![Docker Hub](https://img.shields.io/docker/pulls/21degree/webradar-plus?label=Docker%20Pulls&logo=docker&style=flat-square)](https://hub.docker.com/r/21degree/webradar-plus)
[![GitHub](https://img.shields.io/badge/GitHub-JackpicOfficial-181717?logo=github&style=flat-square)](https://github.com/JackpicOfficial/webradar)

---

## Features

| Tool | Description |
|---|---|
| ◎ **WHOIS** | Domain registration lookup via WHOIS + RDAP fallback |
| ⊕ **IP Checker** | Queries 7 geolocation providers simultaneously |
| ⊗ **DNS Checker** | DNS propagation across 8 global resolvers, all record types |
| ⇢ **Redirect Checker** | Traces full redirect chain with status codes |
| ✎ **Text Calculator** | Live character, word, sentence and reading-time stats |
| ⊙ **Password Generator** | Cryptographically random passwords or passphrases |
| **Aa Case Converter** | 7 case styles — Sentence, lower, UPPER, Capitalized, aLtErNaTiNg, Title, InVeRsE |
| ⊞ **Syntax Validator** | JSON, YAML, JS, HTML, XML, CSS, Python, Dockerfile, ENV, K8s, Docker Compose |
| ✉ **CF Email Check** | Map nameservers to contact emails — admin-configurable |
| ⚙ **Admin Panel** | User management, role-based feature access, 2FA per user |

---

## Authentication

- Session-based login (8-hour session, optional **Remember Me** for 24 hours)
- Per-user **TOTP 2FA** (Google Authenticator, Authy, etc.)
- Role-based access — control which tools each role can see
- Default admin account created automatically on first run

**Default credentials (change immediately after first login):**
```
Username: admin
Password: Admin@123
```

---

## Deployment

### Option 1 — npm (local / development)

**Requirements:** Node.js 18+

```bash
git clone https://github.com/JackpicOfficial/webradar.git
cd webradar
npm install
node server.js
```

Open `http://localhost:3000`

For auto-reload during development:
```bash
npm run dev
```

---

### Option 2 — Docker

**Requirements:** Docker

Pull straight from Docker Hub — no need to clone the repo:
```bash
docker pull 21degree/webradar-plus:latest
docker run -d \
  -p 8080:3000 \
  -v $(pwd)/data:/app/data \
  --name webradar \
  --restart unless-stopped \
  21degree/webradar-plus:latest
```

Open `http://localhost:8080`

> 🐳 Docker Hub: [hub.docker.com/r/21degree/webradar-plus](https://hub.docker.com/r/21degree/webradar-plus)

---

### Option 3 — Docker Compose ✅ Recommended

**Requirements:** Docker + Docker Compose

Pull from Docker Hub (no build needed):
```bash
curl -O https://raw.githubusercontent.com/JackpicOfficial/webradar/main/docker-compose.yml
mkdir -p data
docker-compose up -d
```

Or clone the full repo:
```bash
git clone https://github.com/JackpicOfficial/webradar.git
cd webradar
docker-compose up -d
```

Open `http://localhost:8080`

To stop:
```bash
docker-compose down
```

To update after a code change:
```bash
docker-compose up -d --build
```

---

## Data Persistence

All user accounts, roles and CF email mappings are stored in the `data/` folder:

```
data/
  users.json        ← user accounts (hashed passwords, 2FA secrets)
  roles.json        ← role definitions and feature permissions
  cf-mappings.json  ← CF email nameserver mappings
```

The `docker-compose.yml` mounts this folder as a volume (`./data:/app/data`) so your data **persists across restarts and rebuilds**.

> ⚠️ Back up the `data/` folder regularly. Do not commit it to Git — it contains password hashes.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the server listens on |
| `NODE_ENV` | `production` | Node environment |
| `SESSION_SECRET` | *(built-in fallback)* | Secret for signing session cookies — **set this in production** |
| `ENCRYPTION_KEY` | *(falls back to SESSION_SECRET)* | Key for AES-256-GCM encryption of data files — **set this in production** |

To set secrets, create a `.env` file:
```env
SESSION_SECRET=your-long-random-secret-here
ENCRYPTION_KEY=another-long-random-secret-here
```

---

## Roles & Permissions

WebRadar Plus uses role-based access control. Each role defines which tools are visible to its users.

- **Admin** — full access + user/role management
- **Viewer** — read-only access to WHOIS, IP, DNS, Redirects
- Custom roles can be created from the Admin Panel

---

## Project Structure

```
webradar/
├── server.js          ← Express app entry point
├── routes/            ← API route handlers
│   ├── auth.js
│   ├── whois.js
│   ├── ip.js
│   ├── dns.js
│   ├── redirect.js
│   ├── validator.js
│   ├── cfemail.js
│   └── admin.js
├── middleware/
│   └── auth.js        ← requireAuth / requireAdmin
├── lib/
│   └── totp.js        ← TOTP implementation (RFC 6238)
├── public/            ← Frontend (HTML, CSS, JS)
│   ├── index.html
│   ├── login.html
│   ├── app.js
│   └── style.css
├── data/              ← Persistent data (DO NOT COMMIT)
│   ├── users.json
│   ├── roles.json
│   └── cf-mappings.json
├── Dockerfile
└── docker-compose.yml
```

---

## .gitignore

Make sure your `.gitignore` includes:
```
node_modules/
data/
.env
```

---

## License

MIT — Built by [JackpicOfficial](https://github.com/JackpicOfficial)

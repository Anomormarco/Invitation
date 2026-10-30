# INVITE

A cute, modern digital date invitation.

- **Landing / invitation** (`/`) — one personalised page. Big question, a `Yes` button
  that grows and a `No` button that dodges the cursor. On yes: confetti, pick a time
  slot, leave a note.
- **Admin dashboard** (`/dashboard`) — check the responses that came in from the landing:
  who opened the link, who said yes / no, chosen slot, note, and how many times they
  dodged the `No` button.

## Architecture

Monolith, one repo, two npm workspaces:

| Part     | Stack                                            |
| -------- | ----------------------------------------------- |
| `client` | React + TypeScript (Vite), framer-motion, confetti |
| `server` | Node + Express + TypeScript, Prisma ORM         |
| database | PostgreSQL                                       |

**RBAC** — two roles, enforced by Express middleware (`server/src/rbac.ts`). No login /
register. The `public` role opens the invitation endpoints; the `admin` role (a shared
key) opens the dashboard endpoints.

| Route                          | Role     |
| ------------------------------ | -------- |
| `GET  /api/config`             | public   |
| `POST /api/visit`              | public   |
| `POST /api/response`           | public   |
| `GET  /api/responses`          | admin    |
| `GET  /api/stats`              | admin    |

## PostgreSQL configuration

Started by `docker-compose.yml`:

| Setting  | Value            |
| -------- | ---------------- |
| Host     | `localhost`      |
| Port     | `5432`           |
| Database | `invite_db`      |
| User     | `invite`         |
| Password | `invite_dev_pw`  |

Connection string (already in `server/.env`):

```
postgresql://invite:invite_dev_pw@localhost:5432/invite_db?schema=public
```

## Run locally

```bash
# 1. install
npm install

# 2. start local PostgreSQL and create tables (Docker Desktop must be running)
npm run setup:local

# 3. start client + server together
npm run dev
```

- Invitation → http://localhost:5174
- Dashboard  → http://localhost:5174/dashboard
  (the key is remembered after the first visit; change it via `ADMIN_KEY` in `server/.env`)
- API        → http://localhost:4000

Handy:

```bash
npm run db:studio     # Prisma Studio — browse the DB
npm run db:reset      # wipe the DB volume and recreate
npm run db:down       # stop postgres
```

## Personalise

Edit `server/.env`:

```
INVITE_TO="Nandin"
INVITE_FROM="Bat"
INVITE_KICKER="I have been meaning to ask you something"
INVITE_QUESTION="Will you go on a date with me?"
INVITE_MESSAGE="No pressure at all — an evening with you would be really nice."
INVITE_SLOTS="Friday 7pm,Saturday brunch,Sunday sunset walk"
```

## Deploy on Render

### 1. Database — Render PostgreSQL

New > PostgreSQL. Name `invite-db`, Database `invite`, User `invite`,
**Region: Singapore** (closest to MN — the web service must use the same region),
version 16, Free or Basic plan.

When it is `Available`, open it and copy two URLs from **Connections**:

- **External Database URL** — for running the schema push from your laptop
- **Internal Database URL** — for the web service

Push the tables (Render's DB user can't create the shadow DB that `migrate dev`
needs, so use `db push`):

```bash
# server/.env → DATABASE_URL = External URL + ?sslmode=require
npm run db:push
```

### 2. Server — Render Web Service

New > Web Service, same repo, **Region: Singapore**. Render auto-detects the
`Dockerfile`; leave build/start blank (the image handles it) or use:

| Field         | Value                        |
| ------------- | --------------------------- |
| Build command | `npm install && npm run build` (if not using Docker) |
| Start command | `npm start`                  |
| Health check  | `/api/health`                |

Environment variables:

| Key             | Value                                                    |
| --------------- | ------------------------------------------------------- |
| `DATABASE_URL`  | the **Internal Database URL**                            |
| `ADMIN_KEY`     | a long random string (dashboard key)                    |
| `CLIENT_ORIGIN` | the **Vercel** client URL, e.g. `https://huurhun-husleed.vercel.app` (comma-separate to allow more) |
| `NODE_ENV`      | `production`                                             |
| `RUN_DB_PUSH`   | `1` for the first deploy against a fresh DB (then remove) |

### 3. Client — Vercel

New Project > import the same GitHub repo.

| Setting          | Value      |
| ---------------- | ---------- |
| Root Directory   | `client`   |
| Framework Preset | Vite       |
| Build / Output   | auto (`npm run build` → `dist`) — `client/vercel.json` also sets it |

Environment variable:

| Key            | Value                                             |
| -------------- | ----------------------------------------------- |
| `VITE_API_URL` | the Render server URL, e.g. `https://invite-xxxx.onrender.com` |

`client/vercel.json` adds the SPA rewrite so `/dashboard` deep-links work.
Order: deploy the server first, then set `VITE_API_URL` on Vercel and redeploy,
then set `CLIENT_ORIGIN` on Render to the Vercel URL.

- Invitation: `https://<your-app>.vercel.app`
- Dashboard:  `https://<your-app>.vercel.app/dashboard?key=<ADMIN_KEY>`

(Local dev is unchanged — leave `VITE_API_URL` empty and the Vite proxy forwards
`/api` and `/socket.io` to `:4000`.)

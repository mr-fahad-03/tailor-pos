# Deploying Tailor POS to Vercel

The site and the API ship as **one Vercel project on one domain**. Next.js
serves the pages; the Express API runs as a serverless function mounted at
`/api` on that same domain, so the browser never makes a cross-origin request
and there is no CORS to configure.

```
   tailor-pos.vercel.app
   ├── /  /job-cards  /sales  …     Next.js pages
   └── /api/*                       Express, as one serverless function
                                          │
                                          ▼
                                    MongoDB Atlas
```

---

## 1. Open the database to Vercel

Vercel's outbound IP addresses change on every deploy, so Atlas has to accept
connections from anywhere. **Do this first** — without it every request fails
with a connection timeout.

1. Atlas → **Network Access** → **Add IP Address**
2. Choose **Allow access from anywhere** (`0.0.0.0/0`) → Confirm

From that point the database password is the only thing protecting your data,
so it must be strong and must not be shared.

## 2. Push the code to GitHub

This project is not a git repository yet:

```bash
cd ~/Desktop/tailor-pos-v1
git init
git add .
git commit -m "Tailor POS"
git remote add origin https://github.com/<you>/tailor-pos.git
git push -u origin main
```

`.gitignore` already excludes `server/.env` and `client/.env.local`, so no
credentials are pushed. Confirm with `git status` before committing.

## 3. Create the Vercel project

Import the repository at [vercel.com/new](https://vercel.com/new), then set:

| Setting | Value |
|---|---|
| **Root Directory** | `client` |
| Framework Preset | Next.js (detected) |
| Build / install commands | leave as detected |

Root Directory **must** be `client` — that is where the Next.js app lives.
Vercel installs the npm workspaces from the repository root automatically, so
the `server` package is available to the API function.

## 4. Environment variables

Project → **Settings** → **Environment Variables**. Add these for
**Production, Preview and Development**:

| Name | Value |
|---|---|
| `MONGODB_URI` | your full Atlas string, **including `/tailor-pos`** before the `?` |
| `JWT_SECRET` | a fresh 96-character hex string (below) |
| `JWT_EXPIRES_IN` | `12h` |

Generate a secret that is not the one used locally:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Leave `NEXT_PUBLIC_API_URL` **unset**. The client falls back to the relative
`/api` on any non-localhost host, which is what you want. `CORS_ORIGIN` is also
unnecessary while the site and API share a domain.

`JWT_SECRET` is required in production: the API refuses to start without it
rather than falling back to the insecure development key.

## 5. Deploy, then check

Deploy, then confirm the API is alive on the live domain:

```bash
curl https://<your-app>.vercel.app/api/health
# {"ok":true,"time":"..."}

curl -o /dev/null -w "%{http_code}\n" https://<your-app>.vercel.app/api/ledgers
# 401  — good, the API is protected
```

Then open the site and sign in.

---

## Notes

**The database is already seeded.** Production points at the same Atlas cluster
you have been using, so the ledgers, products, counters and user accounts are
already there. Do **not** run `npm run seed` again unless you are pointing at a
fresh database.

**Change the passwords.** `superadmin`, `admin` and `salesman` ship with
passwords that appear in this repository's documentation. Anyone who finds the
URL can sign in until you change them — do it from the account menu
immediately after the first deploy.

**Cold starts.** After a quiet period the first API request takes about a
second while the function boots and connects to Atlas. Subsequent requests are
normal. The Mongo connection is cached across invocations so a busy counter
does not reopen it per request.

**Upgrade Next.js.** `next@14.2.5` carries a published security advisory. Run
`npm i next@latest --workspace=client`, check the app still builds, and
redeploy.

**Local development is unchanged.** `npm run dev` still runs the API as a real
server on port 5000 and the site on 3000; only the deployed build uses the
serverless path.

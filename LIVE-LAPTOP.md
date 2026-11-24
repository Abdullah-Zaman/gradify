# Running Gradify live from this laptop

Free setup for a 1–2 month test:

```
Browser ──> Vercel (frontend, Next.js)            https://<project>.vercel.app
   │
   └─ API calls + file links ──> Tailscale Funnel  https://<device>.<tailnet>.ts.net  (:443)
                                      │
                                      └─> backend on 127.0.0.1:4000 (production build)
                                             ├─ Postgres in Docker (127.0.0.1:5432)
                                             └─ backend/uploads (files stay on this laptop)
```

The site only works while this laptop is **on, awake, online, and running `start-live.ps1`**.

## 1. Tailscale setup (once)

1. Install Tailscale for Windows from tailscale.com and sign in.
2. In the Tailscale admin console, open **DNS** and enable **MagicDNS** and **HTTPS Certificates**.
3. In PowerShell, run `tailscale funnel 4000` once, without `--bg`. If Funnel is not enabled for
   your tailnet yet, it prints a link: open it and approve. After that it prints your public URL,
   `https://<device>.<tailnet>.ts.net`. Write it down, then press Ctrl+C.
4. Optional: rename the device in the admin console *before* this step if you want a nicer URL.
   Renaming it later changes the URL.

## 2. Backend config (once)

In `backend\.env` (copy from `backend\.env.example` if missing), set:

```
FRONTEND_URL=http://localhost:3000,https://<project>.vercel.app
```

- These must be exact origins: `https://`, no trailing slash, no path.
- Vercel *preview* URLs (`<project>-git-...vercel.app`) are different origins. Add them here too if you test previews.
- `JWT_SECRET` / `JWT_REFRESH_SECRET` must be set (32+ chars each, different from each other).
- You do **not** set `NODE_ENV`, `HOST`, `TRUST_PROXY` or `PORT` here. `start-live.ps1` sets them.

First time on an empty database only: `cd backend; npm run db:setup` (with Docker running).

## 3. Vercel setup (once)

1. On vercel.com: **Add New → Project**, then import the GitHub repo.
2. **Root Directory:** `frontend`. Framework preset: Next.js (auto-detected). Leave the build and install commands at their defaults.
3. **Environment Variables:** add exactly one, for Production (and Preview if you use it):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://<device>.<tailnet>.ts.net` (no trailing slash) |

4. Deploy. Copy the production URL (`https://<project>.vercel.app`) into `FRONTEND_URL` (step 2),
   then restart the live backend.

`NEXT_PUBLIC_API_URL` is baked in at build time. After changing it, **redeploy** in Vercel
(Deployments → ⋯ → Redeploy). Uploaded-file links also use this URL.

## 4. Start / stop

From the repo root in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-live.ps1      # DB + build + backend + funnel
powershell -ExecutionPolicy Bypass -File .\start-live.ps1 -SkipBuild   # restart without rebuilding
powershell -ExecutionPolicy Bypass -File .\stop-live.ps1       # funnel off, backend off, DB stopped
powershell -ExecutionPolicy Bypass -File .\stop-live.ps1 -KeepDatabase
```

- Stop `npm run start:dev` first. Both use port 4000, and the script refuses to start if the port is taken.
- Backend logs: `backend\logs\live.out.log` and `backend\logs\live.err.log`.
- After a reboot, start Docker Desktop and run `start-live.ps1` again.
- Keep the laptop awake: Settings → System → Power → set *Sleep* to **Never** while plugged in.
- Database data lives in the Docker volume `postgres_data`. `stop-live.ps1` keeps it. Don't run `docker compose down -v`.

## 5. If login fails

Open the browser DevTools (F12) → **Network** / **Console** on the Vercel site and try again.

| Symptom | Cause / fix |
|---|---|
| Requests go to `localhost:4000` or to the vercel.app domain itself | `NEXT_PUBLIC_API_URL` missing or wrong in Vercel. Fix it, then **redeploy**. |
| "blocked by CORS policy" | The Vercel origin is not in `FRONTEND_URL` exactly (check https, trailing slash, preview URL). Fix `backend\.env`, then stop and start. |
| `ERR_CONNECTION_*` / timeout to `.ts.net` | Laptop asleep or offline, backend not running, or funnel off. Run `tailscale funnel status` and open `https://<device>.<tailnet>.ts.net/` on your phone using mobile data. |
| 502 from the `.ts.net` URL | Funnel is up but the backend isn't. Check `backend\logs\live.err.log` and run `start-live.ps1` again. |
| 429 "Too many attempts…" | 10 failed logins from that IP in 15 min. Wait, or restart the backend (the counter is in memory). |
| 401 "Invalid credentials" | Wrong email, password or role. Users come from the laptop's database. |
| Backend won't start | Read the error in the console or `live.err.log`. Usually a missing or short `JWT_*` secret, or `FRONTEND_URL` / `DATABASE_URL` not set. |

**Checking real visitor IPs:** after a login from another network, open Admin → Users → login
history (or the Activity log). The IP should be the visitor's public IP. If every entry shows
`127.0.0.1`, the proxy isn't passing `X-Forwarded-For`. Then all visitors share one rate-limit
bucket, so report it.

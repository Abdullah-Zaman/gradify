# Deploying Gradify to a Linux server

This runs PostgreSQL, the NestJS backend and the Next.js frontend with Docker Compose. nginx on the host serves one domain:

| URL | Goes to |
|---|---|
| `https://your-domain.com/` | frontend container (`127.0.0.1:3000`) |
| `https://your-domain.com/api/...` | backend container (`127.0.0.1:4000`), with `/api` stripped |

**Why `/api` on the same domain instead of an `api.` subdomain?** You only need one DNS record and one TLS certificate. The browser sees a single origin, so there are no CORS preflights and cookie/HTTPS rules stay simple. Both containers listen on `127.0.0.1` only, so the only public entry point is nginx.

## 1. Server prerequisites (Ubuntu/Debian)

```bash
# Docker Engine + compose plugin: https://docs.docker.com/engine/install/
sudo apt-get install -y nginx certbot python3-certbot-nginx git
```

Point your domain's DNS A record at the server. Open ports 80 and 443. Do not open 3000, 4000 or 5432.

## 2. Get the code and configure

```bash
git clone <repo-url> gradify && cd gradify
cp .env.prod.example .env.prod
nano .env.prod      # fill in every value (see the comments in the file)
chmod 600 .env.prod
```

- `POSTGRES_PASSWORD`: letters and digits only, for example `openssl rand -hex 24`.
- `JWT_SECRET` / `JWT_REFRESH_SECRET`: two different values from `openssl rand -base64 48`.
- `FRONTEND_URL=https://your-domain.com` and `NEXT_PUBLIC_API_URL=https://your-domain.com/api`.

`NEXT_PUBLIC_API_URL` is baked into the frontend at build time. If you change it, rebuild the frontend (step 3).

## 3. Build and start

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
```

## 4. Prepare the empty database (first deploy only)

This creates the tables, then the super admin, the manager, the academic structure and the default settings:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend npm run db:setup
```

The seed scripts skip accounts that already exist, so it is safe to re-run.

## 5. nginx + HTTPS

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/gradify
sudo sed -i 's/your-domain.com/<your real domain>/g' /etc/nginx/sites-available/gradify
sudo ln -s /etc/nginx/sites-available/gradify /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d <your real domain>
```

Open `https://<your domain>/login` (or `/admin-login` for the super admin).

## Updating

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
# after schema changes:
docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend npx prisma db push
```

## Operations

- Logs: `docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f backend`
- Database backup:
  `docker compose -f docker-compose.prod.yml --env-file .env.prod exec postgres pg_dump -U <POSTGRES_USER> <POSTGRES_DB> > backup.sql`
- Data lives in the named volumes `postgres_data` and `uploads`. `docker compose down` keeps them, but `down -v` **deletes** them.
- Uploaded files under `/api/uploads/...` are publicly readable by anyone with the link.

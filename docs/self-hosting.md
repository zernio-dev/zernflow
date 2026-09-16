# Self-hosting ZernFlow

The Quick Start in the README targets Supabase Cloud and Vercel. This guide
covers running everything yourself — the app plus the Supabase services it
depends on — with Docker Compose, and then the same stack on
[Dokploy](https://dokploy.com).

Everything here was verified end to end on a fresh host: signup, the workspace
trigger, PostgREST reads under RLS, a realtime `postgres_changes` subscription,
and both cron endpoints.

## What ZernFlow actually needs

| Service | Why | Image |
|---|---|---|
| Postgres | schema, RLS, `auth.users` | `supabase/postgres:15.8.1.060` |
| GoTrue | `/login`, `/register`, `/auth/callback` | `supabase/gotrue:v2.174.0` |
| PostgREST | every `supabase.from(...)` call | `postgrest/postgrest:v12.2.12` |
| Realtime | the inbox subscribes to `postgres_changes` on `conversations` and `messages` | `supabase/realtime:v2.34.47` |
| Gateway | routes `/auth/v1`, `/rest/v1`, `/realtime/v1` under one origin | `nginx:1.27-alpine` |
| Cron | replaces the `vercel.json` cron entries | `alpine:3.20` |

Storage is **not** needed — the codebase never calls `storage.from()`.

## Quick start with Docker Compose

```bash
git clone https://github.com/zernio-dev/zernflow.git
cd zernflow/docker
cp .env.example .env
node generate-keys.mjs >> .env      # appends JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY, ...
$EDITOR .env                        # set SITE_URL and SUPABASE_PUBLIC_URL
docker compose --env-file .env up -d --build
```

Then open `SITE_URL`, register, and enter your Zernio API key under **Settings**.

`SITE_URL` and `SUPABASE_PUBLIC_URL` must be the addresses a **browser** can
reach, not internal Docker hostnames: the browser talks to the gateway directly.

## Five things that bite when you self-host

### 1. The `postgres` role cannot configure the Supabase roles

In the `supabase/postgres` image, `postgres` is not a superuser and supautils
guards the internal roles, so the obvious setup step fails:

```
ERROR:  "authenticator" is a reserved role, only superusers can modify it
```

Connect as **`supabase_admin`** instead (it is a superuser, and it accepts
`POSTGRES_PASSWORD` over TCP). `docker/init/01-roles.sh` does this. The roles
themselves already exist in the image — they only lack passwords, without which
GoTrue and PostgREST cannot connect at all.

### 2. GoTrue rejects the CORS preflight for `apikey`

This one looks like a broken install but is pure CORS: `/register` and `/login`
fail in the browser with **"Failed to fetch"** while the very same request works
from `curl`.

`supabase-js` sends an `apikey` header, so the browser first sends a preflight
`OPTIONS` asking whether that header is allowed — and GoTrue answers `204`
*without* `Access-Control-Allow-Origin`, so the browser drops the request before
it is ever sent. On Supabase Cloud that preflight is answered by Kong, not by
GoTrue, which is why it never shows up there. `curl` never issues a preflight,
which is why a command-line smoke test passes while the UI does not.

The gateway answers the preflight for `/auth/v1/` itself — see `nginx.conf`.

### 3. Migrations have to wait for GoTrue

`ALL_MIGRATIONS.sql` has foreign keys to `auth.users` and a trigger on it, so it
cannot run until GoTrue has applied its own migrations.
`docker/init/02-migrate.sh` polls for `auth.users` before applying anything, and
is a no-op if `public.workspaces` already exists.

### 4. Realtime needs the tables added to the publication

On Supabase Cloud you tick "Enable Realtime" per table. Self-hosted, the inbox
stays silent until `conversations` and `messages` are added to the
`supabase_realtime` publication with `replica identity full` — the migrate
script does it.

Realtime also resolves its tenant from the first label of the `Host` header, so
the gateway forwards `Host: realtime-dev.supabase-realtime` to match
`SELF_HOST_TENANT_NAME`.

### 5. Nothing runs the crons

`vercel.json` schedules `/api/cron/jobs` and `/api/cron/sequences` every minute.
Off Vercel, delay nodes, scheduled jobs and sequences simply never fire. The
`cron` service in the compose file polls both endpoints with `CRON_SECRET`.

Also note `NEXT_PUBLIC_*` values are inlined by Next.js at **build** time:
changing the public URL later means rebuilding the image, not just restarting it.

## Deploying on Dokploy

1. **Create the project** — *Projects → Create Project*, e.g. `zernflow`.
2. **Add a Compose service** — *Create Service → Compose*, name it
   `zernflow-stack`.
3. **Point it at this repo** — *Provider → GitHub* (or a public Git URL),
   branch `main`, **Compose Path** `./docker/docker-compose.yml`. ZernFlow is a
   public repository, so a plain Git provider works; the GitHub App is only
   needed for private forks and push-to-deploy.
4. **Fill in the environment** — paste the contents of `docker/.env.example`
   into the service's *Environment* tab with real values. Keep the secrets here
   rather than in the repository.
5. **Set the public URLs** — `SITE_URL` and `SUPABASE_PUBLIC_URL` must be what
   the browser will use. With Dokploy domains that is
   `https://zernflow.example.com` and `https://supabase-zernflow.example.com`;
   with a bare host it is `http://<ip>:3000` and `http://<ip>:8100`.
6. **Deploy.** The first build compiles the Next.js app and takes a few minutes.

If you use Dokploy domains instead of published ports, point one domain at the
`app` service (port 3000) and another at the `gateway` service (port 8000), and
drop the `ports:` entries.

### Troubleshooting

- **The whole stack fails and no app container is created.** Check `db-init`
  first: if it exits non-zero, `auth`, `migrate` and `app` never start.
- **Signup or login shows "Failed to fetch" but `curl` works.** The CORS
  preflight is being refused — check that the gateway, not GoTrue, answers
  `OPTIONS /auth/v1/signup` (see below). Hard-reload the page afterwards, since
  browsers cache a failed preflight.
- **Login returns a network error.** `SUPABASE_PUBLIC_URL` is probably an
  internal hostname, or the gateway port is not published. It must be reachable
  from the browser.
- **The inbox never updates live.** Check that `conversations` and `messages`
  are in the `supabase_realtime` publication.
- **Delays and sequences never fire.** The `cron` container is not running, or
  `CRON_SECRET` differs between it and the app.

### Verifying an install

```bash
curl "$SUPABASE_PUBLIC_URL/auth/v1/health" -H "apikey: $ANON_KEY"
curl -o /dev/null -w '%{http_code}\n' "$SUPABASE_PUBLIC_URL/rest/v1/workspaces?select=id" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
curl -o /dev/null -w '%{http_code}\n' "$SITE_URL/login"
curl "$SITE_URL/api/cron/jobs?key=$CRON_SECRET"
```

A successful signup creates one row in `workspaces` and one in
`workspace_members` via the `auth.users` trigger — that is the quickest check
that both GoTrue and the migrations landed correctly.

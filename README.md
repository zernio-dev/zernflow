# ZernFlow

The open-source ManyChat alternative. Visual flow builder for Instagram, Facebook, WhatsApp, Telegram, Twitter/X, Bluesky & Reddit.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Website](https://img.shields.io/badge/Website-zernflow.com-indigo)](https://zernflow.com)

**Live at [zernflow.com](https://zernflow.com)**

## What is ZernFlow?

ZernFlow is an open-source alternative to ManyChat. Build visual chatbot flows, manage contacts, send broadcasts, run drip campaigns, and handle live chat conversations across 7 social media platforms.

**Powered by [Zernio](https://zernio.com)** for OAuth, token refresh, rate limiting, and cross-platform messaging.

### Features

- **Visual Flow Builder** - Drag-and-drop chatbot builder with 15+ node types
- **AI Response Node** - AI-powered replies via OpenAI, Anthropic, or Google (Vercel AI SDK)
- **Live Chat Inbox** - Real-time inbox with human takeover and conversation assignment
- **Contact CRM** - Tags, custom fields, segments, and contact management
- **Broadcasting** - Send targeted messages to contact segments
- **Sequences** - Drip campaigns with timed message series and automatic enrollment
- **Team Management** - Invite members, assign roles, manage permissions
- **Multi-Platform** - Instagram, Facebook, WhatsApp, Telegram, Twitter/X, Bluesky, Reddit
  - WhatsApp needs a WhatsApp Business Account; Meta's signup flow creates one during connect. Meta only accepts free-form messages within 24 hours of the contact's last message, so auto-replies work while broadcasts and delayed sequence steps can be rejected outside that window (approved message templates are not supported yet).
- **Connect Channels** - OAuth connection flow directly from ZernFlow (powered by Zernio)
- **Rich Messaging** - Buttons, quick replies, and carousel cards
- **Comment-to-DM** - Automatically DM users who comment specific keywords
- **Growth Tools** - Conversation starter links for each connected platform
- **A/B Testing** - Split test different message paths
- **Webhooks & HTTP** - Connect to external APIs from your flows

## Quick Start

### Prerequisites

- Node.js 24+
- A [Supabase](https://supabase.com) project (free tier works)
- A [Zernio](https://zernio.com) API key (entered in Settings after setup)
- A [Vercel AI Gateway](https://vercel.com/ai-gateway) key (optional, for AI node, entered in Settings or env)

### Setup

1. **Clone the repo**

```bash
git clone https://github.com/zernio-dev/zernflow.git
cd zernflow
npm install
```

2. **Set up Supabase**

Create a free project at [supabase.com](https://supabase.com), then apply the database migrations using either method below.

#### Supabase SQL Editor

For a new ZernFlow database:

1. Open your project in the [Supabase dashboard](https://supabase.com/dashboard).
2. Select **SQL Editor**, then **New query**.
3. Copy the complete contents of `supabase/migrations/ALL_MIGRATIONS.sql` into the editor.
4. Select **Run** and wait for the query to finish successfully.

For a database that already has ZernFlow tables, run only the new numbered files
from `supabase/migrations/` in ascending order. Do not rerun
`ALL_MIGRATIONS.sql` over an existing schema.

#### Supabase CLI

Install or run the latest CLI, authenticate, link the project, and push pending migrations:

```bash
npx supabase@latest login
npx supabase@latest link --project-ref your-project-ref
npx supabase@latest db push
```

Find the project reference in the Supabase URL: for
`https://your-project-ref.supabase.co`, it is `your-project-ref`. The CLI may
prompt for the project's database password. Run `db push` again whenever new
numbered migration files are added.

Migration `00017_backfill_user_workspaces.sql` provisions a workspace for auth
accounts created before the initial database migration was installed.

3. **Configure environment**

```bash
cp .env.example .env
```

Fill in your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CRON_SECRET=your-cron-secret              # For sequence processor + job scheduler
# AI_GATEWAY_API_KEY=...                  # Optional, for self-hosted (Vercel handles this automatically)
```

After starting the app, go to **Settings** to enter your Zernio API key and (optionally) AI Gateway key.

4. **Run**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign up, and start building flows.

## Docker Deployment

The production image uses Next.js standalone output and runs as an unprivileged
user. Docker Compose also enables a read-only root filesystem, drops Linux
capabilities, and configures an application health check.

1. Copy the environment template and provide production values:

```bash
cp .env.example .env
```

Set `NEXT_PUBLIC_APP_URL` to the public HTTPS URL of the deployment. The
`NEXT_PUBLIC_SUPABASE_*` values are embedded into the browser bundle during the
image build; the service-role key and other secrets are provided only when the
container starts.

2. Build and start the service:

```bash
docker compose up -d --build
```

3. Confirm the deployment is healthy:

```bash
docker compose ps
curl --fail http://localhost:${APP_PORT:-3000}/api/health
```

To publish on another host port, set `APP_PORT` in `.env`. Run scheduled jobs
from your platform's scheduler by calling `/api/cron/jobs` and
`/api/cron/sequences` with `Authorization: Bearer $CRON_SECRET`.

For a plain Docker deployment without Compose, pass the three
`NEXT_PUBLIC_*` values as build arguments, then provide all values from
`.env.example` as runtime environment variables.

### Hostinger Compose from URL

Hostinger can download the public repository as a remote Docker build context,
so this deployment does not require GitHub Actions, a container registry, or a
GitHub login on the VPS.

1. In Hostinger Docker Manager, choose **Compose > Compose from URL** and use:

   ```text
   https://raw.githubusercontent.com/KhBayazidAhmed/zernflow/main/compose.hostinger.yaml
   ```

2. Configure these environment variables in Hostinger before deploying:

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_APP_URL` (the public HTTPS application URL)
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET`
   - `AI_GATEWAY_API_KEY` (optional)
   - `HOST_PORT` (optional, defaults to `3100`; choose any unused VPS port)
   - `SOURCE_REPOSITORY_URL` (optional; use a public fork URL ending in
     `.git#main` when deploying modified source)

`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, and `AI_GATEWAY_API_KEY` are runtime
secrets. They are read only when the container runs and are not included in the
image. The `NEXT_PUBLIC_*` values are intentionally public and are supplied as
build arguments by Hostinger because Next.js embeds them in browser code.

For updates, redeploy or rebuild the application in Hostinger. Docker fetches
the latest source from `main` and builds a fresh local image. A plain container
restart does not rebuild the source.

## Architecture

```
Browser (Flow Builder, Inbox, CRM, Sequences)
        |
   Next.js App Router
        |
   +----+----+----+----+----+
   |    |    |    |    |    |
Webhook Flow CRM  Live  Broadcast Sequence
Recv.  Engine     Chat           Processor
   |    |    |    |    |    |
   +----+----+----+----+----+
        |         |         |
    Supabase   Zernio API AI SDK
  (PG + Auth   (7 platforms) (OpenAI /
  + Realtime)              Anthropic /
                           Google)
```

## Stack

| Layer | Tool |
|-------|------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Database + Auth + Realtime | Supabase |
| Flow Builder | React Flow (@xyflow/react) |
| AI | Vercel AI SDK + [AI Gateway](https://vercel.com/ai-gateway) |
| UI | Tailwind CSS 4 |
| Icons | @icons-pack/react-simple-icons |
| Messaging | [Zernio API](https://zernio.com) |

## Flow Node Types

| Node | Description |
|------|-------------|
| Trigger | Keyword, postback, quick reply, welcome, default |
| Send Message | Text, images, buttons, quick replies, carousels |
| AI Response | AI-powered replies with conversation context (OpenAI, Anthropic, Google) |
| Condition | If/else on tags, fields, platform, variables |
| Delay | Wait seconds/minutes/hours/days |
| Add/Remove Tag | Manage contact tags |
| Set Custom Field | Set contact field values with variable interpolation |
| HTTP Request | Call external APIs, store responses |
| Go To Flow | Jump to another flow (with return stack) |
| Human Takeover | Pause automation, alert inbox |
| Enroll in Sequence | Add contact to a drip campaign |
| Subscribe/Unsubscribe | Toggle contact subscription |
| A/B Split | Randomly route contacts for testing |
| Smart Delay | Wait for user response or timeout |
| Comment Reply | Public reply to comments |
| Private Reply | Instagram comment-to-DM |

## Project Structure

```
zernflow/
├── app/
│   ├── (auth)/             # Login, register pages
│   ├── (dashboard)/        # Flows, inbox, contacts, sequences, settings
│   ├── invite/             # Team invite acceptance page
│   └── api/
│       ├── webhooks/late/   # Webhook receiver
│       ├── cron/jobs/       # Job scheduler
│       ├── cron/sequences/  # Sequence step processor
│       └── v1/              # CRUD API routes
├── components/
│   ├── flow-builder/        # Canvas, nodes, panels
│   ├── inbox/               # Conversation list, thread, contact panel
│   ├── sequences/           # Sequence editor, enrollment list
│   ├── settings/            # Team management
│   └── ui/                  # Shared UI components
├── lib/
│   ├── supabase/            # Server/client/middleware
│   ├── flow-engine/         # Engine, trigger matcher, platform adapter, AI node
│   ├── actions/             # Server actions (team, sequences, workspace)
│   └── types/               # TypeScript types
└── supabase/
    └── migrations/          # SQL schema + RLS policies (00001-00009)
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT

<p align="center">
  <a href="https://zernio.com">
    <img src="https://zernio.com/brand/powered-by-zernio.svg" alt="Powered by Zernio" width="180">
  </a>
</p>

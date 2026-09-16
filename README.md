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

- Node.js 18+
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

Create a free project at [supabase.com](https://supabase.com). Then run the SQL migrations in the Supabase SQL editor:

```bash
# Run every numbered file in supabase/migrations/ in order, 00001 upwards.
# Skipping later ones leaves features broken: 00016, for example, is what
# lets a WhatsApp channel be stored at all.
```

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

### Self-hosting

To run ZernFlow without Supabase Cloud or Vercel — Postgres, auth, realtime and
the crons all on your own box, with Docker Compose or Dokploy — see
[docs/self-hosting.md](docs/self-hosting.md).

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

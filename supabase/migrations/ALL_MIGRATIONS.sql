-- =============================================
-- ZERNFLOW - COMBINED MIGRATIONS
-- Paste this entire file into Supabase SQL Editor
-- https://supabase.com/dashboard/project/ttrxunsiaycmfwcdqocr/sql/new
-- =============================================

-- ============================================================
-- MIGRATION 1: SCHEMA
-- ============================================================

create extension if not exists "uuid-ossp";

-- WORKSPACES
create table workspaces (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  late_api_key_encrypted text,
  global_keywords jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index idx_workspace_members_user on workspace_members(user_id);

-- CHANNELS
create table channels (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  platform text not null check (platform in ('facebook', 'instagram', 'twitter', 'telegram', 'bluesky', 'reddit')),
  late_account_id text not null,
  username text,
  display_name text,
  profile_picture text,
  webhook_id text,
  webhook_secret text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, late_account_id)
);

create index idx_channels_workspace on channels(workspace_id);

-- CONTACTS (CRM)
create table contacts (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  display_name text,
  email text,
  avatar_url text,
  is_subscribed boolean not null default true,
  last_interaction_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_contacts_workspace on contacts(workspace_id);
create index idx_contacts_last_interaction on contacts(workspace_id, last_interaction_at desc);

create table contact_channels (
  id uuid primary key default uuid_generate_v4(),
  contact_id uuid not null references contacts(id) on delete cascade,
  channel_id uuid not null references channels(id) on delete cascade,
  platform_sender_id text not null,
  platform_username text,
  created_at timestamptz not null default now(),
  unique (channel_id, platform_sender_id)
);

create index idx_contact_channels_contact on contact_channels(contact_id);

create table tags (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  color text default '#6366f1',
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table contact_tags (
  contact_id uuid not null references contacts(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contact_id, tag_id)
);

create table custom_field_definitions (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  type text not null default 'text' check (type in ('text', 'number', 'boolean', 'date', 'url', 'email')),
  created_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create table contact_custom_fields (
  contact_id uuid not null references contacts(id) on delete cascade,
  field_id uuid not null references custom_field_definitions(id) on delete cascade,
  value text not null,
  updated_at timestamptz not null default now(),
  primary key (contact_id, field_id)
);

-- FLOWS
create table flows (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  viewport jsonb,
  version integer not null default 1,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_flows_workspace on flows(workspace_id);
create index idx_flows_status on flows(workspace_id, status);

create table triggers (
  id uuid primary key default uuid_generate_v4(),
  flow_id uuid not null references flows(id) on delete cascade,
  channel_id uuid references channels(id) on delete set null,
  type text not null check (type in ('keyword', 'postback', 'quick_reply', 'welcome', 'default', 'comment_keyword')),
  config jsonb not null default '{}'::jsonb,
  priority integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_triggers_channel_type on triggers(channel_id, type, is_active);
create index idx_triggers_flow on triggers(flow_id);

create table flow_sessions (
  id uuid primary key default uuid_generate_v4(),
  contact_id uuid not null references contacts(id) on delete cascade,
  flow_id uuid not null references flows(id) on delete cascade,
  channel_id uuid not null references channels(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'completed', 'expired', 'cancelled')),
  current_node_id text,
  variables jsonb not null default '{}'::jsonb,
  flow_stack jsonb not null default '[]'::jsonb,
  waiting_until timestamptz,
  waiting_for_input boolean not null default false,
  human_takeover_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_flow_sessions_contact_active on flow_sessions(contact_id, channel_id) where status = 'active';

-- CONVERSATIONS & MESSAGES
create table conversations (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  channel_id uuid not null references channels(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  late_conversation_id text,
  platform text not null,
  status text not null default 'open' check (status in ('open', 'closed', 'snoozed')),
  assigned_to uuid references auth.users(id) on delete set null,
  last_message_at timestamptz,
  last_message_preview text,
  unread_count integer not null default 0,
  is_automation_paused boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_id, contact_id)
);

create index idx_conversations_workspace on conversations(workspace_id, last_message_at desc);
create index idx_conversations_status on conversations(workspace_id, status);

create table messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  text text,
  attachments jsonb,
  quick_reply_payload text,
  postback_payload text,
  callback_data text,
  platform_message_id text,
  sent_by_flow_id uuid references flows(id) on delete set null,
  sent_by_node_id text,
  sent_by_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'sent' check (status in ('pending', 'sent', 'delivered', 'failed')),
  created_at timestamptz not null default now()
);

create index idx_messages_conversation on messages(conversation_id, created_at);

-- BROADCASTS
create table broadcasts (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sending', 'completed', 'cancelled')),
  message_content jsonb not null default '{}'::jsonb,
  segment_filter jsonb,
  scheduled_for timestamptz,
  total_recipients integer not null default 0,
  sent integer not null default 0,
  delivered integer not null default 0,
  failed integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_broadcasts_workspace on broadcasts(workspace_id);

create table broadcast_recipients (
  id uuid primary key default uuid_generate_v4(),
  broadcast_id uuid not null references broadcasts(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  channel_id uuid not null references channels(id) on delete cascade,
  status text not null default 'pending',
  sent_at timestamptz,
  error_message text
);

create index idx_broadcast_recipients_broadcast on broadcast_recipients(broadcast_id, status);

-- JOBS & ANALYTICS
create table scheduled_jobs (
  id uuid primary key default uuid_generate_v4(),
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  run_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);

create index idx_scheduled_jobs_pending on scheduled_jobs(run_at) where status = 'pending';

create table analytics_events (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  flow_id uuid references flows(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  event_type text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index idx_analytics_workspace on analytics_events(workspace_id, created_at desc);
create index idx_analytics_flow on analytics_events(flow_id, created_at desc);

-- ENABLE REALTIME
alter publication supabase_realtime add table conversations;
alter publication supabase_realtime add table messages;

-- UPDATED_AT TRIGGER
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on workspaces for each row execute function update_updated_at();
create trigger set_updated_at before update on channels for each row execute function update_updated_at();
create trigger set_updated_at before update on contacts for each row execute function update_updated_at();
create trigger set_updated_at before update on flows for each row execute function update_updated_at();
create trigger set_updated_at before update on flow_sessions for each row execute function update_updated_at();
create trigger set_updated_at before update on conversations for each row execute function update_updated_at();
create trigger set_updated_at before update on broadcasts for each row execute function update_updated_at();

-- AUTO-CREATE WORKSPACE ON SIGNUP
create or replace function handle_new_user()
returns trigger as $$
declare
  workspace_id uuid;
  user_name text;
  workspace_slug text;
begin
  user_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );
  workspace_slug := lower(regexp_replace(user_name, '[^a-zA-Z0-9]', '-', 'g')) || '-' || substr(new.id::text, 1, 8);

  insert into workspaces (name, slug)
  values (user_name || '''s Workspace', workspace_slug)
  returning id into workspace_id;

  insert into workspace_members (workspace_id, user_id, role)
  values (workspace_id, new.id, 'owner');

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- MIGRATION 2: RLS POLICIES
-- ============================================================

create or replace function is_workspace_member(ws_id uuid)
returns boolean as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws_id and user_id = auth.uid()
  );
$$ language sql security definer stable;

-- WORKSPACES
alter table workspaces enable row level security;
create policy "Users can view their workspaces" on workspaces for select using (is_workspace_member(id));
create policy "Users can update their workspaces" on workspaces for update using (is_workspace_member(id));

-- WORKSPACE MEMBERS
alter table workspace_members enable row level security;
create policy "Users can view members of their workspaces" on workspace_members for select using (is_workspace_member(workspace_id));
create policy "Owners can manage members" on workspace_members for all using (
  exists (
    select 1 from workspace_members wm
    where wm.workspace_id = workspace_members.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'owner'
  )
);

-- CHANNELS
alter table channels enable row level security;
create policy "Users can view channels in their workspaces" on channels for select using (is_workspace_member(workspace_id));
create policy "Users can manage channels in their workspaces" on channels for all using (is_workspace_member(workspace_id));

-- CONTACTS
alter table contacts enable row level security;
create policy "Users can view contacts in their workspaces" on contacts for select using (is_workspace_member(workspace_id));
create policy "Users can manage contacts in their workspaces" on contacts for all using (is_workspace_member(workspace_id));

-- CONTACT CHANNELS
alter table contact_channels enable row level security;
create policy "Users can view contact channels via contact" on contact_channels for select using (
  exists (select 1 from contacts c where c.id = contact_channels.contact_id and is_workspace_member(c.workspace_id))
);
create policy "Users can manage contact channels" on contact_channels for all using (
  exists (select 1 from contacts c where c.id = contact_channels.contact_id and is_workspace_member(c.workspace_id))
);

-- TAGS
alter table tags enable row level security;
create policy "Users can view tags in their workspaces" on tags for select using (is_workspace_member(workspace_id));
create policy "Users can manage tags in their workspaces" on tags for all using (is_workspace_member(workspace_id));

-- CONTACT TAGS
alter table contact_tags enable row level security;
create policy "Users can view contact tags" on contact_tags for select using (
  exists (select 1 from contacts c where c.id = contact_tags.contact_id and is_workspace_member(c.workspace_id))
);
create policy "Users can manage contact tags" on contact_tags for all using (
  exists (select 1 from contacts c where c.id = contact_tags.contact_id and is_workspace_member(c.workspace_id))
);

-- CUSTOM FIELD DEFINITIONS
alter table custom_field_definitions enable row level security;
create policy "Users can view custom fields in their workspaces" on custom_field_definitions for select using (is_workspace_member(workspace_id));
create policy "Users can manage custom fields in their workspaces" on custom_field_definitions for all using (is_workspace_member(workspace_id));

-- CONTACT CUSTOM FIELDS
alter table contact_custom_fields enable row level security;
create policy "Users can view contact custom fields" on contact_custom_fields for select using (
  exists (select 1 from contacts c where c.id = contact_custom_fields.contact_id and is_workspace_member(c.workspace_id))
);
create policy "Users can manage contact custom fields" on contact_custom_fields for all using (
  exists (select 1 from contacts c where c.id = contact_custom_fields.contact_id and is_workspace_member(c.workspace_id))
);

-- FLOWS
alter table flows enable row level security;
create policy "Users can view flows in their workspaces" on flows for select using (is_workspace_member(workspace_id));
create policy "Users can manage flows in their workspaces" on flows for all using (is_workspace_member(workspace_id));

-- TRIGGERS
alter table triggers enable row level security;
create policy "Users can view triggers via flow" on triggers for select using (
  exists (select 1 from flows f where f.id = triggers.flow_id and is_workspace_member(f.workspace_id))
);
create policy "Users can manage triggers via flow" on triggers for all using (
  exists (select 1 from flows f where f.id = triggers.flow_id and is_workspace_member(f.workspace_id))
);

-- FLOW SESSIONS
alter table flow_sessions enable row level security;
create policy "Users can view flow sessions via flow" on flow_sessions for select using (
  exists (select 1 from flows f where f.id = flow_sessions.flow_id and is_workspace_member(f.workspace_id))
);

-- CONVERSATIONS
alter table conversations enable row level security;
create policy "Users can view conversations in their workspaces" on conversations for select using (is_workspace_member(workspace_id));
create policy "Users can manage conversations in their workspaces" on conversations for all using (is_workspace_member(workspace_id));

-- MESSAGES
alter table messages enable row level security;
create policy "Users can view messages via conversation" on messages for select using (
  exists (select 1 from conversations conv where conv.id = messages.conversation_id and is_workspace_member(conv.workspace_id))
);
create policy "Users can insert messages via conversation" on messages for insert with check (
  exists (select 1 from conversations conv where conv.id = messages.conversation_id and is_workspace_member(conv.workspace_id))
);

-- BROADCASTS
alter table broadcasts enable row level security;
create policy "Users can view broadcasts in their workspaces" on broadcasts for select using (is_workspace_member(workspace_id));
create policy "Users can manage broadcasts in their workspaces" on broadcasts for all using (is_workspace_member(workspace_id));

-- BROADCAST RECIPIENTS
alter table broadcast_recipients enable row level security;
create policy "Users can view broadcast recipients" on broadcast_recipients for select using (
  exists (select 1 from broadcasts b where b.id = broadcast_recipients.broadcast_id and is_workspace_member(b.workspace_id))
);

-- SCHEDULED JOBS (service role only)
alter table scheduled_jobs enable row level security;

-- ANALYTICS
alter table analytics_events enable row level security;
create policy "Users can view analytics in their workspaces" on analytics_events for select using (is_workspace_member(workspace_id));
create policy "Users can insert analytics in their workspaces" on analytics_events for insert with check (is_workspace_member(workspace_id));

-- ============================================================
-- MIGRATION 3: RPC FUNCTIONS
-- ============================================================

create or replace function increment_unread(conv_id uuid, preview text)
returns void as $$
begin
  update conversations
  set unread_count = unread_count + 1,
      last_message_at = now(),
      last_message_preview = preview,
      status = 'open'
  where id = conv_id;
end;
$$ language plpgsql security definer;

create or replace function increment_broadcast_sent(b_id uuid)
returns void as $$
begin
  update broadcasts
  set sent = sent + 1,
      delivered = delivered + 1
  where id = b_id;
end;
$$ language plpgsql security definer;

create or replace function increment_broadcast_failed(b_id uuid)
returns void as $$
begin
  update broadcasts
  set failed = failed + 1
  where id = b_id;
end;
$$ language plpgsql security definer;

-- ============================================================
-- MIGRATION 10: FLOW VERSIONS
-- ============================================================

create table if not exists flow_versions (
  id uuid primary key default uuid_generate_v4(),
  flow_id uuid not null references flows(id) on delete cascade,
  version integer not null,
  nodes jsonb not null,
  edges jsonb not null,
  viewport jsonb,
  name text not null,
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (flow_id, version)
);

create index if not exists idx_flow_versions_flow on flow_versions(flow_id, version desc);

alter table flow_versions enable row level security;

create policy "flow_versions_select" on flow_versions for select
  using (exists (
    select 1 from flows f
    join workspace_members wm on wm.workspace_id = f.workspace_id
    where f.id = flow_versions.flow_id
      and wm.user_id = auth.uid()
  ));

create policy "flow_versions_insert" on flow_versions for insert
  with check (exists (
    select 1 from flows f
    join workspace_members wm on wm.workspace_id = f.workspace_id
    where f.id = flow_versions.flow_id
      and wm.user_id = auth.uid()
  ));

-- ============================================================
-- MIGRATION 11: WORKSPACE WEBHOOK SECRET
-- ============================================================
-- Workspace-level secret for Zernio webhook HMAC signature verification.
-- Zernio exposes a single webhook per profile/API key, so the secret is stored
-- at the workspace level (not per-channel). Used by /api/webhooks/late.
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS webhook_secret TEXT;

-- ============================================================
-- Idempotency ledger for inbound Zernio webhook deliveries. Zernio retries a
-- delivery with the same event id whenever our 200 doesn't arrive within its 5s
-- timeout; /api/webhooks/late claims the id here before processing so retries
-- and redeliveries never re-run a flow (which was double-sending DMs).
CREATE TABLE IF NOT EXISTS webhook_events (
  event_id TEXT PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhook_events_received_at_idx ON webhook_events (received_at);

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- MIGRATION 13: SEQUENCE ENROLLMENTS CHANNEL CASCADE
-- ============================================================
-- sequence_enrollments.channel_id was declared without an ON DELETE action
-- (00005_sequences.sql), so deleting a channel with enrollments failed with a
-- 23503 FK violation. Every other channel FK cascades (or sets null); align
-- this one so channel deletion works.
ALTER TABLE sequence_enrollments
  DROP CONSTRAINT sequence_enrollments_channel_id_fkey,
  ADD CONSTRAINT sequence_enrollments_channel_id_fkey
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE;

-- ============================================================
-- MIGRATION 14: SCHEDULED JOBS CLAIMED_AT
-- ============================================================
-- The cron claims a job by flipping status to 'processing'. If that UPDATE
-- commits but the response is lost, the job is stranded: the fetch only read
-- 'pending' rows. claimed_at lets the cron reclaim 'processing' jobs whose
-- claim is older than a few minutes.
ALTER TABLE scheduled_jobs ADD COLUMN claimed_at timestamptz;

CREATE INDEX idx_scheduled_jobs_processing ON scheduled_jobs(claimed_at)
  WHERE status = 'processing';

-- ============================================================
-- MIGRATION 15: BACKFILL CLAIMED_AT
-- ============================================================
-- 00014 added claimed_at but did not backfill rows already stuck in
-- 'processing', and old-code invocations claim without stamping it. Stamp
-- existing NULL claims so the cron's staleness clock (claimed_at older than
-- 5 minutes) applies to them; genuinely stranded rows become reclaimable
-- shortly after this runs, while a claim still live at migration time gets
-- the full window to finish before being reclaimed.
UPDATE scheduled_jobs
SET claimed_at = now()
WHERE status = 'processing' AND claimed_at IS NULL;

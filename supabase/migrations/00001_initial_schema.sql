-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- WORKSPACES
-- ============================================================
create table workspaces (
  id uuid primary key default gen_random_uuid(),
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

-- ============================================================
-- CHANNELS
-- ============================================================
create table channels (
  id uuid primary key default gen_random_uuid(),
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

-- ============================================================
-- CONTACTS (CRM)
-- ============================================================
create table contacts (
  id uuid primary key default gen_random_uuid(),
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
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  channel_id uuid not null references channels(id) on delete cascade,
  platform_sender_id text not null,
  platform_username text,
  created_at timestamptz not null default now(),
  unique (channel_id, platform_sender_id)
);

create index idx_contact_channels_contact on contact_channels(contact_id);

create table tags (
  id uuid primary key default gen_random_uuid(),
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
  id uuid primary key default gen_random_uuid(),
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

-- ============================================================
-- FLOWS
-- ============================================================
create table flows (
  id uuid primary key default gen_random_uuid(),
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
  id uuid primary key default gen_random_uuid(),
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
  id uuid primary key default gen_random_uuid(),
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

-- ============================================================
-- CONVERSATIONS & MESSAGES
-- ============================================================
create table conversations (
  id uuid primary key default gen_random_uuid(),
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
  id uuid primary key default gen_random_uuid(),
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

-- ============================================================
-- BROADCASTS
-- ============================================================
create table broadcasts (
  id uuid primary key default gen_random_uuid(),
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
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references broadcasts(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  channel_id uuid not null references channels(id) on delete cascade,
  status text not null default 'pending',
  sent_at timestamptz,
  error_message text
);

create index idx_broadcast_recipients_broadcast on broadcast_recipients(broadcast_id, status);

-- ============================================================
-- JOBS & ANALYTICS
-- ============================================================
create table scheduled_jobs (
  id uuid primary key default gen_random_uuid(),
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
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  flow_id uuid references flows(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  event_type text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index idx_analytics_workspace on analytics_events(workspace_id, created_at desc);
create index idx_analytics_flow on analytics_events(flow_id, created_at desc);

-- ============================================================
-- ENABLE REALTIME
-- ============================================================
alter publication supabase_realtime add table conversations;
alter publication supabase_realtime add table messages;

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
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

-- ============================================================
-- AUTO-CREATE WORKSPACE ON SIGNUP
-- ============================================================
create or replace function handle_new_user()
returns trigger as $$
declare
  ws_id uuid;
  user_name text;
  workspace_slug text;
begin
  user_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );
  workspace_slug := lower(regexp_replace(user_name, '[^a-zA-Z0-9]', '-', 'g')) || '-' || substr(new.id::text, 1, 8);

  insert into public.workspaces (name, slug)
  values (user_name || '''s Workspace', workspace_slug)
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws_id, new.id, 'owner');

  return new;
exception when others then
  raise log 'handle_new_user error: % %', sqlerrm, sqlstate;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

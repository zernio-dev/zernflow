-- Comment logs pointed at a trigger row only, but publishing deletes and re-creates a flow's
-- trigger rows, which nulled matched_trigger_id and lost the flow's history. Keep the flow too.
alter table comment_logs
  add column if not exists flow_id uuid references flows(id) on delete set null;

create index if not exists idx_comment_logs_flow_id on comment_logs(flow_id, created_at desc);

update comment_logs l
set flow_id = t.flow_id
from triggers t
where l.matched_trigger_id = t.id and l.flow_id is null;

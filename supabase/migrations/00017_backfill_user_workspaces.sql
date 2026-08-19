-- Accounts created before the workspace trigger was installed need an initial workspace.
do $$
declare
  account record;
  workspace_id uuid;
  account_name text;
begin
  for account in
    select users.id, users.email, users.raw_user_meta_data
    from auth.users as users
    where not exists (
      select 1
      from public.workspace_members as members
      where members.user_id = users.id
    )
  loop
    account_name := coalesce(
      account.raw_user_meta_data->>'full_name',
      account.raw_user_meta_data->>'name',
      split_part(account.email, '@', 1),
      'My'
    );

    insert into public.workspaces (name, slug)
    values (
      account_name || '''s Workspace',
      lower(regexp_replace(account_name, '[^a-zA-Z0-9]', '-', 'g')) || '-' || substr(account.id::text, 1, 8)
    )
    returning id into workspace_id;

    insert into public.workspace_members (workspace_id, user_id, role)
    values (workspace_id, account.id, 'owner');
  end loop;
end;
$$;

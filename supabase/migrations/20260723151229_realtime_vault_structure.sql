-- Keep the shared vault structure live across the web app and Qlip iOS.
-- content_items is already part of this publication; add the tables whose
-- changes affect an open client's folders, feeds, and home dashboard.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'folders',
    'item_folders',
    'rss_subscriptions',
    'daily_picks'
  ] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;

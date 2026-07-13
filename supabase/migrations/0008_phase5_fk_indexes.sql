-- Covering indexes for the FKs introduced in Phase 5 (per performance advisor).
-- daily_picks(user_id, ...) is already covered by its composite primary key.
create index if not exists idx_content_items_rss_subscription_id
  on public.content_items (rss_subscription_id)
  where rss_subscription_id is not null;

create index if not exists idx_daily_picks_item_id
  on public.daily_picks (item_id);

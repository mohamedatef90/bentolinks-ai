-- Cross-client parity: database-backed Priority Vault ordering and explicit
-- ownership of folder/category assignments.

alter table public.content_items
  add column if not exists pin_position integer;

with ranked as (
  select id,
         row_number() over (partition by user_id order by created_at desc, id) - 1 as position
  from public.content_items
  where is_pinned
)
update public.content_items as item
set pin_position = ranked.position
from ranked
where item.id = ranked.id
  and item.pin_position is null;

alter table public.content_items
  drop constraint if exists content_items_pin_position_check;
alter table public.content_items
  add constraint content_items_pin_position_check
  check (pin_position is null or pin_position >= 0);

create index if not exists content_items_user_pin_position_idx
  on public.content_items (user_id, pin_position)
  where is_pinned;

alter table public.item_folders
  add column if not exists assignment_source text not null default 'user';

alter table public.item_folders
  drop constraint if exists item_folders_assignment_source_check;
alter table public.item_folders
  add constraint item_folders_assignment_source_check
  check (assignment_source in ('ai', 'user'));

comment on column public.content_items.pin_position is
  'Shared Priority Vault order. Null when the item is not pinned.';
comment on column public.item_folders.assignment_source is
  'AI assignments may be refreshed; a user assignment is never overwritten by AI.';

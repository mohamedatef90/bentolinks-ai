-- Persist the AI classification that every provider already returns. Detailed
-- provenance and per-stage outcomes live in raw_metadata.ai / .processing so
-- clients can evolve without a column per provider-specific diagnostic.
alter table public.content_items
  add column if not exists content_type_label text;

alter table public.content_items
  drop constraint if exists content_items_content_type_label_check;

alter table public.content_items
  add constraint content_items_content_type_label_check
  check (
    content_type_label is null or content_type_label in (
      'Tutorial', 'News Article', 'Research Paper', 'Tool Review', 'Opinion',
      'Case Study', 'Video Essay', 'Social Post', 'Documentation', 'Other'
    )
  );

comment on column public.content_items.content_type_label is
  'AI-generated format classification. Model/provider provenance is raw_metadata.ai.';

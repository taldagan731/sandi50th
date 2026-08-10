create table if not exists public.photo_stories (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  media_asset_id uuid not null references public.media_assets(id) on delete cascade,
  author_name text not null default 'Someone who remembers' check (char_length(author_name) between 1 and 80),
  people_tags text[] not null default '{}',
  memory text,
  status text not null default 'visible' check (status in ('visible','hidden')),
  created_at timestamptz not null default now(),
  constraint photo_story_has_content check (
    cardinality(people_tags) > 0 or char_length(trim(coalesce(memory,''))) > 0
  )
);

create index if not exists photo_stories_media_created_idx
  on public.photo_stories(media_asset_id, created_at)
  where status = 'visible';

create index if not exists photo_stories_project_idx
  on public.photo_stories(project_id);

alter table public.photo_stories enable row level security;

-- Browser clients never access this table directly. The public reveal uses the
-- validated server route, and the service role remains the only write path.
revoke all on table public.photo_stories from anon, authenticated;

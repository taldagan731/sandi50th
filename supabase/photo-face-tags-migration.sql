-- Run once in Supabase SQL Editor. Originals remain untouched; coordinates are
-- normalized (0..1) against the correctly oriented web derivative.
create table if not exists public.photo_face_tags (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  media_asset_id uuid not null references public.media_assets(id) on delete cascade,
  person_name text not null default '' check (char_length(person_name) <= 80),
  x real not null check (x >= 0 and x <= 1),
  y real not null check (y >= 0 and y <= 1),
  width real not null check (width > 0 and width <= 1),
  height real not null check (height > 0 and height <= 1),
  status text not null default 'suggested' check (status in ('confirmed','suggested','rejected')),
  source text not null default 'manual' check (source in ('manual','ai')),
  confidence real check (confidence is null or (confidence >= 0 and confidence <= 1)),
  reference_tag_id uuid references public.photo_face_tags(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists photo_face_tags_media_status_idx
  on public.photo_face_tags(media_asset_id, status);
create index if not exists photo_face_tags_project_person_idx
  on public.photo_face_tags(project_id, lower(person_name))
  where status = 'confirmed' and person_name <> '';
create unique index if not exists photo_face_tags_unique_position_idx
  on public.photo_face_tags(media_asset_id, status, round(x::numeric, 3), round(y::numeric, 3), lower(person_name));

alter table public.photo_face_tags enable row level security;
revoke all on table public.photo_face_tags from anon, authenticated;

comment on table public.photo_face_tags is
  'Owner-confirmed and AI-suggested face locations. Browser clients use validated server routes only.';

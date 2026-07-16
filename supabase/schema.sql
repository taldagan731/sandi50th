create extension if not exists "uuid-ossp";

do $$ begin
  create type public.project_role as enum ('owner','reviewer');
exception when duplicate_object then null; end $$;

create table if not exists public.projects (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  title text not null,
  birthday date not null,
  submission_deadline date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.project_members (
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role public.project_role not null,
  primary key(project_id,user_id)
);

create table if not exists public.submissions (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null,
  contact text,
  relationship text,
  first_memory text not null,
  story text,
  approximate_year text,
  location text,
  people text[] not null default '{}',
  life_chapter text,
  prompt text,
  consent boolean not null default false,
  status text not null default 'received',
  reviewer_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  upload_completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.media_assets (
  id uuid primary key default uuid_generate_v4(),
  submission_id uuid references public.submissions(id) on delete cascade,
  storage_path text unique not null,
  original_name text not null,
  mime_type text not null,
  bytes bigint not null check(bytes > 0),
  created_at timestamptz not null default now()
);

insert into public.projects(slug,title,birthday,submission_deadline)
values('sandi50th','Still Becoming — The Story of Sandi','2026-08-11','2026-08-07')
on conflict(slug) do update set title=excluded.title,birthday=excluded.birthday,submission_deadline=excluded.submission_deadline;

alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.submissions enable row level security;
alter table public.media_assets enable row level security;

create or replace function public.is_project_member(project uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.project_members where project_id=project and user_id=auth.uid());
$$;

create or replace function public.is_project_owner(project uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.project_members where project_id=project and user_id=auth.uid() and role='owner');
$$;

drop policy if exists "members read projects" on public.projects;
create policy "members read projects" on public.projects for select using(public.is_project_member(id));
drop policy if exists "members read submissions" on public.submissions;
create policy "members read submissions" on public.submissions for select using(public.is_project_member(project_id));
drop policy if exists "members review submissions" on public.submissions;
create policy "members review submissions" on public.submissions for update using(public.is_project_member(project_id));
drop policy if exists "owners delete submissions" on public.submissions;
create policy "owners delete submissions" on public.submissions for delete using(public.is_project_owner(project_id));

do $$ begin
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('sandi-memories','sandi-memories',false,5368709120,array[
    'image/jpeg','image/png','image/webp','image/heic','image/heif','video/mp4','video/quicktime','video/webm',
    'audio/mpeg','audio/mp4','audio/wav','audio/x-m4a','application/pdf'
  ]) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
exception when undefined_column then
  insert into storage.buckets(id,name,public) values('sandi-memories','sandi-memories',false) on conflict(id) do update set public=false;
end $$;

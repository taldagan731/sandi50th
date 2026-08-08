-- Run once in Supabase SQL Editor after studio-migration.sql.
-- Reverses the archive from approval-first to visible-by-default and adds the reveal-day switch.

alter table public.projects
  add column if not exists reveal_public boolean not null default false,
  add column if not exists reveal_opened_at timestamptz;

alter table public.submissions
  alter column review_status set default 'included';

alter table public.media_assets
  alter column review_status set default 'included';

-- Existing genuine contributions become visible immediately.
update public.submissions
set review_status = 'included'
where review_status = 'pending'
  and name !~* '(MOBILE TEST|CODEX)';

update public.media_assets media
set review_status = 'included'
from public.submissions submission
where media.submission_id = submission.id
  and media.review_status = 'pending'
  and submission.name !~* '(MOBILE TEST|CODEX)';

-- Test contributions are always hidden, regardless of their earlier state.
update public.submissions
set review_status = 'excluded'
where name ~* '(MOBILE TEST|CODEX)';

update public.media_assets media
set review_status = 'excluded'
from public.submissions submission
where media.submission_id = submission.id
  and submission.name ~* '(MOBILE TEST|CODEX)';

-- Contributor metadata provides the immediate chapter. AI may fill only the gaps later.
update public.media_assets media
set chapter_number = case
  when lower(submission.life_chapter) ~ '(baby|early childhood)' then 1
  when lower(submission.life_chapter) ~ '(roslyn|school years)' then 2
  when lower(submission.life_chapter) ~ '(boston university|semester abroad|england)' then 3
  when lower(submission.life_chapter) ~ '(magazine advertising|oracle|career)' then 4
  when lower(submission.life_chapter) ~ '(family|love)' then 5
  when lower(submission.life_chapter) ~ '(travel|adventure)' then 6
  when lower(submission.life_chapter) ~ '(friendship|people who love)' then 7
  when lower(submission.life_chapter) ~ '(sandi today|birthday wishes|still becoming)' then 8
  else media.chapter_number
end
from public.submissions submission
where media.submission_id = submission.id
  and media.chapter_number is null;

notify pgrst, 'reload schema';

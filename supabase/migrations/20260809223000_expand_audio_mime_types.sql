-- Keep the legacy Supabase media bucket compatible with recordings made by
-- Safari, Chrome, Firefox, and iPhone Voice Memos. The active contribution
-- flow uses Vercel Blob, but this prevents future/archive paths rejecting an
-- otherwise valid recording.
update storage.buckets
set allowed_mime_types = array[
  'image/jpeg','image/png','image/webp','image/heic','image/heif',
  'video/mp4','video/quicktime','video/webm',
  'audio/mpeg','audio/mp4','audio/wav','audio/x-m4a','audio/webm','audio/ogg',
  'audio/aac','audio/3gpp','audio/caf','audio/x-caf','audio/quicktime',
  'application/pdf'
]
where id = 'sandi-memories';

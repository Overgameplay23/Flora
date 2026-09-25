-- Add pet processing status + asset URLs
alter table public.pet
  add column if not exists stylized_url text,
  add column if not exists cutout_url text,
  add column if not exists mask_url text,
  add column if not exists processing_status text not null default 'idle',
  add column if not exists processing_error text,
  add column if not exists updated_at timestamptz not null default now();

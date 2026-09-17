create extension if not exists pgcrypto;

create table if not exists public.game_state (
  id text primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.game_content (
  id text primary key,
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.team_answers (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.game_state(id) on delete cascade,
  round text not null check (round in ('obstacle', 'speed')),
  question_index integer not null check (question_index >= 0),
  team_id integer not null check (team_id between 1 and 3),
  answer text not null check (char_length(answer) between 1 and 300),
  response_ms integer,
  submitted_at timestamptz not null default now(),
  unique (game_id, round, question_index, team_id)
);

create table if not exists public.buzzes (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.game_state(id) on delete cascade,
  round integer not null check (round between 0 and 2),
  question_index integer not null check (question_index between 0 and 3),
  attempt_token text not null,
  team_id integer not null check (team_id between 1 and 3),
  buzzed_at timestamptz not null default clock_timestamp(),
  unique (game_id, attempt_token)
);

alter table public.game_state enable row level security;
alter table public.game_content enable row level security;
alter table public.team_answers enable row level security;
alter table public.buzzes enable row level security;

drop policy if exists "public read game state" on public.game_state;
create policy "public read game state" on public.game_state for select to anon using (true);

drop policy if exists "public read game content" on public.game_content;
create policy "public read game content" on public.game_content for select to anon using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('olympia-media', 'olympia-media', true, 104857600, array['audio/mpeg','audio/mp3','audio/wav','audio/ogg','image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public read team answers" on public.team_answers;
create policy "public read team answers" on public.team_answers for select to anon using (
  exists (
    select 1 from public.game_state
    where game_state.id = team_answers.game_id
      and (game_state.state->>'currentSlide')::integer in (15, 21)
  )
);

drop policy if exists "public read buzzes" on public.buzzes;
create policy "public read buzzes" on public.buzzes for select to anon using (true);

insert into public.game_state (id, state)
values ('main', '{"currentSlide":1,"scores":[0,0,0]}'::jsonb)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_state') then
    alter publication supabase_realtime add table public.game_state;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_content') then
    alter publication supabase_realtime add table public.game_content;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'team_answers') then
    alter publication supabase_realtime add table public.team_answers;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'buzzes') then
    alter publication supabase_realtime add table public.buzzes;
  end if;
end $$;

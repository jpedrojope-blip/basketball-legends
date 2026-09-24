-- Métricas agregadas do THE MANBA.
-- Nenhuma informação da carreira, placar ou atributo é armazenada.

create table if not exists public.manba_visitors (
  visitor_hash text primary key check (visitor_hash ~ '^[a-f0-9]{64}$'),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  device text not null default 'desktop' check (device in ('mobile', 'tablet', 'desktop')),
  has_played boolean not null default true
);

create table if not exists public.manba_sessions (
  session_hash text primary key,
  visitor_hash text not null references public.manba_visitors(visitor_hash) on delete cascade,
  started_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  device text not null default 'desktop' check (device in ('mobile', 'tablet', 'desktop'))
);

create table if not exists public.manba_daily_players (
  day date not null,
  visitor_hash text not null references public.manba_visitors(visitor_hash) on delete cascade,
  primary key (day, visitor_hash)
);

create table if not exists public.manba_daily_metrics (
  day date primary key,
  players integer not null default 0 check (players >= 0),
  games_finished bigint not null default 0 check (games_finished >= 0),
  careers_started bigint not null default 0 check (careers_started >= 0)
);

create table if not exists public.manba_event_ids (
  event_id text primary key,
  created_at timestamptz not null default now()
);

create index if not exists manba_sessions_last_seen_idx on public.manba_sessions(last_seen);
create index if not exists manba_visitors_last_seen_idx on public.manba_visitors(last_seen);
create index if not exists manba_event_ids_created_at_idx on public.manba_event_ids(created_at);

create or replace function public.manba_record_event(
  p_event text,
  p_visitor_hash text,
  p_session_hash text,
  p_device text,
  p_event_id text,
  p_count integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
  v_count integer := greatest(least(coalesce(p_count, 1), 1000), 1);
  v_player_added integer := 0;
begin
  if p_event not in ('career_started', 'game_finished', 'heartbeat') then
    raise exception 'Evento inválido';
  end if;
  if p_visitor_hash is null or p_visitor_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Visitante inválido';
  end if;
  if p_session_hash is null or p_session_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Sessão inválida';
  end if;
  if p_event_id is null or length(p_event_id) < 16 or length(p_event_id) > 120 then
    raise exception 'Identificador de evento inválido';
  end if;

  delete from public.manba_sessions where last_seen < now() - interval '2 days';
  delete from public.manba_event_ids where created_at < now() - interval '90 days';

  insert into public.manba_event_ids (event_id)
  values (p_event_id)
  on conflict (event_id) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return jsonb_build_object('accepted', true, 'duplicate', true);
  end if;

  if p_event = 'heartbeat' then
    update public.manba_sessions
       set last_seen = now(),
           device = case when p_device in ('mobile', 'tablet', 'desktop') then p_device else device end
     where session_hash = p_session_hash;
    return jsonb_build_object('accepted', true, 'duplicate', false);
  end if;

  insert into public.manba_visitors (visitor_hash, device, has_played)
  values (p_visitor_hash, case when p_device in ('mobile', 'tablet', 'desktop') then p_device else 'desktop' end, true)
  on conflict (visitor_hash) do update
    set last_seen = now(),
        device = excluded.device,
        has_played = true;

  insert into public.manba_sessions (session_hash, visitor_hash, device)
  values (p_session_hash, p_visitor_hash, case when p_device in ('mobile', 'tablet', 'desktop') then p_device else 'desktop' end)
  on conflict (session_hash) do update
    set last_seen = now(),
        device = excluded.device;

  if p_event = 'career_started' then
    insert into public.manba_daily_players (day, visitor_hash)
    values (current_date, p_visitor_hash)
    on conflict (day, visitor_hash) do nothing;
    get diagnostics v_rows = row_count;
    v_player_added := case when v_rows > 0 then 1 else 0 end;

    insert into public.manba_daily_metrics (day, players, careers_started)
    values (current_date, v_player_added, 1)
    on conflict (day) do update
      set players = public.manba_daily_metrics.players + excluded.players,
          careers_started = public.manba_daily_metrics.careers_started + excluded.careers_started;
  elsif p_event = 'game_finished' then
    insert into public.manba_daily_metrics (day, games_finished)
    values (current_date, v_count)
    on conflict (day) do update
      set games_finished = public.manba_daily_metrics.games_finished + excluded.games_finished;
  end if;

  return jsonb_build_object('accepted', true, 'duplicate', false);
end;
$$;

create or replace function public.manba_get_metrics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return jsonb_build_object(
    'totalPlayers', (select count(*) from public.manba_visitors where has_played),
    'totalGamesFinished', coalesce((select sum(games_finished) from public.manba_daily_metrics), 0),
    'totalCareersStarted', coalesce((select sum(careers_started) from public.manba_daily_metrics), 0),
    'activeNow', (select count(distinct visitor_hash) from public.manba_sessions where last_seen >= now() - interval '90 seconds'),
    'today', jsonb_build_object(
      'players', coalesce((select players from public.manba_daily_metrics where day = current_date), 0),
      'gamesFinished', coalesce((select games_finished from public.manba_daily_metrics where day = current_date), 0),
      'careersStarted', coalesce((select careers_started from public.manba_daily_metrics where day = current_date), 0)
    ),
    'devices', jsonb_build_object(
      'mobile', (select count(*) from public.manba_visitors where has_played and device = 'mobile'),
      'tablet', (select count(*) from public.manba_visitors where has_played and device = 'tablet'),
      'desktop', (select count(*) from public.manba_visitors where has_played and device = 'desktop')
    ),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', dates.day,
        'players', coalesce(metrics.players, 0),
        'gamesFinished', coalesce(metrics.games_finished, 0),
        'careersStarted', coalesce(metrics.careers_started, 0)
      ) order by dates.day)
      from generate_series(current_date - 13, current_date, interval '1 day') as dates(day)
      left join public.manba_daily_metrics metrics on metrics.day = dates.day::date
    ), '[]'::jsonb),
    'updatedAt', now()
  );
end;
$$;

revoke all on table public.manba_visitors, public.manba_sessions, public.manba_daily_players,
  public.manba_daily_metrics, public.manba_event_ids from public, anon, authenticated;
revoke all on function public.manba_record_event(text, text, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.manba_get_metrics() from public, anon, authenticated;
grant execute on function public.manba_record_event(text, text, text, text, text, integer) to service_role;
grant execute on function public.manba_get_metrics() to service_role;

-- Shrawn Gym: schema, row level security, and server-side business logic.
-- Mirrors the rules in src/lib/domain.ts (used by the browser demo adapter).

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- The gym's calendar day, so expiry flips at midnight Nepal time, not UTC.
create or replace function public.gym_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Kathmandu')::date $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'staff' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now()
);

create table public.settings (
  id int primary key default 1 check (id = 1),
  gym_name text not null default 'Shrawn Gym',
  reminder_days int[] not null default '{7,3,0}',
  follow_up_after_days int not null default 14,
  duplicate_window_minutes int not null default 30
);
insert into public.settings (id) values (1);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  duration_days int not null check (duration_days > 0),
  price_npr numeric(10, 2) not null check (price_npr >= 0),
  active boolean not null default true
);

create sequence public.member_code_seq start 1001;

create table public.members (
  id uuid primary key default gen_random_uuid(),
  member_code text not null unique default 'SG-' || nextval('public.member_code_seq'),
  full_name text not null,
  phone text not null,
  email text,
  gender text not null default 'other' check (gender in ('male', 'female', 'other')),
  dob date,
  emergency_contact text,
  notes text,
  photo_url text,
  status text not null default 'active' check (status in ('active', 'frozen', 'archived')),
  joined_on date not null default public.gym_today(),
  portal_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);

create table public.credentials (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  type text not null check (type in ('card', 'qr', 'fingerprint')),
  value text not null,
  label text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
-- A card / QR / fingerprint can only be active for one member at a time.
create unique index credentials_active_value on public.credentials (type, lower(value)) where active;

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  start_date date not null,
  end_date date not null,
  amount_npr numeric(10, 2) not null default 0,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index memberships_member_end on public.memberships (member_id, end_date desc);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  membership_id uuid references public.memberships (id) on delete set null,
  amount_npr numeric(10, 2) not null,
  method text not null check (method in ('cash', 'esewa', 'khalti', 'bank')),
  note text,
  paid_at timestamptz not null default now()
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members (id) on delete cascade,
  method text not null check (method in ('card', 'qr', 'fingerprint', 'assisted', 'gate')),
  result text not null check (result in ('accepted', 'denied')),
  deny_reason text,
  credential_value text,
  checked_in_at timestamptz not null default now()
);
create index attendance_time on public.attendance (checked_in_at desc);
create index attendance_member_time on public.attendance (member_id, checked_in_at desc);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  membership_id uuid not null references public.memberships (id) on delete cascade,
  kind text not null,
  channel text not null default 'in_app' check (channel in ('in_app', 'sms', 'email')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'dismissed')),
  scheduled_for date not null default public.gym_today(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (membership_id, kind)
);

create table public.addons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_npr numeric(10, 2) not null default 0,
  active boolean not null default true
);

create table public.member_addons (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  addon_id uuid not null references public.addons (id) on delete cascade,
  start_date date not null default public.gym_today(),
  end_date date
);

create table public.follow_up_notes (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  note text not null,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.gate_sessions (
  code text primary key,
  expires_at timestamptz not null
);

-- ---------------------------------------------------------------------------
-- Auth: profiles are created on sign-up; the very first user becomes owner.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when exists (select 1 from public.profiles) then 'staff' else 'owner' end
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid())
$$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'owner')
$$;

-- Every new member gets a personal QR credential.
create or replace function public.issue_member_qr() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.credentials (member_id, type, value, label)
  values (new.id, 'qr', replace(gen_random_uuid()::text, '-', ''), 'Personal QR');
  return new;
end $$;

create trigger on_member_created after insert on public.members
for each row execute function public.issue_member_qr();

-- Issuing a new personal QR revokes the previous one.
create or replace function public.single_active_qr() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.type = 'qr' and new.active then
    update public.credentials set active = false
    where member_id = new.member_id and type = 'qr' and active and id <> new.id;
  end if;
  return new;
end $$;

create trigger on_credential_created before insert on public.credentials
for each row execute function public.single_active_qr();

-- ---------------------------------------------------------------------------
-- Derived view
-- ---------------------------------------------------------------------------

create or replace view public.member_summaries with (security_invoker = true) as
select
  m.*,
  cm.id as membership_id,
  cm.plan_id,
  cm.start_date,
  cm.end_date,
  cm.amount_npr,
  cm.created_at as membership_created_at,
  p.name as plan_name,
  (cm.end_date - public.gym_today()) as days_left,
  case
    when m.status = 'archived' then 'archived'
    when m.status = 'frozen' then 'frozen'
    when cm.id is null then 'none'
    when cm.end_date < public.gym_today() then 'expired'
    when cm.end_date - public.gym_today() <= 7 then 'expiring'
    else 'active'
  end as access,
  lv.last_visit,
  coalesce(cr.types, '{}') as credential_types
from public.members m
left join lateral (
  select * from public.memberships ms where ms.member_id = m.id order by ms.end_date desc limit 1
) cm on true
left join public.plans p on p.id = cm.plan_id
left join lateral (
  select max(a.checked_in_at) as last_visit
  from public.attendance a where a.member_id = m.id and a.result = 'accepted'
) lv on true
left join lateral (
  select array_agg(distinct c.type) as types
  from public.credentials c where c.member_id = m.id and c.active
) cr on true;

-- ---------------------------------------------------------------------------
-- Check-in
-- ---------------------------------------------------------------------------

-- Internal: evaluates access, de-duplicates, and logs the attempt.
create or replace function public._record_check_in(
  p_member_id uuid, p_method text, p_value text, p_forced_reason text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s public.member_summaries;
  v_reason text := p_forced_reason;
  v_now timestamptz := now();
  v_window int;
  v_result text;
  v_payload jsonb;
begin
  if p_member_id is null then
    v_reason := coalesce(v_reason, 'Unknown credential');
    insert into public.attendance (member_id, method, result, deny_reason, credential_value)
    values (null, p_method, 'denied', v_reason, p_value);
    return jsonb_build_object('result', 'denied', 'reason', v_reason, 'member', null,
      'planName', null, 'endDate', null, 'daysLeft', null, 'at', v_now);
  end if;

  select * into s from public.member_summaries where id = p_member_id;

  if v_reason is null then
    v_reason := case s.access
      when 'archived' then 'Member is archived'
      when 'frozen' then 'Membership is frozen'
      when 'expired' then 'Membership expired on ' || to_char(s.end_date, 'FMDD Mon YYYY')
      when 'none' then 'No active membership'
      else null
    end;
  end if;

  v_payload := jsonb_build_object(
    'member', jsonb_build_object('id', s.id, 'fullName', s.full_name, 'memberCode', s.member_code, 'photoUrl', s.photo_url),
    'planName', s.plan_name, 'endDate', s.end_date, 'daysLeft', s.days_left, 'at', v_now);

  if v_reason is null then
    select duplicate_window_minutes into v_window from public.settings where id = 1;
    if exists (
      select 1 from public.attendance
      where member_id = p_member_id and result = 'accepted'
        and checked_in_at >= v_now - make_interval(mins => v_window)
    ) then
      return v_payload || jsonb_build_object('result', 'duplicate', 'reason', 'Already checked in recently');
    end if;
  end if;

  v_result := case when v_reason is null then 'accepted' else 'denied' end;
  insert into public.attendance (member_id, method, result, deny_reason, credential_value)
  values (p_member_id, p_method, v_result, v_reason, p_value);

  return v_payload || jsonb_build_object('result', v_result, 'reason', v_reason);
end $$;

revoke all on function public._record_check_in(uuid, text, text, text) from public, anon, authenticated;

-- Called by the kiosk (and later by card / fingerprint hardware bridges).
-- p_value is the card UID, QR token, fingerprint id, or member id for 'assisted'.
create or replace function public.check_in(p_method text, p_value text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_cred public.credentials;
  v_member_id uuid;
  v_reason text;
begin
  if not public.is_staff() then
    raise exception 'Not authorized';
  end if;

  if p_method = 'assisted' then
    select id into v_member_id from public.members where id::text = p_value;
    return public._record_check_in(v_member_id, p_method, null, null);
  end if;

  if p_method not in ('card', 'qr', 'fingerprint') then
    raise exception 'Unknown check-in method %', p_method;
  end if;

  select * into v_cred from public.credentials
  where type = p_method and lower(value) = lower(trim(p_value))
  order by active desc, created_at desc limit 1;

  if found then
    v_member_id := v_cred.member_id;
    if not v_cred.active then v_reason := 'Credential has been revoked'; end if;
  end if;

  return public._record_check_in(v_member_id, p_method, trim(p_value), v_reason);
end $$;

-- ---------------------------------------------------------------------------
-- Gate QR: staff screen shows a rotating 6-digit code; members check in from
-- their own phone via their portal link.
-- ---------------------------------------------------------------------------

create or replace function public.create_gate_session() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_expires timestamptz := now() + interval '60 seconds';
begin
  if not public.is_staff() then raise exception 'Not authorized'; end if;
  delete from public.gate_sessions where expires_at < now();
  loop
    v_code := lpad(floor(random() * 1000000)::int::text, 6, '0');
    begin
      insert into public.gate_sessions (code, expires_at) values (v_code, v_expires);
      exit;
    exception when unique_violation then
      -- extremely rare collision; try another code
    end;
  end loop;
  return jsonb_build_object('code', v_code, 'expiresAt', v_expires);
end $$;

create or replace function public.get_portal(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s public.member_summaries;
begin
  select * into s from public.member_summaries where portal_token = p_token;
  if not found then return null; end if;
  return jsonb_build_object(
    'member', jsonb_build_object('fullName', s.full_name, 'memberCode', s.member_code, 'portalToken', s.portal_token),
    'qrValue', (select value from public.credentials where member_id = s.id and type = 'qr' and active limit 1),
    'planName', s.plan_name,
    'endDate', s.end_date,
    'daysLeft', s.days_left,
    'access', s.access,
    'recentVisits', coalesce((
      select jsonb_agg(t.checked_in_at order by t.checked_in_at desc) from (
        select checked_in_at from public.attendance
        where member_id = s.id and result = 'accepted' order by checked_in_at desc limit 5
      ) t), '[]'::jsonb)
  );
end $$;

create or replace function public.gate_check_in(p_token text, p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_member_id uuid;
begin
  select id into v_member_id from public.members where portal_token = p_token;
  if v_member_id is null then
    return public._record_check_in(null, 'gate', null, 'Unknown member link');
  end if;
  if not exists (select 1 from public.gate_sessions where code = p_code and expires_at > now()) then
    return public._record_check_in(v_member_id, 'gate', null, 'Gate code expired — scan the screen again');
  end if;
  return public._record_check_in(v_member_id, 'gate', null, null);
end $$;

-- ---------------------------------------------------------------------------
-- Members & renewals
-- ---------------------------------------------------------------------------

create or replace function public.create_member(
  p_member jsonb, p_plan_id uuid, p_amount numeric, p_method text, p_start_date date
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_member_id uuid;
  v_membership_id uuid;
  v_plan public.plans;
begin
  if not public.is_staff() then raise exception 'Not authorized'; end if;
  select * into v_plan from public.plans where id = p_plan_id;
  if not found then raise exception 'Choose a plan'; end if;

  insert into public.members (full_name, phone, email, gender, dob, emergency_contact, notes, photo_url, status)
  values (
    p_member ->> 'fullName', p_member ->> 'phone', p_member ->> 'email',
    coalesce(p_member ->> 'gender', 'other'), (p_member ->> 'dob')::date,
    p_member ->> 'emergencyContact', p_member ->> 'notes', p_member ->> 'photoUrl',
    coalesce(p_member ->> 'status', 'active')
  ) returning id into v_member_id;

  insert into public.memberships (member_id, plan_id, start_date, end_date, amount_npr)
  values (v_member_id, p_plan_id, p_start_date, p_start_date + v_plan.duration_days - 1, p_amount)
  returning id into v_membership_id;

  insert into public.payments (member_id, membership_id, amount_npr, method, note)
  values (v_member_id, v_membership_id, p_amount, p_method, 'New membership');

  return v_member_id;
end $$;

-- Extends from the current end date if still running, otherwise starts today.
create or replace function public.renew_membership(
  p_member_id uuid, p_plan_id uuid, p_amount numeric, p_method text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_plan public.plans;
  v_current_end date;
  v_start date;
  v_membership_id uuid;
begin
  if not public.is_staff() then raise exception 'Not authorized'; end if;
  select * into v_plan from public.plans where id = p_plan_id;
  if not found then raise exception 'Choose a plan'; end if;

  select max(end_date) into v_current_end from public.memberships where member_id = p_member_id;
  v_start := case when v_current_end >= public.gym_today() then v_current_end + 1 else public.gym_today() end;

  insert into public.memberships (member_id, plan_id, start_date, end_date, amount_npr)
  values (p_member_id, p_plan_id, v_start, v_start + v_plan.duration_days - 1, p_amount)
  returning id into v_membership_id;

  insert into public.payments (member_id, membership_id, amount_npr, method, note)
  values (p_member_id, v_membership_id, p_amount, p_method, 'Renewal');

  update public.reminders set status = 'dismissed'
  where member_id = p_member_id and status = 'pending';

  return v_membership_id;
end $$;

-- ---------------------------------------------------------------------------
-- Renewal reminders (run daily by pg_cron, or on demand by staff)
-- ---------------------------------------------------------------------------

create or replace function public.generate_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_days int[];
  v_threshold int;
  v_kind text;
  v_rows int;
  v_count int := 0;
begin
  -- auth.uid() is null when invoked by pg_cron.
  if auth.uid() is not null and not public.is_staff() then raise exception 'Not authorized'; end if;
  select reminder_days into v_days from public.settings where id = 1;

  for r in select id, membership_id, days_left from public.member_summaries
           where status = 'active' and membership_id is not null loop
    if r.days_left < 0 then
      v_kind := case when r.days_left >= -30 then 'overdue' end;
    else
      select min(d) into v_threshold from unnest(v_days) d where d >= r.days_left;
      v_kind := case when v_threshold is null then null when v_threshold = 0 then 'due' else v_threshold || 'd' end;
    end if;

    if v_kind is not null then
      insert into public.reminders (member_id, membership_id, kind)
      values (r.id, r.membership_id, v_kind)
      on conflict (membership_id, kind) do nothing;
      get diagnostics v_rows = row_count;
      v_count := v_count + v_rows;
    end if;
  end loop;
  return v_count;
end $$;

-- ---------------------------------------------------------------------------
-- Dashboard
-- ---------------------------------------------------------------------------

create or replace function public.dashboard_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := public.gym_today();
begin
  if not public.is_staff() then raise exception 'Not authorized'; end if;
  return jsonb_build_object(
    'activeMembers', (select count(*) from public.member_summaries where access in ('active', 'expiring')),
    'renewalsDue', (select count(*) from public.member_summaries where access = 'expiring'),
    'todaysCheckIns', (
      select count(*) from public.attendance
      where result = 'accepted' and (checked_in_at at time zone 'Asia/Kathmandu')::date = v_today),
    'collectedThisMonth', (
      select coalesce(sum(amount_npr), 0) from public.payments
      where (paid_at at time zone 'Asia/Kathmandu')::date >= date_trunc('month', v_today)::date),
    'week', (
      select jsonb_agg(jsonb_build_object('date', d::date, 'count', (
        select count(*) from public.attendance
        where result = 'accepted' and (checked_in_at at time zone 'Asia/Kathmandu')::date = d::date
      )) order by d)
      from generate_series((v_today - 6)::timestamp, v_today::timestamp, interval '1 day') d)
  );
end $$;

-- ---------------------------------------------------------------------------
-- Row level security: signed-in staff manage everything; settings, plans and
-- add-on catalog changes are owner-only. Members never sign in; their portal
-- goes through get_portal / gate_check_in above.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.plans enable row level security;
alter table public.members enable row level security;
alter table public.credentials enable row level security;
alter table public.memberships enable row level security;
alter table public.payments enable row level security;
alter table public.attendance enable row level security;
alter table public.reminders enable row level security;
alter table public.addons enable row level security;
alter table public.member_addons enable row level security;
alter table public.follow_up_notes enable row level security;
alter table public.gate_sessions enable row level security;

create policy "staff read profiles" on public.profiles for select using (public.is_staff());
create policy "owner manages profiles" on public.profiles for update using (public.is_owner());

create policy "staff read settings" on public.settings for select using (public.is_staff());
create policy "owner updates settings" on public.settings for update using (public.is_owner());

create policy "staff read plans" on public.plans for select using (public.is_staff());
create policy "owner writes plans" on public.plans for all using (public.is_owner()) with check (public.is_owner());

create policy "staff read addons" on public.addons for select using (public.is_staff());
create policy "owner writes addons" on public.addons for all using (public.is_owner()) with check (public.is_owner());

create policy "staff all members" on public.members for all using (public.is_staff()) with check (public.is_staff());
create policy "staff all credentials" on public.credentials for all using (public.is_staff()) with check (public.is_staff());
create policy "staff all memberships" on public.memberships for all using (public.is_staff()) with check (public.is_staff());
create policy "staff all payments" on public.payments for all using (public.is_staff()) with check (public.is_staff());
create policy "staff read attendance" on public.attendance for select using (public.is_staff());
create policy "staff all reminders" on public.reminders for all using (public.is_staff()) with check (public.is_staff());
create policy "staff all member_addons" on public.member_addons for all using (public.is_staff()) with check (public.is_staff());
create policy "staff all notes" on public.follow_up_notes for all using (public.is_staff()) with check (public.is_staff());
-- gate_sessions: no policies; only reachable through security definer functions.

grant execute on function public.get_portal(text) to anon, authenticated;
grant execute on function public.gate_check_in(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: live check-in feed and cross-device updates.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table
  public.attendance, public.members, public.memberships, public.credentials, public.reminders;

-- ---------------------------------------------------------------------------
-- Daily reminder job at 07:00 Nepal time (01:15 UTC).
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron;
select cron.schedule('generate-renewal-reminders', '15 1 * * *', $$select public.generate_reminders()$$);

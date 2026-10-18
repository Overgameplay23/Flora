-- Luna launch-week report: sign-ups, onboarding, the first day, D1/D7/D30 retention, stickiness, paintings.
-- Read-only. Paste into the Supabase dashboard (Bloom > SQL Editor) and run; each block is one result table.
-- Targets from the strategy report (docs/product-strategy/PRODUCT_STRATEGY.md): D1 > 38%, D7 > 18%, D30 > 10%,
-- DAU/MAU > 35%.
--
-- "Active on a day" means a day of care, exactly as Days Together counts it: a task done or a check-in, on the
-- person's own local day (daily_user_metrics). The sign-up day is the UTC date of the account, so a late-evening
-- sign-up in the Americas can land a day early; at launch-week sizes that is noise, not a trend.
-- Test and review accounts are left out by the `people` filter: add their emails to `excluded`.

-- ---------------------------------------------------------------- 1. sign-ups and onboarding, per day (30 days)
with excluded(email) as (values ('review@example.com')),
people as (
  select u.id, (u.created_at at time zone 'utc')::date as joined, u.email
  from auth.users u
  where u.created_at is not null and u.email not like '%@floura.local' and u.email not in (select email from excluded)
)
select
  p.joined,
  count(*) as sign_ups,
  count(*) filter (where pr.pet_photo_url is not null) as finished_onboarding,
  round(100.0 * count(*) filter (where pr.pet_photo_url is not null) / nullif(count(*), 0), 1) as onboarding_pct,
  count(*) filter (where exists (
    select 1 from public.daily_user_metrics m
    where m.user_id = p.id and m.day = p.joined and (m.tasks_completed > 0 or m.checkins_completed > 0)
  )) as cared_on_day_one
from people p
left join public.profiles pr on pr.user_id = p.id
where p.joined >= current_date - 30
group by p.joined
order by p.joined desc;

-- ---------------------------------------------------------------- 2. D1 / D7 / D30 by weekly cohort
-- Each rate only counts people whose day N has already happened, so a young cohort shows blanks, not zeros.
with excluded(email) as (values ('review@example.com')),
people as (
  select u.id, (u.created_at at time zone 'utc')::date as joined
  from auth.users u
  where u.created_at is not null and u.email not like '%@floura.local' and u.email not in (select email from excluded)
),
active as (
  select user_id, day from public.daily_user_metrics where tasks_completed > 0 or checkins_completed > 0
),
flags as (
  select
    date_trunc('week', p.joined)::date as cohort_week,
    p.joined,
    exists (select 1 from active a where a.user_id = p.id and a.day = p.joined + 1) as d1,
    exists (select 1 from active a where a.user_id = p.id and a.day = p.joined + 7) as d7,
    exists (select 1 from active a where a.user_id = p.id and a.day = p.joined + 30) as d30
  from people p
)
select
  cohort_week,
  count(*) as people,
  round(100.0 * count(*) filter (where d1 and joined + 1 < current_date) / nullif(count(*) filter (where joined + 1 < current_date), 0), 1) as d1_pct,
  round(100.0 * count(*) filter (where d7 and joined + 7 < current_date) / nullif(count(*) filter (where joined + 7 < current_date), 0), 1) as d7_pct,
  round(100.0 * count(*) filter (where d30 and joined + 30 < current_date) / nullif(count(*) filter (where joined + 30 < current_date), 0), 1) as d30_pct
from flags
group by cohort_week
order by cohort_week desc;

-- ---------------------------------------------------------------- 3. stickiness: average DAU / MAU, last 30 days
with excluded(email) as (values ('review@example.com')),
people as (
  select u.id from auth.users u
  where u.created_at is not null and u.email not like '%@floura.local' and u.email not in (select email from excluded)
),
active as (
  select m.user_id, m.day from public.daily_user_metrics m
  join people p on p.id = m.user_id
  where (m.tasks_completed > 0 or m.checkins_completed > 0) and m.day >= current_date - 30 and m.day < current_date
)
select
  round(avg(dau), 1) as avg_dau,
  (select count(distinct user_id) from active) as mau,
  round(100.0 * avg(dau) / nullif((select count(distinct user_id) from active), 0), 1) as dau_mau_pct
from (select day, count(distinct user_id) as dau from active group by day) d;

-- ---------------------------------------------------------------- 4. paintings: how the pet portraits are doing
-- ready = painted; processing = waiting (stuck if old); error = failed (see pet.processing_error); idle = never asked.
with excluded(email) as (values ('review@example.com'))
select
  coalesce(pt.processing_status, 'none') as status,
  count(*) as pets,
  count(*) filter (where pt.processing_status = 'processing' and pt.updated_at < now() - interval '10 minutes') as stuck_over_10_min
from public.pet pt
join auth.users u on u.id = pt.user_id
where u.created_at is not null and u.email not like '%@floura.local' and u.email not in (select email from excluded)
group by 1
order by 2 desc;

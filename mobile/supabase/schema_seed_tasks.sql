-- Seed default tasks for new users
-- Triggered when a profiles row is created
-- Safe to re-run (idempotent)

create or replace function public.seed_default_tasks()
returns trigger as $$
begin
  -- Insert default tasks only if user has no tasks yet
  if not exists (
    select 1 from public.tasks where user_id = new.user_id
  ) then
    insert into public.tasks (user_id, title, sort_order)
    values
      (new.user_id, '10-minute focus session', 1),
      (new.user_id, 'Drink water', 2),
      (new.user_id, 'Go outside / get sunlight', 3);
  end if;

  return new;
end;
$$ language plpgsql;

-- Make re-runs safe
drop trigger if exists profiles_seed_tasks on public.profiles;

create trigger profiles_seed_tasks
after insert on public.profiles
for each row execute function public.seed_default_tasks();

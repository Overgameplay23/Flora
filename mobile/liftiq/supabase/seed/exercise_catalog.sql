insert into public.exercise_catalog (
  slug,
  name,
  category,
  equipment,
  movement_pattern,
  primary_muscles,
  secondary_muscles,
  is_system,
  source
)
values
  ('barbell-back-squat', 'Barbell Back Squat', 'legs', 'barbell', 'squat', array['quads', 'glutes'], array['core', 'hamstrings'], true, 'seed'),
  ('front-squat', 'Front Squat', 'legs', 'barbell', 'squat', array['quads'], array['core', 'glutes'], true, 'seed'),
  ('leg-press', 'Leg Press', 'legs', 'machine', 'press', array['quads', 'glutes'], array['hamstrings'], true, 'seed'),
  ('romanian-deadlift', 'Romanian Deadlift', 'legs', 'barbell', 'hinge', array['hamstrings', 'glutes'], array['lower_back'], true, 'seed'),
  ('conventional-deadlift', 'Conventional Deadlift', 'back', 'barbell', 'hinge', array['glutes', 'hamstrings', 'back'], array['forearms', 'core'], true, 'seed'),
  ('barbell-bench-press', 'Barbell Bench Press', 'chest', 'barbell', 'horizontal_press', array['chest'], array['triceps', 'front_delts'], true, 'seed'),
  ('incline-dumbbell-press', 'Incline Dumbbell Press', 'chest', 'dumbbell', 'incline_press', array['upper_chest'], array['triceps', 'front_delts'], true, 'seed'),
  ('machine-chest-press', 'Machine Chest Press', 'chest', 'machine', 'horizontal_press', array['chest'], array['triceps', 'front_delts'], true, 'seed'),
  ('cable-fly', 'Cable Fly', 'chest', 'cable', 'fly', array['chest'], array['front_delts'], true, 'seed'),
  ('standing-overhead-press', 'Standing Overhead Press', 'shoulders', 'barbell', 'vertical_press', array['shoulders'], array['triceps', 'upper_chest'], true, 'seed'),
  ('seated-dumbbell-press', 'Seated Dumbbell Press', 'shoulders', 'dumbbell', 'vertical_press', array['shoulders'], array['triceps'], true, 'seed'),
  ('dumbbell-lateral-raise', 'Dumbbell Lateral Raise', 'shoulders', 'dumbbell', 'raise', array['side_delts'], array['upper_traps'], true, 'seed'),
  ('pull-up', 'Pull-Up', 'back', 'bodyweight', 'vertical_pull', array['lats'], array['biceps', 'upper_back'], true, 'seed'),
  ('lat-pulldown', 'Lat Pulldown', 'back', 'cable', 'vertical_pull', array['lats'], array['biceps', 'upper_back'], true, 'seed'),
  ('barbell-row', 'Barbell Row', 'back', 'barbell', 'horizontal_pull', array['upper_back', 'lats'], array['biceps', 'lower_back'], true, 'seed'),
  ('seated-cable-row', 'Seated Cable Row', 'back', 'cable', 'horizontal_pull', array['upper_back', 'lats'], array['biceps'], true, 'seed'),
  ('hip-thrust', 'Hip Thrust', 'legs', 'barbell', 'bridge', array['glutes'], array['hamstrings'], true, 'seed'),
  ('walking-lunge', 'Walking Lunge', 'legs', 'dumbbell', 'lunge', array['quads', 'glutes'], array['core', 'hamstrings'], true, 'seed'),
  ('leg-curl', 'Leg Curl', 'legs', 'machine', 'curl', array['hamstrings'], array['calves'], true, 'seed'),
  ('leg-extension', 'Leg Extension', 'legs', 'machine', 'extension', array['quads'], array[]::text[], true, 'seed'),
  ('seated-calf-raise', 'Seated Calf Raise', 'legs', 'machine', 'calf_raise', array['calves'], array[]::text[], true, 'seed'),
  ('barbell-curl', 'Barbell Curl', 'arms', 'barbell', 'curl', array['biceps'], array['forearms'], true, 'seed'),
  ('hammer-curl', 'Hammer Curl', 'arms', 'dumbbell', 'curl', array['biceps', 'brachialis'], array['forearms'], true, 'seed'),
  ('triceps-pushdown', 'Triceps Pushdown', 'arms', 'cable', 'extension', array['triceps'], array[]::text[], true, 'seed'),
  ('plank', 'Plank', 'core', 'bodyweight', 'brace', array['core'], array['glutes'], true, 'seed')
on conflict (slug) do update
set
  name = excluded.name,
  category = excluded.category,
  equipment = excluded.equipment,
  movement_pattern = excluded.movement_pattern,
  primary_muscles = excluded.primary_muscles,
  secondary_muscles = excluded.secondary_muscles,
  is_system = true,
  source = excluded.source,
  updated_at = now();

insert into public.exercise_aliases (exercise_id, alias)
select ec.id, alias_values.alias
from (
  values
    ('barbell-back-squat', 'back squat'),
    ('barbell-back-squat', 'bb squat'),
    ('front-squat', 'bb front squat'),
    ('leg-press', 'sled press'),
    ('romanian-deadlift', 'rdl'),
    ('conventional-deadlift', 'deadlift'),
    ('conventional-deadlift', 'conv deadlift'),
    ('barbell-bench-press', 'bench'),
    ('barbell-bench-press', 'bb bench'),
    ('incline-dumbbell-press', 'incline db press'),
    ('machine-chest-press', 'chest press'),
    ('standing-overhead-press', 'ohp'),
    ('standing-overhead-press', 'military press'),
    ('seated-dumbbell-press', 'db shoulder press'),
    ('dumbbell-lateral-raise', 'lat raise'),
    ('pull-up', 'pullup'),
    ('lat-pulldown', 'lat pull down'),
    ('barbell-row', 'bb row'),
    ('barbell-row', 'bent over row'),
    ('seated-cable-row', 'cable row'),
    ('hip-thrust', 'barbell hip thrust'),
    ('walking-lunge', 'db lunge'),
    ('leg-curl', 'ham curl'),
    ('leg-extension', 'quad extension'),
    ('seated-calf-raise', 'calf raise'),
    ('barbell-curl', 'bb curl'),
    ('hammer-curl', 'db hammer curl'),
    ('triceps-pushdown', 'pressdown'),
    ('triceps-pushdown', 'rope pushdown'),
    ('plank', 'front plank')
) as alias_values(slug, alias)
join public.exercise_catalog ec on ec.slug = alias_values.slug
on conflict do nothing;

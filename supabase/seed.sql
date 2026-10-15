-- Starter catalog. Members are added from the app (Members → Add member).
insert into public.plans (name, duration_days, price_npr) values
  ('Monthly', 30, 2500),
  ('Quarterly', 90, 7500),
  ('Half-yearly', 180, 13500),
  ('Yearly', 365, 24000);

insert into public.addons (name, price_npr) values
  ('Personal locker', 500),
  ('Personal trainer', 6000),
  ('Towel service', 300),
  ('Diet consultation', 1500);

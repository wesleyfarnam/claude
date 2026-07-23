-- Extend the widgets.type check constraint to include the sports widget type.
alter table public.widgets drop constraint widgets_type_check;
alter table public.widgets add constraint widgets_type_check
  check (type in ('weather', 'news', 'sports'));

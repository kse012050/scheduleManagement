-- Weekend notes are no longer displayed for film and wallpaper work types.

update public.work_types
set note = null
where name in ('필름', '도배');

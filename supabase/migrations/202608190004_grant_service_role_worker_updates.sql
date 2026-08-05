-- Allow the admin Edge Function to update editable worker profile fields.

grant update (name, phone, work_type_id)
  on table public.profiles
  to service_role;

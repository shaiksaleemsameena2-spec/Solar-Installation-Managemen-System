-- ============================================================
-- SolarOps AI — migration 2 of 3: Row Level Security & helper
-- Run after 0001_schema.sql.
--
-- Model:
--  - Staff (admin/sales/inventory/installation/service) get role-
--    based access via their profile.
--  - Customers can only read their OWN records (customer_id link).
--  - Technicians table is world-readable (anonymous OK) for the
--    public locator; writes are staff-only.
-- ============================================================

-- helper: current user's role
create or replace function public.current_role() returns app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

-- helper: current user's linked customer id (null for staff)
create or replace function public.current_customer_id() returns uuid
language sql stable security definer set search_path = public as $$
  select customer_id from public.profiles where id = auth.uid();
$$;

-- helper: staff check
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(current_role() <> 'customer', false);
$$;

alter function public.current_role() owner to postgres;
alter function public.current_customer_id() owner to postgres;
alter function public.is_staff() owner to postgres;

-- Grant baseline
grant usage on schema public to anon, authenticated;
grant select on public.technicians, public.app_settings to anon;

-- ---------- Enable RLS on every table ----------
do $$
declare t text;
begin
  foreach t in array array['profiles','customers','customer_notes','site_surveys','solar_packages',
    'quotations','inventory_items','inventory_transactions','equipment_units','installation_crews',
    'installation_projects','checklist_items','installation_photos','customer_acceptances',
    'warranties','service_tickets','service_ticket_notes','payments','project_expenses',
    'subsidy_applications','activity_logs','technicians','app_settings']
  loop
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end $$;

-- ---------- Policies (owner/staff-customer pattern) ----------
-- Simplest consistent model for the hackathon: staff can do everything
-- on operational tables; customers get read-only on their own rows.

do $$
declare t text;
begin
  foreach t in array array['customers','site_surveys','quotations','installation_projects',
    'checklist_items','installation_photos','customer_acceptances','warranties','service_tickets',
    'payments','project_expenses','subsidy_applications','customer_notes','activity_logs']
  loop
    execute format($f$
      create policy "%1$s_staff_all" on public.%1$I
        for all to authenticated
        using (public.is_staff())
        with check (public.is_staff());

      create policy "%1$s_customer_read" on public.%1$I
        for select to authenticated
        using (customer_id = public.current_customer_id());
    $f$, t);
  end loop;
end $$;

-- staff-only write tables (customers never write)
create policy "packages_staff_all" on public.solar_packages
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "packages_world_read" on public.solar_packages
  for select to anon, authenticated using (is_active);

create policy "inventory_staff_all" on public.inventory_items
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "inventory_staff_read" on public.inventory_items
  for select to authenticated using (true);

create policy "invtx_staff_all" on public.inventory_transactions
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy "units_staff_all" on public.equipment_units
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "units_staff_read" on public.equipment_units
  for select to authenticated using (true);

create policy "crews_staff_all" on public.installation_crews
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "crews_read" on public.installation_crews
  for select to authenticated using (true);

create policy "ticketnotes_staff_all" on public.service_ticket_notes
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "ticketnotes_customer_read" on public.service_ticket_notes
  for select to authenticated
  using (exists (select 1 from public.service_tickets st where st.id = ticket_id and st.customer_id = public.current_customer_id()));

-- technicians + settings: world readable, staff writable
create policy "tech_staff_write" on public.technicians
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "tech_world_read" on public.technicians
  for select to anon, authenticated using (is_active);

create policy "settings_staff_all" on public.app_settings
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "settings_world_read" on public.app_settings
  for select to anon, authenticated using (true);

-- profiles: self read/update, staff read all
create policy "profiles_self" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_staff());
create policy "profiles_staff_write" on public.profiles
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- auto-provision a profile on signup (default role customer)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', 'New user'), new.email, 'customer');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

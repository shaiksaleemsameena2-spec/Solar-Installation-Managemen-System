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

-- helper: current user's application role
-- Note: Named current_app_role to avoid collision with PostgreSQL reserved keyword CURRENT_ROLE
create or replace function public.current_app_role() returns app_role
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
  select coalesce(public.current_app_role() <> 'customer'::app_role, false);
$$;

alter function public.current_app_role() owner to postgres;
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

-- ---------- Customers Table Policies ----------
drop policy if exists "customers_staff_all" on public.customers;
create policy "customers_staff_all" on public.customers
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "customers_customer_read" on public.customers;
create policy "customers_customer_read" on public.customers
  for select to authenticated
  using (id = public.current_customer_id());

-- ---------- Operational Tables with direct customer_id column ----------
do $$
declare t text;
begin
  foreach t in array array['site_surveys','quotations','installation_projects',
    'warranties','service_tickets','payments','subsidy_applications',
    'customer_notes','activity_logs']
  loop
    execute format('drop policy if exists "%1$s_staff_all" on public.%1$I;', t);
    execute format('drop policy if exists "%1$s_customer_read" on public.%1$I;', t);

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

-- ---------- Project Child Tables (linked via project_id) ----------
-- checklist_items
drop policy if exists "checklist_items_staff_all" on public.checklist_items;
create policy "checklist_items_staff_all" on public.checklist_items
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "checklist_items_customer_read" on public.checklist_items;
create policy "checklist_items_customer_read" on public.checklist_items
  for select to authenticated
  using (exists (
    select 1 from public.installation_projects p
    where p.id = project_id and p.customer_id = public.current_customer_id()
  ));

-- installation_photos
drop policy if exists "installation_photos_staff_all" on public.installation_photos;
create policy "installation_photos_staff_all" on public.installation_photos
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "installation_photos_customer_read" on public.installation_photos;
create policy "installation_photos_customer_read" on public.installation_photos
  for select to authenticated
  using (exists (
    select 1 from public.installation_projects p
    where p.id = project_id and p.customer_id = public.current_customer_id()
  ));

-- customer_acceptances
drop policy if exists "customer_acceptances_staff_all" on public.customer_acceptances;
create policy "customer_acceptances_staff_all" on public.customer_acceptances
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "customer_acceptances_customer_read" on public.customer_acceptances;
create policy "customer_acceptances_customer_read" on public.customer_acceptances
  for select to authenticated
  using (exists (
    select 1 from public.installation_projects p
    where p.id = project_id and p.customer_id = public.current_customer_id()
  ));

-- project_expenses (internal financials: staff-only)
drop policy if exists "project_expenses_staff_all" on public.project_expenses;
create policy "project_expenses_staff_all" on public.project_expenses
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------- Packages & Inventory ----------
drop policy if exists "packages_staff_all" on public.solar_packages;
create policy "packages_staff_all" on public.solar_packages
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "packages_world_read" on public.solar_packages;
create policy "packages_world_read" on public.solar_packages
  for select to anon, authenticated using (is_active);

drop policy if exists "inventory_staff_all" on public.inventory_items;
create policy "inventory_staff_all" on public.inventory_items
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "inventory_staff_read" on public.inventory_items;
create policy "inventory_staff_read" on public.inventory_items
  for select to authenticated using (true);

drop policy if exists "invtx_staff_all" on public.inventory_transactions;
create policy "invtx_staff_all" on public.inventory_transactions
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "units_staff_all" on public.equipment_units;
create policy "units_staff_all" on public.equipment_units
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "units_staff_read" on public.equipment_units;
create policy "units_staff_read" on public.equipment_units
  for select to authenticated using (true);

drop policy if exists "crews_staff_all" on public.installation_crews;
create policy "crews_staff_all" on public.installation_crews
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "crews_read" on public.installation_crews;
create policy "crews_read" on public.installation_crews
  for select to authenticated using (true);

-- ---------- Service Ticket Notes ----------
drop policy if exists "ticketnotes_staff_all" on public.service_ticket_notes;
create policy "ticketnotes_staff_all" on public.service_ticket_notes
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "ticketnotes_customer_read" on public.service_ticket_notes;
create policy "ticketnotes_customer_read" on public.service_ticket_notes
  for select to authenticated
  using (exists (
    select 1 from public.service_tickets st
    where st.id = ticket_id and st.customer_id = public.current_customer_id()
  ));

-- ---------- Technicians & Settings ----------
drop policy if exists "tech_staff_write" on public.technicians;
create policy "tech_staff_write" on public.technicians
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "tech_world_read" on public.technicians;
create policy "tech_world_read" on public.technicians
  for select to anon, authenticated using (is_active);

drop policy if exists "settings_staff_all" on public.app_settings;
create policy "settings_staff_all" on public.app_settings
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "settings_world_read" on public.app_settings;
create policy "settings_world_read" on public.app_settings
  for select to anon, authenticated using (true);

-- ---------- Profiles ----------
drop policy if exists "profiles_self" on public.profiles;
create policy "profiles_self" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_staff());

drop policy if exists "profiles_staff_write" on public.profiles;
create policy "profiles_staff_write" on public.profiles
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------- Trigger: Auto-provision a profile on signup ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', 'New user'), new.email, 'customer')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

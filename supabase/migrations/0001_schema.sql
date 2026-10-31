-- ============================================================
-- SolarOps AI — Supabase schema (migration 1 of 3)
-- Mirrors the TS domain types in src/types/index.ts.
-- Run this first in the Supabase SQL editor.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- Profiles & auth linking ----------
create type app_role as enum ('admin','sales','inventory','installation','service','customer');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role app_role not null default 'sales',
  customer_id uuid, -- link for customer role
  created_at timestamptz not null default now()
);

-- ---------- Customers ----------
create type lead_status as enum ('new','contacted','survey_scheduled','survey_completed','quotation_sent','negotiation','won','lost');
create type customer_type as enum ('residential','commercial');

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  full_name text not null,
  phone text not null,
  email text,
  address text,
  city text,
  state text,
  postal_code text,
  customer_type customer_type not null default 'residential',
  monthly_units numeric(10,2) default 0,
  monthly_bill numeric(12,2) default 0,
  lead_source text,
  assigned_to text,
  notes text default '',
  lead_status lead_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  note text not null,
  author text,
  created_at timestamptz not null default now()
);

-- ---------- Surveys ----------
create type survey_status as enum ('scheduled','in_progress','completed','cancelled');

create table public.site_surveys (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  customer_id uuid not null references public.customers(id) on delete cascade,
  survey_date date,
  surveyor text,
  property_type text,
  roof_type text,
  roof_area_sqm numeric(10,2),
  installable_area_sqm numeric(10,2),
  shading text,
  monthly_units numeric(10,2),
  monthly_bill numeric(12,2),
  required_capacity_kw numeric(6,2),
  grid_available boolean default true,
  recommended_system_type text,
  constraints_text text,
  notes text,
  status survey_status not null default 'scheduled',
  photo_urls jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------- Packages & Quotations ----------
create type system_type as enum ('on_grid','off_grid');

create table public.solar_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  capacity_kw numeric(5,2) not null,
  system_type system_type not null default 'on_grid',
  panel_wattage int not null default 550,
  panel_count int not null default 2,
  inverter_spec text,
  battery_spec text default '—',
  equipment_cost numeric(12,2) not null default 0,
  installation_cost numeric(12,2) not null default 0,
  additional_cost numeric(12,2) not null default 0,
  tax_percent numeric(5,2) not null default 12,
  description text,
  is_active boolean default true
);

create type quotation_status as enum ('draft','generated','sent','accepted','rejected','expired');

create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  customer_id uuid not null references public.customers(id) on delete cascade,
  survey_id uuid references public.site_surveys(id) on delete set null,
  package_id uuid references public.solar_packages(id),
  -- denormalized snapshot of the package at quotation time (immutable after accept)
  package_name text,
  capacity_kw numeric(5,2),
  system_type system_type,
  panel_wattage int,
  panel_count int,
  inverter_spec text,
  battery_spec text,
  equipment_cost numeric(12,2),
  installation_cost numeric(12,2),
  tax_percent numeric(5,2),
  additional_items jsonb not null default '[]'::jsonb,
  discount numeric(12,2) default 0,
  subsidy_estimate numeric(12,2) default 0,
  subtotal numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  valid_until date,
  terms text,
  status quotation_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- BUSINESS RULE: at most one non-cancelled project per accepted quotation
-- (the partial unique index is created after installation_projects is defined below)

-- ---------- Inventory ----------
create type inventory_category as enum ('solar_panel','inverter','battery','mounting','cable','connector','protection','other');

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  category inventory_category not null,
  manufacturer text,
  model text,
  unit text default 'units',
  purchase_cost numeric(12,2) default 0,
  selling_price numeric(12,2) default 0,
  available_qty numeric(12,2) not null default 0 check (available_qty >= 0),
  reserved_qty numeric(12,2) not null default 0 check (reserved_qty >= 0),
  reorder_level numeric(12,2) default 0,
  supplier text,
  warranty_months int default 12,
  is_active boolean default true
);

create type tx_type as enum ('receipt','adjustment','reserve','release','dispatch','install');

create table public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  item_name text,
  type tx_type not null,
  qty numeric(12,2) not null,
  reference text,
  note text,
  by text,
  created_at timestamptz not null default now()
);

create type equipment_status as enum ('in_stock','reserved','dispatched','installed','returned','defective');

-- BUSINESS RULE: globally unique serial numbers (duplicate registration rejected)
create table public.equipment_units (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id),
  item_name text,
  serial_number text not null unique, -- enforced uniqueness
  purchase_ref text,
  status equipment_status not null default 'in_stock',
  project_id uuid, -- fk added after installations table
  dispatched_at timestamptz,
  installed_at timestamptz,
  notes text default '',
  created_at timestamptz not null default now()
);

-- ---------- Crews & Projects ----------
create type crew_availability as enum ('available','busy','off_duty','on_leave');

create table public.installation_crews (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  leader text,
  members jsonb default '[]'::jsonb,
  phone text,
  skills jsonb default '[]'::jsonb,
  availability crew_availability default 'available'
);

create type project_status as enum ('awaiting_stock','ready_to_schedule','scheduled','in_progress','quality_inspection','completed','cancelled');

create table public.installation_projects (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  customer_id uuid not null references public.customers(id),
  quotation_id uuid not null references public.quotations(id),
  package_name text,
  capacity_kw numeric(5,2),
  installation_type text,
  address text,
  manager text,
  crew_id uuid references public.installation_crews(id),
  scheduled_start date,
  scheduled_end date,
  actual_completion date,
  status project_status not null default 'awaiting_stock',
  planned_cost numeric(12,2) default 0,
  actual_cost numeric(12,2) default 0,
  contract_value numeric(12,2) not null default 0,
  notes text default '',
  equipment_status text default 'pending' check (equipment_status in ('pending','reserved','dispatched')),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.equipment_units
  add constraint fk_equipment_project foreign key (project_id)
  references public.installation_projects(id) on delete set null;

-- now create the partial unique index defined above
create unique index unique_project_per_quotation
  on public.installation_projects (quotation_id)
  where status <> 'cancelled';

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.installation_projects(id) on delete cascade,
  sequence int not null default 1,
  description text not null,
  completed boolean default false,
  completed_by text,
  completed_at timestamptz,
  notes text default ''
);

create table public.installation_photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.installation_projects(id) on delete cascade,
  caption text,
  storage_path text, -- Supabase storage object path
  uploaded_by text,
  uploaded_at timestamptz not null default now()
);

-- acceptance: at most one per project
create table public.customer_acceptances (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.installation_projects(id) on delete cascade,
  customer_name text not null,
  accepted_at timestamptz not null default now(),
  signature_storage_path text -- optional; a typed name is NOT a verified digital signature
);

-- ---------- Warranties ----------
create type warranty_status as enum ('pending_activation','active','expired','claimed','voided');

-- BUSINESS RULE: one activation record per project + product (duplicate prevention in app logic)
create table public.warranties (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  customer_id uuid not null references public.customers(id),
  project_id uuid not null references public.installation_projects(id),
  equipment_unit_id uuid references public.equipment_units(id),
  product_name text,
  serial_number text,
  warranty_type text,
  start_date date,
  end_date date,
  duration_months int not null default 12,
  terms text,
  status warranty_status not null default 'pending_activation',
  created_at timestamptz not null default now()
);

-- ---------- Service ----------
create type ticket_status as enum ('open','assigned','in_progress','waiting_parts','resolved','closed');
create type ticket_priority as enum ('low','medium','high','critical');
create type assignment_status as enum ('requested','awaiting_confirmation','confirmed','in_progress','completed','cancelled');

create table public.service_tickets (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  customer_id uuid not null references public.customers(id),
  project_id uuid references public.installation_projects(id),
  equipment_unit_id uuid references public.equipment_units(id),
  serial_number text,
  issue_category text,
  description text not null,
  priority ticket_priority not null default 'medium',
  status ticket_status not null default 'open',
  assigned_technician text,
  assignment_status assignment_status,
  appointment_time text,
  resolution_notes text default '',
  estimated_cost numeric(12,2) default 0,
  actual_cost numeric(12,2) default 0,
  resolution_date date,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_ticket_notes (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.service_tickets(id) on delete cascade,
  note text not null,
  author text,
  created_at timestamptz not null default now()
);

-- ---------- Finance ----------
create type payment_status as enum ('pending','paid','failed','refunded');
create type payment_stage as enum ('booking_advance','equipment_dispatch','installation_milestone','final');

-- BUSINESS RULE: duplicate payment protection (same txn_ref + project + amount)
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  customer_id uuid not null references public.customers(id),
  project_id uuid references public.installation_projects(id),
  quotation_id uuid references public.quotations(id),
  amount numeric(12,2) not null check (amount > 0),
  payment_date date,
  method text,
  txn_ref text default '',
  stage payment_stage not null default 'booking_advance',
  status payment_status not null default 'pending',
  notes text default '',
  created_at timestamptz not null default now()
);

create unique index unique_txn_ref_per_project
  on public.payments (project_id, txn_ref, amount)
  where coalesce(txn_ref, '') <> '';

create table public.project_expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.installation_projects(id) on delete cascade,
  category text,
  amount numeric(12,2) not null check (amount > 0),
  expense_date date not null default current_date,
  vendor text,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- Subsidies ----------
create type subsidy_status as enum ('not_started','draft','submitted','under_review','approved','rejected','paid');

create table public.subsidy_applications (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  project_id uuid references public.installation_projects(id),
  program_name text not null,
  estimated_amount numeric(12,2) default 0,
  requested_amount numeric(12,2) default 0,
  application_ref text default '',
  application_date date,
  status subsidy_status not null default 'not_started',
  approval_date date,
  approved_amount numeric(12,2) default 0,
  received_amount numeric(12,2) default 0,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- Activity ----------
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  message text not null,
  entity_type text,
  entity_id uuid,
  customer_id uuid references public.customers(id) on delete set null,
  project_id uuid references public.installation_projects(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- Technicians (customer locator) ----------
create type tech_availability as enum ('available','busy','off_duty','on_leave');

create table public.technicians (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  photo_color text default '#15803d',
  phone text not null,
  specializations jsonb default '[]'::jsonb,
  experience_years int default 0,
  location_name text,
  lat numeric(9,6),
  lng numeric(9,6),
  service_areas jsonb default '[]'::jsonb,
  max_radius_km numeric(6,2) default 15,
  working_hours text,
  availability tech_availability default 'available',
  rating numeric(3,2) default 4.5,
  completed_jobs int default 0,
  is_active boolean default true
);

-- ---------- Settings (single row) ----------
create table public.app_settings (
  id int primary key default 1 check (id = 1),
  org_name text not null default 'SunPower Solutions',
  demo_location_name text default 'Hyderabad, Telangana',
  demo_lat numeric(9,6) default 17.385,
  demo_lng numeric(9,6) default 78.4867,
  savings_assumptions jsonb not null default '{}'::jsonb
);

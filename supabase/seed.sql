-- ============================================================
-- SolarOps AI — Supabase seed (mirror of src/services/seed.ts)
-- Loads the same fictional demo dataset into the cloud DB.
-- Run AFTER supabase/migrations/0001_schema.sql and 0002_rls.sql.
--
-- Quotation totals below follow the same audited formula as
-- src/lib/calculations/finance.ts::computeQuotationTotals:
--   subtotal   = equipment + installation + additional
--   taxable    = max(0, subtotal − discount)
--   tax        = taxable × tax_percent / 100
--   total      = taxable + tax − min(subsidy, taxable + tax)
-- ============================================================

begin;

-- Idempotent re-run: wipe domain rows (never touch auth.users/profiles)
truncate table
  public.activity_logs, public.subsidy_applications, public.project_expenses,
  public.payments, public.service_ticket_notes, public.service_tickets,
  public.warranties, public.customer_acceptances, public.installation_photos,
  public.checklist_items, public.equipment_units, public.installation_projects,
  public.installation_crews, public.inventory_transactions, public.inventory_items,
  public.quotations, public.solar_packages, public.site_surveys, public.customer_notes,
  public.customers, public.technicians
  restart identity cascade;

-- ---------- Customers (12) ----------
insert into public.customers (id, code, full_name, phone, email, address, city, state, postal_code, customer_type, monthly_units, monthly_bill, lead_source, assigned_to, notes, lead_status, created_at, updated_at) values
('cust-01','CUST-0001','Ramesh Gupta','+91 90001 11223','ramesh.gupta@example.com','Ramesh, Banjara Hills','Banjara Hills','Telangana','50011','residential',360,2880,'Referral','Sales Executive — Alicia Dsouza','','won', now()-interval '45 days', now()-interval '45 days'),
('cust-02','CUST-0002','Sunita Reddy','+91 90001 22334','sunita.reddy@example.com','Sunita, Kukatpally','Kukatpally','Telangana','50012','residential',240,1920,'Google Ads','Sales Executive — Alicia Dsouza','','won', now()-interval '80 days', now()-interval '80 days'),
('cust-03','CUST-0003','Mohammed Irfan','+91 90001 33445','irfan.m@example.com','Mohammed, Gachibowli','Gachibowli','Telangana','50013','residential',520,4160,'Website','Sales Executive — Rahul Menon','','won', now()-interval '12 days', now()-interval '12 days'),
('cust-04','CUST-0004','Kavya Nair','+91 90001 44556','kavya.nair@example.com','Kavya, Madhapur','Madhapur','Telangana','50014','residential',300,2400,'Exhibition','Sales Executive — Rahul Menon','','survey_scheduled', now()-interval '6 days', now()-interval '6 days'),
('cust-05','CUST-0005','Rajesh Kumar Sharma','+91 90001 55667','rajesh.sharma@example.com','Rajesh, Hitec City (Office)','Hitec City (Office)','Telangana','50015','commercial',2400,19200,'Cold Call','Sales Executive — Alicia Dsouza','','negotiation', now()-interval '20 days', now()-interval '20 days'),
('cust-06','CUST-0006','Priya Desai','+91 90001 66778','priya.desai@example.com','Priya, Manikonda','Manikonda','Telangana','50016','residential',180,1440,'Social Media','Sales Executive — Rahul Menon','','new', now()-interval '2 days', now()-interval '2 days'),
('cust-07','CUST-0007','Anil Verma','+91 90001 77889','anil.verma@example.com','Anil, Jubilee Hills','Jubilee Hills','Telangana','50017','commercial',900,7200,'Referral','Sales Executive — Alicia Dsouza','','won', now()-interval '25 days', now()-interval '25 days'),
('cust-08','CUST-0008','Lakshmi Prasanna','+91 90001 88990','lakshmi.p@example.com','Lakshmi, Amberpet','Amberpet','Telangana','50018','residential',200,1600,'Walk-in','Sales Executive — Rahul Menon','','quotation_sent', now()-interval '9 days', now()-interval '9 days'),
('cust-09','CUST-0009','Farhan Ali','+91 90001 99001','farhan.ali@example.com','Farhan, Tolichowki','Tolichowki','Telangana','50019','residential',150,1200,'Website','Sales Executive — Alicia Dsouza','','contacted', now()-interval '5 days', now()-interval '5 days'),
('cust-10','CUST-0010','Venkat Rao Textiles','+91 90001 10112','venkat@venkatra@example.com','Venkat, Uppal','Uppal','Telangana','50020','commercial',1800,14400,'Referral','Sales Executive — Rahul Menon','','survey_scheduled', now()-interval '7 days', now()-interval '7 days'),
('cust-11','CUST-0011','Geetha Krishnan','+91 90001 11223','geetha.k@example.com','Geetha, Sainikpuri','Sainikpuri','Telangana','50021','residential',220,1760,'Google Ads','Sales Executive — Rahul Menon','','new', now()-interval '1 day', now()-interval '1 day'),
('cust-12','CUST-0012','Sudheer Babu','+91 90001 12324','sudheer.babu@example.com','Sudheer, LB Nagar','LB Nagar','Telangana','50022','residential',260,2080,'Exhibition','Sales Executive — Alicia Dsouza','','lost', now()-interval '35 days', now()-interval '35 days');

insert into public.customer_notes (customer_id, note, author, created_at) values
('cust-01','Referred by Mr. Suresh. Wants net metering application support.','Sales Executive — Alicia Dsouza', now()-interval '44 days'),
('cust-05','Needs ROI deck before negotiation call on Friday.','Sales Executive — Alicia Dsouza', now()-interval '2 days');

-- ---------- Packages (demo prices — editable assumptions) ----------
insert into public.solar_packages (id, name, capacity_kw, system_type, panel_wattage, panel_count, inverter_spec, battery_spec, equipment_cost, installation_cost, additional_cost, tax_percent, description, is_active) values
('pkg-1kw-ong','SunStart 1 kW On-Grid',1.00,'on_grid',550,2,'1 kW On-grid string inverter, MPPT, Wi-Fi monitoring','—',62000,12000,2000,12,'Entry-level rooftop system for small homes. (Demo price — editable)',true),
('pkg-2kw-ong','SunHome 2 kW On-Grid',2.00,'on_grid',550,4,'2 kW On-grid string inverter, MPPT, Wi-Fi monitoring','—',118000,18000,3500,12,'Popular residential system for 2-3 BHK. (Demo price — editable)',true),
('pkg-3kw-ong','SunHome Plus 3 kW On-Grid',3.00,'on_grid',550,6,'3 kW On-grid string inverter, MPPT, Wi-Fi monitoring','—',172000,22000,5000,12,'For medium homes with 300-450 units/month. (Demo price — editable)',true),
('pkg-5kw-ong','SunMax 5 kW On-Grid',5.00,'on_grid',550,9,'5 kW On-grid string inverter, MPPT, Wi-Fi monitoring','—',278000,30000,8000,12,'Large homes & light commercial rooftops. (Demo price — editable)',true),
('pkg-2kw-off','SunOffice 2 kW Off-Grid',2.00,'off_grid',550,4,'2 kW Off-grid inverter with MPPT charge controller','2.5 kWh LiFePO4 battery with 5-year warranty',156000,20000,4000,12,'Backup-focused system with lithium battery. (Demo price — editable)',true),
('pkg-5kw-off','SunFactory 5 kW Off-Grid',5.00,'off_grid',550,9,'5 kW Off-grid inverter with MPPT charge controller','7.5 kWh LiFePO4 battery with 5-year warranty',396000,34000,9000,12,'Frequent power-cut areas; full-day backup. (Demo price — editable)',true);

-- ---------- Surveys (6) ----------
insert into public.site_surveys (id, code, customer_id, survey_date, surveyor, property_type, roof_type, roof_area_sqm, installable_area_sqm, shading, monthly_units, monthly_bill, required_capacity_kw, grid_available, recommended_system_type, constraints_text, notes, status, photo_urls, created_at) values
('survey-01','SRV-2026-0001','cust-01',current_date-40,'Kiran Babu (Surveyor)','Independent house','RCC concrete',90,26,'Minimal (some morning shadow)',360,2880,3.00,true,'on_grid','South-facing roof, good sun','Customer wants fast ROI.','completed','["demo/Roof view — south face.svg","demo/Shadow pattern at 10 AM.svg"]'::jsonb, now()-interval '45 days'),
('survey-02','SRV-2026-0002','cust-02',current_date-78,'Kiran Babu (Surveyor)','Independent house','Sheet roof',70,18,'Moderate afternoon',240,1920,2.00,true,'on_grid','Elevated structure recommended','Sheet roof needs structural check.','completed','["demo/Sheet roof structure.svg"]'::jsonb, now()-interval '80 days'),
('survey-03','SRV-2026-0003','cust-03',current_date-9,'Deepak Rao (Surveyor)','Independent house','RCC concrete',130,30,'None',520,4160,4.00,true,'on_grid','','Rooftop is clean, ideal placement.','completed','["demo/Clean RCC roof.svg"]'::jsonb, now()-interval '14 days'),
('survey-04','SRV-2026-0004','cust-07',current_date-18,'Deepak Rao (Surveyor)','Clinic building','RCC concrete',160,42,'Low',900,7200,5.00,true,'on_grid','Daytime-heavy load, good for solar','Commercial meter existing.','completed','[]'::jsonb, now()-interval '24 days'),
('survey-05','SRV-2026-0005','cust-04',current_date+3,'Kiran Babu (Surveyor)','Apartment (own rooftop rights)','RCC concrete',60,0,'Unknown',300,2400,3.00,true,'on_grid','','Waiting for society approval.','scheduled','[]'::jsonb, now()-interval '6 days'),
('survey-06','SRV-2026-0006','cust-10',current_date+5,'Deepak Rao (Surveyor)','Industrial shed','Metal sheet',800,0,'TBD',1800,14400,5.00,true,'on_grid','Load-bearing check needed','First visit for assessment.','scheduled','[]'::jsonb, now()-interval '7 days');

-- ---------- Quotations (8) ----------
insert into public.quotations (id, number, customer_id, survey_id, package_id, package_name, capacity_kw, system_type, panel_wattage, panel_count, inverter_spec, battery_spec, equipment_cost, installation_cost, tax_percent, additional_items, discount, subsidy_estimate, subtotal, tax_amount, total, valid_until, terms, status, created_at, updated_at) values
('qt-qt-2026-0001','QT-2026-0001','cust-01','survey-01','pkg-3kw-ong','SunHome Plus 3 kW On-Grid',3.00,'on_grid',550,6,'3 kW On-grid string inverter, MPPT, Wi-Fi monitoring','—',172000,22000,12,'[{"description":"Elevated structure for terrace access","amount":4500}]'::jsonb,3000,39000,198500,23460,179960,current_date+30,'1. Package prices in this catalogue are demonstration prices and are fully editable by administrators.
2. Subsidy is only an estimate; eligibility and approval are decided exclusively by the government scheme. SunPower Solutions does not guarantee subsidy approval.
3. 50% booking advance required to confirm the order.
4. Net metering application and approvals are subject to local DISCOM rules.
5. Warranty as per manufacturer terms on registered serial-numbered equipment.','accepted', now()-interval '38 days', now()-interval '38 days'),
('qt-qt-2026-0002','QT-2026-0002','cust-02','survey-02','pkg-2kw-ong','SunHome 2 kW On-Grid',2.00,'on_grid',550,4,'2 kW On-grid string inverter, MPPT, Wi-Fi monitoring','—',118000,18000,12,'[{"description":"Elevated structure (sheet roof)","amount":6000}]'::jsonb,2000,36000,142000,16800,120800,current_date+30,'1. Package prices in this catalogue are demonstration prices and are fully editable by administrators.
2. Subsidy is only an estimate; eligibility and approval are decided exclusively by the government scheme. SunPower Solutions does not guarantee subsidy approval.
3. 50% booking advance required to confirm the order.
4. Net metering application and approvals are subject to local DISCOM rules.
5. Warranty as per manufacturer terms on registered serial-numbered equipment.','accepted', now()-interval '74 days', now()-interval '74 days'),
('qt-qt-2026-0003','QT-2026-0003','cust-03','survey-03','pkg-5kw-ong','SunMax 5 kW On-Grid',5.00,'on_grid',550,9,'5 kW On-grid string inverter, MPPT, Wi-Fi monitoring','—',278000,30000,12,'[]'::jsonb,8000,78000,308000,36000,258000,current_date+25,'1. Package prices in this catalogue are demonstration prices and are fully editable by administrators.
2. Subsidy is only an estimate; eligibility and approval are decided exclusively by the government scheme. SunPower Solutions does not guarantee subsidy approval.
3. 50% booking advance required to confirm the order.
4. Net metering application and approvals are subject to local DISCOM rules.
5. Warranty as per manufacturer terms on registered serial-numbered equipment.','accepted', now()-interval '7 days', now()-interval '7 days'),
('qt-qt-2026-0004','QT-2026-0004','cust-07','survey-04','pkg-5kw-ong','SunMax 5 kW On-Grid',5.00,'on_grid',550,9,'5 kW On-grid string inverter, MPPT, Wi-Fi monitoring','—',278000,30000,12,'[{"description":"Industrial-grade AC DB upgrade","amount":7500}]'::jsonb,10000,0,315500,36660,342160,current_date+20,'1. Package prices in this catalogue are demonstration prices and are fully editable by administrators.
2. Subsidy is only an estimate; eligibility and approval are decided exclusively by the government scheme. SunPower Solutions does not guarantee subsidy approval.
3. 50% booking advance required to confirm the order.
4. Net metering application and approvals are subject to local DISCOM rules.
5. Warranty as per manufacturer terms on registered serial-numbered equipment.','accepted', now()-interval '14 days', now()-interval '14 days'),
('qt-qt-2026-0005','QT-2026-0005','cust-08',null,'pkg-2kw-ong','SunHome 2 kW On-Grid',2.00,'on_grid',550,4,'2 kW On-grid string inverter, MPPT, Wi-Fi monitoring','—',118000,18000,12,'[]'::jsonb,0,36000,136000,16320,116320,current_date+18,'1. Package prices in this catalogue are demonstration prices and are fully editable by administrators.
2. Subsidy is only an estimate; eligibility and approval are decided exclusively by the government scheme. SunPower Solutions does not guarantee subsidy approval.
3. 50% booking advance required to confirm the order.
4. Net metering application and approvals are subject to local DISCOM rules.
5. Warranty as per manufacturer terms on registered serial-numbered equipment.','sent', now()-interval '3 days', now()-interval '3 days'),
('qt-qt-2026-0006','QT-2026-0006','cust-05',null,'pkg-5kw-ong','SunMax 5 kW On-Grid',5.00,'on_grid',550,9,'5 kW On-grid string inverter, MPPT, Wi-Fi monitoring','—',278000,30000,12,'[{"description":"HT panel modification support","amount":15000}]'::jsonb,12000,0,323000,37320,348320,current_date+15,'1. Package prices in this catalogue are demonstration prices and are fully editable by administrators.
2. Subsidy is only an estimate; eligibility and approval are decided exclusively by the government scheme. SunPower Solutions does not guarantee subsidy approval.
3. 50% booking advance required to confirm the order.
4. Net metering application and approvals are subject to local DISCOM rules.
5. Warranty as per manufacturer terms on registered serial-numbered equipment.','sent', now()-interval '2 days', now()-interval '2 days'),
('qt-qt-2026-0007','QT-2026-0007','cust-12',null,'pkg-2kw-ong','SunHome 2 kW On-Grid',2.00,'on_grid',550,4,'2 kW On-grid string inverter, MPPT, Wi-Fi monitoring','—',118000,18000,12,'[]'::jsonb,0,36000,136000,16320,116320,current_date-20,'1. Package prices in this catalogue are demonstration prices and are fully editable by administrators.
2. Subsidy is only an estimate; eligibility and approval are decided exclusively by the government scheme. SunPower Solutions does not guarantee subsidy approval.
3. 50% booking advance required to confirm the order.
4. Net metering application and approvals are subject to local DISCOM rules.
5. Warranty as per manufacturer terms on registered serial-numbered equipment.','rejected', now()-interval '30 days', now()-interval '30 days'),
('qt-qt-2026-0008','QT-2026-0008','cust-10','survey-06','pkg-5kw-ong','SunMax 5 kW On-Grid',5.00,'on_grid',550,9,'5 kW On-grid string inverter, MPPT, Wi-Fi monitoring','—',278000,30000,12,'[]'::jsonb,0,0,308000,36960,344960,current_date+15,'1. Package prices in this catalogue are demonstration prices and are fully editable by administrators.
2. Subsidy is only an estimate; eligibility and approval are decided exclusively by the government scheme. SunPower Solutions does not guarantee subsidy approval.
3. 50% booking advance required to confirm the order.
4. Net metering application and approvals are subject to local DISCOM rules.
5. Warranty as per manufacturer terms on registered serial-numbered equipment.','draft', now(), now());

-- ---------- Inventory items (10) ----------
insert into public.inventory_items (id, sku, name, category, manufacturer, model, unit, purchase_cost, selling_price, available_qty, reserved_qty, reorder_level, supplier, warranty_months, is_active) values
('inv-p500','SP-PNL-500','Solar Panel 500W Mono PERC','solar_panel','Waaree','WS-500','units',9800,11000,14,10,5,'Waaree Solar (North)',300,true),
('inv-inv5','SP-INV-5KW','On-Grid Inverter 5 kW','inverter','Delta','D5-STR','units',42000,48000,1,1,1,'Delta Electronics (IN)',60,true),
('inv-inv3','SP-INV-3KW','On-Grid Inverter 3 kW','inverter','Delta','D3-STR','units',31000,35000,1,0,2,'Delta Electronics (IN)',60,true),
('inv-bat','SP-BAT-2.5','LiFePO4 Battery 2.5 kWh','battery','Exgard','EX-2500','units',38000,44000,4,0,2,'Exgard Energy',60,true),
('inv-mnt','SP-MNT-RCC','Mounting Structure Set (RCC)','mounting','SunMount','SM-RCC-STD','sets',6500,7500,9,0,3,'SunMount Fabricators',60,true),
('inv-cable','SP-CAB-DC4','DC Solar Cable 4 sqmm (100m roll)','cable','Polycab','PC-DC4','rolls',3200,3600,7,0,2,'Polycab Dealer',12,true),
('inv-mc4','SP-CON-MC4','MC4 Connector Pair','connector','Staubli','MC4-EVO2','pairs',180,240,60,0,20,'Staubli (IN)',12,true),
('inv-spd','SP-PRT-SPD','DC Surge Protection Device','protection','Schneider','iPRD40','units',2400,2900,5,0,2,'Schneider Electric',24,true),
('inv-earth','SP-OTH-EARTH','Earthing Kit (copper rod + chemical)','protection','Gmax','GM-EK1','kits',2800,3400,8,0,2,'Gmax Electro',60,true),
('inv-dongle','SP-OTH-DONGLE','Wi-Fi Monitoring Dongle','other','Delta','WD-01','units',2200,2600,2,0,2,'Delta Electronics (IN)',24,true);

-- ---------- Crews (3) ----------
insert into public.installation_crews (id, name, leader, members, phone, skills, availability) values
('crew-1','Alpha Crew — Hyderabad West','Prakash Naik','["Prakash Naik","Srinivas T","Manoj Y"]'::jsonb,'+91 98010 10001','["RCC roofs","On-grid","Elevated structures"]'::jsonb,'available'),
('crew-2','Beta Crew — Commercial','Iqbal Ahmed','["Iqbal Ahmed","Ravi K","Sanjay M","Teja P"]'::jsonb,'+91 98010 20002','["Commercial","HT panels","Metal sheet roofs"]'::jsonb,'busy'),
('crew-3','Gamma Crew — Off-grid & Battery','Kumar Swamy','["Kumar Swamy","Devineni R"]'::jsonb,'+91 98010 30003','["Off-grid","Battery systems"]'::jsonb,'available');

-- ---------- Projects (4) ----------
insert into public.installation_projects (id, number, customer_id, quotation_id, package_name, capacity_kw, installation_type, address, manager, crew_id, scheduled_start, scheduled_end, actual_completion, status, planned_cost, actual_cost, contract_value, notes, equipment_status, accepted_at, created_at) values
('prj-0001','PRJ-2026-0001','cust-01','qt-qt-2026-0001','SunHome Plus 3 kW On-Grid',3.00,'RCC Rooftop (Elevated)','Road No. 12, Banjara Hills, Hyderabad','Installation Manager — Sunil Khanna','crew-1',current_date-30,current_date-29,current_date-24,'completed',174000,120700,179960,'Completed on time.','dispatched', now()-interval '26 days', now()-interval '38 days'),
('prj-0002','PRJ-2026-0002','cust-02','qt-qt-2026-0002','SunHome 2 kW On-Grid',2.00,'Sheet Roof (Elevated)','Phase 9, Kukatpally, Hyderabad','Installation Manager — Sunil Khanna','crew-1',current_date-70,current_date-69,current_date-62,'completed',121500,100500,120800,'Elevated structure took extra day.','dispatched', now()-interval '66 days', now()-interval '74 days'),
('prj-0003','PRJ-2026-0003','cust-07','qt-qt-2026-0004','SunMax 5 kW On-Grid',5.00,'Clinic RCC Rooftop','Road No. 36, Jubilee Hills, Hyderabad','Installation Manager — Sunil Khanna','crew-2',current_date-1,current_date+1,null,'quality_inspection',306500,44300,342160,'Inspection pending; AC DB upgrade done.','dispatched', now()-interval '12 days', now()-interval '14 days'),
('prj-0004','PRJ-2026-0004','cust-03','qt-qt-2026-0003','SunMax 5 kW On-Grid',5.00,'RCC Rooftop (Elevated)','Survey 120, Gachibowli, Hyderabad','Installation Manager — Sunil Khanna',null,null,null,null,'awaiting_stock',300000,0,258000,'','pending', now()-interval '5 days', now()-interval '7 days');

-- ---------- Equipment units (25, globally unique serials) ----------
insert into public.equipment_units (id, item_id, item_name, serial_number, purchase_ref, status, project_id, dispatched_at, installed_at, notes, created_at) values
-- PRJ-0001: 6 panels + 1 inverter (installed)
('eq-sp-pnl-500-2450','inv-p500','Solar Panel 500W Mono PERC','SP-PNL-500-2450','PO-2026-04','installed','prj-0001',current_date-31,current_date-29,'',now()-interval '120 days'),
('eq-sp-pnl-500-2451','inv-p500','Solar Panel 500W Mono PERC','SP-PNL-500-2451','PO-2026-05','installed','prj-0001',current_date-31,current_date-29,'',now()-interval '120 days'),
('eq-sp-pnl-500-2452','inv-p500','Solar Panel 500W Mono PERC','SP-PNL-500-2452','PO-2026-06','installed','prj-0001',current_date-31,current_date-29,'',now()-interval '120 days'),
('eq-sp-pnl-500-2453','inv-p500','Solar Panel 500W Mono PERC','SP-PNL-500-2453','PO-2026-07','installed','prj-0001',current_date-31,current_date-29,'',now()-interval '120 days'),
('eq-sp-pnl-500-2454','inv-p500','Solar Panel 500W Mono PERC','SP-PNL-500-2454','PO-2026-08','installed','prj-0001',current_date-31,current_date-29,'',now()-interval '120 days'),
('eq-sp-pnl-500-2455','inv-p500','Solar Panel 500W Mono PERC','SP-PNL-500-2455','PO-2026-01','installed','prj-0001',current_date-31,current_date-29,'',now()-interval '120 days'),
('eq-sp-inv-3kw-2456','inv-inv3','On-Grid Inverter 3 kW','SP-INV-3KW-2456','PO-2026-02','installed','prj-0001',current_date-31,current_date-29,'',now()-interval '120 days'),
-- PRJ-0002: 4 panels + 1 inverter (installed)
('eq-sp-pnl-500-2457','inv-p500','Solar Panel 500W Mono PERC','SP-PNL-500-2457','PO-2026-03','installed','prj-0002',current_date-71,current_date-69,'',now()-interval '120 days'),
('eq-sp-pnl-500-2458','inv-p500','Solar Panel 500W Mono PERC','SP-PNL-500-2458','PO-2026-04','installed','prj-0002',current_date-71,current_date-69,'',now()-interval '120 days'),
('eq-sp-pnl-500-2459','inv-p500','Solar Panel 500W Mono PERC','SP-PNL-500-2459','PO-2026-05','installed','prj-0002',current_date-71,current_date-69,'',now()-interval '120 days'),
('eq-sp-pnl-500-2460','inv-p500','Solar Panel 500W Mono PERC','SP-PNL-500-2460','PO-2026-06','installed','prj-0002',current_date-71,current_date-69,'',now()-interval '120 days'),
('eq-sp-inv-5kw-2461','inv-inv5','On-Grid Inverter 5 kW','SP-INV-5KW-2461','PO-2026-07','installed','prj-0002',current_date-71,current_date-69,'',now()-interval '120 days'),
-- PRJ-0003: 10 panels + 1 inverter (dispatched, awaiting install)
('eq-sp-pnl-500-2462','inv-p500','Solar Panel 500W Mono PERC','SP-PNL-500-2462','PO-2026-08','dispatched','prj-0003',current_date-2,null,'',now()-interval '120 days'),
('eq-sp-pnl-500-2463','inv-p500','Solar Panel 500W Mono PERC','SP-PNL-500-2463','PO-2026-01','dispatched','prj-0003',current_date-2,null,'',now()-interval '120 days'),
('eq-sp-pnl-500-2464','inv-p500','Solar Panel 500W Mono PERC','SP-PNL-500-2464','PO-2026-02','dispatched','prj-0003',current_date-2,null,'',now()-interval '120 days'),
('eq-sp-pnl-500-2465','inv-p500','Solar Panel 500W Mono PERC','SP-PNL-500-2465','PO-2026-03','dispatched','prj-0003',current_date-2,null,'',now()-interval '120 days'),
('eq-sp-pnl-500-2466','inv-p500','Solar Panel 500W Mono PERC','SP-PNL-500-2466','PO-2026-04','dispatched','prj-0003',current_date-2,null,'',now()-interval '120 days'),
('eq-sp-pnl-500-2467','inv-p500','Solar Panel 500W Mono PERC','SP-PNL-500-2467','PO-2026-05','dispatched','prj-0003',current_date-2,null,'',now()-interval '120 days'),
('eq-sp-pnl-500-2468','inv-p500','Solar Panel 500W Mono PERC','SP-PNL-500-2468','PO-2026-06','dispatched','prj-0003',current_date-2,null,'',now()-interval '120 days'),
('eq-sp-pnl-500-2469','inv-p500','Solar Panel 500W Mono PERC','SP-PNL-500-2469','PO-2026-07','dispatched','prj-0003',current_date-2,null,'',now()-interval '120 days'),
('eq-sp-pnl-500-2470','inv-p500','Solar Panel 500W Mono PERC','SP-PNL-500-2470','PO-2026-08','dispatched','prj-0003',current_date-2,null,'',now()-interval '120 days'),
('eq-sp-pnl-500-2471','inv-p500','Solar Panel 500W Mono PERC','SP-PNL-500-2471','PO-2026-01','dispatched','prj-0003',current_date-2,null,'',now()-interval '120 days'),
('eq-sp-inv-5kw-2472','inv-inv5','On-Grid Inverter 5 kW','SP-INV-5KW-2472','PO-2026-02','dispatched','prj-0003',current_date-2,null,'',now()-interval '120 days'),
-- Stock
('eq-sp-pnl-500-2473','inv-p500','Solar Panel 500W Mono PERC','SP-PNL-500-2473','PO-2026-03','in_stock',null,null,null,'',now()-interval '120 days'),
('eq-sp-pnl-500-2474','inv-p500','Solar Panel 500W Mono PERC','SP-PNL-500-2474','PO-2026-04','in_stock',null,null,null,'',now()-interval '120 days'),
('eq-sp-pnl-500-2475','inv-p500','Solar Panel 500W Mono PERC','SP-PNL-500-2475','PO-2026-05','in_stock',null,null,null,'',now()-interval '120 days'),
('eq-sp-pnl-500-2476','inv-p500','Solar Panel 500W Mono PERC','SP-PNL-500-2476','PO-2026-06','in_stock',null,null,null,'',now()-interval '120 days'),
('eq-sp-pnl-500-2477','inv-p500','Solar Panel 500W Mono PERC','SP-PNL-500-2477','PO-2026-07','in_stock',null,null,null,'',now()-interval '120 days'),
('eq-sp-inv-3kw-2478','inv-inv3','On-Grid Inverter 3 kW','SP-INV-3KW-2478','PO-2026-08','in_stock',null,null,null,'',now()-interval '120 days'),
('eq-sp-inv-3kw-2479','inv-inv3','On-Grid Inverter 3 kW','SP-INV-3KW-2479','PO-2026-01','defective',null,null,null,'Failed self-test at QC bench; supplier RMA raised.',now()-interval '120 days'),
('eq-sp-bat-2.5-2480','inv-bat','LiFePO4 Battery 2.5 kWh','SP-BAT-2.5-2480','PO-2026-02','in_stock',null,null,null,'',now()-interval '120 days');

-- ---------- Inventory transactions (4) ----------
insert into public.inventory_transactions (item_id, item_name, type, qty, reference, note, by, created_at) values
('inv-p500','Solar Panel 500W Mono PERC','receipt',25,'PO-2026-04','Panel batch received','Inventory Manager', now()-interval '90 days'),
('inv-inv3','On-Grid Inverter 3 kW','receipt',2,'PO-2026-05','3 kW inverter batch','Inventory Manager', now()-interval '85 days'),
('inv-p500','Solar Panel 500W Mono PERC','dispatch',10,'PRJ-2026-0001 / 0002 / 0003','Dispatched to projects','Inventory Manager', now()-interval '1 day'),
('inv-inv5','On-Grid Inverter 5 kW','dispatch',1,'PRJ-2026-0003','5 kW inverter','Inventory Manager', now()-interval '1 day');

-- ---------- Checklists (10 items × 4 projects; PRJ-0003 has 8/10 done) ----------
insert into public.checklist_items (project_id, sequence, description, completed, completed_by, completed_at, notes)
select p.pid, c.ord, c.descr,
       c.ord <= p.done,
       case when c.ord <= p.done then 'Prakash Naik (Leader)' else '' end,
       case when c.ord <= p.done then (current_date-25+c.ord) else null end,
       ''
from (values ('prj-0001',10),('prj-0002',10),('prj-0003',8),('prj-0004',0)) as p(pid,done),
     unnest(array[
       'Site preparation completed','Mounting structure installed','Solar panels installed',
       'Inverter installed','Electrical connections inspected','Earthing checked',
       'Safety inspection completed','System startup completed','Customer demonstration completed',
       'Final quality inspection completed'
     ]) with ordinality as c(descr,ord);

-- ---------- Photos & acceptance ----------
insert into public.installation_photos (project_id, caption, storage_path, uploaded_by, uploaded_at) values
('prj-0001','Completed 3 kW array front view','demo/3 kW Array — front.svg','Prakash Naik', now()-interval '28 days'),
('prj-0001','Inverter + AC DB wiring','demo/Inverter wiring.svg','Prakash Naik', now()-interval '28 days'),
('prj-0002','Elevated structure on sheet roof','demo/Elevated structure.svg','Prakash Naik', now()-interval '64 days');

insert into public.customer_acceptances (project_id, customer_name, accepted_at, signature_storage_path) values
('prj-0001','Ramesh Gupta', now()-interval '26 days', null),
('prj-0002','Sunita Reddy', now()-interval '62 days', null);

-- ---------- Warranties (4) ----------
insert into public.warranties (code, customer_id, project_id, equipment_unit_id, product_name, serial_number, warranty_type, start_date, end_date, duration_months, terms, status, created_at) values
('WRT-2026-0001','cust-01','prj-0001','eq-sp-pnl-500-2450','Solar Panel 500W Mono PERC (6 units)','SP-PNL-500-2450 … +5 more','Product — Panels', current_date-29, (current_date-29 + interval '300 months')::date, 300,'Manufacturer product warranty per registered serial. Certificate generated by SolarOps AI application; not a manufacturer registration.','active', now()-interval '29 days'),
('WRT-2026-0002','cust-01','prj-0001','eq-sp-inv-3kw-2456','On-Grid Inverter 3 kW','SP-INV-3KW-2456','Product — Inverter', current_date-29, (current_date-29 + interval '60 months')::date, 60,'Manufacturer product warranty per registered serial. Application-generated certificate.','active', now()-interval '29 days'),
('WRT-2026-0003','cust-02','prj-0002','eq-sp-pnl-500-2457','Solar Panel 500W Mono PERC (4 units)','SP-PNL-500-2457 … +3 more','Product — Panels', current_date-69, (current_date-69 + interval '300 months')::date, 300,'Manufacturer product warranty per registered serials. Application-generated certificate.','active', now()-interval '69 days'),
('WRT-2026-0004','cust-02','prj-0002',null,'Workmanship Warranty — Installation','—','Workmanship', current_date-75, (current_date-75 + interval '3 months')::date, 3,'Installation workmanship covered by SunPower Solutions (demo). Certificate expires within 2 weeks for demo.','active', now()-interval '75 days');

-- ---------- Payments (6) ----------
insert into public.payments (id, number, customer_id, project_id, quotation_id, amount, payment_date, method, txn_ref, stage, status, notes, created_at) values
('pay-1','PAY-2026-0001','cust-01','prj-0001','qt-qt-2026-0001',78750,current_date-37,'Bank Transfer (NEFT/RTGS)','NEFT883120','booking_advance','paid','50% booking advance', now()-interval '37 days'),
('pay-2','PAY-2026-0002','cust-01','prj-0001','qt-qt-2026-0001',78750,current_date-22,'UPI','UPI4492013','final','paid','On completion', now()-interval '22 days'),
('pay-3','PAY-2026-0003','cust-02','prj-0002','qt-qt-2026-0002',76275,current_date-72,'Bank Transfer (NEFT/RTGS)','NEFT223311','booking_advance','paid','50% advance', now()-interval '72 days'),
('pay-4','PAY-2026-0004','cust-07','prj-0003','qt-qt-2026-0004',127550,current_date-12,'UPI','UPI778912','booking_advance','paid','Advance on acceptance', now()-interval '12 days'),
('pay-5','PAY-2026-0005','cust-07','prj-0003','qt-qt-2026-0004',127550,null,'UPI','','installation_milestone','pending','Due post workmanship inspection', now()-interval '12 days'),
('pay-6','PAY-2026-0006','cust-03','prj-0004','qt-qt-2026-0003',120500,null,'Bank Transfer (NEFT/RTGS)','','booking_advance','pending','Advance requested', now()-interval '5 days');

-- ---------- Expenses (9) ----------
insert into public.project_expenses (project_id, category, amount, expense_date, vendor, notes, created_at) values
('prj-0001','Installation Labor',18000,current_date-29,'Alpha Crew — contract','3-day job', now()-interval '29 days'),
('prj-0001','Transportation',4200,current_date-31,'Sai Transport','', now()-interval '31 days'),
('prj-0001','Electrical Works',6500,current_date-28,'Ravi Electrician','AC DB + earthing', now()-interval '28 days'),
('prj-0001','Equipment Purchase',92000,current_date-33,'Internal stock transfer (cost basis)','6 panels + 1 inverter at cost', now()-interval '33 days'),
('prj-0002','Installation Labor',15500,current_date-69,'Alpha Crew — contract','', now()-interval '69 days'),
('prj-0002','Structural Works',9000,current_date-70,'SunMount Fabricators','Elevated structure build', now()-interval '70 days'),
('prj-0003','Installation Labor',26000,current_date-1,'Beta Crew — contract','Commercial install', now()-interval '1 day'),
('prj-0003','Transportation',6800,current_date-2,'Sai Transport','Crane support', now()-interval '2 days'),
('prj-0003','Electrical Works',11500,current_date,'Ravi Electrician','AC DB upgrade', now());

-- ---------- Subsidies (3) ----------
insert into public.subsidy_applications (customer_id, project_id, program_name, estimated_amount, requested_amount, application_ref, application_date, status, approval_date, approved_amount, received_amount, notes, created_at) values
('cust-01','prj-0001','PM Surya Ghar: Muft Bijli Yojana (assumption — verify current rules)',39000,39000,'PSG-2026-118842',current_date-25,'approved',current_date-8,39000,0,'Estimates are editable assumptions — approval decided by the scheme.', now()-interval '26 days'),
('cust-02','prj-0002','PM Surya Ghar: Muft Bijli Yojana (assumption — verify current rules)',36000,36000,'PSG-2026-100211',current_date-60,'approved',current_date-20,36000,36000,'Received via DISCOM node (demo).', now()-interval '61 days'),
('cust-03','prj-0004','PM Surya Ghar: Muft Bijli Yojana (assumption — verify current rules)',78000,0,'',null,'submitted',null,0,0,'Documents uploaded on national portal (demo).', now()-interval '4 days');

-- ---------- Service tickets (5) ----------
insert into public.service_tickets (id, number, customer_id, project_id, equipment_unit_id, serial_number, issue_category, description, priority, status, assigned_technician, assignment_status, appointment_time, resolution_notes, estimated_cost, actual_cost, resolution_date, created_by, created_at, updated_at) values
('tkt-1','SRV-2026-0001','cust-01','prj-0001','eq-sp-inv-3kw-2456','SP-INV-3KW-2456','Inverter Fault','Inverter shows Error E03 in late afternoon; production drops to zero.','high','in_progress','Mahesh K. (Demo Technician)',null,null,'',0,0,null,'Service Technician', now()-interval '3 days', now()),
('tkt-2','SRV-2026-0002','cust-02','prj-0002',null,'','Cleaning Request','Dust accumulation after construction nearby.','low','resolved','Mahesh K. (Demo Technician)',null,null,'Cleaned all panels; output recovered to normal.',800,800,current_date-10,'Service Technician', now()-interval '16 days', now()-interval '10 days'),
('tkt-3','SRV-2026-0003','cust-01','prj-0001',null,'','Monitoring/App','Mobile app disconnected since Monday; website shows plant offline.','medium','open','','',null,'',0,0,null,'Customer Portal (demo)', now()-interval '1 day', now()),
('tkt-4','SRV-2026-0004','cust-07','prj-0003',null,'','Wiring/Electrical','AC DB upgrade part pending installation by vendor.','medium','waiting_parts','Iqbal Ahmed',null,null,'',3500,0,null,'Installation Manager', now()-interval '4 days', now()-interval '2 days'),
('tkt-5','SRV-2026-0005','cust-02','prj-0002','eq-sp-inv-5kw-2461','SP-INV-5KW-2461','Performance Issue','Morning generation looks lower than neighbours'' same-size systems.','medium','assigned','Ramesh Yadav (Demo Technician)','awaiting_confirmation',(current_date+2)::text||' 10:30','',0,0,null,'Customer Portal (demo)', now()-interval '1 day', now());

insert into public.service_ticket_notes (ticket_id, note, author, created_at) values
('tkt-1','Technician visited; suspects AC-side derating. Monitoring dongle logs pulled.','Mahesh K.', now()-interval '2 days'),
('tkt-2','Cleaning completed.','Mahesh K.', now()-interval '10 days');

-- ---------- Activity log ----------
insert into public.activity_logs (type, message, entity_type, entity_id, customer_id, project_id, created_at) values
('customer_created','Customer created — Ramesh Gupta','customer','cust-01','cust-01',null, now()-interval '45 days'),
('survey_completed','Site survey completed for Ramesh Gupta','survey','survey-01','cust-01',null, now()-interval '40 days'),
('quotation_generated','Quotation QT-2026-0001 generated','quotation','qt-qt-2026-0001','cust-01','prj-0001', now()-interval '38 days'),
('quotation_accepted','Quotation QT-2026-0001 accepted by customer','quotation','qt-qt-2026-0001','cust-01','prj-0001', now()-interval '36 days'),
('project_created','Installation project PRJ-2026-0001 created','project','prj-0001','cust-01','prj-0001', now()-interval '36 days'),
('equipment_reserved','Equipment reserved & dispatched for PRJ-2026-0001','project','prj-0001','cust-01','prj-0001', now()-interval '31 days'),
('installation_accepted','Customer acceptance recorded — PRJ-2026-0001','project','prj-0001','cust-01','prj-0001', now()-interval '26 days'),
('installation_completed','Installation completed — PRJ-2026-0001','project','prj-0001','cust-01','prj-0001', now()-interval '24 days'),
('warranty_activated','2 warranties activated for PRJ-2026-0001','warranty',null,'cust-01','prj-0001', now()-interval '24 days'),
('payment_recorded','Final payment collected for PRJ-2026-0001','payment','pay-2','cust-01','prj-0001', now()-interval '22 days'),
('service_ticket_opened','Service ticket SRV-2026-0001 opened (Inverter Fault)','ticket','tkt-1','cust-01','prj-0001', now()-interval '3 days'),
('service_ticket_opened','Service ticket SRV-2026-0003 opened via customer portal','ticket','tkt-3','cust-01','prj-0001', now()-interval '1 day');

-- ---------- Technicians (6, fictional demo profiles) ----------
insert into public.technicians (id, name, photo_color, phone, specializations, experience_years, location_name, lat, lng, service_areas, max_radius_km, working_hours, availability, rating, completed_jobs, is_active) values
('tech-1','Mahesh K.','#15803d','+91 98990 00001','["Inverter Specialist","Grid-Tie Expert"]'::jsonb,7,'Banjara Hills, Hyderabad',17.4126,78.4392,'["Banjara Hills","Jubilee Hills","Khairatabad"]'::jsonb,15,'Mon–Sat 9:00–18:00','available',4.80,212,true),
('tech-2','Ramesh Yadav','#0e7490','+91 98990 00002','["Performance Analysis","Cleaning & Maintenance"]'::jsonb,4,'Kukatpally, Hyderabad',17.4849,78.4137,'["Kukatpally","KPHB","Miyapur"]'::jsonb,12,'Mon–Sun 8:00–17:00','busy',4.50,143,true),
('tech-3','Farzana S.','#a21caf','+91 98990 00003','["Electrical Works","Battery Systems"]'::jsonb,5,'Gachibowli, Hyderabad',17.4401,78.3450,'["Gachibowli","Madhapur","Hitec City"]'::jsonb,18,'Mon–Sat 9:30–18:30','available',4.90,187,true),
('tech-4','Naveen Chandra','#b45309','+91 98990 00004','["Structural/Roofing","Elevated Structures"]'::jsonb,8,'Malakpet, Hyderabad',17.3711,78.5106,'["Uppal","LB Nagar","Amberpet"]'::jsonb,10,'Mon–Fri 8:30–18:00','available',4.60,255,true),
('tech-5','Sohail Ahmed','#1d4ed8','+91 98990 00005','["Off-grid","Monitoring/App"]'::jsonb,3,'Uppal, Hyderabad',17.4600,78.5200,'["Uppal","Nacharam","Sainikpuri"]'::jsonb,14,'Sat–Thu 9:00–18:00','off_duty',4.20,68,true),
('tech-6','Devi Prasad','#166534','+91 98990 00006','["Inverter Specialist","Electrical Works"]'::jsonb,6,'LB Nagar, Hyderabad',17.3457,78.5522,'["LB Nagar","Vanasthalipuram","Hayathnagar"]'::jsonb,16,'Mon–Sat 9:00–19:00','on_leave',4.70,176,false);

-- ---------- Settings (singleton) ----------
insert into public.app_settings (id, org_name, demo_location_name, demo_lat, demo_lng, savings_assumptions) values
(1,'SunPower Solutions','Hyderabad, Telangana',17.385,78.4867,
 '{"grid_rate_per_unit":8,"daily_sun_hours":4.5,"performance_ratio":0.8,"export_tariff_per_unit":3,"annual_degradation_percent":0.5}'::jsonb)
on conflict (id) do update set
  org_name = excluded.org_name,
  demo_location_name = excluded.demo_location_name,
  demo_lat = excluded.demo_lat,
  demo_lng = excluded.demo_lng,
  savings_assumptions = excluded.savings_assumptions;

commit;

# 🎤 SolarOps AI — Demo Kit (for the hackathon presentation)

> Golden rule before you start: **Settings → Reset demo data** restores the pristine seed dataset. Do it right before presenting.

---

## A. The 6-minute golden demo path (Admin → Customer)

### Minute 0 — Hook
- Sign in as **Admin (demo)** → **Dashboard**
- Script: *"Every number on this screen is computed live from the database — nothing is hardcoded. Revenue ₹3.61 L collected, ₹5.40 L outstanding, ₹4.92 L stock value — all formulas from one unit-tested finance engine."*

### Minute 1 — Sell something
- **Quotations** → click **QT-2026-0005** (sent, SunHome 2 kW)
- Open the breakdown: equipment ₹118,000 + installation + −discount −₹36,000 subsidy + 12% GST
- Press 🖨️ **Print** → show the quotation certificate
- Back to list → click ✅ **Accept** → badge flips to Accepted

### Minute 2 — One sale = one project (enforced)
- On QT-2026-0005 → click **Convert → Project**
- Toast confirms PRJ number created; the quotation now shows its linked project
- Script: *"The partial unique index in Postgres makes it impossible to create a second project from the same quotation."*

### Minute 3 — Grace the warehouse in
- **Inventory** → Stock tab: point at panel row (14 available / 10 reserved, reorder in red)
- Serials tab: *"every inverter and panel has its own serial number"*
- Try to **Register serial number** with `SP-PNL-500-2450` → **rejected by duplicate protection** 🔒
- Transactions tab: *"every movement is an audit line — nothing disappears silently"*

### Minute 4 — Run the installation
- **Installations** → PRJ-0003 (quality_inspection) → checklist 8/10 done
- Tick remaining 2 items → try **Complete** without acceptance → politely refused 😊
- Record customer acceptance (project PRJ-0003's customer is Anil Verma) → Complete works
- Wait — for the demo flow, warranties activate; show **Warranties** page (active/expiry-soon computed)

### Minute 5 — Money with fraud protection
- **Payments** → **Record payment**
- Create: project PRJ-0004, ₹50,000, txn_ref `DEMO-777`, paid → success toast
- Repeat the SAME form → 🔴 **blocked: duplicate reference** — *"same txn-ref + project + amount can never be recorded twice, DB-enforced."*

### Minute 6 — Switch worlds
- **Logout** → sign in as **Ramesh Gupta (demo)** → Customer Portal
- Journey tracker built from real records; prints warranty cert
- **Find a Technician** → map (OpenStreetMap, zero API keys), distances computed
- Raise a request → sign back as staff → **Service Center** → request is `awaiting confirmation` → confirm it ✅
- Close: *"One serial number connects purchase order → roof → warranty → service ticket. That's traceability in one system."*

---

## B. Talking points (memorize the punchlines)

1. **AI boundary** — "AI only drafts text. Not one rupee in this app is produced by a language model; every financial figure comes from unit-tested TypeScript."
2. **Honest gaps** — "QR scanning, payment gateway, email — listed in Settings as optional integrations. Nothing pretends to be live when it isn't."
3. **Demo-first** — "Zero credentials needed; the whole demo runs offline with a seeded dataset and one-click reset."
4. **Production-adjacent** — "The Supabase package ships the same rules as DB-level unique indexes + row-level security, so demo logic and schema stay in lockstep."
5. **Customer portal** — "The tracker shows nothing as done until it actually happened — customers can't be fooled."

## C. Pre-demo checklist

- [ ] `Settings` → **Reset demo data** (restores pristine seed)
- [ ] Hard-refresh browser (Ctrl+Shift+R) once
- [ ] Open tabs in order: Dashboard, Quotations, Inventory, Payments, Portal
- [ ] Browser zoom ~90% so tables fit
- [ ] Have `admin@demo.solarops` + `customer@demo.solarops` ready (password anything)
- [ ] Print view test once: open a quotation → Ctrl+P shows the certificate

## D. If something breaks live

- Blank screen? → Ctrl+Shift+R, then Settings → Reset
- Wrong numbers? → numbers are always computed; if data feels off, reset the seed
- Emergency fallback: the app has **JSON export** in Settings → export the DB before the demo so you can restore state manually if needed.

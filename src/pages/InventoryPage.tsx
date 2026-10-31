import { useMemo, useState } from "react";
import { Search, Plus, PackagePlus, SlidersHorizontal, Boxes, QrCode, ArrowDownUp, Download } from "lucide-react";
import { Card, PageHeader, Button, Input, Select, Modal, Label, Table, Th, Td, Badge, FieldError, EmptyState, StatTile, Tabs, Textarea } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useDB, api } from "@/services";
import { INVENTORY_CATEGORY } from "@/lib/labels";
import { formatINR, formatDateTime, formatNum } from "@/lib/utils";
import { isLowStock, stockValue } from "@/lib/calculations/finance";
import { downloadCSV } from "@/lib/csv";

export default function InventoryPage() {
  const db = useDB();
  const toast = useToast();
  const [tab, setTab] = useState("stock");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [addModal, setAddModal] = useState(false);
  const [addSerialModal, setAddSerialModal] = useState(false);
  const [transacting, setTransacting] = useState<{ itemId: string; type: "receipt" | "adjustment" } | null>(null);

  const items = useMemo(() => db.inventory_items
    .filter((i) => (cat === "all" ? true : i.category === cat))
    .filter((i) => {
      const t = q.toLowerCase();
      return !t || i.name.toLowerCase().includes(t) || i.sku.toLowerCase().includes(t) || i.manufacturer.toLowerCase().includes(t);
    }), [db.inventory_items, q, cat]);

  const value = stockValue(db.inventory_items);
  const lowCount = db.inventory_items.filter(isLowStock).length;

  const serials = useMemo(() => db.equipment_units
    .filter((u) => {
      const t = q.toLowerCase();
      const item = db.inventory_items.find((x) => x.id === u.item_id);
      return !t || u.serial_number.toLowerCase().includes(t) || u.item_name.toLowerCase().includes(t) || (item?.sku.toLowerCase().includes(t) ?? false);
    }), [db.equipment_units, db.inventory_items, q]);

  return (
    <div className="space-y-5">
      <PageHeader title="Inventory" subtitle={`${formatINR(value)} stock value · ${lowCount} item(s) at or below reorder level`}>
        <Button variant="outline" onClick={() => setAddSerialModal(true)}><QrCode className="h-4 w-4" /> Register serial number</Button>
        <Button onClick={() => setAddModal(true)}><Plus className="h-4 w-4" /> Add item</Button>
      </PageHeader>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <StatTile label="Stock value (at cost)" value={formatINR(value)} icon={Boxes} />
        <StatTile label="SKUs" value={db.inventory_items.length} />
        <StatTile label="Serial units tracked" value={db.equipment_units.length} sub={`${db.equipment_units.filter((u) => u.status === "in_stock").length} in stock`} />
        <StatTile label="Low stock" value={lowCount} tone={lowCount ? "bad" : "good"} />
      </div>

      <Tabs tabs={[
        { key: "stock", label: "Stock", count: db.inventory_items.length },
        { key: "serials", label: "Serial numbers", count: db.equipment_units.length },
        { key: "transactions", label: "Movement history", count: db.inventory_transactions.length },
      ]} active={tab} onChange={setTab} />

      {tab === "stock" && (
        <>
          <div className="flex flex-wrap gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input className="pl-8" placeholder="Search name, SKU, manufacturer…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select className="w-48" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="all">All categories</option>
              {Object.entries(INVENTORY_CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Button variant="ghost" size="sm" onClick={() => downloadCSV("inventory-stock.csv", items, ["sku", "name", "category", "manufacturer", "available_qty", "reserved_qty", "reorder_level", "purchase_cost", "selling_price"])}>Export CSV</Button>
          </div>
          <Card>
            {items.length ? (
              <Table>
                <thead><tr><Th>Item</Th><Th>Category</Th><Th>Available</Th><Th>Reserved</Th><Th>Cost</Th><Th>Status</Th><Th className="text-right">Actions</Th></tr></thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id} className="hover:bg-slate-50/60">
                      <Td><p className="font-semibold text-slate-800">{i.name}</p><p className="font-mono text-[11px] text-slate-400">{i.sku} · {i.manufacturer} {i.model}</p></Td>
                      <Td><Badge label={INVENTORY_CATEGORY[i.category]} className="bg-slate-100 text-slate-600" /></Td>
                      <Td>
                        <p className={i.available_qty <= i.reorder_level ? "font-bold text-rose-600" : "font-semibold"}>{i.available_qty} {i.unit}</p>
                        <p className="text-[10.5px] text-slate-400">reorder @ {i.reorder_level}</p>
                      </Td>
                      <Td>{i.reserved_qty}</Td>
                      <Td><p>{formatINR(i.purchase_cost)}</p><p className="text-[10.5px] text-slate-400">{formatINR(stockValue([i]))} value</p></Td>
                      <Td>{isLowStock(i) ? <Badge status="low" label="Reorder" /> : <Badge status="in_stock" label="Healthy" />}</Td>
                      <Td>
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="secondary" onClick={() => setTransacting({ itemId: i.id, type: "receipt" })}><PackagePlus className="h-3.5 w-3.5" /> Receive</Button>
                          <Button size="sm" variant="ghost" onClick={() => setTransacting({ itemId: i.id, type: "adjustment" })}><SlidersHorizontal className="h-3.5 w-3.5" /> Adjust</Button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : <EmptyState icon={Boxes} title="No items match" subtitle="Adjust filters or add a new inventory item." action={<Button onClick={() => setAddModal(true)}><Plus className="h-4 w-4" /> Add item</Button>} />}
          </Card>
        </>
      )}

      {tab === "serials" && (
        <SerialTable serials={serials} onAdd={() => setAddSerialModal(true)} />
      )}

      {tab === "transactions" && (
        <Card>
          <div className="flex items-center justify-between px-4 pt-3">
            <p className="text-[12px] text-slate-500">All stock movements are recorded as transaction records</p>
            <Button variant="ghost" size="sm" onClick={() => downloadCSV("inventory-transactions.csv", db.inventory_transactions, ["item_name", "type", "qty", "reference", "note", "by", "created_at"])}>Export CSV</Button>
          </div>
          <Table>
            <thead><tr><Th>Date</Th><Th>Item</Th><Th>Type</Th><Th>Qty</Th><Th>Reference</Th><Th>Note</Th><Th>By</Th></tr></thead>
            <tbody>
              {db.inventory_transactions.slice(0, 40).map((t) => (
                <tr key={t.id}>
                  <Td className="whitespace-nowrap text-[12px]">{formatDateTime(t.created_at)}</Td>
                  <Td>{t.item_name}</Td>
                  <Td><Badge status={t.type} /></Td>
                  <Td className="font-semibold">{t.qty > 0 ? "+" : ""}{formatNum(t.qty)}</Td>
                  <Td className="text-[12px] text-slate-500">{t.reference}</Td>
                  <Td className="max-w-[220px] truncate text-[12px] text-slate-500">{t.note}</Td>
                  <Td className="text-[12px] text-slate-400">{t.by}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {db.inventory_transactions.length === 0 && <EmptyState icon={ArrowDownUp} title="No movements recorded yet" />}
        </Card>
      )}

      {addModal && <AddItemModal onClose={() => setAddModal(false)} />}
      {addSerialModal && <AddSerialModal onClose={() => setAddSerialModal(false)} />}
      {transacting && <TransactionModal itemId={transacting.itemId} type={transacting.type} onClose={() => setTransacting(null)} />}
    </div>
  );
}

function SerialTable({ serials, onAdd }: { serials: import("@/types").EquipmentUnit[]; onAdd: () => void }) {
  const db = useDB();
  const toast = useToast();
  const [info, setInfo] = useState<string | null>(null);
  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] text-slate-500">Unique serial numbers enforced. A unit marked <b>installed</b> cannot be assigned to another project.</p>
        <Button variant="ghost" size="sm" onClick={() => downloadCSV("equipment-serials.csv", serials, ["serial_number", "item_name", "status", "purchase_ref", "dispatched_at", "installed_at"])}>Export CSV</Button>
      </div>
      <Card>
        {serials.length ? (
          <Table>
            <thead><tr><Th>Serial number</Th><Th>Equipment</Th><Th>Status</Th><Th>Project</Th><Th>Dispatched</Th><Th>Installed</Th><Th className="text-right">Action</Th></tr></thead>
            <tbody>
              {serials.slice(0, 80).map((u) => {
                const proj = db.installation_projects.find((p) => p.id === u.project_id);
                return (
                  <tr key={u.id} className="hover:bg-slate-50/60">
                    <Td><span className="font-mono text-[12px] font-semibold">{u.serial_number}</span><p className="text-[10.5px] text-slate-400">{u.purchase_ref}</p></Td>
                    <Td>{u.item_name}</Td>
                    <Td><Badge status={u.status} /></Td>
                    <Td>{proj ? <a href={`/installations/${proj.id}`} className="text-brand-700 hover:underline">{proj.number}</a> : "—"}</Td>
                    <Td className="text-[12px] text-slate-500">{u.dispatched_at ? u.dispatched_at.slice(0, 10) : "—"}</Td>
                    <Td className="text-[12px] text-slate-500">{u.installed_at ? u.installed_at.slice(0, 10) : "—"}</Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        {["dispatched", "reserved", "in_stock"].includes(u.status) && proj && (
                          <Button size="sm" variant="secondary" onClick={() => { api.markUnitInstalled(u.id); toast.success("Marked installed", u.serial_number); }}>Mark installed</Button>
                        )}
                        {u.notes && <Button size="sm" variant="ghost" onClick={() => setInfo(`${u.serial_number}: ${u.notes}`)}>Info</Button>}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : <EmptyState icon={QrCode} title="No serial units" subtitle="Register panels, inverters and batteries individually." action={<Button onClick={onAdd}><Plus className="h-4 w-4" /> Register serial number</Button>} />}
      </Card>
      <Modal open={!!info} onClose={() => setInfo(null)} title="Unit notes" width="max-w-sm">
        <p className="text-[13px] text-slate-600">{info}</p>
      </Modal>
    </>
  );
}

function AddItemModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    sku: "", name: "", category: "solar_panel", manufacturer: "", model: "", unit: "units",
    purchase_cost: "", selling_price: "", available_qty: "0", reorder_level: "2", supplier: "", warranty_months: "60",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = () => {
    const errs: Record<string, string> = {};
    if (!form.sku.trim()) errs.sku = "SKU required";
    if (!form.name.trim()) errs.name = "Name required";
    if (!Number(form.purchase_cost)) errs.purchase_cost = "Cost required";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      api.createInventoryItem({
        sku: form.sku, name: form.name,
        category: form.category as never, manufacturer: form.manufacturer, model: form.model, unit: form.unit,
        purchase_cost: Number(form.purchase_cost), selling_price: Number(form.selling_price || 0),
        available_qty: Number(form.available_qty), reserved_qty: 0, reorder_level: Number(form.reorder_level),
        supplier: form.supplier, warranty_months: Number(form.warranty_months || 12), is_active: true,
      });
      toast.success("Inventory item added", form.name);
      onClose();
    } catch (e) { toast.error("Add failed", e instanceof Error ? e.message : String(e)); }
  };
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Modal open onClose={onClose} title="Add inventory item" width="max-w-xl">
      <div className="grid gap-3.5 sm:grid-cols-2">
        <FG label="SKU" required err={errors.sku}><Input value={form.sku} onChange={(e) => set("sku", e.target.value)} placeholder="SP-PNL-550" /></FG>
        <FG label="Product name" required err={errors.name}><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></FG>
        <FG label="Category">
          <Select value={form.category} onChange={(e) => set("category", e.target.value)}>
            {Object.entries(INVENTORY_CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </FG>
        <FG label="Unit">
          <Select value={form.unit} onChange={(e) => set("unit", e.target.value)}>
            {["units", "sets", "rolls", "pairs", "meters", "kg", "kits"].map((u) => <option key={u}>{u}</option>)}
          </Select>
        </FG>
        <FG label="Manufacturer"><Input value={form.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} /></FG>
        <FG label="Model"><Input value={form.model} onChange={(e) => set("model", e.target.value)} /></FG>
        <FG label="Purchase cost (₹)" required err={errors.purchase_cost}><Input type="number" value={form.purchase_cost} onChange={(e) => set("purchase_cost", e.target.value)} /></FG>
        <FG label="Selling price (₹)"><Input type="number" value={form.selling_price} onChange={(e) => set("selling_price", e.target.value)} /></FG>
        <FG label="Opening quantity"><Input type="number" value={form.available_qty} onChange={(e) => set("available_qty", e.target.value)} /></FG>
        <FG label="Reorder level"><Input type="number" value={form.reorder_level} onChange={(e) => set("reorder_level", e.target.value)} /></FG>
        <FG label="Supplier"><Input value={form.supplier} onChange={(e) => set("supplier", e.target.value)} /></FG>
        <FG label="Warranty duration (months)"><Input type="number" value={form.warranty_months} onChange={(e) => set("warranty_months", e.target.value)} /></FG>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save}>Add item</Button>
      </div>
    </Modal>
  );
}

function AddSerialModal({ onClose }: { onClose: () => void }) {
  const db = useDB();
  const toast = useToast();
  const [form, setForm] = useState({ item_id: db.inventory_items[0]?.id ?? "", serial_number: "", purchase_ref: "PO-2026-06", notes: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = () => {
    const errs: Record<string, string> = {};
    if (!form.serial_number.trim() || form.serial_number.trim().length < 3) errs.serial_number = "Serial must be at least 3 characters";
    if (!form.item_id) errs.item_id = "Select an item";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      api.addEquipmentUnit(form);
      toast.success("Serial number registered", `${form.serial_number} added to stock`);
      onClose();
    } catch (e) { toast.error("Registration failed", e instanceof Error ? e.message : String(e)); }
  };
  return (
    <Modal open onClose={onClose} title="Register equipment serial number (manual entry)" width="max-w-md">
      <div className="space-y-3">
        <FG label="Base item" required err={errors.item_id}>
          <Select value={form.item_id} onChange={(e) => setForm({ ...form, item_id: e.target.value })}>
            <option value="">Select inventory item…</option>
            {db.inventory_items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>)}
            {db.inventory_items.length === 0 && <option value="" disabled>No inventory items registered</option>}
          </Select>
        </FG>
        <FG label="Serial number" required err={errors.serial_number} hint="Scanning is optional — manual entry is fully supported. Uniqueness is enforced.">
          <Input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} placeholder="e.g., SP-PNL-500-2451" className="font-mono" />
        </FG>
        <FG label="Batch / purchase reference"><Input value={form.purchase_ref} onChange={(e) => setForm({ ...form, purchase_ref: e.target.value })} /></FG>
        <FG label="Notes"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="min-h-[60px]" /></FG>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Register serial</Button>
        </div>
      </div>
    </Modal>
  );
}

function TransactionModal({ itemId, type, onClose }: { itemId: string; type: "receipt" | "adjustment"; onClose: () => void }) {
  const db = useDB();
  const toast = useToast();
  const item = db.inventory_items.find((x) => x.id === itemId)!;
  const [qty, setQty] = useState(type === "receipt" ? 1 : 0);
  const [ref, setRef] = useState(type === "receipt" ? `PO-2026-0${new Date().getMonth() + 1}` : "");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const save = () => {
    try {
      if (type === "receipt") {
        api.stockReceipt(itemId, Number(qty), ref, note);
        toast.success(`Stock received`, `${qty} × ${item.name}`);
      } else {
        api.stockAdjustment(itemId, Number(qty), note);
        toast.success(`Stock adjusted`, `${qty >= 0 ? "+" : ""}${qty} × ${item.name}`);
      }
      onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };
  return (
    <Modal open onClose={onClose} title={type === "receipt" ? `Receive stock — ${item.name}` : `Adjust stock — ${item.name}`} width="max-w-sm">
      <div className="space-y-3">
        <p className="text-[12.5px] text-slate-500">Current available: <b>{item.available_qty} {item.unit}</b> · reserved <b>{item.reserved_qty}</b></p>
        <div>
          <Label required>{type === "receipt" ? "Quantity received" : "Adjustment (−/+)"}</Label>
          <Input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
        </div>
        {type === "receipt" && (
          <div>
            <Label>Purchase reference</Label>
            <Input value={ref} onChange={(e) => setRef(e.target.value)} />
          </div>
        )}
        <div>
          <Label>Note</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={type === "adjustment" ? "Reason for adjustment" : ""} />
        </div>
        <FieldError message={err} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>{type === "receipt" ? "Record receipt" : "Record adjustment"}</Button>
        </div>
      </div>
    </Modal>
  );
}

function FG({ label, children, err, required, className, hint }: { label: string; children: React.ReactNode; err?: string; required?: boolean; className?: string; hint?: string }) {
  return (
    <div className={className}>
      <Label required={required}>{label}</Label>
      {children}
      {hint && <p className="mt-0.5 text-[10.5px] text-slate-400">{hint}</p>}
      <FieldError message={err} />
    </div>
  );
}

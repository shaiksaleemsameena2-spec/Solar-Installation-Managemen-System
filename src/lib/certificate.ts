import type { Warranty, Customer, Quotation } from "@/types";
import { formatDate, formatINR, downloadTextFile } from "./utils";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function baseDoc(title: string, bodyCss: string, content: string) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  * { box-sizing: border-box; }
  @page { size: A4; margin: 16mm 14mm; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1f2937; margin: 0; }
  .wrap { max-width: 800px; margin: 32px auto; padding: 40px 48px; }
  @media print {
    .wrap { margin: 0; padding: 0; max-width: 100%; }
    .doc-title { break-after: avoid; }
    table { break-inside: auto; }
    tr { break-inside: avoid; }
  }
  .brand { display: flex; align-items: center; gap: 14px; }
  .logo { width: 44px; height: 44px; border-radius: 10px; background: #15803d; color: #bef264; display:flex; align-items:center; justify-content:center; font-size: 24px; font-weight: bold; }
  .org { font-size: 20px; font-weight: bold; color: #14532d; letter-spacing: .2px; }
  .org-sub { font-size: 11px; color: #6b7280; letter-spacing: .8px; text-transform: uppercase; }
  .doc-title { margin-top: 28px; font-size: 15px; text-transform: uppercase; letter-spacing: 2px; color: #15803d; border-bottom: 2px solid #15803d; padding-bottom: 8px; }
  .row { display: flex; gap: 40px; margin-top: 18px; font-size: 13.5px; }
  .col { flex: 1; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
  th { text-align: left; background: #f0fdf4; color: #14532d; padding: 8px 10px; border: 1px solid #d1d5db; font-size: 11px; text-transform: uppercase; letter-spacing: .6px; }
  td { padding: 8px 10px; border: 1px solid #e5e7eb; }
  .total { font-size: 15px; font-weight: bold; background: #f0fdf4; }
  .fine { margin-top: 22px; font-size: 11.5px; color: #6b7280; line-height: 1.6; }
  .note { margin-top: 18px; padding: 10px 14px; background: #fefce8; border: 1px solid #fde047; border-radius: 6px; font-size: 11px; color: #854d0e; line-height: 1.5; }
  .sign { margin-top: 48px; display: flex; justify-content: space-between; font-size: 12px; color: #4b5563; }
  .sign div { width: 220px; border-top: 1px solid #9ca3af; padding-top: 6px; }
  ${bodyCss}
</style></head><body><div class="wrap">${content}</div></body></html>`;
}

function header(org: string) {
  return `<div class="brand"><div class="logo">☀</div><div><div class="org">${esc(org)}</div><div class="org-sub">From First Lead to Lifetime Solar Service</div></div></div>`;
}

export function printQuotation(q: Quotation, customer: Customer | undefined, org: string) {
  const itemRows = [
    `<tr><td>${esc(q.package_name)} — ${q.capacity_kw} kW ${q.system_type === "on_grid" ? "On-Grid" : "Off-Grid"} system</td><td style="text-align:right">${formatINR(q.equipment_cost)}</td></tr>`,
    `<tr><td>Installation charges — ${q.panel_count} × ${q.panel_wattage}W panels, ${esc(q.inverter_spec)}</td><td style="text-align:right">${formatINR(q.installation_cost)}</td></tr>`,
    ...q.additional_items.map((a) => `<tr><td>${esc(a.description)}</td><td style="text-align:right">${formatINR(a.amount)}</td></tr>`),
  ].join("");
  const terms = q.terms.split("\n").map((t) => `<p style="margin:4px 0">${esc(t)}</p>`).join("");
  const html = baseDoc(`Quotation ${q.number}`, "", `
    ${header(org)}
    <div class="doc-title">Quotation ${esc(q.number)}</div>
    <div class="row">
      <div class="col"><b style="color:#6b7280;font-size:11px;text-transform:uppercase">Customer</b><br>${esc(customer?.full_name ?? "")}<br>${esc(customer?.address ?? "")}, ${esc(customer?.city ?? "")}<br>${esc(customer?.phone ?? "")} · ${esc(customer?.email ?? "")}</div>
      <div class="col"><b style="color:#6b7280;font-size:11px;text-transform:uppercase">Quotation details</b><br>Date: ${esc(formatDate(q.created_at))}<br>Valid until: <b>${esc(formatDate(q.valid_until))}</b><br>Status: ${esc(q.status.toUpperCase())}</div>
    </div>
    <table>
      <tr><th>Description</th><th style="text-align:right">Amount</th></tr>
      ${itemRows}
      <tr><td style="text-align:right"><b>Subtotal</b></td><td style="text-align:right">${formatINR(q.subtotal)}</td></tr>
      ${q.discount ? `<tr><td style="text-align:right">Discount</td><td style="text-align:right">- ${formatINR(q.discount)}</td></tr>` : ""}
      <tr><td style="text-align:right">GST @ ${q.tax_percent}%</td><td style="text-align:right">${formatINR(q.tax_amount)}</td></tr>
      ${q.subsidy_estimate ? `<tr><td style="text-align:right">Estimated subsidy (assumption)</td><td style="text-align:right">- ${formatINR(q.subsidy_estimate)}</td></tr>` : ""}
      <tr class="total"><td style="text-align:right">TOTAL PAYABLE</td><td style="text-align:right">${formatINR(q.total)}</td></tr>
    </table>
    <div class="fine"><b>Terms &amp; Conditions</b>${terms}</div>
    <div class="note">This quotation was generated by the SolarOps AI application for ${esc(org)}. Package prices are demonstration values editable by administrators and do not represent actual market prices. Subsidy shown is an estimate only — eligibility and approval are decided solely by the government scheme.</div>
    <div class="sign"><div>For ${esc(org)}<br><br><br>Authorized Signatory</div><div>Customer Acceptance<br><br><br>Signature</div></div>
  `);
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); w.setTimeout(() => w.print(), 400); }
  else downloadTextFile(`Quotation-${q.number}.html`, html);
}

export function printWarrantyCertificate(w: Warranty, customer: Customer | undefined, org = "SunPower Solutions") {
  const html = baseDoc(`Warranty ${w.code}`, "", `
    ${header(org)}
    <div class="doc-title">Warranty Certificate · ${esc(w.code)}</div>
    <p style="font-size:13px; margin-top:18px">The following equipment is covered by a warranty recorded in the SolarOps AI application of ${esc(org)}:</p>
    <table>
      <tr><th>Field</th><th>Details</th></tr>
      <tr><td>Warranty code</td><td><b>${esc(w.code)}</b></td></tr>
      <tr><td>Customer</td><td>${esc(customer?.full_name ?? "")} — ${esc(customer?.city ?? "")}</td></tr>
      <tr><td>Product</td><td>${esc(w.product_name)}</td></tr>
      <tr><td>Serial number(s)</td><td style="font-family: monospace">${esc(w.serial_number)}</td></tr>
      <tr><td>Warranty type</td><td>${esc(w.warranty_type)}</td></tr>
      <tr><td>Start date</td><td>${esc(formatDate(w.start_date))}</td></tr>
      <tr><td>End date</td><td><b>${esc(formatDate(w.end_date))}</b> (${w.duration_months} months)</td></tr>
      <tr><td>Status</td><td><b>${esc(w.status.toUpperCase())}</b></td></tr>
      <tr><td>Terms</td><td>${esc(w.terms)}</td></tr>
    </table>
    <div class="note">⚠ This certificate is <b>application-generated</b> by SolarOps AI for demonstration and record-keeping. It does <b>not</b> represent a manufacturer warranty registration, and does not imply any manufacturer has accepted a warranty claim.</div>
    <div class="sign"><div>For ${esc(org)}<br><br><br>Authorized Signatory</div><div>Customer<br><br><br>Signature</div></div>
  `);
  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); win.setTimeout(() => win.print(), 400); }
  else downloadTextFile(`Warranty-${w.code}.html`, html);
}

export function printTechnicianRequestAck(ticketNumber: string, technicianName: string, appointment: string) {
  const html = baseDoc("Service request confirmation", "", `
    ${header("SunPower Solutions")}
    <div class="doc-title">Service Request Confirmation · ${esc(ticketNumber)}</div>
    <table>
      <tr><td>Technician</td><td><b>${esc(technicianName)}</b> (demo technician profile)</td></tr>
      <tr><td>Preferred appointment</td><td>${esc(appointment || "to be confirmed")}</td></tr>
      <tr><td>Status</td><td>Requested — awaiting technician confirmation</td></tr>
    </table>
  `);
  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); }
}

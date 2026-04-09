/**
 * طباعة ملخص شيفت: إجمالي المبيعات، المصاريف، وإجمالي كل طريقة دفع.
 */

import { printHtmlDocument } from "./printHtmlDocument";

function escapeHtml(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMoney(n) {
  return new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);
}

function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("ar-EG-u-nu-latn", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

/**
 * يجمع مبالغ الفواتير حسب تسمية طريقة الدفع كما في نقطة البيع (كاش / فيزا / محفظة / انستا باي).
 * الفواتير بدون حقل أو بقيمة غير معروفة تُحسب ككاش.
 *
 * @param {Array<{ totalAmount?: number, paymentMethod?: string }>} invoices
 */
export function aggregateShiftPaymentTotals(invoices) {
  let totalCash = 0;
  let totalVisa = 0;
  let totalWallet = 0;
  let totalInstapay = 0;
  for (const inv of invoices || []) {
    const amt = Number(inv.totalAmount || 0);
    const pm = String(inv.paymentMethod ?? "").trim();
    if (pm === "فيزا") totalVisa += amt;
    else if (pm === "محفظة") totalWallet += amt;
    else if (pm === "انستا باي") totalInstapay += amt;
    else totalCash += amt;
  }
  return { totalCash, totalVisa, totalWallet, totalInstapay };
}

/**
 * @param {object} p
 * @param {number} p.salesTotal
 * @param {number} p.expensesTotal
 * @param {number} p.totalCash
 * @param {number} p.totalVisa
 * @param {number} p.totalWallet
 * @param {number} p.totalInstapay
 * @param {string} [p.generatedAt] ISO
 */
export function printShiftSummary(p) {
  const {
    salesTotal,
    expensesTotal,
    totalCash,
    totalVisa,
    totalWallet,
    totalInstapay,
    generatedAt,
  } = p || {};

  const at = formatDateTime(generatedAt || new Date().toISOString());

  const rows = [
    ["إجمالي المبيعات", formatMoney(salesTotal)],
    ["إجمالي المصاريف", formatMoney(expensesTotal)],
    ["إجمالي الكاش", formatMoney(totalCash)],
    ["إجمالي الفيزا", formatMoney(totalVisa)],
    ["إجمالي المحفظة", formatMoney(totalWallet)],
    ["إجمالي انستا باي", formatMoney(totalInstapay)],
  ]
    .map(
      ([label, value]) =>
        `<tr><th scope="row">${escapeHtml(label)}</th><td>${value}</td></tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <title>ملخص شيفت</title>
  <style>
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @page { size: 80mm auto; margin: 1.5mm; }
    html, body {
      height: auto;
      min-height: 0;
    }
    body {
      font-family: Tahoma, Arial, "Segoe UI", sans-serif;
      margin: 0 auto;
      padding: 7px 8px 5px;
      max-width: 79mm;
      color: #000;
      background: #fff;
      font-size: 13px;
      font-weight: 800;
      line-height: 1.45;
    }
    .sheet {
      border: 2px solid #000;
      border-radius: 8px;
      overflow: hidden;
      background: #fff;
    }
    .sheet-top {
      height: 2px;
      background: #000;
    }
    .sheet-inner { padding: 10px 10px 9px; }
    h1 {
      font-size: 15px;
      font-weight: 900;
      margin: 0 0 8px;
      text-align: center;
      letter-spacing: 0.02em;
      color: #000;
      border-bottom: 1px solid #000;
      padding-bottom: 7px;
    }
    .meta {
      font-size: 12px;
      font-weight: 800;
      color: #000;
      margin: 0 0 10px;
      text-align: center;
    }
    table.summary {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 13px;
      border: 2px solid #000;
    }
    .summary th,
    .summary td {
      border: 1px solid #000;
      padding: 8px 8px;
      text-align: right;
      vertical-align: middle;
    }
    .summary th {
      width: 56%;
      background: #f3f4f6;
      color: #111;
      font-weight: 900;
      font-size: 13px;
    }
    .summary td {
      font-weight: 900;
      font-size: 13px;
      color: #000;
      background: #fff;
      text-align: left;
      white-space: nowrap;
    }
    .summary tbody tr:nth-child(even) th { background: #f9fafb; }
    .summary tbody tr:nth-child(even) td { background: #ffffff; }
    @media print {
      body { padding: 1.5mm 2mm 1mm; max-width: none; }
      .sheet { border-radius: 0; }
      html, body { height: auto !important; min-height: 0 !important; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="sheet-top" aria-hidden="true"></div>
    <div class="sheet-inner">
      <h1>ملخص شيفت</h1>
      <p class="meta">تاريخ الطباعة: ${escapeHtml(at)}</p>
      <table class="summary">
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>
</body>
</html>`;

  printHtmlDocument(html, { iframeTitle: "طباعة ملخص الشيفت" });
}

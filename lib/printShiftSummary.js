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
    * { box-sizing: border-box; }
    body { font-family: system-ui, Tahoma, sans-serif; padding: 24px; color: #111; max-width: 480px; margin: 0 auto; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    .meta { color: #6b7280; font-size: 13px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 15px; }
    th, td { border: 1px solid #e5e7eb; padding: 12px 14px; text-align: right; }
    th { background: #f3f4f6; font-weight: 700; width: 55%; }
    td { font-weight: 800; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <h1>ملخص شيفت</h1>
  <p class="meta">تاريخ الطباعة: ${escapeHtml(at)}</p>
  <table>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

  printHtmlDocument(html, { iframeTitle: "طباعة ملخص الشيفت" });
}

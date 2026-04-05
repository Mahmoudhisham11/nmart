"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import { printHtmlDocument } from "@/lib/printHtmlDocument";
import {
  FaCalendarAlt,
  FaChartLine,
  FaDollarSign,
  FaPrint,
  FaReceipt,
  FaSpinner,
} from "react-icons/fa";
import styles from "./page.module.css";

function closureProfit(c) {
  const revenue = c.totalRevenue || 0;
  const cost = c.totalCost || 0;
  if (typeof c.totalProfit === "number") return c.totalProfit;
  return revenue - cost;
}

function isoDayKey(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function normalizeInvoiceItems(inv) {
  if (!inv || typeof inv !== "object") return [];
  const raw = inv.items;
  return Array.isArray(raw) ? raw : [];
}

function normalizeCategoryLabel(raw) {
  const s = String(raw || "").trim();
  return s || "بدون قسم";
}

function sortCategoryNames(names) {
  const noCat = "بدون قسم";
  const set = new Set(names);
  const rest = [...set]
    .filter((x) => x !== noCat)
    .sort((a, b) => a.localeCompare(b, "ar"));
  if (set.has(noCat)) rest.push(noCat);
  return rest;
}

function isDrinkLine(item) {
  if (item.itemType === "drink") return true;
  return Boolean(item.drinkId) && !item.productId;
}

function lineRowKey(item) {
  if (isDrinkLine(item) && item.drinkId) return `d:${item.drinkId}`;
  if (item.productId) return `p:${item.productId}`;
  const b = String(item.barcode || "").trim();
  const n = String(item.nameAr || "").trim();
  return `f:${n}:${b}`;
}

function categoryForLineItem(
  item,
  productCategoryById,
  drinkCategoryById,
  productCategoryByBarcode
) {
  if (isDrinkLine(item)) {
    const id = item.drinkId;
    if (id && drinkCategoryById[id]) return drinkCategoryById[id];
    return "بدون قسم";
  }
  const pid = item.productId;
  if (pid && productCategoryById[pid]) return productCategoryById[pid];
  const bc = String(item.barcode || "").trim();
  if (bc && productCategoryByBarcode[bc]) return productCategoryByBarcode[bc];
  return "بدون قسم";
}

function aggregateLines(invoices, productCategoryById, drinkCategoryById, productCategoryByBarcode) {
  /** @type {Map<string, Map<string, { nameAr: string, kind: string, quantity: number, revenue: number }>>} */
  const byCat = new Map();

  for (const inv of invoices) {
    for (const item of normalizeInvoiceItems(inv)) {
      const cat = categoryForLineItem(
        item,
        productCategoryById,
        drinkCategoryById,
        productCategoryByBarcode
      );
      const qty = Number(item.quantity || 0);
      const revenue =
        typeof item.total === "number"
          ? item.total
          : qty * Number(item.unitPrice || 0);
      const kind = isDrinkLine(item) ? "drink" : "product";
      const key = lineRowKey(item);
      const nameAr = String(item.nameAr || "—").trim() || "—";

      if (!byCat.has(cat)) byCat.set(cat, new Map());
      const inner = byCat.get(cat);
      const prev = inner.get(key) || {
        nameAr,
        kind,
        quantity: 0,
        revenue: 0,
      };
      inner.set(key, {
        nameAr: prev.nameAr || nameAr,
        kind,
        quantity: prev.quantity + qty,
        revenue: prev.revenue + revenue,
      });
    }
  }

  const categories = sortCategoryNames([...byCat.keys()]);
  return categories.map((catName) => {
    const inner = byCat.get(catName);
    const rows = [...inner.values()].sort((a, b) =>
      String(a.nameAr).localeCompare(String(b.nameAr), "ar")
    );
    const qtySum = rows.reduce((s, r) => s + r.quantity, 0);
    const revSum = rows.reduce((s, r) => s + r.revenue, 0);
    return { catName, rows, qtySum, revSum };
  });
}

function escapeHtmlPrint(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatPrintDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ar-EG-u-nu-latn", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

function buildReportDayCategoriesPrintHtml({
  reportDate,
  printedAtIso,
  blocks,
  formatMoney,
}) {
  const at = formatPrintDateTime(printedAtIso);
  let sections = "";
  let grandRev = 0;
  let grandQty = 0;
  for (const block of blocks) {
    grandRev += block.revSum;
    grandQty += block.qtySum;
    const rows = block.rows
      .map(
        (row) =>
          `<tr>
        <td>${escapeHtmlPrint(row.kind === "drink" ? "مشروب" : "منتج")}</td>
        <td>${escapeHtmlPrint(row.nameAr)}</td>
        <td>${escapeHtmlPrint(String(row.quantity))}</td>
        <td>${escapeHtmlPrint(formatMoney(row.revenue))}</td>
      </tr>`
      )
      .join("");
    sections += `
  <section class="sec">
    <h2>${escapeHtmlPrint(block.catName)}</h2>
    <table>
      <thead><tr><th>النوع</th><th>الصنف</th><th>الكمية</th><th>إجمالي البيع</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr class="subtotal"><th colspan="3" scope="row">إجمالي القسم (إيراد)</th><td>${escapeHtmlPrint(formatMoney(block.revSum))}</td></tr>
        <tr class="subqty"><th colspan="3" scope="row">إجمالي كمية القسم</th><td>${escapeHtmlPrint(String(block.qtySum))}</td></tr>
      </tfoot>
    </table>
  </section>`;
  }

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <title>تقرير أقسام ${escapeHtmlPrint(reportDate)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, Tahoma, sans-serif; padding: 20px; color: #111; max-width: 720px; margin: 0 auto; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    .meta { color: #6b7280; font-size: 13px; margin-bottom: 16px; }
    h2 { font-size: 16px; margin: 20px 0 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 8px; }
    th, td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: right; }
    th { background: #f3f4f6; font-weight: 800; }
    tfoot .subtotal td { font-weight: 800; }
    .grand { margin-top: 24px; padding: 14px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; font-size: 15px; }
    .grand div { margin-bottom: 6px; }
    @media print { body { padding: 12px; } }
  </style>
</head>
<body>
  <h1>تقرير مبيعات الأقسام</h1>
  <p class="meta">تاريخ اليوم: <strong>${escapeHtmlPrint(reportDate)}</strong> · تاريخ الطباعة: ${escapeHtmlPrint(at)}</p>
  ${sections}
  <div class="grand">
    <div>إجمالي الأقسام المحددة — كمية: <strong>${escapeHtmlPrint(String(grandQty))}</strong></div>
    <div>إجمالي الأقسام المحددة — إيراد: <strong>${escapeHtmlPrint(formatMoney(grandRev))}</strong></div>
  </div>
</body>
</html>`;
}

export default function ReportsPage() {
  const [closures, setClosures] = useState([]);
  const [products, setProducts] = useState([]);
  const [drinks, setDrinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reportDate, setReportDate] = useState("");
  const [dayInvoices, setDayInvoices] = useState([]);
  const [dayArchivedExpenseRows, setDayArchivedExpenseRows] = useState([]);
  const [loadingDay, setLoadingDay] = useState(false);
  const [dayError, setDayError] = useState("");
  const [reportPrintSelectedCats, setReportPrintSelectedCats] = useState(
    () => new Set()
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [cSnap, pSnap, dSnap] = await Promise.all([
        getDocs(collection(firestore, "shiftClosures")),
        getDocs(collection(firestore, "products")),
        getDocs(collection(firestore, "drinks")),
      ]);

      const cList = [];
      cSnap.forEach((d) => cList.push({ id: d.id, ...d.data() }));

      const pList = [];
      pSnap.forEach((d) => pList.push({ id: d.id, ...d.data() }));

      const dList = [];
      dSnap.forEach((d) => dList.push({ id: d.id, ...d.data() }));

      setClosures(cList);
      setProducts(pList);
      setDrinks(dList);
    } catch (e) {
      console.error(e);
      setError("تعذر تحميل بيانات التقارير.");
      setClosures([]);
      setProducts([]);
      setDrinks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!reportDate) {
      setDayInvoices([]);
      setDayArchivedExpenseRows([]);
      setLoadingDay(false);
      setDayError("");
      return;
    }

    let cancelled = false;
    setDayInvoices([]);
    setDayArchivedExpenseRows([]);
    (async () => {
      setLoadingDay(true);
      setDayError("");
      try {
        const dayShifts = closures.filter((c) => c.dayKey === reportDate);
        const shiftIds = dayShifts.map((c) => String(c.shiftId || c.id));

        const archivedNested = await Promise.all(
          shiftIds.map((sid) =>
            getDocs(collection(firestore, "shiftClosures", sid, "invoices"))
          )
        );
        const archived = [];
        for (const snap of archivedNested) {
          snap.forEach((d) => archived.push({ id: d.id, ...d.data() }));
        }

        const expNested = await Promise.all(
          shiftIds.map((sid) =>
            getDocs(
              collection(firestore, "shiftClosures", sid, "archivedExpenses")
            )
          )
        );
        const expenseRows = [];
        for (let i = 0; i < shiftIds.length; i++) {
          const sid = shiftIds[i];
          const closure = dayShifts.find(
            (c) => String(c.shiftId || c.id) === sid
          );
          const label =
            closure?.shiftLabel || `شيفت ${closure?.shiftNumber ?? "—"}`;
          expNested[i].forEach((d) =>
            expenseRows.push({
              rowKey: `${sid}-${d.id}`,
              docId: d.id,
              shiftId: sid,
              shiftLabel: label,
              ...d.data(),
            })
          );
        }
        expenseRows.sort((a, b) =>
          String(b.archivedAt || b.createdAt || "").localeCompare(
            String(a.archivedAt || a.createdAt || "")
          )
        );

        const salesSnap = await getDocs(collection(firestore, "sales"));
        const open = [];
        salesSnap.forEach((d) => {
          const data = d.data();
          if (isoDayKey(data.createdAt) === reportDate) {
            open.push({ id: d.id, ...data });
          }
        });

        if (!cancelled) {
          setDayInvoices([...archived, ...open]);
          setDayArchivedExpenseRows(expenseRows);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setDayInvoices([]);
          setDayArchivedExpenseRows([]);
          setDayError("تعذر تحميل فواتير اليوم المحدد.");
        }
      } finally {
        if (!cancelled) setLoadingDay(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reportDate, closures]);

  const productCategoryById = useMemo(() => {
    const m = {};
    for (const p of products) {
      m[p.id] = normalizeCategoryLabel(p.category);
    }
    return m;
  }, [products]);

  const drinkCategoryById = useMemo(() => {
    const m = {};
    for (const d of drinks) {
      m[d.id] = normalizeCategoryLabel(d.category);
    }
    return m;
  }, [drinks]);

  const productCategoryByBarcode = useMemo(() => {
    const m = {};
    for (const p of products) {
      const b = String(p.barcode || "").trim();
      if (b) m[b] = normalizeCategoryLabel(p.category);
    }
    return m;
  }, [products]);

  const categoryBlocks = useMemo(
    () =>
      aggregateLines(
        dayInvoices,
        productCategoryById,
        drinkCategoryById,
        productCategoryByBarcode
      ),
    [
      dayInvoices,
      productCategoryById,
      drinkCategoryById,
      productCategoryByBarcode,
    ]
  );

  useEffect(() => {
    if (categoryBlocks.length === 0) {
      setReportPrintSelectedCats(new Set());
      return;
    }
    setReportPrintSelectedCats(
      new Set(categoryBlocks.map((b) => b.catName))
    );
  }, [categoryBlocks]);

  const { sumRevenue, sumProfit, shiftCount, sumExpenses, sumNetProfit } =
    useMemo(() => {
      let sumRevenue = 0;
      let sumProfit = 0;
      let sumExpenses = 0;
      for (const c of closures) {
        sumRevenue += c.totalRevenue || 0;
        sumProfit += closureProfit(c);
        sumExpenses += Number(c.totalExpenses || 0);
      }
      return {
        sumRevenue,
        sumProfit,
        shiftCount: closures.length,
        sumExpenses,
        sumNetProfit: sumProfit - sumExpenses,
      };
    }, [closures]);

  const dayClosures = useMemo(
    () => closures.filter((c) => c.dayKey === reportDate),
    [closures, reportDate]
  );

  const dayStats = useMemo(() => {
    if (!reportDate) return null;
    let rev = 0;
    let prof = 0;
    for (const inv of dayInvoices) {
      const r = Number(inv.totalAmount || 0);
      const c = Number(inv.totalCost || 0);
      rev += r;
      prof += r - c;
    }
    const sumExp = dayClosures.reduce(
      (s, c) => s + Number(c.totalExpenses || 0),
      0
    );
    return {
      sumRevenue: rev,
      sumProfit: prof,
      sumExpenses: sumExp,
      sumNetProfit: prof - sumExp,
      shiftCount: dayClosures.length,
      invoiceCount: dayInvoices.length,
    };
  }, [reportDate, dayClosures, dayInvoices]);

  const formatCurrency = (value) =>
    new Intl.NumberFormat("ar-EG", {
      style: "currency",
      currency: "EGP",
      maximumFractionDigits: 0,
    }).format(value || 0);

  const selectedCategoryBlocksForPrint = useMemo(
    () =>
      categoryBlocks.filter((b) => reportPrintSelectedCats.has(b.catName)),
    [categoryBlocks, reportPrintSelectedCats]
  );

  const reportPrintSelectedTotals = useMemo(() => {
    let totalRevenue = 0;
    let totalQty = 0;
    for (const b of selectedCategoryBlocksForPrint) {
      totalRevenue += b.revSum;
      totalQty += b.qtySum;
    }
    return { totalRevenue, totalQty };
  }, [selectedCategoryBlocksForPrint]);

  const handlePrintReportCategories = () => {
    if (selectedCategoryBlocksForPrint.length === 0) return;
    const html = buildReportDayCategoriesPrintHtml({
      reportDate,
      printedAtIso: new Date().toISOString(),
      blocks: selectedCategoryBlocksForPrint,
      formatMoney: (n) => formatCurrency(n),
    });
    printHtmlDocument(html, { iframeTitle: "طباعة تقرير الأقسام" });
  };

  const displayStats =
    reportDate && dayStats
      ? dayStats
      : {
          sumRevenue,
          sumProfit,
          shiftCount,
          sumExpenses,
          sumNetProfit,
        };

  const statsHint = reportDate
    ? "لمُحدَّد: تقفيلات اليوم + أي فواتير مفتوحة (لم تُؤرشف بعد) بنفس التاريخ."
    : "كل الشيفتات المؤرشفة في النظام.";

  const statsShiftsNote =
    reportDate && dayClosures.length > 0
      ? dayClosures
          .map((c) => c.shiftLabel || `شيفت ${c.shiftNumber ?? "—"}`)
          .join("، ")
      : null;

  return (
    <div className={styles.wrapper}>
      <section className={styles.intro}>
        <h2 className={styles.introTitle}>التقارير</h2>
        <p className={styles.introText}>
          اختر تاريخاً لمراجعة <strong>مبيعات ذلك اليوم</strong> و<strong>الأصناف المباعة</strong>{" "}
          مجمّعة حسب <strong>الأقسام</strong>، و<strong>المصاريف المؤرشفة</strong> مع كل تقفيل
          (تُنقل تلقائياً من صفحة المصاريف عند تقفيل الشيفت وتُحفظ مع أرشيف ذلك الشيفت).
          التقارير الشاملة بدون تاريخ تعرض إجمالي كل التقفيلات والمصاريف المؤرشفة.
        </p>
      </section>

      <div className={styles.filterRow}>
        <label className={styles.dateLabel} htmlFor="reports-date-filter">
          <FaCalendarAlt className={styles.dateIcon} aria-hidden />
          <span>تصفية بالتاريخ</span>
        </label>
        <div className={styles.dateInputs}>
          <input
            id="reports-date-filter"
            type="date"
            className={styles.dateInput}
            value={reportDate}
            onChange={(e) => {
              setReportDate(e.target.value);
              setError("");
              setDayError("");
            }}
          />
          {reportDate ? (
            <button
              type="button"
              className={styles.clearDateBtn}
              onClick={() => setReportDate("")}
            >
              عرض الإجمالي الكلّي
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
      {dayError ? <p className={styles.error}>{dayError}</p> : null}

      {loading ? (
        <p className={styles.muted}>
          <FaSpinner className={styles.spinner} aria-hidden />
          جارٍ تحميل البيانات...
        </p>
      ) : null}

      {!loading && !error && closures.length === 0 ? (
        <p className={styles.muted}>لا توجد تقفيلات مسجّلة بعد؛ لا توجد أرقام للعرض.</p>
      ) : null}

      {!loading && closures.length > 0 ? (
        <>
          <p className={styles.metaLine}>
            {reportDate ? (
              <>
                اليوم المحدد: <strong>{reportDate}</strong>
                {typeof dayStats?.shiftCount === "number" ? (
                  <>
                    {" "}
                    · شيفتات مؤرشفة: <strong>{dayStats.shiftCount}</strong>
                  </>
                ) : null}
                {typeof dayStats?.invoiceCount === "number" ? (
                  <>
                    {" "}
                    · فواتير (أرشيف + مفتوحة): <strong>{dayStats.invoiceCount}</strong>
                  </>
                ) : null}
              </>
            ) : (
              <>
                عدد الشيفتات (كل الفترة): <strong>{shiftCount}</strong>
              </>
            )}
          </p>
          {statsShiftsNote ? (
            <p className={styles.shiftNote}>تقفيلات هذا التاريخ: {statsShiftsNote}</p>
          ) : null}

          <div className={styles.cards}>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: "#dbeafe" }}>
                <FaDollarSign style={{ color: "#3b82f6" }} aria-hidden />
              </div>
              <div className={styles.statTitle}>
                {reportDate ? "مبيعات اليوم" : "إجمالي المبيعات"}
              </div>
              <div className={styles.statValue}>
                {reportDate && loadingDay ? (
                  <FaSpinner className={styles.spinner} aria-label="جارٍ التحميل" />
                ) : (
                  formatCurrency(displayStats.sumRevenue)
                )}
              </div>
              <div className={styles.statHint}>{statsHint}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: "#dcfce7" }}>
                <FaChartLine style={{ color: "#10b981" }} aria-hidden />
              </div>
              <div className={styles.statTitle}>
                {reportDate ? "أرباح اليوم (قبل المصاريف)" : "إجمالي الأرباح"}
              </div>
              <div className={styles.statValue}>
                {reportDate && loadingDay ? (
                  <FaSpinner className={styles.spinner} aria-label="جارٍ التحميل" />
                ) : (
                  formatCurrency(displayStats.sumProfit)
                )}
              </div>
              <div className={styles.statHint}>
                الإيراد − تكلفة البضاعة (حيث تتوفر)
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: "#ffedd5" }}>
                <FaReceipt style={{ color: "#ea580c" }} aria-hidden />
              </div>
              <div className={styles.statTitle}>
                {reportDate ? "مصاريف مؤرشفة (اليوم)" : "إجمالي المصاريف المؤرشفة"}
              </div>
              <div className={styles.statValue}>
                {reportDate && loadingDay ? (
                  <FaSpinner className={styles.spinner} aria-label="جارٍ التحميل" />
                ) : (
                  formatCurrency(displayStats.sumExpenses ?? 0)
                )}
              </div>
              <div className={styles.statHint}>
                مبالغ نُقلت مع تقفيل الشيفت إلى archivedExpenses
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: "#e0e7ff" }}>
                <FaChartLine style={{ color: "#4f46e5" }} aria-hidden />
              </div>
              <div className={styles.statTitle}>
                {reportDate ? "صافي الربح بعد المصاريف" : "صافي الأرباح بعد المصاريف"}
              </div>
              <div
                className={`${styles.statValue} ${
                  (displayStats.sumNetProfit ?? 0) < 0 ? styles.statValueNegative : ""
                }`}
              >
                {reportDate && loadingDay ? (
                  <FaSpinner className={styles.spinner} aria-label="جارٍ التحميل" />
                ) : (
                  formatCurrency(displayStats.sumNetProfit ?? 0)
                )}
              </div>
              <div className={styles.statHint}>أرباح التقارير ناقص المصاريف المؤرشفة</div>
            </div>
          </div>
        </>
      ) : null}

      {!loading && reportDate ? (
        <section className={styles.productsPanel}>
          <h3 className={styles.productsPanelTitle}>المصاريف المؤرشفة لهذا التاريخ</h3>
          {loadingDay ? (
            <p className={styles.muted}>
              <FaSpinner className={styles.spinner} aria-hidden />
              جارٍ تحميل المصاريف المؤرشفة...
            </p>
          ) : dayArchivedExpenseRows.length === 0 ? (
            <p className={styles.muted}>
              لا توجد مصاريف مؤرشفة لهذا اليوم (أو تقفيلات قديمة قبل تفعيل الأرشفة).
            </p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.linesTable}>
                <thead>
                  <tr>
                    <th>التقفيل</th>
                    <th>وقت الأرشفة</th>
                    <th>المبلغ</th>
                    <th>البيان</th>
                    <th>سُجّل بواسطة</th>
                  </tr>
                </thead>
                <tbody>
                  {dayArchivedExpenseRows.map((row) => (
                    <tr key={row.rowKey}>
                      <td>{row.shiftLabel}</td>
                      <td>
                        {row.archivedAt
                          ? new Date(row.archivedAt).toLocaleString("ar-EG", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "—"}
                      </td>
                      <td className={styles.expenseAmountCell}>
                        {formatCurrency(row.amount)}
                      </td>
                      <td>{row.note || "—"}</td>
                      <td>{row.createdByName || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {!loading && reportDate ? (
        <section className={styles.productsPanel}>
          <h3 className={styles.productsPanelTitle}>الأصناف المباعة حسب القسم</h3>
          {loadingDay ? (
            <p className={styles.muted}>
              <FaSpinner className={styles.spinner} aria-hidden />
              جارٍ تحميل فواتير هذا اليوم...
            </p>
          ) : dayInvoices.length === 0 ? (
            <p className={styles.muted}>
              لا توجد فواتير لهذا التاريخ (لا تقفيلات مؤرشفة ولا مبيعات مفتوحة بنفس اليوم).
            </p>
          ) : categoryBlocks.length === 0 ? (
            <p className={styles.muted}>لا توجد بنود في الفواتير.</p>
          ) : (
            <>
              <div className={styles.reportPrintBar}>
                <div className={styles.reportPrintBarTop}>
                  <span
                    className={styles.reportPrintBarTitle}
                    id="report-print-cats-label"
                  >
                    اختر الأقسام للطباعة
                  </span>
                  <div className={styles.reportPrintBarActions}>
                    <button
                      type="button"
                      className={styles.reportPrintQuickBtn}
                      onClick={() =>
                        setReportPrintSelectedCats(
                          new Set(categoryBlocks.map((b) => b.catName))
                        )
                      }
                    >
                      تحديد الكل
                    </button>
                    <button
                      type="button"
                      className={styles.reportPrintQuickBtn}
                      onClick={() => setReportPrintSelectedCats(new Set())}
                    >
                      إلغاء الكل
                    </button>
                    <button
                      type="button"
                      className={styles.reportPrintBtn}
                      onClick={handlePrintReportCategories}
                      disabled={selectedCategoryBlocksForPrint.length === 0}
                    >
                      <FaPrint aria-hidden />
                      طباعة
                    </button>
                  </div>
                </div>
                <p className={styles.reportPrintTotals}>
                  إجمالي المحدد: {formatCurrency(reportPrintSelectedTotals.totalRevenue)}{" "}
                  · كمية: {reportPrintSelectedTotals.totalQty}
                </p>
                {selectedCategoryBlocksForPrint.length === 0 ? (
                  <p className={styles.reportPrintWarn}>
                    اختر قسمًا واحدًا على الأقل للطباعة.
                  </p>
                ) : null}
                <div
                  className={styles.reportPrintChips}
                  role="group"
                  aria-labelledby="report-print-cats-label"
                >
                  {categoryBlocks.map((block) => (
                    <label
                      key={block.catName}
                      className={styles.reportPrintCatLabel}
                    >
                      <input
                        type="checkbox"
                        className={styles.reportPrintCheckbox}
                        checked={reportPrintSelectedCats.has(block.catName)}
                        onChange={() => {
                          setReportPrintSelectedCats((prev) => {
                            const next = new Set(prev);
                            if (next.has(block.catName)) {
                              next.delete(block.catName);
                            } else {
                              next.add(block.catName);
                            }
                            return next;
                          });
                        }}
                      />
                      <span className={styles.reportPrintCatName}>
                        {block.catName}
                      </span>
                      <span className={styles.reportPrintCatMeta}>
                        {formatCurrency(block.revSum)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            <div className={styles.categoryStack}>
              {categoryBlocks.map((block) => (
                <article key={block.catName} className={styles.categoryCard}>
                  <header className={styles.categoryHeader}>
                    <span className={styles.categoryBadge}>{block.catName}</span>
                    <span className={styles.categoryMeta}>
                      {block.rows.length} صنف · {formatCurrency(block.revSum)} · إجمالي
                      الكمية: {block.qtySum}
                    </span>
                  </header>
                  <div className={styles.tableWrap}>
                    <table className={styles.linesTable}>
                      <thead>
                        <tr>
                          <th>النوع</th>
                          <th>الصنف</th>
                          <th>الكمية</th>
                          <th>إجمالي البيع</th>
                        </tr>
                      </thead>
                      <tbody>
                        {block.rows.map((row, idx) => (
                          <tr key={`${block.catName}-${idx}-${row.nameAr}`}>
                            <td>
                              <span
                                className={
                                  row.kind === "drink"
                                    ? styles.kindDrink
                                    : styles.kindProduct
                                }
                              >
                                {row.kind === "drink" ? "مشروب" : "منتج"}
                              </span>
                            </td>
                            <td>{row.nameAr}</td>
                            <td>{row.quantity}</td>
                            <td>{formatCurrency(row.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              ))}
            </div>
            </>
          )}
        </section>
      ) : !loading && !reportDate && closures.length > 0 ? (
        <p className={styles.mutedHint}>
          اختر تاريخاً من الحقل أعلاه لعرض الأصناف المباعة ومجموع مبيعات ذلك اليوم.
        </p>
      ) : null}
    </div>
  );
}

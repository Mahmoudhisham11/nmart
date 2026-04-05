"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getCountFromServer,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import {
  aggregateShiftPaymentTotals,
  printShiftSummary,
} from "@/lib/printShiftSummary";
import {
  FaDollarSign,
  FaChartLine,
  FaExclamationTriangle,
  FaLock,
  FaPrint,
  FaReceipt,
  FaSpinner,
} from "react-icons/fa";
import styles from "./page.module.css";
import { useAuth } from "@/components/AuthContext";

const INVOICE_PAYMENT_FILTER_OPTIONS = [
  { id: "all", label: "الكل" },
  { id: "cash", label: "كاش" },
  { id: "visa", label: "فيزا" },
  { id: "wallet", label: "محفظة" },
  { id: "instapay", label: "انستا باي" },
];

function invoiceMatchesPaymentFilter(inv, filterId) {
  if (filterId === "all") return true;
  const pm = String(inv.paymentMethod ?? "").trim();
  if (filterId === "visa") return pm === "فيزا";
  if (filterId === "wallet") return pm === "محفظة";
  if (filterId === "instapay") return pm === "انستا باي";
  if (filterId === "cash") {
    return pm !== "فيزا" && pm !== "محفظة" && pm !== "انستا باي";
  }
  return true;
}

function paymentMethodDisplayLabel(inv) {
  const pm = String(inv?.paymentMethod ?? "").trim();
  if (pm === "فيزا") return "فيزا";
  if (pm === "محفظة") return "محفظة";
  if (pm === "انستا باي") return "انستا باي";
  return "كاش";
}

export default function HomeDashboardPage() {
  const { user, profile } = useAuth();
  const role = (profile?.role || "").toLowerCase();
  const isOwner = role === "owner";
  const canManageExpenses = isOwner || role === "manager";
  const [todaySales, setTodaySales] = useState(0);
  const [todayProfit, setTodayProfit] = useState(0);
  const [todayExpensesTotal, setTodayExpensesTotal] = useState(0);
  const [todayInvoicesCount, setTodayInvoicesCount] = useState(0);
  const [todayInvoices, setTodayInvoices] = useState([]);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [topProducts, setTopProducts] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [closing, setClosing] = useState(false);
  const [invoiceModal, setInvoiceModal] = useState(null);
  const [invoicePaymentFilter, setInvoicePaymentFilter] = useState("all");

  const [shiftCloseOpen, setShiftCloseOpen] = useState(false);

  const filteredInvoices = useMemo(
    () =>
      (todayInvoices ?? []).filter((inv) =>
        invoiceMatchesPaymentFilter(inv, invoicePaymentFilter)
      ),
    [todayInvoices, invoicePaymentFilter]
  );

  const loadStats = useCallback(async () => {
    const todayDayKey = new Date().toISOString().slice(0, 10);

    try {
      const salesRef = collection(firestore, "sales");
      const salesSnap = await getDocs(salesRef);
      let totalRevenue = 0;
      let totalCost = 0;
      const invoiceRows = [];
      salesSnap.forEach((docSnap) => {
        const data = docSnap.data();
        totalRevenue += data.totalAmount || 0;
        totalCost += data.totalCost || 0;
        invoiceRows.push({
          id: docSnap.id,
          invoiceNumber: data.invoiceNumber || "—",
          totalAmount: data.totalAmount || 0,
          createdAt: data.createdAt || "",
          paymentMethod: data.paymentMethod,
          items: Array.isArray(data.items) ? data.items : [],
        });
      });
      invoiceRows.sort((a, b) =>
        String(b.createdAt).localeCompare(String(a.createdAt))
      );
      setTodaySales(totalRevenue);
      setTodayProfit(totalRevenue - totalCost);
      setTodayInvoicesCount(invoiceRows.length);
      setTodayInvoices(invoiceRows);
    } catch (e) {
      console.error("خطأ في قراءة مبيعات اليوم", e);
    }

    try {
      const expQ = query(
        collection(firestore, "expenses"),
        where("dayKey", "==", todayDayKey)
      );
      const expSnap = await getDocs(expQ);
      let expSum = 0;
      expSnap.forEach((d) => {
        expSum += Number(d.data().amount || 0);
      });
      setTodayExpensesTotal(expSum);
    } catch (e) {
      console.error("خطأ في قراءة مصاريف اليوم", e);
      setTodayExpensesTotal(0);
    }

    try {
      const productsRef = collection(firestore, "products");
      const productsSnap = await getDocs(productsRef);
      const low = [];
      productsSnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (
          typeof data.quantity === "number" &&
          typeof data.lowStockThreshold === "number" &&
          data.quantity <= data.lowStockThreshold
        ) {
          low.push(data);
        }
      });
      setLowStockCount(low.length);
      setLowStockProducts(low.slice(0, 5));
    } catch (e) {
      console.error("خطأ في قراءة المنتجات", e);
    }

    try {
      const bestRef = collection(firestore, "topProducts");
      const bestSnap = await getDocs(bestRef);
      const best = [];
      bestSnap.forEach((docSnap) => best.push(docSnap.data()));
      setTopProducts(best.slice(0, 5));
    } catch (e) {
      // optional collection
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    const onFocus = () => loadStats();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadStats]);

  const formatCurrency = (value) =>
    new Intl.NumberFormat("ar-EG", {
      style: "currency",
      currency: "EGP",
      maximumFractionDigits: 0,
    }).format(value || 0);

  const formatInvoiceTime = (iso) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString("ar-EG", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  };

  /** يضمن عدم تعطل الواجهة إذا كانت وثيقة البيع بدون items أو items ليست مصفوفة */
  const normalizeInvoiceItems = (inv) => {
    if (!inv || typeof inv !== "object") return [];
    const raw = inv.items;
    return Array.isArray(raw) ? raw : [];
  };

  const closeShiftModalOnly = () => {
    if (closing) return;
    setShiftCloseOpen(false);
  };

  const openShiftCloseModal = useCallback(() => {
    if (todayInvoicesCount === 0) return;
    setShiftCloseOpen(true);
  }, [todayInvoicesCount]);

  const shiftPaymentTotals = aggregateShiftPaymentTotals(todayInvoices);

  const handlePrintShiftSummary = () => {
    printShiftSummary({
      salesTotal: todaySales,
      expensesTotal: todayExpensesTotal,
      ...shiftPaymentTotals,
      generatedAt: new Date().toISOString(),
    });
  };

  const handleCloseShift = async () => {
    const nowDate = new Date();
    const dayKey = nowDate.toISOString().slice(0, 10);

    try {
      setClosing(true);
      const salesRef = collection(firestore, "sales");
      const salesSnap = await getDocs(salesRef);
      const saleDocs = [];
      salesSnap.forEach((d) => saleDocs.push(d));
      if (saleDocs.length === 0) {
        return;
      }

      let totalRevenue = 0;
      let totalCost = 0;
      for (const d of saleDocs) {
        const data = d.data();
        totalRevenue += data.totalAmount || 0;
        totalCost += data.totalCost || 0;
      }
      const invoicesCount = saleDocs.length;
      const now = nowDate.toISOString();
      const qTodayShifts = query(
        collection(firestore, "shiftClosures"),
        where("dayKey", "==", dayKey)
      );
      const todayShiftsCountSnap = await getCountFromServer(qTodayShifts);
      const shiftNumber = (todayShiftsCountSnap.data()?.count || 0) + 1;
      const shiftRef = doc(collection(firestore, "shiftClosures"));
      const shiftId = shiftRef.id;

      const stripUndefined = (o) =>
        Object.fromEntries(
          Object.entries(o).filter(([, v]) => v !== undefined)
        );

      /** مصاريف نفس اليوم → أرشفة في shiftClosures/{shiftId}/archivedExpenses ثم حذف من expenses */
      const expQ = query(
        collection(firestore, "expenses"),
        where("dayKey", "==", dayKey)
      );
      const expSnap = await getDocs(expQ);
      const expDocs = [];
      expSnap.forEach((d) => expDocs.push(d));
      let totalExpensesSum = 0;
      for (const d of expDocs) {
        totalExpensesSum += Number(d.data().amount || 0);
      }
      const EXP_CHUNK = 250;
      for (let i = 0; i < expDocs.length; i += EXP_CHUNK) {
        const chunk = expDocs.slice(i, i + EXP_CHUNK);
        const batch = writeBatch(firestore);
        for (const d of chunk) {
          const data = d.data();
          batch.set(
            doc(
              firestore,
              "shiftClosures",
              shiftId,
              "archivedExpenses",
              d.id
            ),
            stripUndefined({
              ...data,
              archivedAt: now,
              originalExpenseId: d.id,
              shiftId,
              closureDayKey: dayKey,
            })
          );
          batch.delete(doc(firestore, "expenses", d.id));
        }
        await batch.commit();
      }

      /** نقل فواتير الشيفت الحالي إلى shiftClosures/{shiftId}/invoices ثم حذفها من sales */
      const CHUNK = 250;
      for (let i = 0; i < saleDocs.length; i += CHUNK) {
        const chunk = saleDocs.slice(i, i + CHUNK);
        const batch = writeBatch(firestore);
        for (const d of chunk) {
          const data = d.data();
          const archiveRef = doc(
            firestore,
            "shiftClosures",
            shiftId,
            "invoices",
            d.id
          );
          batch.set(
            archiveRef,
            stripUndefined({
              ...data,
              archivedAt: now,
              originalSaleId: d.id,
            })
          );
          batch.delete(doc(firestore, "sales", d.id));
        }
        await batch.commit();
      }

      await setDoc(shiftRef, {
        shiftId,
        shiftNumber,
        dayKey,
        shiftLabel: `${dayKey}-S${shiftNumber}`,
        totalRevenue,
        totalCost,
        totalProfit: totalRevenue - totalCost,
        totalExpenses: totalExpensesSum,
        expensesCount: expDocs.length,
        invoicesCount,
        salesArchived: true,
        closedAt: now,
        closedDate: nowDate.toLocaleDateString("ar-EG-u-nu-latn"),
        closedTime: nowDate.toLocaleTimeString("ar-EG-u-nu-latn", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        closedByUid: user?.uid || "",
        closedByName: profile?.displayName || user?.email || "",
      });

      setTodayInvoices([]);
      setTodayInvoicesCount(0);
      setTodaySales(0);
      setTodayProfit(0);
      await loadStats();
      setShiftCloseOpen(false);
    } catch (e) {
      console.error("خطأ في تقفيل الشيفت", e);
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.cards}>
        <div className={styles.card}>
          <div className={styles.cardIcon} style={{ background: "#dbeafe" }}>
            <FaDollarSign style={{ color: "#3b82f6" }} />
          </div>
          <div className={styles.cardTitle}>مبيعات الشيفت الحالي</div>
          <div className={styles.cardValue}>{formatCurrency(todaySales)}</div>
          <div className={styles.cardHint}>إجمالي قيمة فواتير الشيفت المفتوح</div>
          <div className={styles.cardNetBlock}>
            <div className={styles.cardNetLabel}>صافي بعد المصاريف</div>
            <div
              className={
                todaySales - todayExpensesTotal < 0
                  ? `${styles.cardNetValue} ${styles.cardNetValueNegative}`
                  : styles.cardNetValue
              }
            >
              {formatCurrency(todaySales - todayExpensesTotal)}
            </div>
            <div className={styles.cardNetHint}>
              إجمالي الفواتير ناقص مصاريف اليوم (نفس تاريخ التقفيل UTC)
            </div>
          </div>
        </div>
        {isOwner ? (
          <div className={styles.card}>
            <div className={styles.cardIcon} style={{ background: "#dcfce7" }}>
              <FaChartLine style={{ color: "#10b981" }} />
            </div>
            <div className={styles.cardTitle}>ربح الشيفت الحالي</div>
            <div
              className={
                todayProfit - todayExpensesTotal < 0
                  ? `${styles.cardValue} ${styles.cardNetValueNegative}`
                  : styles.cardValue
              }
            >
              {formatCurrency(todayProfit - todayExpensesTotal)}
            </div>
            <div className={styles.cardHint}>
              الإيراد − تكلفة البضاعة − مصاريف اليوم (UTC)
            </div>
          </div>
        ) : null}
        {canManageExpenses ? (
          <div className={styles.card}>
            <div className={styles.cardIcon} style={{ background: "#ffedd5" }}>
              <FaReceipt style={{ color: "#ea580c" }} />
            </div>
            <div className={styles.cardTitle}>مصاريف اليوم</div>
            <div className={styles.cardValue}>
              {formatCurrency(todayExpensesTotal)}
            </div>
            <div className={styles.cardHint}>
              مجموع المصاريف المسجّلة لتاريخ اليوم في النظام — سجّل من صفحة
              المصاريف
            </div>
          </div>
        ) : null}
        <div className={styles.card}>
          <div className={styles.cardIcon} style={{ background: "#e0e7ff" }}>
            <FaChartLine style={{ color: "#6366f1" }} />
          </div>
          <div className={styles.cardTitle}>فواتير الشيفت الحالي</div>
          <div className={styles.cardValue}>{todayInvoicesCount}</div>
          <div className={styles.cardHint}>عدد عمليات البيع من نقطة البيع</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardIcon} style={{ background: "#fee2e2" }}>
            <FaExclamationTriangle style={{ color: "#ef4444" }} />
          </div>
          <div className={styles.cardTitle}>منتجات منخفضة المخزون</div>
          <div className={styles.cardValue}>{lowStockCount}</div>
          <div className={styles.cardHint}>تحتاج إلى إعادة طلب قريبًا</div>
        </div>
      </div>

      <div className={styles.twoColumns}>
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>أهم المنتجات مبيعًا</h2>
          <ul className={styles.list}>
            {(topProducts ?? []).length === 0 && (
              <li style={{ fontSize: 12, color: "#9ca3af" }}>
                لم يتم تسجيل بيانات بعد.
              </li>
            )}
            {(topProducts ?? []).map((p) => (
              <li key={p.productId || p.nameAr} className={styles.listItem}>
                <span>{p.nameAr}</span>
                <span>{p.totalQuantity} وحدة</span>
              </li>
            ))}
          </ul>
        </section>
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>منتجات قريبة من النفاد</h2>
          <ul className={styles.list}>
            {(lowStockProducts ?? []).length === 0 && (
              <li style={{ fontSize: 12, color: "#9ca3af" }}>
                لا توجد منتجات منخفضة المخزون حاليًا.
              </li>
            )}
            {(lowStockProducts ?? []).map((p) => (
              <li key={p.id || p.barcode} className={styles.listItem}>
                <span>{p.nameAr}</span>
                <span>
                  {p.quantity} / {p.lowStockThreshold}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className={`${styles.panel} ${styles.closeDayPanel}`}>
        <div className={styles.panelHeaderRow}>
          <h2 className={styles.panelTitle}>تقفيل الشيفت</h2>
          <button
            type="button"
            className={styles.closeDayButton}
            onClick={() => openShiftCloseModal()}
            disabled={closing || todayInvoicesCount === 0}
            title={todayInvoicesCount === 0 ? "لا توجد فواتير لتقفيل الشيفت" : "تقفيل الشيفت"}
          >
            {closing ? <FaSpinner className={styles.spinner} /> : <FaLock />}
            <span>تقفيل الشيفت</span>
          </button>
        </div>
        <p className={styles.muted}>
          يتم تسجيل ملخص الشيفت الحالي من فواتير نقطة البيع (مجموعة sales) مع
          وقت التقفيل واسم المستخدم، ثم يبدأ شيفت جديد تلقائيًا.
        </p>
        <h3 className={styles.subsectionTitle}>فواتير الشيفت الحالي</h3>
        {(todayInvoices ?? []).length === 0 ? (
          <p className={styles.invoiceEmpty}>لا توجد فواتير مسجّلة في الشيفت الحالي بعد.</p>
        ) : (
          <>
            <div className={styles.invoiceFilterBar}>
              <span className={styles.invoiceFilterLabel} id="invoice-filter-label">
                تصفية حسب طريقة الدفع
              </span>
              <div
                className={styles.invoiceFilterChips}
                role="group"
                aria-labelledby="invoice-filter-label"
              >
                {INVOICE_PAYMENT_FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`${styles.invoiceFilterChip} ${
                      invoicePaymentFilter === opt.id
                        ? styles.invoiceFilterChipActive
                        : ""
                    }`}
                    onClick={() => setInvoicePaymentFilter(opt.id)}
                    aria-pressed={invoicePaymentFilter === opt.id}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {filteredInvoices.length === 0 ? (
              <p className={styles.invoiceEmpty}>
                لا توجد فواتير تطابق طريقة الدفع المختارة.
              </p>
            ) : (
              <>
                <p className={styles.invoiceFilterHint}>
                  عرض {filteredInvoices.length} من أصل{" "}
                  {(todayInvoices ?? []).length} فاتورة
                </p>
                <ul className={styles.invoiceList}>
                  {filteredInvoices.map((inv) => (
                    <li key={inv.id} className={styles.invoiceListItem}>
                      <button
                        type="button"
                        className={styles.invoiceItem}
                        onClick={() =>
                          setInvoiceModal({
                            ...inv,
                            items: normalizeInvoiceItems(inv),
                          })
                        }
                      >
                        <div className={styles.invoiceLeft}>
                          <div className={styles.invoiceIcon}>
                            <FaDollarSign />
                          </div>
                          <div className={styles.invoiceMeta}>
                            <span className={styles.invoiceNumber}>
                              فاتورة {inv.invoiceNumber}
                            </span>
                            <span className={styles.invoiceSub}>
                              {formatInvoiceTime(inv.createdAt)} ·{" "}
                              {paymentMethodDisplayLabel(inv)}
                            </span>
                          </div>
                        </div>
                        <span className={styles.invoiceTotal}>
                          {formatCurrency(inv.totalAmount)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </section>

      {invoiceModal ? (
        <div
          className={styles.modalOverlay}
          onClick={() => setInvoiceModal(null)}
        >
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="invoice-detail-title"
          >
            <div className={styles.modalHeader}>
              <h3 id="invoice-detail-title" className={styles.modalTitle}>
                فاتورة {invoiceModal.invoiceNumber}
              </h3>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setInvoiceModal(null)}
                aria-label="إغلاق"
              >
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.invoiceModalMeta}>
                {formatInvoiceTime(invoiceModal.createdAt)} ·{" "}
                {paymentMethodDisplayLabel(invoiceModal)} · الإجمالي{" "}
                {formatCurrency(invoiceModal.totalAmount)}
              </p>
              {(() => {
                const modalItems = normalizeInvoiceItems(invoiceModal);
                return modalItems.length === 0 ? (
                <p className={styles.invoiceEmpty}>لا توجد بنود في هذه الفاتورة.</p>
              ) : (
                <div className={styles.invoiceDetailTableWrap}>
                  <table className={styles.invoiceDetailTable}>
                    <thead>
                      <tr>
                        <th>الصنف</th>
                        <th>الكمية</th>
                        <th>سعر الوحدة</th>
                        <th>الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalItems.map((line, idx) => {
                        const isDrink = line.itemType === "drink";
                        const name =
                          line.nameAr || line.name || (isDrink ? "مشروب" : "—");
                        const qty = line.quantity ?? 0;
                        const unit = line.unitPrice ?? 0;
                        const lineTotal =
                          line.total != null
                            ? line.total
                            : qty * unit;
                        return (
                          <tr key={idx}>
                            <td>
                              {name}
                              {isDrink ? (
                                <span className={styles.lineKindBadge}>مشروب</span>
                              ) : null}
                            </td>
                            <td>{qty}</td>
                            <td>{formatCurrency(unit)}</td>
                            <td>{formatCurrency(lineTotal)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
              })()}
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.modalButtonSecondary}
                onClick={() => setInvoiceModal(null)}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {shiftCloseOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => !closing && closeShiftModalOnly()}
        >
          <div
            className={`${styles.modal} ${styles.shiftCloseModal}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>ملخص تقفيل الشيفت</h3>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => !closing && closeShiftModalOnly()}
                disabled={closing}
              >
                ×
              </button>
            </div>
            <div className={`${styles.modalBody} ${styles.shiftCloseBody}`}>
              <p className={styles.shiftCloseHint}>
                ما يلي هو نفس ما سيظهر عند الطباعة. عند التأكيد تُؤرشف الفواتير
                ويبدأ شيفت جديد.
              </p>
              <table className={styles.shiftSummaryPrintTable}>
                <tbody>
                  <tr>
                    <th scope="row">إجمالي المبيعات</th>
                    <td>{formatCurrency(todaySales)}</td>
                  </tr>
                  <tr>
                    <th scope="row">إجمالي المصاريف</th>
                    <td>{formatCurrency(todayExpensesTotal)}</td>
                  </tr>
                  <tr>
                    <th scope="row">إجمالي الكاش</th>
                    <td>{formatCurrency(shiftPaymentTotals.totalCash)}</td>
                  </tr>
                  <tr>
                    <th scope="row">إجمالي الفيزا</th>
                    <td>{formatCurrency(shiftPaymentTotals.totalVisa)}</td>
                  </tr>
                  <tr>
                    <th scope="row">إجمالي المحفظة</th>
                    <td>{formatCurrency(shiftPaymentTotals.totalWallet)}</td>
                  </tr>
                  <tr>
                    <th scope="row">إجمالي انستا باي</th>
                    <td>{formatCurrency(shiftPaymentTotals.totalInstapay)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className={`${styles.modalFooter} ${styles.shiftCloseFooter}`}>
              <button
                type="button"
                className={styles.modalButtonSecondary}
                onClick={closeShiftModalOnly}
                disabled={closing}
              >
                إلغاء
              </button>
              <button
                type="button"
                className={styles.modalButtonPrint}
                onClick={handlePrintShiftSummary}
                disabled={closing}
              >
                <FaPrint aria-hidden />
                طباعة
              </button>
              <button
                type="button"
                className={styles.modalButtonDanger}
                onClick={async () => {
                  if (closing) return;
                  await handleCloseShift();
                }}
                disabled={closing}
              >
                {closing ? (
                  <>
                    <FaSpinner className={styles.spinner} />
                    <span>جارٍ التقفيل...</span>
                  </>
                ) : (
                  "تأكيد التقفيل"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import {
  FaDollarSign,
  FaChartLine,
  FaExclamationTriangle,
  FaLock,
  FaSpinner,
} from "react-icons/fa";
import styles from "./page.module.css";
import { useAuth } from "@/components/AuthContext";

export default function HomeDashboardPage() {
  const { user, profile } = useAuth();
  const isOwner = (profile?.role || "").toLowerCase() === "owner";
  const [todaySales, setTodaySales] = useState(0);
  const [todayProfit, setTodayProfit] = useState(0);
  const [todayInvoicesCount, setTodayInvoicesCount] = useState(0);
  const [todayInvoices, setTodayInvoices] = useState([]);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [topProducts, setTopProducts] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [dayClosed, setDayClosed] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [invoiceModal, setInvoiceModal] = useState(null);

  useEffect(() => {
    const loadStats = async () => {
      const today = new Date();
      const startOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );
      const dayKey = startOfDay.toISOString().slice(0, 10);

      try {
        const salesRef = collection(firestore, "sales");
        const salesQuery = query(
          salesRef,
          where("createdAt", ">=", startOfDay.toISOString())
        );
        const salesSnap = await getDocs(salesQuery);
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

      try {
        const closeRef = doc(firestore, "dayClosures", dayKey);
        const closeSnap = await getDoc(closeRef);
        setDayClosed(closeSnap.exists());
      } catch (e) {
        // ignore
      }
    };

    loadStats();
  }, []);

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

  const handleCloseDay = async () => {
    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const dayKey = startOfDay.toISOString().slice(0, 10);

    try {
      setClosing(true);
      const closeRef = doc(firestore, "dayClosures", dayKey);
      const existing = await getDoc(closeRef);
      if (existing.exists()) {
        setDayClosed(true);
        return;
      }

      const salesRef = collection(firestore, "sales");
      const salesQuery = query(
        salesRef,
        where("createdAt", ">=", startOfDay.toISOString())
      );
      const salesSnap = await getDocs(salesQuery);
      const saleDocs = [];
      salesSnap.forEach((d) => saleDocs.push(d));

      let totalRevenue = 0;
      let totalCost = 0;
      for (const d of saleDocs) {
        const data = d.data();
        totalRevenue += data.totalAmount || 0;
        totalCost += data.totalCost || 0;
      }
      const invoicesCount = saleDocs.length;
      const now = new Date().toISOString();

      const stripUndefined = (o) =>
        Object.fromEntries(
          Object.entries(o).filter(([, v]) => v !== undefined)
        );

      /** نقل كل فاتورة اليوم إلى dayClosures/{dayKey}/invoices ثم حذفها من sales (دفعات 250 فاتورة = 500 عملية كحد أقصى) */
      const CHUNK = 250;
      for (let i = 0; i < saleDocs.length; i += CHUNK) {
        const chunk = saleDocs.slice(i, i + CHUNK);
        const batch = writeBatch(firestore);
        for (const d of chunk) {
          const data = d.data();
          const archiveRef = doc(
            firestore,
            "dayClosures",
            dayKey,
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

      await setDoc(closeRef, {
        dayKey,
        totalRevenue,
        totalCost,
        totalProfit: totalRevenue - totalCost,
        invoicesCount,
        salesArchived: true,
        closedAt: now,
        closedBy: user?.uid || "",
        closedByName: profile?.displayName || "",
      });

      setDayClosed(true);
      setTodayInvoices([]);
      setTodayInvoicesCount(0);
      setTodaySales(0);
      setTodayProfit(0);
    } catch (e) {
      console.error("خطأ في تقفيل اليوم", e);
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
          <div className={styles.cardTitle}>مبيعات اليوم</div>
          <div className={styles.cardValue}>{formatCurrency(todaySales)}</div>
          <div className={styles.cardHint}>إجمالي قيمة فواتير نقطة البيع اليوم</div>
        </div>
        {isOwner ? (
          <div className={styles.card}>
            <div className={styles.cardIcon} style={{ background: "#dcfce7" }}>
              <FaChartLine style={{ color: "#10b981" }} />
            </div>
            <div className={styles.cardTitle}>ربح اليوم</div>
            <div className={styles.cardValue}>{formatCurrency(todayProfit)}</div>
            <div className={styles.cardHint}>الإيراد - تكلفة البضاعة المباعة اليوم</div>
          </div>
        ) : null}
        <div className={styles.card}>
          <div className={styles.cardIcon} style={{ background: "#e0e7ff" }}>
            <FaChartLine style={{ color: "#6366f1" }} />
          </div>
          <div className={styles.cardTitle}>فواتير اليوم</div>
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
          <h2 className={styles.panelTitle}>تقفيل اليوم</h2>
          <button
            type="button"
            className={`${styles.closeDayButton} ${dayClosed ? styles.closeDayButtonDisabled : ""}`}
            onClick={() => setShowCloseConfirm(true)}
            disabled={dayClosed || closing}
            title={dayClosed ? "تم تقفيل اليوم بالفعل" : "تقفيل اليوم"}
          >
            {closing ? <FaSpinner className={styles.spinner} /> : <FaLock />}
            <span>{dayClosed ? "تم تقفيل اليوم" : "تقفيل اليوم"}</span>
          </button>
        </div>
        <p className={styles.muted}>
          يتم تسجيل ملخص اليوم من فواتير نقطة البيع (مجموعة sales). اضغط على
          فاتورة لعرض المنتجات.
        </p>
        <h3 className={styles.subsectionTitle}>فواتير اليوم</h3>
        {(todayInvoices ?? []).length === 0 ? (
          <p className={styles.invoiceEmpty}>لا توجد فواتير مسجّلة اليوم بعد.</p>
        ) : (
          <ul className={styles.invoiceList}>
            {(todayInvoices ?? []).map((inv) => (
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
                        {formatInvoiceTime(inv.createdAt)}
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
                {formatInvoiceTime(invoiceModal.createdAt)} · الإجمالي{" "}
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

      {showCloseConfirm && (
        <div
          className={styles.modalOverlay}
          onClick={() => !closing && setShowCloseConfirm(false)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>تأكيد تقفيل اليوم</h3>
              <button
                className={styles.modalClose}
                onClick={() => !closing && setShowCloseConfirm(false)}
                disabled={closing}
              >
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalText}>
                هل أنت متأكد أنك تريد تقفيل اليوم؟
                <br />
                بعد التقفيل لن تتمكن من تنفيذ مبيعات جديدة اليوم.
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button
                className={styles.modalButtonSecondary}
                onClick={() => !closing && setShowCloseConfirm(false)}
                disabled={closing}
              >
                إلغاء
              </button>
              <button
                className={styles.modalButtonDanger}
                onClick={async () => {
                  if (closing) return;
                  await handleCloseDay();
                  setShowCloseConfirm(false);
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

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
} from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import { 
  FaDollarSign, 
  FaChartLine, 
  FaBox, 
  FaExclamationTriangle,
  FaEllipsisV,
  FaReceipt,
  FaLock,
  FaSpinner
} from "react-icons/fa";
import styles from "./page.module.css";
import { useAuth } from "@/components/AuthContext";

export default function HomeDashboardPage() {
  const { user, profile } = useAuth();
  const [todaySales, setTodaySales] = useState(0);
  const [todayProfit, setTodayProfit] = useState(0);
  const [productsCount, setProductsCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [topProducts, setTopProducts] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [todayInvoices, setTodayInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [dayClosed, setDayClosed] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  useEffect(() => {
    const loadStats = async () => {
      const today = new Date();
      const startOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );
      const dayKey = startOfDay.toISOString().slice(0, 10); // YYYY-MM-DD

      try {
        // مبيعات اليوم
        const salesRef = collection(firestore, "sales");
        const salesQuery = query(
          salesRef,
          where("createdAt", ">=", startOfDay.toISOString())
        );
        const salesSnap = await getDocs(salesQuery);
        let totalRevenue = 0;
        let totalCost = 0;
        const invoices = [];
        salesSnap.forEach((docSnap) => {
          const data = docSnap.data();
          totalRevenue += data.totalAmount || 0;
          totalCost += data.totalCost || 0;
          invoices.push({
            id: docSnap.id,
            invoiceNumber: data.invoiceNumber || "بدون رقم",
            totalAmount: data.totalAmount || 0,
            createdAt: data.createdAt,
            createdBy: data.createdBy,
            itemsCount: Array.isArray(data.items) ? data.items.length : 0,
          });
        });
        setTodaySales(totalRevenue);
        setTodayProfit(totalRevenue - totalCost);
        // ترتيب محلي (الأحدث أولاً)
        invoices.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        setTodayInvoices(invoices.slice(0, 15));
      } catch (e) {
        console.error("خطأ في قراءة مبيعات اليوم", e);
      }

      try {
        // المنتجات + المخزون المنخفض
        const productsRef = collection(firestore, "products");
        const productsSnap = await getDocs(productsRef);
        const low = [];
        const list = [];
        productsSnap.forEach((docSnap) => {
          const data = docSnap.data();
          list.push(data);
          if (
            typeof data.quantity === "number" &&
            typeof data.lowStockThreshold === "number" &&
            data.quantity <= data.lowStockThreshold
          ) {
            low.push(data);
          }
        });
        setProductsCount(list.length);
        setLowStockCount(low.length);
        setLowStockProducts(low.slice(0, 5));
      } catch (e) {
        console.error("خطأ في قراءة المنتجات", e);
      }

      try {
        // المنتجات الأعلى مبيعًا (من مجموعة topProducts إن وجدت)
        const bestRef = collection(firestore, "topProducts");
        const bestSnap = await getDocs(bestRef);
        const best = [];
        bestSnap.forEach((docSnap) => best.push(docSnap.data()));
        setTopProducts(best.slice(0, 5));
      } catch (e) {
        // المجموعة اختيارية، لا تعتبر خطأ قاتل
      }

      // حالة تقفيل اليوم
      try {
        const closeRef = doc(firestore, "dayClosures", dayKey);
        const closeSnap = await getDoc(closeRef);
        setDayClosed(closeSnap.exists());
      } catch (e) {
        // تجاهل
      }
    };

    loadStats();
  }, []);

  const formatTime = (dateString) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    return d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
  };

  const formatCurrency = (value) =>
    new Intl.NumberFormat("ar-EG", {
      style: "currency",
      currency: "EGP",
      maximumFractionDigits: 0,
    }).format(value || 0);

  const handleCloseDay = async () => {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dayKey = startOfDay.toISOString().slice(0, 10);

    try {
      setClosing(true);
      // منع التقفيل مرتين
      const closeRef = doc(firestore, "dayClosures", dayKey);
      const existing = await getDoc(closeRef);
      if (existing.exists()) {
        setDayClosed(true);
        return;
      }

      // جلب مبيعات اليوم لحساب الملخص
      setLoadingInvoices(true);
      const salesRef = collection(firestore, "sales");
      const salesQuery = query(salesRef, where("createdAt", ">=", startOfDay.toISOString()));
      const salesSnap = await getDocs(salesQuery);
      let totalRevenue = 0;
      let totalCost = 0;
      let invoicesCount = 0;
      salesSnap.forEach((d) => {
        const data = d.data();
        totalRevenue += data.totalAmount || 0;
        totalCost += data.totalCost || 0;
        invoicesCount += 1;
      });

      const now = new Date().toISOString();
      await setDoc(closeRef, {
        dayKey,
        totalRevenue,
        totalCost,
        totalProfit: totalRevenue - totalCost,
        invoicesCount,
        closedAt: now,
        closedBy: user?.uid || "",
        closedByName: profile?.displayName || "",
      });

      setDayClosed(true);
    } catch (e) {
      console.error("خطأ في تقفيل اليوم", e);
    } finally {
      setLoadingInvoices(false);
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
          <div className={styles.cardHint}>إجمالي قيمة الفواتير اليوم</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardIcon} style={{ background: "#dcfce7" }}>
            <FaChartLine style={{ color: "#10b981" }} />
          </div>
          <div className={styles.cardTitle}>ربح اليوم</div>
          <div className={styles.cardValue}>{formatCurrency(todayProfit)}</div>
          <div className={styles.cardHint}>
            الإيراد - تكلفة البضاعة المباعة اليوم
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardIcon} style={{ background: "#fef3c7" }}>
            <FaBox style={{ color: "#f59e0b" }} />
          </div>
          <div className={styles.cardTitle}>عدد المنتجات</div>
          <div className={styles.cardValue}>{productsCount}</div>
          <div className={styles.cardHint}>إجمالي المنتجات النشطة</div>
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
            {topProducts.length === 0 && (
              <li style={{ fontSize: 12, color: "#9ca3af" }}>
                لم يتم تسجيل بيانات بعد.
              </li>
            )}
            {topProducts.map((p) => (
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
            {lowStockProducts.length === 0 && (
              <li style={{ fontSize: 12, color: "#9ca3af" }}>
                لا توجد منتجات منخفضة المخزون حاليًا.
              </li>
            )}
            {lowStockProducts.map((p) => (
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

      <div className={styles.twoColumns}>
        <section className={`${styles.panel} ${styles.fullWidth}`}>
          <div className={styles.panelHeaderRow}>
            <h2 className={styles.panelTitle}>فواتير بيع اليوم</h2>
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
          <ul className={styles.invoiceList}>
            {todayInvoices.length === 0 && (
              <li className={styles.invoiceEmpty}>لا توجد فواتير بيع اليوم.</li>
            )}
            {todayInvoices.map((inv) => (
              <li key={inv.id} className={styles.invoiceItem}>
                <div className={styles.invoiceLeft}>
                  <div className={styles.invoiceIcon}>
                    <FaReceipt />
                  </div>
                  <div className={styles.invoiceMeta}>
                    <div className={styles.invoiceNumber}>{inv.invoiceNumber}</div>
                    <div className={styles.invoiceSub}>
                      <span>عدد المنتجات: {inv.itemsCount}</span>
                      <span className={styles.dot}>•</span>
                      <span>الوقت: {formatTime(inv.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <div className={styles.invoiceTotal}>{formatCurrency(inv.totalAmount)}</div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Close Day Confirm Modal */}
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



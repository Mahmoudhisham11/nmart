"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import { FaCalendarAlt, FaDollarSign, FaSpinner } from "react-icons/fa";
import styles from "./page.module.css";

function normalizeInvoiceItems(inv) {
  if (!inv || typeof inv !== "object") return [];
  const raw = inv.items;
  return Array.isArray(raw) ? raw : [];
}

export default function DayClosuresPage() {
  const [closures, setClosures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [selectedDayKey, setSelectedDayKey] = useState(null);
  const [dayInvoices, setDayInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [invoiceModal, setInvoiceModal] = useState(null);

  const loadClosures = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const snap = await getDocs(collection(firestore, "dayClosures"));
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => String(b.dayKey || b.id).localeCompare(String(a.dayKey || a.id)));
      setClosures(list);
    } catch (e) {
      console.error(e);
      setError("تعذر تحميل تقفيلات الأيام.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClosures();
  }, [loadClosures]);

  const filteredClosures = useMemo(() => {
    if (!dateFilter) return closures;
    return closures.filter(
      (c) => (c.dayKey || c.id) === dateFilter
    );
  }, [closures, dateFilter]);

  useEffect(() => {
    if (loading) return;
    const list = filteredClosures;
    if (list.length === 0) {
      setSelectedDayKey(null);
      return;
    }
    const stillValid =
      selectedDayKey &&
      list.some((c) => (c.dayKey || c.id) === selectedDayKey);
    if (!stillValid) {
      setSelectedDayKey(list[0].dayKey || list[0].id);
    }
  }, [loading, filteredClosures, selectedDayKey]);

  const selectedClosure = useMemo(
    () => closures.find((c) => (c.dayKey || c.id) === selectedDayKey) || null,
    [closures, selectedDayKey]
  );

  const loadDayInvoices = useCallback(async (dayKey) => {
    if (!dayKey) return;
    setLoadingInvoices(true);
    setDayInvoices([]);
    try {
      const invCol = collection(
        firestore,
        "dayClosures",
        dayKey,
        "invoices"
      );
      const snap = await getDocs(invCol);
      const rows = [];
      snap.forEach((d) =>
        rows.push({
          id: d.id,
          ...d.data(),
          items: Array.isArray(d.data().items) ? d.data().items : [],
        })
      );
      rows.sort((a, b) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
      );
      setDayInvoices(rows);
    } catch (e) {
      console.error(e);
      setDayInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDayKey) loadDayInvoices(selectedDayKey);
  }, [selectedDayKey, loadDayInvoices]);

  const formatCurrency = (value) =>
    new Intl.NumberFormat("ar-EG", {
      style: "currency",
      currency: "EGP",
      maximumFractionDigits: 0,
    }).format(value || 0);

  const formatInvoiceTime = (iso) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("ar-EG", {
        dateStyle: "short",
        timeStyle: "short",
      });
    } catch {
      return "—";
    }
  };

  return (
    <div className={styles.wrapper}>
      <section className={styles.card}>
        <h2 className={styles.title}>تقفيلات الأيام</h2>
        <p className={styles.muted}>
          اختر يومًا لعرض الفواتير المؤرشفة بعد التقفيل. الفواتير تُنقل من
          مجموعة المبيعات الحالية إلى أرشيف كل يوم عند التقفيل.
        </p>

        <div className={styles.filterRow}>
          <label className={styles.dateLabel} htmlFor="closure-date-filter">
            <FaCalendarAlt className={styles.dateIcon} aria-hidden />
            <span>تصفية بالتاريخ</span>
          </label>
          <div className={styles.dateInputs}>
            <input
              id="closure-date-filter"
              type="date"
              className={styles.dateInput}
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
            {dateFilter ? (
              <button
                type="button"
                className={styles.clearDateBtn}
                onClick={() => setDateFilter("")}
              >
                عرض كل الأيام
              </button>
            ) : null}
          </div>
        </div>

        {error ? <p className={styles.error}>{error}</p> : null}
        {loading ? (
          <p className={styles.muted}>
            <FaSpinner className={styles.spinner} /> جارٍ التحميل...
          </p>
        ) : null}

        {!loading && closures.length === 0 ? (
          <p className={styles.muted}>لا توجد تقفيلات مسجّلة بعد.</p>
        ) : null}

        {!loading && closures.length > 0 && filteredClosures.length === 0 ? (
          <p className={styles.muted}>لا توجد تقفيلة للتاريخ المحدد.</p>
        ) : null}

        {!loading && filteredClosures.length > 0 ? (
          <div className={styles.layout}>
            <div className={styles.listPane}>
              <ul className={styles.dayList}>
                {filteredClosures.map((c) => {
                  const key = c.dayKey || c.id;
                  const active = selectedDayKey === key;
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        className={`${styles.dayBtn} ${active ? styles.dayBtnActive : ""}`}
                        onClick={() => setSelectedDayKey(key)}
                      >
                        <span className={styles.dayKey}>{key}</span>
                        <span className={styles.dayMeta}>
                          {formatCurrency(c.totalRevenue)} · {c.invoicesCount ?? 0}{" "}
                          فاتورة
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className={styles.detailPane}>
              {!selectedDayKey ? (
                <p className={styles.muted}>اختر يومًا من القائمة.</p>
              ) : selectedClosure ? (
                <>
                  <div className={styles.detailHeader}>
                    <h3 className={styles.detailTitle}>يوم {selectedClosure.dayKey || selectedClosure.id}</h3>
                    <div className={styles.summaryGrid}>
                      <div className={styles.summaryChip}>
                        إجمالي المبيعات:{" "}
                        <strong>{formatCurrency(selectedClosure.totalRevenue)}</strong>
                      </div>
                      <div className={styles.summaryChip}>
                        الربح:{" "}
                        <strong>
                          {formatCurrency(
                            selectedClosure.totalProfit ??
                              (selectedClosure.totalRevenue || 0) -
                                (selectedClosure.totalCost || 0)
                          )}
                        </strong>
                      </div>
                      <div className={styles.summaryChip}>
                        عدد الفواتير:{" "}
                        <strong>{selectedClosure.invoicesCount ?? dayInvoices.length}</strong>
                      </div>
                      <div className={styles.summaryChip}>
                        أُقفل في:{" "}
                        {selectedClosure.closedAt
                          ? formatInvoiceTime(selectedClosure.closedAt)
                          : "—"}
                      </div>
                    </div>
                  </div>

                  <h4 className={styles.subTitle}>فواتير اليوم (أرشيف)</h4>
                  {loadingInvoices ? (
                    <p className={styles.muted}>
                      <FaSpinner className={styles.spinner} /> جارٍ تحميل الفواتير...
                    </p>
                  ) : dayInvoices.length === 0 ? (
                    <p className={styles.muted}>
                      لا توجد فواتير مؤرشفة لهذا اليوم (تقفيل قديم قبل تفعيل
                      الأرشيف، أو لم تُسجّل مبيعات).
                    </p>
                  ) : (
                    <ul className={styles.invoiceList}>
                      {dayInvoices.map((inv) => (
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
                                  فاتورة {inv.invoiceNumber || "—"}
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
                </>
              ) : null}
            </div>
          </div>
        ) : null}
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
          >
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
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
                            line.nameAr ||
                            line.name ||
                            (isDrink ? "مشروب" : "—");
                          const qty = line.quantity ?? 0;
                          const unit = line.unitPrice ?? 0;
                          const lineTotal =
                            line.total != null ? line.total : qty * unit;
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
    </div>
  );
}

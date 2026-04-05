"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import { FaBoxes, FaSearch, FaSpinner } from "react-icons/fa";
import styles from "./page.module.css";

function addSoldFromInvoice(data, soldMap) {
  const items = Array.isArray(data?.items) ? data.items : [];
  for (const it of items) {
    if (it?.itemType === "drink") continue;
    const pid = it?.productId;
    if (!pid) continue;
    const q = Number(it.quantity || 0);
    if (!Number.isFinite(q) || q <= 0) continue;
    soldMap.set(pid, (soldMap.get(pid) || 0) + q);
  }
}

function shiftDocId(closure) {
  return String(closure?.shiftId || closure?.id || "");
}

export default function InventoryPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const soldMap = new Map();

      const [productsSnap, salesSnap, closuresSnap] = await Promise.all([
        getDocs(collection(firestore, "products")),
        getDocs(collection(firestore, "sales")),
        getDocs(collection(firestore, "shiftClosures")),
      ]);

      salesSnap.forEach((d) => addSoldFromInvoice(d.data(), soldMap));

      const closures = [];
      closuresSnap.forEach((d) => closures.push({ id: d.id, ...d.data() }));

      const invoiceSnaps = await Promise.all(
        closures.map((c) => {
          const sid = shiftDocId(c);
          if (!sid) return Promise.resolve(null);
          return getDocs(
            collection(firestore, "shiftClosures", sid, "invoices")
          );
        })
      );

      for (const snap of invoiceSnaps) {
        if (!snap) continue;
        snap.forEach((d) => addSoldFromInvoice(d.data(), soldMap));
      }

      const products = [];
      productsSnap.forEach((d) => products.push({ id: d.id, ...d.data() }));
      products.sort((a, b) =>
        String(a.nameAr || a.name || "").localeCompare(
          String(b.nameAr || b.name || ""),
          "ar"
        )
      );

      const merged = products.map((p) => {
        const remaining =
          typeof p.quantity === "number"
            ? p.quantity
            : Number(p.quantity || 0) || 0;
        return {
          id: p.id,
          nameAr: p.nameAr || p.name || "—",
          barcode: String(p.barcode || "").trim(),
          category: String(p.category || "").trim(),
          sold: soldMap.get(p.id) ?? 0,
          remaining,
        };
      });

      setRows(merged);
    } catch (e) {
      console.error(e);
      setError("تعذر تحميل بيانات الجرد.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const categories = useMemo(() => {
    const set = new Set();
    for (const r of rows) {
      if (r.category) set.add(r.category);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ar"));
  }, [rows]);

  const hasNoCategory = useMemo(
    () => rows.some((r) => !r.category),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const needle = searchQuery.trim();
    const lowerNeedle = needle.toLowerCase();

    return rows.filter((r) => {
      if (categoryFilter === "__no_category__") {
        if (r.category) return false;
      } else if (categoryFilter) {
        if (r.category !== categoryFilter) return false;
      }

      if (!needle) return true;
      const parts = [
        r.nameAr,
        r.barcode,
        r.category,
      ].map((x) => String(x || ""));
      return parts.some(
        (s) =>
          s.includes(needle) ||
          s.toLowerCase().includes(lowerNeedle)
      );
    });
  }, [rows, searchQuery, categoryFilter]);

  const formatQty = (n) =>
    new Intl.NumberFormat("ar-EG-u-nu-latn", {
      maximumFractionDigits: 0,
    }).format(Number(n) || 0);

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <h1 className={styles.title}>
          <FaBoxes className={styles.titleIcon} aria-hidden />
          الجرد
        </h1>
        <p className={styles.muted}>
          عرض كل منتجات المخزون: إجمالي المباع من الفواتير (الشيفت المفتوح +
          المؤرشفة) والكمية المتبقية حاليًا. يمكنك البحث أو اختيار قسم.
        </p>
        <p className={styles.hintNote}>
          إذا عدّلت الكمية يدويًا من صفحة المنتجات، قد لا يتطابق مجموع «المباع +
          المتبقي» مع رصيد سابق — الأرقام مبنية على الفواتير والمخزون الحالي.
        </p>

        <div className={styles.filterRow}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="inv-search">
              <FaSearch className={styles.fieldIcon} aria-hidden />
              بحث
            </label>
            <input
              id="inv-search"
              type="search"
              className={styles.textInput}
              placeholder="اسم المنتج أو الباركود…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="inv-category">
              القسم
            </label>
            <select
              id="inv-category"
              className={styles.select}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              disabled={loading}
            >
              <option value="">الكل</option>
              {hasNoCategory ? (
                <option value="__no_category__">بدون قسم</option>
              ) : null}
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? <p className={styles.error}>{error}</p> : null}

        {loading ? (
          <div className={styles.loadingRow}>
            <FaSpinner className={styles.spinner} aria-hidden />
            <span>جارٍ تحميل البيانات...</span>
          </div>
        ) : filteredRows.length === 0 ? (
          <p className={styles.empty}>لا توجد منتجات تطابق الفلتر الحالي.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>المنتج</th>
                  <th>الباركود</th>
                  <th>القسم</th>
                  <th>المباع</th>
                  <th>المتبقي</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
                  <tr key={r.id}>
                    <td className={styles.nameCell}>{r.nameAr}</td>
                    <td>{r.barcode || "—"}</td>
                    <td>{r.category || "—"}</td>
                    <td className={styles.numCell}>{formatQty(r.sold)}</td>
                    <td className={styles.numCell}>{formatQty(r.remaining)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && rows.length > 0 ? (
          <p className={styles.footerMeta}>
            عرض {formatQty(filteredRows.length)} من {formatQty(rows.length)}{" "}
            منتجًا
          </p>
        ) : null}
      </div>
    </div>
  );
}

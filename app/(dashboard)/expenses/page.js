"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import { useAuth } from "@/components/AuthContext";
import { FaSpinner, FaTrash } from "react-icons/fa";
import styles from "./page.module.css";

export default function ExpensesPage() {
  const { user, profile } = useAuth();
  const role = (profile?.role || "").toLowerCase();
  const canManage = role === "owner" || role === "manager";

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const dayKey = () => new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const dk = dayKey();
      const q = query(
        collection(firestore, "expenses"),
        where("dayKey", "==", dk)
      );
      const snap = await getDocs(q);
      const rows = [];
      snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
      rows.sort((a, b) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
      );
      setList(rows);
    } catch (e) {
      console.error(e);
      setError("تعذر تحميل المصاريف.");
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    load();
  }, [load]);

  const formatCurrency = (value) =>
    new Intl.NumberFormat("ar-EG", {
      style: "currency",
      currency: "EGP",
      maximumFractionDigits: 0,
    }).format(value || 0);

  const formatTime = (iso) => {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const n = Number(String(amount).replace(/,/g, "."));
    if (!Number.isFinite(n) || n <= 0) {
      setError("أدخل مبلغاً صحيحاً أكبر من صفر.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const now = new Date().toISOString();
      await addDoc(collection(firestore, "expenses"), {
        amount: n,
        note: String(note || "").trim(),
        createdAt: now,
        dayKey: dayKey(),
        createdByUid: user?.uid || "",
        createdByName: profile?.displayName || user?.email || "",
      });
      setAmount("");
      setNote("");
      await load();
    } catch (err) {
      console.error(err);
      setError("تعذر حفظ المصروف. تحقق من صلاحيات Firestore.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!canManage || !id) return;
    if (!window.confirm("حذف هذا المصروف؟")) return;
    try {
      await deleteDoc(doc(firestore, "expenses", id));
      await load();
    } catch (err) {
      console.error(err);
      setError("تعذر حذف المصروف.");
    }
  };

  if (!canManage) {
    return (
      <div className={styles.denied}>
        لا تملك صلاحية الوصول إلى هذه الصفحة.
      </div>
    );
  }

  const total = list.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div className={styles.wrapper}>
      <section className={styles.card}>
        <h1 className={styles.title}>المصاريف</h1>
        <p className={styles.muted}>
          تسجيل مصاريف اليوم (تاريخ UTC {dayKey()} — نفس منطق التقفيل في النظام).
          تظهر في لوحة التحكم وتُخصم من صافي المبيعات والربح. عند{" "}
          <strong>تقفيل الشيفت</strong> تُنقل كل مصاريف هذا اليوم إلى أرشيف التقفيل
          وتُحذف من هنا، ويمكن مراجعتها من صفحة التقارير باختيار التاريخ.
        </p>

        {error ? <p className={styles.error}>{error}</p> : null}

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="exp-amount">
              المبلغ (جنيه)
            </label>
            <input
              id="exp-amount"
              className={styles.input}
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="مثال: 150"
              disabled={submitting}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="exp-note">
              البيان / الملاحظة
            </label>
            <textarea
              id="exp-note"
              className={styles.textarea}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="مثال: كهرباء، نقل، صيانة..."
              disabled={submitting}
            />
          </div>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <FaSpinner className={styles.spinner} aria-hidden />
                جارٍ الحفظ...
              </>
            ) : (
              "تسجيل المصروف"
            )}
          </button>
        </form>
      </section>

      <section className={styles.card}>
        <h2 className={styles.title}>مصاريف اليوم</h2>
        <p className={styles.muted}>
          الإجمالي: <strong>{formatCurrency(total)}</strong> · {list.length}{" "}
          عملية
        </p>

        {loading ? (
          <p className={styles.muted}>
            <FaSpinner className={styles.spinner} aria-hidden /> جارٍ التحميل...
          </p>
        ) : list.length === 0 ? (
          <p className={styles.empty}>لا توجد مصاريف مسجّلة لهذا اليوم بعد.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>الوقت</th>
                  <th>المبلغ</th>
                  <th>البيان</th>
                  <th>بواسطة</th>
                  <th aria-label="حذف" />
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr key={row.id}>
                    <td>{formatTime(row.createdAt)}</td>
                    <td className={styles.amountCell}>
                      {formatCurrency(row.amount)}
                    </td>
                    <td>{row.note || "—"}</td>
                    <td>{row.createdByName || "—"}</td>
                    <td>
                      <button
                        type="button"
                        className={styles.deleteBtn}
                        onClick={() => handleDelete(row.id)}
                        aria-label="حذف المصروف"
                      >
                        <FaTrash aria-hidden /> حذف
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

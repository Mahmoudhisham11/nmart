"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import styles from "./page.module.css";

export default function DrinksPage() {
  const [drinks, setDrinks] = useState([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDrinks = async () => {
    setLoading(true);
    setError("");
    try {
      const snap = await getDocs(collection(firestore, "drinks"));
      const list = [];
      snap.forEach((row) => list.push({ id: row.id, ...row.data() }));
      list.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
      setDrinks(list);
    } catch (e) {
      console.error("Failed to load drinks", e);
      setError("تعذر تحميل المشاريب.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDrinks();
  }, []);

  const addDrink = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("اسم المشروب مطلوب.");
      return;
    }
    try {
      const now = new Date().toISOString();
      await addDoc(collection(firestore, "drinks"), {
        name: name.trim(),
        price: Number(price || 0),
        category: category.trim(),
        active: true,
        createdAt: now,
        updatedAt: now,
      });
      setName("");
      setPrice("");
      setCategory("");
      await loadDrinks();
    } catch (e) {
      console.error("Failed to add drink", e);
      setError("تعذر إضافة المشروب.");
    }
  };

  const toggleActive = async (item) => {
    try {
      await updateDoc(doc(firestore, "drinks", item.id), {
        active: !item.active,
        updatedAt: new Date().toISOString(),
      });
      setDrinks((prev) =>
        prev.map((x) => (x.id === item.id ? { ...x, active: !x.active } : x))
      );
    } catch (e) {
      console.error("Failed to toggle drink", e);
      setError("تعذر تحديث الحالة.");
    }
  };

  const deleteDrink = async (id) => {
    if (!window.confirm("حذف هذا المشروب؟")) return;
    try {
      await deleteDoc(doc(firestore, "drinks", id));
      setDrinks((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      console.error("Failed to delete drink", e);
      setError("تعذر حذف المشروب.");
    }
  };

  return (
    <div className={styles.wrapper}>
      <section className={styles.card}>
        <h2>إضافة مشروب</h2>
        <form className={styles.form} onSubmit={addDrink}>
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم المشروب" />
          <input className={styles.input} type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="السعر" />
          <input className={styles.input} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="التصنيف" />
          <button className={styles.button} type="submit">إضافة</button>
        </form>
        {error ? <p className={styles.error}>{error}</p> : null}
      </section>

      <section className={styles.card}>
        <h2>قائمة المشاريب</h2>
        {loading ? <p className={styles.muted}>جارٍ التحميل...</p> : null}
        <div className={styles.list}>
          {drinks.map((item) => (
            <div key={item.id} className={styles.row}>
              <div>
                <strong>{item.name}</strong>
                <p className={styles.muted}>
                  {Number(item.price || 0)} ج - {item.category || "بدون تصنيف"}
                </p>
              </div>
              <div className={styles.actions}>
                <button type="button" className={styles.secondaryButton} onClick={() => toggleActive(item)}>
                  {item.active ? "إلغاء التفعيل" : "تفعيل"}
                </button>
                <button type="button" className={styles.dangerButton} onClick={() => deleteDrink(item.id)}>
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}


"use client";

import { useEffect, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import { FaTrash } from "react-icons/fa";
import styles from "./page.module.css";

export default function DrinksPage() {
  const [drinks, setDrinks] = useState([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= 600;
  });

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 600);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const [addOpen, setAddOpen] = useState(false);
  const [addSaving, setAddSaving] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editForm, setEditForm] = useState({
    name: "",
    price: "",
    category: "",
    active: true,
  });

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmDeleting, setConfirmDeleting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const categoryValues = Array.from(
    new Set(
      drinks
        .map((d) => String(d.category || "").trim())
        .filter((c) => c.length > 0)
    )
  )
    .sort((a, b) => a.localeCompare(b, "ar"))
    .map((x) => x);

  const hasNoCategory = drinks.some(
    (d) => !String(d.category || "").trim()
  );

  const openAddModal = () => {
    setAddOpen(true);
    setName("");
    setPrice("");
    setCategory("");
    setError("");
  };

  const closeAddModal = () => {
    if (addSaving) return;
    setAddOpen(false);
    setError("");
  };

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
    if (!category.trim()) {
      setError("التصنيف مطلوب.");
      return;
    }
    try {
      setAddSaving(true);
      setError("");
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
      setAddOpen(false);
      await loadDrinks();
    } catch (e) {
      console.error("Failed to add drink", e);
      setError("تعذر إضافة المشروب.");
    } finally {
      setAddSaving(false);
    }
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setEditForm({
      name: item.name || "",
      price: item.price != null ? String(item.price) : "",
      category: item.category || "",
      active: Boolean(item.active),
    });
    setEditOpen(true);
    setEditError("");
  };

  const closeEdit = () => {
    if (editSaving) return;
    setEditOpen(false);
    setEditingId(null);
    setEditForm({ name: "", price: "", category: "", active: true });
    setEditError("");
  };

  const handleSaveEdit = async (e) => {
    e?.preventDefault?.();
    if (!editingId) return;

    const nextName = String(editForm.name || "").trim();
    const nextCategory = String(editForm.category || "").trim();
    const nextPriceNum = Number(editForm.price || 0);

    if (!nextName) {
      setEditError("اسم المشروب مطلوب.");
      return;
    }
    if (!nextCategory) {
      setEditError("التصنيف مطلوب.");
      return;
    }
    if (Number.isNaN(nextPriceNum) || nextPriceNum < 0) {
      setEditError("السعر غير صحيح.");
      return;
    }

    setEditSaving(true);
    setEditError("");
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(firestore, "drinks", editingId), {
        name: nextName,
        price: nextPriceNum,
        category: nextCategory,
        active: Boolean(editForm.active),
        updatedAt: now,
      });

      setDrinks((prev) =>
        prev.map((x) =>
          x.id === editingId
            ? {
                ...x,
                name: nextName,
                price: nextPriceNum,
                category: nextCategory,
                active: Boolean(editForm.active),
              }
            : x
        )
      );

      closeEdit();
    } catch (e2) {
      console.error("Failed to update drink", e2);
      setEditError("تعذر حفظ التعديلات.");
    } finally {
      setEditSaving(false);
    }
  };

  const requestDelete = (id) => {
    setConfirmDeleteId(id);
    setConfirmDeleteOpen(true);
    setError("");
  };

  const closeConfirmDelete = () => {
    setConfirmDeleteOpen(false);
    setConfirmDeleteId(null);
    setConfirmDeleting(false);
  };

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    setConfirmDeleting(true);
    setError("");
    try {
      await deleteDoc(doc(firestore, "drinks", confirmDeleteId));
      setDrinks((prev) =>
        prev.filter((x) => x.id !== confirmDeleteId)
      );
      if (editingId === confirmDeleteId) closeEdit();
      closeConfirmDelete();
    } catch (e) {
      console.error("Failed to delete drink", e);
      setError("تعذر حذف المشروب.");
      setConfirmDeleting(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <section className={styles.card}>
        <div className={styles.toolbar}>
          <h2 className={styles.title}>قائمة المشاريب</h2>
          <button
            type="button"
            className={styles.btnAddDrink}
            onClick={openAddModal}
            disabled={addSaving}
          >
            إضافة مشروب
          </button>
        </div>
        {loading ? <p className={styles.muted}>جارٍ التحميل...</p> : null}
        {drinks.length > 0 && !loading ? (
          isMobile ? (
            <Swiper
              className={styles.categoryBarMobile}
              slidesPerView="auto"
              spaceBetween={10}
              freeMode={true}
              watchOverflow={true}
            >
              <SwiperSlide className={styles.categorySlide}>
                <button
                  type="button"
                  className={`${styles.categoryBtn} ${
                    !selectedCategory ? styles.categoryBtnActive : ""
                  }`}
                  onClick={() => setSelectedCategory("")}
                >
                  الكل
                </button>
              </SwiperSlide>

              {categoryValues.map((cat) => (
                <SwiperSlide key={cat} className={styles.categorySlide}>
                  <button
                    type="button"
                    className={`${styles.categoryBtn} ${
                      selectedCategory === cat
                        ? styles.categoryBtnActive
                        : ""
                    }`}
                    onClick={() => setSelectedCategory(cat)}
                    role="tab"
                    aria-selected={selectedCategory === cat}
                  >
                    {cat}
                  </button>
                </SwiperSlide>
              ))}

              {hasNoCategory ? (
                <SwiperSlide className={styles.categorySlide}>
                  <button
                    type="button"
                    className={`${styles.categoryBtn} ${
                      selectedCategory === "__no_category__"
                        ? styles.categoryBtnActive
                        : ""
                    }`}
                    onClick={() => setSelectedCategory("__no_category__")}
                  >
                    بدون تصنيف
                  </button>
                </SwiperSlide>
              ) : null}
            </Swiper>
          ) : (
            <div
              className={styles.categoryBarDesktop}
              role="tablist"
              aria-label="أقسام المشاريب"
            >
              <button
                type="button"
                className={`${styles.categoryBtn} ${
                  !selectedCategory ? styles.categoryBtnActive : ""
                }`}
                onClick={() => setSelectedCategory("")}
              >
                الكل
              </button>

              {categoryValues.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`${styles.categoryBtn} ${
                    selectedCategory === cat ? styles.categoryBtnActive : ""
                  }`}
                  onClick={() => setSelectedCategory(cat)}
                  role="tab"
                  aria-selected={selectedCategory === cat}
                >
                  {cat}
                </button>
              ))}

              {hasNoCategory ? (
                <button
                  type="button"
                  className={`${styles.categoryBtn} ${
                    selectedCategory === "__no_category__"
                      ? styles.categoryBtnActive
                      : ""
                  }`}
                  onClick={() => setSelectedCategory("__no_category__")}
                >
                  بدون تصنيف
                </button>
              ) : null}
            </div>
          )
        ) : null}

        {(() => {
          const cat = String(selectedCategory || "").trim();
          const filtered = drinks.filter((d) => {
            const dCat = String(d.category || "").trim();
            if (!cat) return true;
            if (cat === "__no_category__") return !dCat;
            return dCat === cat;
          });

          if (!loading && filtered.length === 0) {
            return <p className={styles.muted}>لا توجد مشاريب في هذا القسم.</p>;
          }

          return (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>الاسم</th>
                    <th>التصنيف</th>
                    <th>السعر</th>
                    <th>الحالة</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name || "—"}</td>
                      <td>{item.category || "بدون تصنيف"}</td>
                      <td>{Number(item.price || 0)} ج</td>
                      <td>{item.active ? "مفعّل" : "غير مفعّل"}</td>
                      <td className={styles.actions}>
                        <button
                          type="button"
                          className={styles.btnEdit}
                          onClick={() => openEdit(item)}
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          className={styles.btnDelete}
                          onClick={() => requestDelete(item.id)}
                        >
                          حذف
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </section>

      {addOpen ? (
        <div
          className={styles.modalOverlay}
          onClick={() => !addSaving && closeAddModal()}
        >
          <div
            className={styles.modal}
            onClick={(ev) => ev.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-drink-title"
          >
            <div className={styles.modalHeader}>
              <h3 id="add-drink-title" className={styles.modalTitle}>
                إضافة مشروب
              </h3>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => !addSaving && closeAddModal()}
                disabled={addSaving}
              >
                ×
              </button>
            </div>

            <form className={styles.modalBody} onSubmit={addDrink}>
              <label className={styles.label}>
                الاسم
                <input
                  className={styles.input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>

              <label className={styles.label}>
                السعر
                <input
                  className={styles.input}
                  type="number"
                  min="0"
                  step="1"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </label>

              <label className={styles.label}>
                التصنيف
                <input
                  className={styles.input}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                />
              </label>

              {error ? <p className={styles.error}>{error}</p> : null}

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => !addSaving && closeAddModal()}
                  disabled={addSaving}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  disabled={addSaving}
                >
                  {addSaving ? "جارٍ الحفظ..." : "حفظ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editOpen ? (
        <div
          className={styles.modalOverlay}
          onClick={() => !editSaving && closeEdit()}
        >
          <div
            className={styles.modal}
            onClick={(ev) => ev.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-drink-title"
          >
            <div className={styles.modalHeader}>
              <h3 id="edit-drink-title" className={styles.modalTitle}>
                تعديل المشروب
              </h3>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => !editSaving && closeEdit()}
                disabled={editSaving}
              >
                ×
              </button>
            </div>

            <form className={styles.modalBody} onSubmit={handleSaveEdit}>
              <label className={styles.label}>
                الاسم
                <input
                  className={styles.input}
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, name: e.target.value }))
                  }
                  required
                />
              </label>

              <label className={styles.label}>
                التصنيف
                <input
                  className={styles.input}
                  value={editForm.category}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, category: e.target.value }))
                  }
                  required
                />
              </label>

              <label className={styles.label}>
                السعر
                <input
                  className={styles.input}
                  type="number"
                  min="0"
                  step="1"
                  value={editForm.price}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, price: e.target.value }))
                  }
                />
              </label>

              <label className={styles.label}>
                الحالة
                <select
                  className={styles.input}
                  value={editForm.active ? "active" : "inactive"}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      active: e.target.value === "active",
                    }))
                  }
                >
                  <option value="active">مفعّل</option>
                  <option value="inactive">غير مفعّل</option>
                </select>
              </label>

              {editError ? <p className={styles.error}>{editError}</p> : null}

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => !editSaving && closeEdit()}
                  disabled={editSaving}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  disabled={editSaving}
                >
                  {editSaving ? "جارٍ الحفظ..." : "حفظ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {confirmDeleteOpen ? (
        <div
          className={styles.modalOverlay}
          onClick={() => !confirmDeleting && closeConfirmDelete()}
        >
          <div
            className={styles.modal}
            onClick={(ev) => ev.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-drink-title"
          >
            <div className={`${styles.modalHeader} ${styles.confirmHeader}`}>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => !confirmDeleting && closeConfirmDelete()}
                disabled={confirmDeleting}
                aria-label="إغلاق"
              >
                ×
              </button>
              <h3 id="delete-drink-title" className={styles.modalTitle}>
                تأكيد حذف المشروب
              </h3>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.confirmIconWrap}>
                <FaTrash className={styles.confirmIcon} />
              </div>
              <p className={`${styles.muted} ${styles.confirmText}`}>
                هل أنت متأكد أنك تريد حذف هذا المشروب؟
                <br />
                لا يمكن التراجع عن هذا الإجراء.
              </p>
            </div>
            <div className={`${styles.modalFooter} ${styles.confirmFooter}`}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => !confirmDeleting && closeConfirmDelete()}
                disabled={confirmDeleting}
              >
                إلغاء
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={confirmDelete}
                disabled={confirmDeleting}
              >
                {confirmDeleting ? "جارٍ الحذف..." : "حذف"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


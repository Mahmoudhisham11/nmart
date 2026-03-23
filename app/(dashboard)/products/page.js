"use client";

import { useCallback, useEffect, useState } from "react";
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
import { FaPlus, FaTrash } from "react-icons/fa";
import styles from "./page.module.css";

const emptyForm = () => ({
  nameAr: "",
  barcode: "",
  category: "",
  quantity: "",
  costPrice: "",
  sellingPrice: "",
  lowStockThreshold: "",
});

const newBulkRow = () => ({
  name: "",
  barcode: "",
  category: "",
  quantity: 1,
  wholesalePrice: 0,
  sellingPrice: 0,
  lowStockThreshold: "",
  total: 0,
});

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const [addOpen, setAddOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState([newBulkRow()]);
  const [bulkSaving, setBulkSaving] = useState(false);

  // "" = الكل, "__no_category__" = بدون قسم
  const [selectedCategory, setSelectedCategory] = useState("");

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmDeleting, setConfirmDeleting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= 600;
  });

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 600);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const categoryValues = Array.from(
    new Set(
      products
        .map((p) => String(p.category || "").trim())
        .filter((c) => c.length > 0)
    )
  )
    .sort((a, b) => a.localeCompare(b, "ar"))
    .map((x) => x);

  const hasNoCategory = products.some(
    (p) => !String(p.category || "").trim()
  );

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const snap = await getDocs(collection(firestore, "products"));
      const list = [];
      snap.forEach((row) => list.push({ id: row.id, ...row.data() }));
      list.sort((a, b) =>
        (a.nameAr || a.name || "").localeCompare(b.nameAr || b.name || "", "ar")
      );
      setProducts(list);
    } catch (e) {
      console.error("Failed to load products", e);
      setError("تعذر تحميل المنتجات.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const openAddModal = () => {
    setBulkRows([newBulkRow()]);
    setAddOpen(true);
    setError("");
  };

  const closeAddModal = () => {
    if (bulkSaving) return;
    setAddOpen(false);
    setBulkRows([newBulkRow()]);
  };

  const handleAddBulkRow = () => {
    setBulkRows((prev) => [...prev, newBulkRow()]);
  };

  const handleRemoveBulkRow = (index) => {
    setBulkRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleBulkChange = (index, field, value) => {
    setBulkRows((prev) => {
      const next = [...prev];
      const row = { ...next[index] };
      if (
        field === "quantity" ||
        field === "wholesalePrice" ||
        field === "sellingPrice"
      ) {
        row[field] = parseFloat(value) || 0;
      } else if (field === "lowStockThreshold") {
        // حقول التنبيه اختيارية: لو فاضية نخليها "" عشان نحفظ null
        row[field] = value === "" ? "" : parseFloat(value) || 0;
      } else {
        row[field] = value;
      }
      if (field === "quantity" || field === "wholesalePrice") {
        row.total = row.quantity * row.wholesalePrice;
      }
      next[index] = row;
      return next;
    });
  };

  const handleBulkSave = async () => {
    if (bulkRows.length === 0) {
      setError("أضف سطر منتج واحد على الأقل.");
      return;
    }
    for (let i = 0; i < bulkRows.length; i++) {
      const r = bulkRows[i];
      if (!String(r.name || "").trim()) {
        setError(`أدخل اسم المنتج في السطر ${i + 1}.`);
        return;
      }
      if (!String(r.category || "").trim()) {
        setError(`أدخل قسم المنتج في السطر ${i + 1}.`);
        return;
      }
      if (r.quantity <= 0) {
        setError(`كمية غير صحيحة في السطر ${i + 1}.`);
        return;
      }
      if (r.wholesalePrice <= 0) {
        setError(`أدخل سعر جملة صحيح في السطر ${i + 1}.`);
        return;
      }
      if (r.sellingPrice < 0) {
        setError(`سعر البيع غير صحيح في السطر ${i + 1}.`);
        return;
      }

      // التنبيه اختيارى، لكن لو موجود لازم يكون >= 0
      if (
        String(r.lowStockThreshold ?? "").trim() !== "" &&
        (() => {
          const thresholdNum = Number(r.lowStockThreshold);
          return Number.isNaN(thresholdNum) || thresholdNum < 0;
        })()
      ) {
        setError(`حد التنبيه غير صحيح في السطر ${i + 1}.`);
        return;
      }
    }

    setBulkSaving(true);
    setError("");
    try {
      const now = new Date().toISOString();
      for (const r of bulkRows) {
        await addDoc(collection(firestore, "products"), {
          nameAr: String(r.name).trim(),
          barcode: String(r.barcode || "").trim(),
          category: String(r.category || "").trim(),
          quantity: r.quantity,
          costPrice: r.wholesalePrice,
          sellingPrice: r.sellingPrice,
          lowStockThreshold:
            r.lowStockThreshold === "" || r.lowStockThreshold == null
              ? null
              : Number(r.lowStockThreshold),
          createdAt: now,
          updatedAt: now,
        });
      }
      setAddOpen(false);
      setBulkRows([newBulkRow()]);
      await loadProducts();
    } catch (err) {
      console.error("Failed to add products", err);
      setError("تعذر حفظ المنتجات.");
    } finally {
      setBulkSaving(false);
    }
  };

  const openEdit = (p) => {
    setEditingId(p.id);
    setForm({
      nameAr: p.nameAr ?? p.name ?? "",
      barcode: p.barcode ?? "",
      category: p.category ?? "",
      quantity: p.quantity != null ? String(p.quantity) : "",
      costPrice: p.costPrice != null ? String(p.costPrice) : "",
      sellingPrice: p.sellingPrice != null ? String(p.sellingPrice) : "",
      lowStockThreshold:
        p.lowStockThreshold != null ? String(p.lowStockThreshold) : "",
    });
    setEditOpen(true);
    setError("");
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editingId) return;
    const nameAr = form.nameAr.trim();
    if (!nameAr) {
      setError("اسم المنتج مطلوب.");
      return;
    }

    const category = String(form.category || "").trim();
    if (!category) {
      setError("القسم مطلوب.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(firestore, "products", editingId), {
        nameAr,
        barcode: form.barcode.trim(),
        category,
        quantity: Number(form.quantity) || 0,
        costPrice: Number(form.costPrice) || 0,
        sellingPrice: Number(form.sellingPrice) || 0,
        lowStockThreshold:
          form.lowStockThreshold === ""
            ? null
            : Number(form.lowStockThreshold) || 0,
        updatedAt: now,
      });
      setProducts((prev) =>
        prev.map((x) =>
          x.id === editingId
            ? {
                ...x,
                nameAr,
                barcode: form.barcode.trim(),
                category,
                quantity: Number(form.quantity) || 0,
                costPrice: Number(form.costPrice) || 0,
                sellingPrice: Number(form.sellingPrice) || 0,
                lowStockThreshold:
                  form.lowStockThreshold === ""
                    ? null
                    : Number(form.lowStockThreshold) || 0,
                updatedAt: now,
              }
            : x
        )
      );
      closeEdit();
    } catch (err) {
      console.error("Failed to update product", err);
      setError("تعذر حفظ التعديلات.");
    } finally {
      setSaving(false);
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
      await deleteDoc(doc(firestore, "products", confirmDeleteId));
      setProducts((prev) =>
        prev.filter((x) => x.id !== confirmDeleteId)
      );
      if (editingId === confirmDeleteId) closeEdit();
      closeConfirmDelete();
    } catch (err) {
      console.error("Failed to delete product", err);
      setError("تعذر حذف المنتج.");
      setConfirmDeleting(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <section className={styles.card}>
        <div className={styles.toolbar}>
          <h2 className={styles.title}>قائمة المنتجات</h2>
          <button
            type="button"
            className={styles.btnAddBulk}
            onClick={openAddModal}
          >
            <FaPlus />
            <span>إضافة منتجات</span>
          </button>
        </div>
        {products.length > 0 ? (
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
                <SwiperSlide
                  key={cat}
                  className={styles.categorySlide}
                >
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
                    بدون قسم
                  </button>
                </SwiperSlide>
              ) : null}
            </Swiper>
          ) : (
            <div
              className={styles.categoryBarDesktop}
              role="tablist"
              aria-label="أقسام المنتجات"
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
                  بدون قسم
                </button>
              ) : null}
            </div>
          )
        ) : null}
        {error ? <p className={styles.error}>{error}</p> : null}
        {loading ? <p className={styles.muted}>جارٍ التحميل...</p> : null}
        {!loading && products.length === 0 ? (
          <p className={styles.muted}>لا توجد منتجات مسجلة. استخدم &quot;إضافة منتجات&quot;.</p>
        ) : null}

        {!loading && products.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>الباركود</th>
                  <th>القسم</th>
                  <th>الكمية</th>
                  <th>سعر البيع</th>
                  <th>التكلفة</th>
                  <th>حد التنبيه</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const cat = String(selectedCategory || "").trim();
                  const filtered = products.filter((p) => {
                    const pCat = String(p.category || "").trim();
                    if (!cat) return true;
                    if (cat === "__no_category__") return !pCat;
                    return pCat === cat;
                  });
                  return filtered.map((p) => (
                  <tr key={p.id}>
                    <td>{p.nameAr || p.name || "—"}</td>
                    <td>{p.barcode || "—"}</td>
                    <td>{p.category || "بدون قسم"}</td>
                    <td>{p.quantity ?? "—"}</td>
                    <td>{p.sellingPrice ?? "—"}</td>
                    <td>{p.costPrice ?? "—"}</td>
                    <td>
                      {p.lowStockThreshold != null ? p.lowStockThreshold : "—"}
                    </td>
                    <td className={styles.actions}>
                      <button
                        type="button"
                        className={styles.btnEdit}
                        onClick={() => openEdit(p)}
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        className={styles.btnDelete}
                        onClick={() => requestDelete(p.id)}
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {addOpen ? (
        <div
          className={styles.modalOverlay}
          onClick={() => !bulkSaving && closeAddModal()}
        >
          <div
            className={styles.modalWide}
            onClick={(ev) => ev.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-products-title"
          >
            <div className={styles.modalHeader}>
              <h3 id="add-products-title" className={styles.modalTitle}>
                إضافة منتجات
              </h3>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => !bulkSaving && closeAddModal()}
                disabled={bulkSaving}
              >
                ×
              </button>
            </div>
            <div className={styles.bulkSection}>
              <div className={styles.bulkHeader}>
                <h4 className={styles.bulkTitle}>أسطر المنتجات</h4>
                <button
                  type="button"
                  className={styles.addRowBtn}
                  onClick={handleAddBulkRow}
                  disabled={bulkSaving}
                >
                  <FaPlus />
                  <span>إضافة سطر</span>
                </button>
              </div>
              {bulkRows.length === 0 ? (
                <p className={styles.muted}>لا توجد أسطر. اضغط &quot;إضافة سطر&quot;.</p>
              ) : (
                <div className={styles.bulkTableWrap}>
                  <table className={styles.bulkTable}>
                    <thead>
                      <tr>
                        <th>الاسم</th>
                        <th>الباركود</th>
                        <th>القسم</th>
                        <th>الكمية</th>
                        <th>سعر الجملة</th>
                        <th>سعر البيع</th>
                        <th>حد التنبيه</th>
                        <th>الإجمالي</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkRows.map((row, index) => (
                        <tr key={index}>
                          <td>
                            <input
                              type="text"
                              className={styles.bulkInput}
                              value={row.name}
                              onChange={(e) =>
                                handleBulkChange(index, "name", e.target.value)
                              }
                              placeholder="اسم المنتج"
                              disabled={bulkSaving}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className={styles.bulkInput}
                              value={row.barcode}
                              onChange={(e) =>
                                handleBulkChange(index, "barcode", e.target.value)
                              }
                              placeholder="الباركود"
                              disabled={bulkSaving}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className={styles.bulkInput}
                              value={row.category}
                              onChange={(e) =>
                                handleBulkChange(index, "category", e.target.value)
                              }
                              placeholder="القسم (مثال: مشروبات باردة)"
                              disabled={bulkSaving}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className={styles.bulkInput}
                              min="1"
                              step="1"
                              value={row.quantity}
                              onChange={(e) =>
                                handleBulkChange(
                                  index,
                                  "quantity",
                                  e.target.value
                                )
                              }
                              disabled={bulkSaving}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className={styles.bulkInput}
                              min="0"
                              step="0.01"
                              value={row.wholesalePrice}
                              onChange={(e) =>
                                handleBulkChange(
                                  index,
                                  "wholesalePrice",
                                  e.target.value
                                )
                              }
                              disabled={bulkSaving}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className={styles.bulkInput}
                              min="0"
                              step="0.01"
                              value={row.sellingPrice}
                              onChange={(e) =>
                                handleBulkChange(
                                  index,
                                  "sellingPrice",
                                  e.target.value
                                )
                              }
                              disabled={bulkSaving}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className={styles.bulkInput}
                              min="0"
                              step="1"
                              value={row.lowStockThreshold}
                              onChange={(e) =>
                                handleBulkChange(
                                  index,
                                  "lowStockThreshold",
                                  e.target.value === ""
                                    ? ""
                                    : e.target.value
                                )
                              }
                              placeholder="اختياري"
                              disabled={bulkSaving}
                            />
                          </td>
                          <td className={styles.bulkTotalCell}>
                            {(row.total || 0).toFixed(0)}
                          </td>
                          <td>
                            <button
                              type="button"
                              className={styles.rowDeleteBtn}
                              onClick={() => handleRemoveBulkRow(index)}
                              disabled={bulkSaving || bulkRows.length <= 1}
                              title="حذف السطر"
                            >
                              <FaTrash />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className={styles.modalFooterBar}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => !bulkSaving && closeAddModal()}
                disabled={bulkSaving}
              >
                إلغاء
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleBulkSave}
                disabled={bulkSaving || bulkRows.length === 0}
              >
                {bulkSaving ? "جارٍ الحفظ..." : "حفظ المنتجات"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editOpen ? (
        <div className={styles.modalOverlay} onClick={() => !saving && closeEdit()}>
          <div
            className={styles.modal}
            onClick={(ev) => ev.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-product-title"
          >
            <div className={styles.modalHeader}>
              <h3 id="edit-product-title" className={styles.modalTitle}>
                تعديل المنتج
              </h3>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => !saving && closeEdit()}
                disabled={saving}
              >
                ×
              </button>
            </div>
            <form className={styles.modalBody} onSubmit={handleSave}>
              <label className={styles.label}>
                الاسم
                <input
                  className={styles.input}
                  value={form.nameAr}
                  onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))}
                  required
                />
              </label>
              <label className={styles.label}>
                الباركود
                <input
                  className={styles.input}
                  value={form.barcode}
                  onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
                />
              </label>
              <label className={styles.label}>
                القسم
                <input
                  className={styles.input}
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value }))
                  }
                  required
                />
              </label>
              <label className={styles.label}>
                الكمية
                <input
                  className={styles.input}
                  type="number"
                  min="0"
                  step="1"
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                />
              </label>
              <label className={styles.label}>
                سعر التكلفة
                <input
                  className={styles.input}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.costPrice}
                  onChange={(e) => setForm((f) => ({ ...f, costPrice: e.target.value }))}
                />
              </label>
              <label className={styles.label}>
                سعر البيع
                <input
                  className={styles.input}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.sellingPrice}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sellingPrice: e.target.value }))
                  }
                />
              </label>
              <label className={styles.label}>
                حد التنبيه للمخزون المنخفض
                <input
                  className={styles.input}
                  type="number"
                  min="0"
                  step="1"
                  placeholder="اختياري"
                  value={form.lowStockThreshold}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lowStockThreshold: e.target.value }))
                  }
                />
              </label>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => !saving && closeEdit()}
                  disabled={saving}
                >
                  إلغاء
                </button>
                <button type="submit" className={styles.btnPrimary} disabled={saving}>
                  {saving ? "جارٍ الحفظ..." : "حفظ"}
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
            aria-labelledby="delete-product-title"
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
              <h3 id="delete-product-title" className={styles.modalTitle}>
                تأكيد حذف المنتج
              </h3>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.confirmIconWrap}>
                <FaTrash className={styles.confirmIcon} />
              </div>
              <p className={`${styles.muted} ${styles.confirmText}`}>
                هل أنت متأكد أنك تريد حذف هذا المنتج نهائياً؟
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

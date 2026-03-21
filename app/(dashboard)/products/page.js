"use client";

import { useCallback, useEffect, useState } from "react";
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
  code: "",
  barcode: "",
  quantity: "",
  costPrice: "",
  sellingPrice: "",
  lowStockThreshold: "",
});

const newBulkRow = () => ({
  name: "",
  code: "",
  barcode: "",
  quantity: 1,
  wholesalePrice: 0,
  sellingPrice: 0,
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
      if (field === "quantity" || field === "wholesalePrice" || field === "sellingPrice") {
        row[field] = parseFloat(value) || 0;
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
    }

    setBulkSaving(true);
    setError("");
    try {
      const now = new Date().toISOString();
      for (const r of bulkRows) {
        await addDoc(collection(firestore, "products"), {
          nameAr: String(r.name).trim(),
          code: String(r.code || "").trim(),
          barcode: String(r.barcode || "").trim(),
          quantity: r.quantity,
          costPrice: r.wholesalePrice,
          sellingPrice: r.sellingPrice,
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
      code: p.code ?? "",
      barcode: p.barcode ?? "",
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

    setSaving(true);
    setError("");
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(firestore, "products", editingId), {
        nameAr,
        code: form.code.trim(),
        barcode: form.barcode.trim(),
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
                code: form.code.trim(),
                barcode: form.barcode.trim(),
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

  const handleDelete = async (id) => {
    if (!window.confirm("حذف هذا المنتج نهائياً؟")) return;
    setError("");
    try {
      await deleteDoc(doc(firestore, "products", id));
      setProducts((prev) => prev.filter((x) => x.id !== id));
      if (editingId === id) closeEdit();
    } catch (err) {
      console.error("Failed to delete product", err);
      setError("تعذر حذف المنتج.");
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
                  <th>الكود</th>
                  <th>الباركود</th>
                  <th>الكمية</th>
                  <th>سعر البيع</th>
                  <th>التكلفة</th>
                  <th>حد التنبيه</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>{p.nameAr || p.name || "—"}</td>
                    <td>{p.code || "—"}</td>
                    <td>{p.barcode || "—"}</td>
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
                        onClick={() => handleDelete(p.id)}
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
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
                        <th>الكود</th>
                        <th>الباركود</th>
                        <th>الكمية</th>
                        <th>سعر الجملة</th>
                        <th>سعر البيع</th>
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
                              value={row.code}
                              onChange={(e) =>
                                handleBulkChange(index, "code", e.target.value)
                              }
                              placeholder="الكود"
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
                الكود
                <input
                  className={styles.input}
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
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
    </div>
  );
}

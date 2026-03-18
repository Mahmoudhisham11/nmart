"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import { useAuth } from "@/components/AuthContext";
import {
  FaPlus,
  FaTimes,
  FaSpinner,
  FaTrash,
  FaFileInvoice,
  FaEdit,
} from "react-icons/fa";
import styles from "./page.module.css";

export default function PurchasesPage() {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [products, setProducts] = useState([]);
  const [formData, setFormData] = useState({ notes: "", invoiceNumber: "" });
  const [notifications, setNotifications] = useState([]);
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);

  useEffect(() => {
    loadPurchases();
    loadSuppliers();
  }, []);

  const showNotification = (message, type = "error") => {
    const id = Date.now();
    const notification = { id, message, type };
    setNotifications((prev) => [...prev, notification]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  };

  const loadPurchases = async () => {
    try {
      setLoading(true);
      const purchasesRef = collection(firestore, "purchases");
      const q = query(purchasesRef, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const purchasesList = [];
      snapshot.forEach((docSnap) => {
        purchasesList.push({ id: docSnap.id, ...docSnap.data() });
      });
      setPurchases(purchasesList);
    } catch (error) {
      console.error("خطأ في جلب الفواتير:", error);
      showNotification("فشل تحميل قائمة الفواتير", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadSuppliers = async () => {
    try {
      const suppliersRef = collection(firestore, "suppliers");
      const snapshot = await getDocs(suppliersRef);
      const suppliersList = [];
      snapshot.forEach((docSnap) => {
        suppliersList.push({ id: docSnap.id, ...docSnap.data() });
      });
      setSuppliers(suppliersList);
    } catch (error) {
      console.error("خطأ في جلب الموردين:", error);
    }
  };

  const generateInvoiceNumber = async () => {
    try {
      const purchasesRef = collection(firestore, "purchases");
      const snapshot = await getDocs(purchasesRef);
      const count = snapshot.size + 1;
      return `INV-${String(count).padStart(3, "0")}`;
    } catch (error) {
      return `INV-${Date.now()}`;
    }
  };

  const calculateTotal = () => {
    return products.reduce((sum, product) => {
      const total = (product.quantity || 0) * (product.wholesalePrice || 0);
      return sum + total;
    }, 0);
  };

  const handleAddProduct = () => {
    setProducts([
      ...products,
      {
        name: "",
        code: "",
        quantity: 1,
        wholesalePrice: 0,
        sellingPrice: 0,
        total: 0,
      },
    ]);
  };

  const handleRemoveProduct = (index) => {
    setProducts(products.filter((_, i) => i !== index));
  };

  const handleProductChange = (index, field, value) => {
    const updatedProducts = [...products];
    updatedProducts[index] = {
      ...updatedProducts[index],
      [field]: field === "quantity" || field === "wholesalePrice" || field === "sellingPrice"
        ? parseFloat(value) || 0
        : value,
    };

    // حساب الإجمالي للمنتج
    if (field === "quantity" || field === "wholesalePrice") {
      updatedProducts[index].total =
        updatedProducts[index].quantity * updatedProducts[index].wholesalePrice;
    }

    setProducts(updatedProducts);
  };

  const handleSavePurchase = async () => {
    if (!selectedSupplier) {
      showNotification("الرجاء اختيار مورد", "error");
      return;
    }

    if (products.length === 0) {
      showNotification("الرجاء إضافة منتج واحد على الأقل", "error");
      return;
    }

    // التحقق من صحة البيانات
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      if (!product.name.trim()) {
        showNotification(`الرجاء إدخال اسم المنتج في الصف ${i + 1}`, "error");
        return;
      }
      if (product.quantity <= 0) {
        showNotification(`الرجاء إدخال كمية صحيحة في الصف ${i + 1}`, "error");
        return;
      }
      if (product.wholesalePrice <= 0) {
        showNotification(`الرجاء إدخال سعر جملة صحيح في الصف ${i + 1}`, "error");
        return;
      }
    }

    try {
      setLoadingAdd(true);
      const totalAmount = calculateTotal();
      const invoiceNumber =
        formData.invoiceNumber.trim() || (await generateInvoiceNumber());

      // حفظ الفاتورة
      const purchasesRef = collection(firestore, "purchases");
      const purchaseData = {
        invoiceNumber,
        supplierId: selectedSupplier.id,
        supplierName: selectedSupplier.name,
        products: products.map((p) => ({
          name: p.name.trim(),
          code: p.code.trim(),
          quantity: p.quantity,
          wholesalePrice: p.wholesalePrice,
          sellingPrice: p.sellingPrice,
          total: p.quantity * p.wholesalePrice,
        })),
        totalAmount,
        notes: formData.notes.trim(),
        createdAt: new Date().toISOString(),
        createdBy: user?.uid || "",
      };

      await addDoc(purchasesRef, purchaseData);

      // تحديث المتبقي للمورد
      const supplierRef = doc(firestore, "suppliers", selectedSupplier.id);
      const currentBalance = selectedSupplier.balance || 0;
      await updateDoc(supplierRef, {
        balance: currentBalance + totalAmount,
        updatedAt: new Date().toISOString(),
      });

      showNotification("تم إضافة الفاتورة بنجاح", "success");
      setShowAddModal(false);
      setSelectedSupplier(null);
      setProducts([]);
      setFormData({ notes: "", invoiceNumber: "" });
      loadPurchases();
      loadSuppliers(); // تحديث الموردين لتحديث المتبقي
    } catch (error) {
      console.error("خطأ في إضافة الفاتورة:", error);
      showNotification("فشل إضافة الفاتورة", "error");
    } finally {
      setLoadingAdd(false);
    }
  };

  const formatCurrency = (value) =>
    new Intl.NumberFormat("ar-EG", {
      style: "currency",
      currency: "EGP",
      maximumFractionDigits: 0,
    }).format(value || 0);

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const openAddModal = async () => {
    const invoiceNumber = await generateInvoiceNumber();
    setFormData({ notes: "", invoiceNumber });
    setSelectedSupplier(null);
    setProducts([]);
    setShowAddModal(true);
  };

  const openEditModal = async (purchase) => {
    setSelectedPurchase(purchase);
    const supplier = suppliers.find((s) => s.id === purchase.supplierId);
    setSelectedSupplier(supplier || null);
    setProducts(
      purchase.products?.map((p) => ({
        name: p.name || "",
        code: p.code || "",
        quantity: p.quantity || 1,
        wholesalePrice: p.wholesalePrice || 0,
        sellingPrice: p.sellingPrice || 0,
        total: (p.quantity || 0) * (p.wholesalePrice || 0),
      })) || []
    );
    setFormData({
      notes: purchase.notes || "",
      invoiceNumber: purchase.invoiceNumber || "",
    });
    setShowEditModal(true);
  };

  const openDeleteConfirm = (purchase) => {
    setSelectedPurchase(purchase);
    setShowDeleteConfirm(true);
  };

  const handleEditPurchase = async () => {
    if (!selectedPurchase) return;

    if (!selectedSupplier) {
      showNotification("الرجاء اختيار مورد", "error");
      return;
    }

    if (products.length === 0) {
      showNotification("الرجاء إضافة منتج واحد على الأقل", "error");
      return;
    }

    // التحقق من صحة البيانات
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      if (!product.name.trim()) {
        showNotification(`الرجاء إدخال اسم المنتج في الصف ${i + 1}`, "error");
        return;
      }
      if (product.quantity <= 0) {
        showNotification(`الرجاء إدخال كمية صحيحة في الصف ${i + 1}`, "error");
        return;
      }
      if (product.wholesalePrice <= 0) {
        showNotification(`الرجاء إدخال سعر جملة صحيح في الصف ${i + 1}`, "error");
        return;
      }
    }

    try {
      setLoadingEdit(true);
      const totalAmount = calculateTotal();
      const oldTotalAmount = selectedPurchase.totalAmount || 0;
      const balanceDifference = totalAmount - oldTotalAmount;

      // تحديث الفاتورة
      const purchaseRef = doc(firestore, "purchases", selectedPurchase.id);
      await updateDoc(purchaseRef, {
        supplierId: selectedSupplier.id,
        supplierName: selectedSupplier.name,
        products: products.map((p) => ({
          name: p.name.trim(),
          code: p.code.trim(),
          quantity: p.quantity,
          wholesalePrice: p.wholesalePrice,
          sellingPrice: p.sellingPrice,
          total: p.quantity * p.wholesalePrice,
        })),
        totalAmount,
        notes: formData.notes.trim(),
        invoiceNumber: formData.invoiceNumber.trim(),
        updatedAt: new Date().toISOString(),
      });

      // تحديث المتبقي للمورد
      // إذا تغير المورد، نرجع المتبقي القديم ونضيف الجديد
      if (selectedPurchase.supplierId !== selectedSupplier.id) {
        // المورد القديم
        const oldSupplierRef = doc(
          firestore,
          "suppliers",
          selectedPurchase.supplierId
        );
        const oldSupplier = suppliers.find(
          (s) => s.id === selectedPurchase.supplierId
        );
        if (oldSupplier) {
          const oldBalance = oldSupplier.balance || 0;
          await updateDoc(oldSupplierRef, {
            balance: oldBalance - oldTotalAmount,
            updatedAt: new Date().toISOString(),
          });
        }

        // المورد الجديد
        const newBalance = selectedSupplier.balance || 0;
        await updateDoc(doc(firestore, "suppliers", selectedSupplier.id), {
          balance: newBalance + totalAmount,
          updatedAt: new Date().toISOString(),
        });
      } else {
        // نفس المورد - نحدث الفرق فقط
        const supplierRef = doc(firestore, "suppliers", selectedSupplier.id);
        const currentBalance = selectedSupplier.balance || 0;
        await updateDoc(supplierRef, {
          balance: currentBalance + balanceDifference,
          updatedAt: new Date().toISOString(),
        });
      }

      showNotification("تم تحديث الفاتورة بنجاح", "success");
      setShowEditModal(false);
      setSelectedPurchase(null);
      setSelectedSupplier(null);
      setProducts([]);
      setFormData({ notes: "", invoiceNumber: "" });
      loadPurchases();
      loadSuppliers();
    } catch (error) {
      console.error("خطأ في تحديث الفاتورة:", error);
      showNotification("فشل تحديث الفاتورة", "error");
    } finally {
      setLoadingEdit(false);
    }
  };

  const handleDeletePurchase = async () => {
    if (!selectedPurchase) return;

    try {
      setLoadingDelete(true);
      const totalAmount = selectedPurchase.totalAmount || 0;

      // حذف الفاتورة
      const purchaseRef = doc(firestore, "purchases", selectedPurchase.id);
      await deleteDoc(purchaseRef);

      // تحديث المتبقي للمورد (نطرح المبلغ)
      const supplier = suppliers.find(
        (s) => s.id === selectedPurchase.supplierId
      );
      if (supplier) {
        const supplierRef = doc(firestore, "suppliers", supplier.id);
        const currentBalance = supplier.balance || 0;
        await updateDoc(supplierRef, {
          balance: Math.max(0, currentBalance - totalAmount), // التأكد من عدم السالب
          updatedAt: new Date().toISOString(),
        });
      }

      showNotification("تم حذف الفاتورة بنجاح", "success");
      setShowDeleteConfirm(false);
      setSelectedPurchase(null);
      loadPurchases();
      loadSuppliers();
    } catch (error) {
      console.error("خطأ في حذف الفاتورة:", error);
      showNotification("فشل حذف الفاتورة", "error");
    } finally {
      setLoadingDelete(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      {/* Toast Notifications */}
      <div className={styles.notificationsContainer}>
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`${styles.notification} ${
              notification.type === "success"
                ? styles.notificationSuccess
                : notification.type === "warning"
                ? styles.notificationWarning
                : styles.notificationError
            }`}
          >
            <span>{notification.message}</span>
            <button
              onClick={() =>
                setNotifications((prev) =>
                  prev.filter((n) => n.id !== notification.id)
                )
              }
              className={styles.notificationClose}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.pageTitle}>فواتير المشتريات</h2>
        <button className={styles.addButton} onClick={openAddModal}>
          <FaPlus />
          <span>إضافة فاتورة جديدة</span>
        </button>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className={styles.loading}>جارٍ التحميل...</div>
      ) : purchases.length === 0 ? (
        <div className={styles.emptyState}>
          <FaFileInvoice className={styles.emptyIcon} />
          <p>لا توجد فواتير حالياً</p>
          <button className={styles.emptyButton} onClick={openAddModal}>
            إضافة أول فاتورة
          </button>
        </div>
      ) : (
        <div className={styles.purchasesGrid}>
          {purchases.map((purchase) => (
            <div key={purchase.id} className={styles.purchaseCard}>
              <div className={styles.cardIcon}>
                <FaFileInvoice />
              </div>
              <div className={styles.cardContent}>
                <h3 className={styles.invoiceNumber}>
                  {purchase.invoiceNumber || "بدون رقم"}
                </h3>
                <p className={styles.supplierName}>
                  المورد: {purchase.supplierName}
                </p>
                <p className={styles.productsCount}>
                  عدد المنتجات: {purchase.products?.length || 0}
                </p>
                <div className={styles.totalAmount}>
                  الإجمالي: {formatCurrency(purchase.totalAmount)}
                </div>
                <p className={styles.date}>
                  {formatDate(purchase.createdAt)}
                </p>
              </div>
              <div className={styles.cardActions}>
                <button
                  className={styles.actionButton}
                  onClick={() => openEditModal(purchase)}
                  title="تعديل"
                >
                  <FaEdit />
                </button>
                <button
                  className={`${styles.actionButton} ${styles.actionButtonDanger}`}
                  onClick={() => openDeleteConfirm(purchase)}
                  title="حذف"
                >
                  <FaTrash />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Purchase Modal */}
      {showAddModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => !loadingAdd && setShowAddModal(false)}
        >
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>إضافة فاتورة شراء</h3>
              <button
                className={styles.modalClose}
                onClick={() => !loadingAdd && setShowAddModal(false)}
                disabled={loadingAdd}
              >
                <FaTimes />
              </button>
            </div>
            <div className={styles.modalBody}>
              {/* Supplier Selection */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>المورد *</label>
                <select
                  className={styles.formSelect}
                  value={selectedSupplier?.id || ""}
                  onChange={(e) => {
                    const supplier = suppliers.find((s) => s.id === e.target.value);
                    setSelectedSupplier(supplier || null);
                  }}
                  disabled={loadingAdd}
                >
                  <option value="">اختر مورد</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Invoice Number */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>رقم الفاتورة</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={formData.invoiceNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, invoiceNumber: e.target.value })
                  }
                  placeholder="سيتم توليده تلقائياً"
                  disabled={loadingAdd}
                />
              </div>

              {/* Products Table */}
              <div className={styles.productsSection}>
                <div className={styles.productsHeader}>
                  <h4 className={styles.productsTitle}>المنتجات</h4>
                  <button
                    className={styles.addProductButton}
                    onClick={handleAddProduct}
                    disabled={loadingAdd}
                  >
                    <FaPlus />
                    <span>إضافة منتج</span>
                  </button>
                </div>

                {products.length === 0 ? (
                  <p className={styles.noProducts}>لا توجد منتجات. اضغط "إضافة منتج" لإضافة منتج.</p>
                ) : (
                  <div className={styles.productsTable}>
                    <table>
                      <thead>
                        <tr>
                          <th>الاسم</th>
                          <th>الكود</th>
                          <th>الكمية</th>
                          <th>سعر الجملة</th>
                          <th>سعر البيع</th>
                          <th>الإجمالي</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map((product, index) => (
                          <tr key={index}>
                            <td>
                              <input
                                type="text"
                                className={styles.tableInput}
                                value={product.name}
                                onChange={(e) =>
                                  handleProductChange(index, "name", e.target.value)
                                }
                                placeholder="اسم المنتج"
                                disabled={loadingAdd}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className={styles.tableInput}
                                value={product.code}
                                onChange={(e) =>
                                  handleProductChange(index, "code", e.target.value)
                                }
                                placeholder="كود المنتج"
                                disabled={loadingAdd}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className={styles.tableInput}
                                value={product.quantity}
                                onChange={(e) =>
                                  handleProductChange(
                                    index,
                                    "quantity",
                                    e.target.value
                                  )
                                }
                                min="1"
                                disabled={loadingAdd}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className={styles.tableInput}
                                value={product.wholesalePrice}
                                onChange={(e) =>
                                  handleProductChange(
                                    index,
                                    "wholesalePrice",
                                    e.target.value
                                  )
                                }
                                min="0"
                                step="0.01"
                                disabled={loadingAdd}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className={styles.tableInput}
                                value={product.sellingPrice}
                                onChange={(e) =>
                                  handleProductChange(
                                    index,
                                    "sellingPrice",
                                    e.target.value
                                  )
                                }
                                min="0"
                                step="0.01"
                                disabled={loadingAdd}
                              />
                            </td>
                            <td className={styles.totalCell}>
                              {formatCurrency(product.quantity * product.wholesalePrice)}
                            </td>
                            <td>
                              <button
                                className={styles.removeButton}
                                onClick={() => handleRemoveProduct(index)}
                                disabled={loadingAdd}
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

                {/* Total */}
                <div className={styles.totalSection}>
                  <span className={styles.totalLabel}>إجمالي الفاتورة:</span>
                  <span className={styles.totalValue}>
                    {formatCurrency(calculateTotal())}
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>ملاحظات</label>
                <textarea
                  className={styles.formTextarea}
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="ملاحظات إضافية (اختياري)"
                  rows="3"
                  disabled={loadingAdd}
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                className={styles.modalButtonSecondary}
                onClick={() => !loadingAdd && setShowAddModal(false)}
                disabled={loadingAdd}
              >
                إلغاء
              </button>
              <button
                className={styles.modalButton}
                onClick={handleSavePurchase}
                disabled={loadingAdd}
              >
                {loadingAdd ? (
                  <>
                    <FaSpinner className={styles.spinner} />
                    <span>جارٍ الحفظ...</span>
                  </>
                ) : (
                  "حفظ الفاتورة"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Purchase Modal */}
      {showEditModal && selectedPurchase && (
        <div
          className={styles.modalOverlay}
          onClick={() => !loadingEdit && setShowEditModal(false)}
        >
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>تعديل فاتورة شراء</h3>
              <button
                className={styles.modalClose}
                onClick={() => !loadingEdit && setShowEditModal(false)}
                disabled={loadingEdit}
              >
                <FaTimes />
              </button>
            </div>
            <div className={styles.modalBody}>
              {/* Supplier Selection */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>المورد *</label>
                <select
                  className={styles.formSelect}
                  value={selectedSupplier?.id || ""}
                  onChange={(e) => {
                    const supplier = suppliers.find((s) => s.id === e.target.value);
                    setSelectedSupplier(supplier || null);
                  }}
                  disabled={loadingEdit}
                >
                  <option value="">اختر مورد</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Invoice Number */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>رقم الفاتورة</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={formData.invoiceNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, invoiceNumber: e.target.value })
                  }
                  placeholder="رقم الفاتورة"
                  disabled={loadingEdit}
                />
              </div>

              {/* Products Table */}
              <div className={styles.productsSection}>
                <div className={styles.productsHeader}>
                  <h4 className={styles.productsTitle}>المنتجات</h4>
                  <button
                    className={styles.addProductButton}
                    onClick={handleAddProduct}
                    disabled={loadingEdit}
                  >
                    <FaPlus />
                    <span>إضافة منتج</span>
                  </button>
                </div>

                {products.length === 0 ? (
                  <p className={styles.noProducts}>لا توجد منتجات. اضغط "إضافة منتج" لإضافة منتج.</p>
                ) : (
                  <div className={styles.productsTable}>
                    <table>
                      <thead>
                        <tr>
                          <th>الاسم</th>
                          <th>الكود</th>
                          <th>الكمية</th>
                          <th>سعر الجملة</th>
                          <th>سعر البيع</th>
                          <th>الإجمالي</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map((product, index) => (
                          <tr key={index}>
                            <td>
                              <input
                                type="text"
                                className={styles.tableInput}
                                value={product.name}
                                onChange={(e) =>
                                  handleProductChange(index, "name", e.target.value)
                                }
                                placeholder="اسم المنتج"
                                disabled={loadingEdit}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className={styles.tableInput}
                                value={product.code}
                                onChange={(e) =>
                                  handleProductChange(index, "code", e.target.value)
                                }
                                placeholder="كود المنتج"
                                disabled={loadingEdit}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className={styles.tableInput}
                                value={product.quantity}
                                onChange={(e) =>
                                  handleProductChange(
                                    index,
                                    "quantity",
                                    e.target.value
                                  )
                                }
                                min="1"
                                disabled={loadingEdit}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className={styles.tableInput}
                                value={product.wholesalePrice}
                                onChange={(e) =>
                                  handleProductChange(
                                    index,
                                    "wholesalePrice",
                                    e.target.value
                                  )
                                }
                                min="0"
                                step="0.01"
                                disabled={loadingEdit}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className={styles.tableInput}
                                value={product.sellingPrice}
                                onChange={(e) =>
                                  handleProductChange(
                                    index,
                                    "sellingPrice",
                                    e.target.value
                                  )
                                }
                                min="0"
                                step="0.01"
                                disabled={loadingEdit}
                              />
                            </td>
                            <td className={styles.totalCell}>
                              {formatCurrency(product.quantity * product.wholesalePrice)}
                            </td>
                            <td>
                              <button
                                className={styles.removeButton}
                                onClick={() => handleRemoveProduct(index)}
                                disabled={loadingEdit}
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

                {/* Total */}
                <div className={styles.totalSection}>
                  <span className={styles.totalLabel}>إجمالي الفاتورة:</span>
                  <span className={styles.totalValue}>
                    {formatCurrency(calculateTotal())}
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>ملاحظات</label>
                <textarea
                  className={styles.formTextarea}
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="ملاحظات إضافية (اختياري)"
                  rows="3"
                  disabled={loadingEdit}
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                className={styles.modalButtonSecondary}
                onClick={() => !loadingEdit && setShowEditModal(false)}
                disabled={loadingEdit}
              >
                إلغاء
              </button>
              <button
                className={styles.modalButton}
                onClick={handleEditPurchase}
                disabled={loadingEdit}
              >
                {loadingEdit ? (
                  <>
                    <FaSpinner className={styles.spinner} />
                    <span>جارٍ التحديث...</span>
                  </>
                ) : (
                  "حفظ التعديلات"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && selectedPurchase && (
        <div
          className={styles.modalOverlay}
          onClick={() => {
            if (!loadingDelete) {
              setShowDeleteConfirm(false);
              setSelectedPurchase(null);
            }
          }}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>تأكيد الحذف</h3>
              <button
                className={styles.modalClose}
                onClick={() => {
                  if (!loadingDelete) {
                    setShowDeleteConfirm(false);
                    setSelectedPurchase(null);
                  }
                }}
                disabled={loadingDelete}
              >
                <FaTimes />
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalText}>
                هل أنت متأكد من حذف الفاتورة "{selectedPurchase.invoiceNumber}"؟
                <br />
                سيتم حذف المتبقي ({formatCurrency(selectedPurchase.totalAmount)}) من حساب المورد "{selectedPurchase.supplierName}".
                <br />
                لا يمكن التراجع عن هذا الإجراء.
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button
                className={styles.modalButtonSecondary}
                onClick={() => {
                  if (!loadingDelete) {
                    setShowDeleteConfirm(false);
                    setSelectedPurchase(null);
                  }
                }}
                disabled={loadingDelete}
              >
                إلغاء
              </button>
              <button
                className={`${styles.modalButton} ${styles.modalButtonDanger}`}
                onClick={handleDeletePurchase}
                disabled={loadingDelete}
              >
                {loadingDelete ? (
                  <>
                    <FaSpinner className={styles.spinner} />
                    <span>جارٍ الحذف...</span>
                  </>
                ) : (
                  "حذف الفاتورة"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


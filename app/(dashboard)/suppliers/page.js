"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import { useAuth } from "@/components/AuthContext";
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaChartBar,
  FaTruck,
  FaTimes,
  FaSpinner,
  FaMoneyBillWave,
  FaHistory,
} from "react-icons/fa";
import styles from "./page.module.css";

export default function SuppliersPage() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [formData, setFormData] = useState({ name: "", phone: "" });
  const [notifications, setNotifications] = useState([]);
  const [reportsData, setReportsData] = useState(null);
  const [loadingReports, setLoadingReports] = useState(false);
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPaymentReportsModal, setShowPaymentReportsModal] = useState(false);
  const [paymentData, setPaymentData] = useState({
    amount: "",
    paymentMethod: "نقدي",
    paymentDate: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [paymentReportsData, setPaymentReportsData] = useState(null);
  const [loadingPaymentReports, setLoadingPaymentReports] = useState(false);

  useEffect(() => {
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

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const suppliersRef = collection(firestore, "suppliers");
      const snapshot = await getDocs(suppliersRef);
      const suppliersList = [];
      snapshot.forEach((docSnap) => {
        suppliersList.push({ id: docSnap.id, ...docSnap.data() });
      });
      setSuppliers(suppliersList);
    } catch (error) {
      console.error("خطأ في جلب الموردين:", error);
      showNotification("فشل تحميل قائمة الموردين", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!formData.name.trim() || !formData.phone.trim()) {
      showNotification("الرجاء إدخال جميع الحقول المطلوبة", "error");
      return;
    }

    try {
      setLoadingAdd(true);
      const suppliersRef = collection(firestore, "suppliers");
      await addDoc(suppliersRef, {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        balance: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      showNotification("تم إضافة المورد بنجاح", "success");
      setShowAddModal(false);
      setFormData({ name: "", phone: "" });
      loadSuppliers();
    } catch (error) {
      console.error("خطأ في إضافة المورد:", error);
      showNotification("فشل إضافة المورد", "error");
    } finally {
      setLoadingAdd(false);
    }
  };

  const handleEdit = async () => {
    if (!formData.name.trim() || !formData.phone.trim()) {
      showNotification("الرجاء إدخال جميع الحقول المطلوبة", "error");
      return;
    }

    if (!selectedSupplier) return;

    try {
      setLoadingEdit(true);
      const supplierRef = doc(firestore, "suppliers", selectedSupplier.id);
      await updateDoc(supplierRef, {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        updatedAt: new Date().toISOString(),
      });
      showNotification("تم تحديث المورد بنجاح", "success");
      setShowEditModal(false);
      setSelectedSupplier(null);
      setFormData({ name: "", phone: "" });
      loadSuppliers();
    } catch (error) {
      console.error("خطأ في تحديث المورد:", error);
      showNotification("فشل تحديث المورد", "error");
    } finally {
      setLoadingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedSupplier) return;

    try {
      setLoadingDelete(true);
      const supplierRef = doc(firestore, "suppliers", selectedSupplier.id);
      await deleteDoc(supplierRef);
      showNotification("تم حذف المورد بنجاح", "success");
      setShowDeleteConfirm(false);
      setSelectedSupplier(null);
      loadSuppliers();
    } catch (error) {
      console.error("خطأ في حذف المورد:", error);
      showNotification("فشل حذف المورد", "error");
    } finally {
      setLoadingDelete(false);
    }
  };

  const handleShowReports = async (supplier) => {
    setSelectedSupplier(supplier);
    setShowReportsModal(true);
    setLoadingReports(true);
    setReportsData(null);

    try {
      // جلب فواتير الشراء للمورد
      const purchasesRef = collection(firestore, "purchases");
      const q = query(purchasesRef, where("supplierId", "==", supplier.id));
      const snapshot = await getDocs(q);

      let totalPurchases = 0;
      let invoiceCount = 0;
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        totalPurchases += data.totalAmount || 0;
        invoiceCount++;
      });

      setReportsData({
        name: supplier.name,
        phone: supplier.phone,
        balance: supplier.balance || 0,
        totalPurchases,
        invoiceCount,
      });
    } catch (error) {
      console.error("خطأ في جلب تقارير المورد:", error);
      showNotification("فشل تحميل تقارير المورد", "error");
      setReportsData({
        name: supplier.name,
        phone: supplier.phone,
        balance: supplier.balance || 0,
        totalPurchases: 0,
        invoiceCount: 0,
      });
    } finally {
      setLoadingReports(false);
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

  const openAddModal = () => {
    setFormData({ name: "", phone: "" });
    setShowAddModal(true);
  };

  const openEditModal = (supplier) => {
    setSelectedSupplier(supplier);
    setFormData({
      name: supplier.name || "",
      phone: supplier.phone || "",
    });
    setShowEditModal(true);
  };

  const openDeleteConfirm = (supplier) => {
    setSelectedSupplier(supplier);
    setShowDeleteConfirm(true);
  };

  const openPaymentModal = (supplier) => {
    setSelectedSupplier(supplier);
    setPaymentData({
      amount: "",
      paymentMethod: "نقدي",
      paymentDate: new Date().toISOString().split("T")[0],
      notes: "",
    });
    setShowPaymentModal(true);
  };

  const handlePayment = async () => {
    if (!selectedSupplier) return;

    const amount = parseFloat(paymentData.amount);
    if (!amount || amount <= 0) {
      showNotification("الرجاء إدخال مبلغ صحيح", "error");
      return;
    }

    if (amount > (selectedSupplier.balance || 0)) {
      showNotification("مبلغ السداد لا يمكن أن يزيد عن المتبقي", "error");
      return;
    }

    try {
      setLoadingPayment(true);
      const paymentsRef = collection(firestore, "supplierPayments");
      await addDoc(paymentsRef, {
        supplierId: selectedSupplier.id,
        supplierName: selectedSupplier.name,
        amount,
        paymentMethod: paymentData.paymentMethod,
        paymentDate: paymentData.paymentDate,
        notes: paymentData.notes.trim(),
        createdAt: new Date().toISOString(),
        createdBy: user?.uid || "",
      });

      // تحديث المتبقي للمورد
      const supplierRef = doc(firestore, "suppliers", selectedSupplier.id);
      const currentBalance = selectedSupplier.balance || 0;
      await updateDoc(supplierRef, {
        balance: currentBalance - amount,
        updatedAt: new Date().toISOString(),
      });

      showNotification("تم تسجيل السداد بنجاح", "success");
      setShowPaymentModal(false);
      setSelectedSupplier(null);
      setPaymentData({
        amount: "",
        paymentMethod: "نقدي",
        paymentDate: new Date().toISOString().split("T")[0],
        notes: "",
      });
      loadSuppliers();
    } catch (error) {
      console.error("خطأ في تسجيل السداد:", error);
      showNotification("فشل تسجيل السداد", "error");
    } finally {
      setLoadingPayment(false);
    }
  };

  const handleShowPaymentReports = async (supplier) => {
    setSelectedSupplier(supplier);
    setShowPaymentReportsModal(true);
    setLoadingPaymentReports(true);
    setPaymentReportsData(null);

    try {
      const paymentsRef = collection(firestore, "supplierPayments");
      // استخدام where فقط بدون orderBy لتجنب مشاكل الـ index
      const q = query(
        paymentsRef,
        where("supplierId", "==", supplier.id)
      );
      const snapshot = await getDocs(q);

      const payments = [];
      let totalPaid = 0;
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        payments.push({ 
          id: docSnap.id, 
          ...data,
          createdAt: data.createdAt || data.paymentDate || new Date().toISOString()
        });
        totalPaid += data.amount || 0;
      });

      // ترتيب السدادات حسب التاريخ (الأحدث أولاً) في الكود
      payments.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.paymentDate || 0);
        const dateB = new Date(b.createdAt || b.paymentDate || 0);
        return dateB - dateA; // ترتيب تنازلي
      });

      setPaymentReportsData({
        supplierName: supplier.name,
        payments,
        totalPaid,
        lastPayment: payments[0] || null,
      });
    } catch (error) {
      console.error("خطأ في جلب تقارير السداد:", error);
      // عرض الخطأ فقط إذا لم يكن بسبب عدم وجود بيانات
      if (error.code !== "failed-precondition" && error.code !== "permission-denied") {
        showNotification("فشل تحميل تقارير السداد", "error");
      }
      // في جميع الأحوال، نعرض البيانات الفارغة
      setPaymentReportsData({
        supplierName: supplier.name,
        payments: [],
        totalPaid: 0,
        lastPayment: null,
      });
    } finally {
      setLoadingPaymentReports(false);
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
        <h2 className={styles.pageTitle}>الموردون</h2>
        <button className={styles.addButton} onClick={openAddModal}>
          <FaPlus />
          <span>إضافة مورد جديد</span>
        </button>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className={styles.loading}>جارٍ التحميل...</div>
      ) : suppliers.length === 0 ? (
        <div className={styles.emptyState}>
          <FaTruck className={styles.emptyIcon} />
          <p>لا توجد موردين حالياً</p>
          <button className={styles.emptyButton} onClick={openAddModal}>
            إضافة أول مورد
          </button>
        </div>
      ) : (
        <div className={styles.suppliersGrid}>
          {suppliers.map((supplier) => (
            <div key={supplier.id} className={styles.supplierCard}>
              <div className={styles.cardIcon}>
                <FaTruck />
              </div>
              <div className={styles.cardContent}>
                <h3 className={styles.supplierName}>{supplier.name}</h3>
                <p className={styles.supplierPhone}>{supplier.phone}</p>
                <div
                  className={`${styles.supplierBalance} ${
                    (supplier.balance || 0) > 0 ? styles.balancePositive : ""
                  }`}
                >
                  المتبقي: {formatCurrency(supplier.balance || 0)}
                </div>
              </div>
              <div className={styles.cardActions}>
                <button
                  className={styles.actionButton}
                  onClick={() => openEditModal(supplier)}
                  title="تعديل"
                >
                  <FaEdit />
                </button>
                <button
                  className={`${styles.actionButton} ${styles.actionButtonPayment}`}
                  onClick={() => openPaymentModal(supplier)}
                  title="سداد"
                  disabled={(supplier.balance || 0) <= 0}
                >
                  <FaMoneyBillWave />
                </button>
                <button
                  className={`${styles.actionButton} ${styles.actionButtonPaymentReports}`}
                  onClick={() => handleShowPaymentReports(supplier)}
                  title="تقارير السداد"
                >
                  <FaHistory />
                </button>
                <button
                  className={`${styles.actionButton} ${styles.actionButtonReports}`}
                  onClick={() => handleShowReports(supplier)}
                  title="تقارير"
                >
                  <FaChartBar />
                </button>
                <button
                  className={`${styles.actionButton} ${styles.actionButtonDanger}`}
                  onClick={() => openDeleteConfirm(supplier)}
                  title="حذف"
                >
                  <FaTrash />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => !loadingAdd && setShowAddModal(false)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>إضافة مورد جديد</h3>
              <button
                className={styles.modalClose}
                onClick={() => !loadingAdd && setShowAddModal(false)}
                disabled={loadingAdd}
              >
                <FaTimes />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>اسم المورد</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="أدخل اسم المورد"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>رقم الهاتف</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="أدخل رقم الهاتف"
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
                onClick={handleAdd}
                disabled={loadingAdd}
              >
                {loadingAdd ? (
                  <>
                    <FaSpinner className={styles.spinner} />
                    <span>جارٍ الحفظ...</span>
                  </>
                ) : (
                  "حفظ"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => {
            if (!loadingEdit) {
              setShowEditModal(false);
              setSelectedSupplier(null);
              setFormData({ name: "", phone: "" });
            }
          }}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>تعديل مورد</h3>
              <button
                className={styles.modalClose}
                onClick={() => {
                  if (!loadingEdit) {
                    setShowEditModal(false);
                    setSelectedSupplier(null);
                    setFormData({ name: "", phone: "" });
                  }
                }}
                disabled={loadingEdit}
              >
                <FaTimes />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>اسم المورد</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="أدخل اسم المورد"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>رقم الهاتف</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="أدخل رقم الهاتف"
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                className={styles.modalButtonSecondary}
                onClick={() => {
                  if (!loadingEdit) {
                    setShowEditModal(false);
                    setSelectedSupplier(null);
                    setFormData({ name: "", phone: "" });
                  }
                }}
                disabled={loadingEdit}
              >
                إلغاء
              </button>
              <button
                className={styles.modalButton}
                onClick={handleEdit}
                disabled={loadingEdit}
              >
                {loadingEdit ? (
                  <>
                    <FaSpinner className={styles.spinner} />
                    <span>جارٍ التحديث...</span>
                  </>
                ) : (
                  "حفظ"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div
          className={styles.modalOverlay}
          onClick={() => {
            if (!loadingDelete) {
              setShowDeleteConfirm(false);
              setSelectedSupplier(null);
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
                    setSelectedSupplier(null);
                  }
                }}
                disabled={loadingDelete}
              >
                <FaTimes />
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalText}>
                هل أنت متأكد من حذف المورد "{selectedSupplier?.name}"؟
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
                    setSelectedSupplier(null);
                  }
                }}
                disabled={loadingDelete}
              >
                إلغاء
              </button>
              <button
                className={`${styles.modalButton} ${styles.modalButtonDanger}`}
                onClick={handleDelete}
                disabled={loadingDelete}
              >
                {loadingDelete ? (
                  <>
                    <FaSpinner className={styles.spinner} />
                    <span>جارٍ الحذف...</span>
                  </>
                ) : (
                  "حذف"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reports Modal */}
      {showReportsModal && selectedSupplier && (
        <div
          className={styles.modalOverlay}
          onClick={() => {
            setShowReportsModal(false);
            setSelectedSupplier(null);
            setReportsData(null);
          }}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>تقارير المورد</h3>
              <button
                className={styles.modalClose}
                onClick={() => {
                  setShowReportsModal(false);
                  setSelectedSupplier(null);
                  setReportsData(null);
                }}
              >
                <FaTimes />
              </button>
            </div>
            <div className={styles.modalBody}>
              {loadingReports ? (
                <div className={styles.loadingReports}>جارٍ تحميل البيانات...</div>
              ) : reportsData ? (
                <div className={styles.reportsContent}>
                  <div className={styles.reportSection}>
                    <h4 className={styles.reportSectionTitle}>معلومات المورد</h4>
                    <div className={styles.reportItem}>
                      <span className={styles.reportLabel}>الاسم:</span>
                      <span className={styles.reportValue}>{reportsData.name}</span>
                    </div>
                    <div className={styles.reportItem}>
                      <span className={styles.reportLabel}>الهاتف:</span>
                      <span className={styles.reportValue}>{reportsData.phone}</span>
                    </div>
                  </div>
                  <div className={styles.reportSection}>
                    <h4 className={styles.reportSectionTitle}>الإحصائيات</h4>
                    <div className={styles.reportItem}>
                      <span className={styles.reportLabel}>المتبقي:</span>
                      <span
                        className={`${styles.reportValue} ${
                          reportsData.balance > 0 ? styles.balancePositive : ""
                        }`}
                      >
                        {formatCurrency(reportsData.balance)}
                      </span>
                    </div>
                    <div className={styles.reportItem}>
                      <span className={styles.reportLabel}>إجمالي المشتريات:</span>
                      <span className={styles.reportValue}>
                        {formatCurrency(reportsData.totalPurchases)}
                      </span>
                    </div>
                    <div className={styles.reportItem}>
                      <span className={styles.reportLabel}>عدد الفواتير:</span>
                      <span className={styles.reportValue}>
                        {reportsData.invoiceCount}
                      </span>
                    </div>
                  </div>
                  <div className={styles.reportActions}>
                    <button
                      className={styles.reportActionButton}
                      onClick={() => handleShowPaymentReports(selectedSupplier)}
                    >
                      <FaMoneyBillWave />
                      <span>تقارير السداد</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            <div className={styles.modalFooter}>
              <button
                className={styles.modalButton}
                onClick={() => {
                  setShowReportsModal(false);
                  setSelectedSupplier(null);
                  setReportsData(null);
                }}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedSupplier && (
        <div
          className={styles.modalOverlay}
          onClick={() => {
            if (!loadingPayment) {
              setShowPaymentModal(false);
              setSelectedSupplier(null);
              setPaymentData({
                amount: "",
                paymentMethod: "نقدي",
                paymentDate: new Date().toISOString().split("T")[0],
                notes: "",
              });
            }
          }}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>سداد للمورد</h3>
              <button
                className={styles.modalClose}
                onClick={() => {
                  if (!loadingPayment) {
                    setShowPaymentModal(false);
                    setSelectedSupplier(null);
                    setPaymentData({
                      amount: "",
                      paymentMethod: "نقدي",
                      paymentDate: new Date().toISOString().split("T")[0],
                      notes: "",
                    });
                  }
                }}
                disabled={loadingPayment}
              >
                <FaTimes />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.paymentInfo}>
                <p className={styles.paymentInfoText}>
                  المورد: <strong>{selectedSupplier.name}</strong>
                </p>
                <p className={styles.paymentInfoText}>
                  المتبقي الحالي:{" "}
                  <strong className={styles.balanceAmount}>
                    {formatCurrency(selectedSupplier.balance || 0)}
                  </strong>
                </p>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>مبلغ السداد *</label>
                <input
                  type="number"
                  className={styles.formInput}
                  value={paymentData.amount}
                  onChange={(e) =>
                    setPaymentData({ ...paymentData, amount: e.target.value })
                  }
                  placeholder="أدخل مبلغ السداد"
                  min="0"
                  step="0.01"
                  disabled={loadingPayment}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>طريقة الدفع *</label>
                <select
                  className={styles.formSelect}
                  value={paymentData.paymentMethod}
                  onChange={(e) =>
                    setPaymentData({
                      ...paymentData,
                      paymentMethod: e.target.value,
                    })
                  }
                  disabled={loadingPayment}
                >
                  <option value="نقدي">نقدي</option>
                  <option value="تحويل بنكي">تحويل بنكي</option>
                  <option value="شيك">شيك</option>
                  <option value="أخرى">أخرى</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>تاريخ السداد *</label>
                <input
                  type="date"
                  className={styles.formInput}
                  value={paymentData.paymentDate}
                  onChange={(e) =>
                    setPaymentData({
                      ...paymentData,
                      paymentDate: e.target.value,
                    })
                  }
                  disabled={loadingPayment}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>ملاحظات</label>
                <textarea
                  className={styles.formTextarea}
                  value={paymentData.notes}
                  onChange={(e) =>
                    setPaymentData({ ...paymentData, notes: e.target.value })
                  }
                  placeholder="ملاحظات إضافية (اختياري)"
                  rows="3"
                  disabled={loadingPayment}
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                className={styles.modalButtonSecondary}
                onClick={() => {
                  if (!loadingPayment) {
                    setShowPaymentModal(false);
                    setSelectedSupplier(null);
                    setPaymentData({
                      amount: "",
                      paymentMethod: "نقدي",
                      paymentDate: new Date().toISOString().split("T")[0],
                      notes: "",
                    });
                  }
                }}
                disabled={loadingPayment}
              >
                إلغاء
              </button>
              <button
                className={styles.modalButton}
                onClick={handlePayment}
                disabled={loadingPayment}
              >
                {loadingPayment ? (
                  <>
                    <FaSpinner className={styles.spinner} />
                    <span>جارٍ التسجيل...</span>
                  </>
                ) : (
                  "تسجيل السداد"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Reports Modal */}
      {showPaymentReportsModal && selectedSupplier && (
        <div
          className={styles.modalOverlay}
          onClick={() => {
            setShowPaymentReportsModal(false);
            setSelectedSupplier(null);
            setPaymentReportsData(null);
          }}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>تقارير السداد</h3>
              <button
                className={styles.modalClose}
                onClick={() => {
                  setShowPaymentReportsModal(false);
                  setSelectedSupplier(null);
                  setPaymentReportsData(null);
                }}
              >
                <FaTimes />
              </button>
            </div>
            <div className={styles.modalBody}>
              {loadingPaymentReports ? (
                <div className={styles.loadingReports}>جارٍ تحميل البيانات...</div>
              ) : paymentReportsData ? (
                <div className={styles.reportsContent}>
                  <div className={styles.reportSection}>
                    <h4 className={styles.reportSectionTitle}>
                      تقارير السداد - {paymentReportsData.supplierName}
                    </h4>
                    <div className={styles.reportItem}>
                      <span className={styles.reportLabel}>إجمالي المدفوع:</span>
                      <span className={styles.reportValue}>
                        {formatCurrency(paymentReportsData.totalPaid)}
                      </span>
                    </div>
                    <div className={styles.reportItem}>
                      <span className={styles.reportLabel}>عدد السدادات:</span>
                      <span className={styles.reportValue}>
                        {paymentReportsData.payments.length}
                      </span>
                    </div>
                    {paymentReportsData.lastPayment && (
                      <div className={styles.reportItem}>
                        <span className={styles.reportLabel}>آخر سداد:</span>
                        <span className={styles.reportValue}>
                          {formatCurrency(paymentReportsData.lastPayment.amount)} -{" "}
                          {formatDate(paymentReportsData.lastPayment.paymentDate)}
                        </span>
                      </div>
                    )}
                  </div>
                  {paymentReportsData.payments.length > 0 ? (
                    <div className={styles.reportSection}>
                      <h4 className={styles.reportSectionTitle}>قائمة السدادات</h4>
                      <div className={styles.paymentsTable}>
                        <table>
                          <thead>
                            <tr>
                              <th>التاريخ</th>
                              <th>المبلغ</th>
                              <th>طريقة الدفع</th>
                              <th>ملاحظات</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paymentReportsData.payments.map((payment) => (
                              <tr key={payment.id}>
                                <td>{formatDate(payment.paymentDate)}</td>
                                <td className={styles.amountCell}>
                                  {formatCurrency(payment.amount)}
                                </td>
                                <td>{payment.paymentMethod}</td>
                                <td>{payment.notes || "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <p className={styles.noPayments}>لا توجد سدادات مسجلة</p>
                  )}
                </div>
              ) : null}
            </div>
            <div className={styles.modalFooter}>
              <button
                className={styles.modalButton}
                onClick={() => {
                  setShowPaymentReportsModal(false);
                  setSelectedSupplier(null);
                  setPaymentReportsData(null);
                }}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


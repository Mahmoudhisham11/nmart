"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  runTransaction,
  where,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import { useAuth } from "@/components/AuthContext";
import { FaBarcode, FaMinus, FaPlus, FaSpinner, FaTrash } from "react-icons/fa";
import styles from "./page.module.css";

export default function POSPage() {
  const { user } = useAuth();
  const barcodeRef = useRef(null);

  const [barcodeInput, setBarcodeInput] = useState("");
  const [cartItems, setCartItems] = useState([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    // تركيز تلقائي على حقل الباركود
    const t = setTimeout(() => barcodeRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const showNotification = (message, type = "error") => {
    const id = Date.now();
    const notification = { id, message, type };
    setNotifications((prev) => [...prev, notification]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  };

  const formatCurrency = (value) =>
    new Intl.NumberFormat("ar-EG", {
      style: "currency",
      currency: "EGP",
      maximumFractionDigits: 0,
    }).format(value || 0);

  const cartTotal = useMemo(
    () =>
      cartItems.reduce(
        (sum, it) => sum + (it.quantity || 0) * (it.unitPrice || 0),
        0
      ),
    [cartItems]
  );

  const findProductByBarcodeOrCode = async (value) => {
    const cleaned = String(value || "").trim();
    if (!cleaned) return null;

    const productsRef = collection(firestore, "products");

    // 1) محاولة البحث بالباركود
    const qBarcode = query(productsRef, where("barcode", "==", cleaned));
    const snapBarcode = await getDocs(qBarcode);
    if (!snapBarcode.empty) {
      const docSnap = snapBarcode.docs[0];
      return { id: docSnap.id, ...docSnap.data() };
    }

    // 2) محاولة البحث بالكود (code) لو المستخدم بيستخدمه بدل الباركود
    const qCode = query(productsRef, where("code", "==", cleaned));
    const snapCode = await getDocs(qCode);
    if (!snapCode.empty) {
      const docSnap = snapCode.docs[0];
      return { id: docSnap.id, ...docSnap.data() };
    }

    return null;
  };

  // مزامنة منتج من فواتير الشراء إلى products (لو المنتج موجود في purchases فقط)
  const syncProductFromPurchases = async (codeOrBarcode) => {
    const cleaned = String(codeOrBarcode || "").trim();
    if (!cleaned) return null;

    // نجلب فواتير الشراء ونبحث محلياً داخل products array (MVP)
    const purchasesRef = collection(firestore, "purchases");
    const purchasesSnap = await getDocs(purchasesRef);

    let foundLine = null;
    let totalPurchasedQty = 0;
    purchasesSnap.forEach((d) => {
      const data = d.data();
      const items = Array.isArray(data.products) ? data.products : [];
      items.forEach((p) => {
        const code = String(p.code ?? "").trim();
        const barcode = String(p.barcode ?? "").trim();
        if (code === cleaned || barcode === cleaned) {
          foundLine = foundLine || p; // أول مرة نلاقي فيها المنتج
          totalPurchasedQty += Number(p.quantity || 0);
        }
      });
    });

    if (!foundLine) return null;

    // خصم الكميات المباعة من sales (لو موجودة)
    let totalSoldQty = 0;
    try {
      const salesRef = collection(firestore, "sales");
      const salesSnap = await getDocs(salesRef);
      salesSnap.forEach((d) => {
        const data = d.data();
        const items = Array.isArray(data.items) ? data.items : [];
        items.forEach((it) => {
          const code = String(it.code ?? "").trim();
          const barcode = String(it.barcode ?? "").trim();
          if (code === cleaned || barcode === cleaned) {
            totalSoldQty += Number(it.quantity || 0);
          }
        });
      });
    } catch (e) {
      // لو sales مش موجودة/صلاحيات.. نكمل على المشتريات فقط
    }

    const netQty = Math.max(0, totalPurchasedQty - totalSoldQty);

    // إنشاء المنتج في المخزون (products) عشان يبقى قابل للبيع
    const nameAr = String(foundLine.name ?? foundLine.nameAr ?? "منتج").trim();
    const code = String(foundLine.code ?? cleaned).trim();
    const barcode = String(foundLine.barcode ?? cleaned).trim();
    const costPrice = Number(foundLine.wholesalePrice || 0);
    const sellingPrice = Number(foundLine.sellingPrice || 0);

    const productsRef = collection(firestore, "products");
    const now = new Date().toISOString();

    const newDocRef = await addDoc(productsRef, {
      nameAr,
      code,
      barcode,
      quantity: netQty,
      costPrice,
      sellingPrice,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id: newDocRef.id,
      nameAr,
      code,
      barcode,
      quantity: netQty,
      costPrice,
      sellingPrice,
    };
  };

  const addProductToCart = (product) => {
    const available = typeof product.quantity === "number" ? product.quantity : 0;
    if (available < 1) {
      showNotification("هذا المنتج نفد من المخزون", "warning");
      return;
    }

    setCartItems((prev) => {
      const existing = prev.find((x) => x.productId === product.id);
      if (!existing) {
        return [
          ...prev,
          {
            productId: product.id,
            nameAr: product.nameAr || product.name || "منتج",
            barcode: product.barcode || "",
            quantity: 1,
            unitPrice:
              typeof product.sellingPrice === "number" ? product.sellingPrice : 0,
            costPrice: typeof product.costPrice === "number" ? product.costPrice : 0,
            availableQuantity: available,
          },
        ];
      }

      const newQty = (existing.quantity || 0) + 1;
      if (newQty > (existing.availableQuantity ?? available)) {
        showNotification(
          "الكمية المطلوبة أكبر من الكمية المتاحة في المخزون",
          "error"
        );
        return prev;
      }

      return prev.map((x) =>
        x.productId === product.id ? { ...x, quantity: newQty } : x
      );
    });
  };

  const handleBarcodeSubmit = async (e) => {
    e?.preventDefault?.();
    const barcode = barcodeInput.trim();
    if (!barcode) return;

    try {
      setSearching(true);
      let product = await findProductByBarcodeOrCode(barcode);

      // لو المنتج مش موجود في products لكن موجود في فواتير الشراء -> مزامنة تلقائية
      if (!product) {
        const synced = await syncProductFromPurchases(barcode);
        if (synced) {
          product = synced;
          showNotification("تمت مزامنة المنتج من فواتير الشراء إلى المخزون", "success");
        }
      }

      if (!product) {
        showNotification("لم يتم العثور على منتج بهذا الكود/الباركود", "error");
        return;
      }

      addProductToCart(product);
      setBarcodeInput("");
      setTimeout(() => barcodeRef.current?.focus(), 0);
    } catch (err) {
      console.error("خطأ في البحث بالباركود:", err);
      showNotification("حدث خطأ أثناء البحث عن المنتج", "error");
    } finally {
      setSearching(false);
    }
  };

  const removeCartItem = (productId) => {
    setCartItems((prev) => prev.filter((x) => x.productId !== productId));
  };

  const setCartItemQuantity = (productId, nextQty) => {
    const qty = Math.floor(Number(nextQty || 0));
    if (qty < 1) return;

    setCartItems((prev) =>
      prev.map((x) => {
        if (x.productId !== productId) return x;
        if (qty > (x.availableQuantity ?? 0)) {
          showNotification(
            "الكمية المطلوبة أكبر من الكمية المتاحة في المخزون",
            "error"
          );
          return x;
        }
        return { ...x, quantity: qty };
      })
    );
  };

  const incQty = (productId) => {
    const it = cartItems.find((x) => x.productId === productId);
    if (!it) return;
    setCartItemQuantity(productId, (it.quantity || 0) + 1);
  };

  const decQty = (productId) => {
    const it = cartItems.find((x) => x.productId === productId);
    if (!it) return;
    const next = (it.quantity || 0) - 1;
    if (next < 1) return;
    setCartItemQuantity(productId, next);
  };

  const generateSaleInvoiceNumber = () => `S-${Date.now()}`;

  const handleSubmitSale = async () => {
    if (cartItems.length === 0) {
      showNotification("السلة فارغة", "warning");
      return;
    }

    try {
      setSubmitting(true);
      // منع البيع بعد تقفيل اليوم
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const dayKey = startOfDay.toISOString().slice(0, 10);
      try {
        const closeRef = doc(firestore, "dayClosures", dayKey);
        const closeSnap = await getDoc(closeRef);
        if (closeSnap.exists()) {
          showNotification("تم تقفيل اليوم، لا يمكن تنفيذ مبيعات جديدة", "warning");
          return;
        }
      } catch (e) {
        // تجاهل
      }

      const invoiceNumber = generateSaleInvoiceNumber();
      const createdAt = new Date().toISOString();

      // Transaction: تأكيد المخزون وتحديثه + إنشاء فاتورة البيع بشكل آمن
      await runTransaction(firestore, async (tx) => {
        // 1) قراءة المنتجات والتحقق من الكميات
        const productSnaps = {};
        for (const it of cartItems) {
          const ref = doc(firestore, "products", it.productId);
          const snap = await tx.get(ref);
          if (!snap.exists()) {
            throw new Error("PRODUCT_NOT_FOUND:" + it.productId);
          }
          productSnaps[it.productId] = { ref, snap };
        }

        for (const it of cartItems) {
          const { snap } = productSnaps[it.productId];
          const data = snap.data();
          const available =
            typeof data.quantity === "number" ? data.quantity : 0;
          if ((it.quantity || 0) > available) {
            throw new Error("INSUFFICIENT_STOCK:" + (data.nameAr || "منتج"));
          }
        }

        // 2) تحديث المخزون
        for (const it of cartItems) {
          const { ref, snap } = productSnaps[it.productId];
          const data = snap.data();
          const available =
            typeof data.quantity === "number" ? data.quantity : 0;
          const newQty = available - (it.quantity || 0);
          tx.update(ref, {
            quantity: newQty < 0 ? 0 : newQty,
            updatedAt: createdAt,
          });
        }

        // 3) إنشاء فاتورة البيع
        const salesRef = collection(firestore, "sales");
        const totalAmount = cartItems.reduce(
          (sum, it) => sum + (it.quantity || 0) * (it.unitPrice || 0),
          0
        );
        const totalCost = cartItems.reduce(
          (sum, it) => sum + (it.quantity || 0) * (it.costPrice || 0),
          0
        );

        tx.set(doc(salesRef), {
          invoiceNumber,
          items: cartItems.map((it) => ({
            productId: it.productId,
            nameAr: it.nameAr,
            barcode: it.barcode,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            total: (it.quantity || 0) * (it.unitPrice || 0),
            costPrice: it.costPrice || 0,
          })),
          totalAmount,
          totalCost,
          paymentMethod: "نقدي",
          createdAt,
          createdBy: user?.uid || "",
        });
      });

      showNotification("تم إتمام عملية البيع بنجاح", "success");
      setCartItems([]);
      setBarcodeInput("");
      setTimeout(() => barcodeRef.current?.focus(), 50);
    } catch (err) {
      console.error("خطأ في إتمام البيع:", err);
      const msg = String(err?.message || "");
      if (msg.startsWith("INSUFFICIENT_STOCK:")) {
        showNotification(
          "الكمية أقل من الكمية المتاحة في المخزن",
          "error"
        );
        return;
      }
      if (msg.startsWith("PRODUCT_NOT_FOUND:")) {
        showNotification("تم حذف أحد المنتجات من قاعدة البيانات", "error");
        return;
      }
      showNotification("فشل إتمام عملية البيع", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      {/* Toast Notifications */}
      <div className={styles.notificationsContainer}>
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`${styles.notification} ${
              n.type === "success"
                ? styles.notificationSuccess
                : n.type === "warning"
                ? styles.notificationWarning
                : styles.notificationError
            }`}
          >
            <span>{n.message}</span>
            <button
              onClick={() =>
                setNotifications((prev) => prev.filter((x) => x.id !== n.id))
              }
              className={styles.notificationClose}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className={styles.header}>
        <h2 className={styles.pageTitle}>نقطة البيع</h2>
      </div>

      <form className={styles.barcodeSection} onSubmit={handleBarcodeSubmit}>
        <div className={styles.barcodeInputWrap}>
          <FaBarcode className={styles.barcodeIcon} />
          <input
            ref={barcodeRef}
            className={styles.barcodeInput}
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            placeholder="أدخل/امسح باركود المنتج ثم اضغط Enter"
            inputMode="numeric"
            autoComplete="off"
            disabled={searching || submitting}
          />
        </div>
        <button
          type="submit"
          className={styles.barcodeButton}
          disabled={!barcodeInput.trim() || searching || submitting}
        >
          {searching ? (
            <>
              <FaSpinner className={styles.spinner} />
              <span>جارٍ الإضافة...</span>
            </>
          ) : (
            <>
              <FaPlus />
              <span>إضافة</span>
            </>
          )}
        </button>
      </form>

      {cartItems.length === 0 ? (
        <div className={styles.emptyState}>
          <p>السلة فارغة. ابدأ بمسح/إدخال باركود منتج.</p>
        </div>
      ) : (
        <div className={styles.cartSection}>
          <div className={styles.cartTable}>
            <table>
              <thead>
                <tr>
                  <th>المنتج</th>
                  <th>الباركود</th>
                  <th>الكمية</th>
                  <th>سعر الوحدة</th>
                  <th>الإجمالي</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cartItems.map((it) => (
                  <tr key={it.productId}>
                    <td className={styles.nameCell}>
                      <div className={styles.nameMain}>{it.nameAr}</div>
                      <div className={styles.nameSub}>
                        المتاح: {it.availableQuantity ?? 0}
                      </div>
                    </td>
                    <td>{it.barcode}</td>
                    <td>
                      <div className={styles.qtyControls}>
                        <button
                          type="button"
                          className={styles.qtyBtn}
                          onClick={() => decQty(it.productId)}
                          disabled={submitting || (it.quantity || 1) <= 1}
                          title="تقليل"
                        >
                          <FaMinus />
                        </button>
                        <input
                          type="number"
                          className={styles.qtyInput}
                          value={it.quantity}
                          min={1}
                          onChange={(e) =>
                            setCartItemQuantity(it.productId, e.target.value)
                          }
                          disabled={submitting}
                        />
                        <button
                          type="button"
                          className={styles.qtyBtn}
                          onClick={() => incQty(it.productId)}
                          disabled={
                            submitting ||
                            (it.quantity || 0) >= (it.availableQuantity ?? 0)
                          }
                          title="زيادة"
                        >
                          <FaPlus />
                        </button>
                      </div>
                    </td>
                    <td>{formatCurrency(it.unitPrice)}</td>
                    <td className={styles.totalCell}>
                      {formatCurrency((it.quantity || 0) * (it.unitPrice || 0))}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.removeButton}
                        onClick={() => removeCartItem(it.productId)}
                        disabled={submitting}
                        title="حذف"
                      >
                        <FaTrash />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.footerRow}>
            <div className={styles.totalSection}>
              <span className={styles.totalLabel}>الإجمالي:</span>
              <span className={styles.totalValue}>{formatCurrency(cartTotal)}</span>
            </div>
            <button
              type="button"
              className={styles.submitButton}
              onClick={handleSubmitSale}
              disabled={submitting || cartItems.length === 0}
            >
              {submitting ? (
                <>
                  <FaSpinner className={styles.spinner} />
                  <span>جارٍ إتمام البيع...</span>
                </>
              ) : (
                "إتمام البيع"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}



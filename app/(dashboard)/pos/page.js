"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import {
  addDoc,
  collection,
  doc,
  getDocs,
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

  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [drinks, setDrinks] = useState([]);
  const [loadingDrinks, setLoadingDrinks] = useState(true);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const [selectedCategory, setSelectedCategory] = useState("");
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= 600;
  });

  useEffect(() => {
    const t = setTimeout(() => barcodeRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 600);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const loadDrinks = async () => {
      try {
        setLoadingDrinks(true);
        const snap = await getDocs(collection(firestore, "drinks"));
        const list = [];
        snap.forEach((row) => {
          const data = row.data();
          if (data.active !== false) {
            list.push({ id: row.id, ...data });
          }
        });
        list.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
        setDrinks(list);
      } catch (e) {
        console.error("خطأ في تحميل المشاريب", e);
      } finally {
        setLoadingDrinks(false);
      }
    };
    loadDrinks();
  }, []);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoadingProducts(true);
        const snap = await getDocs(collection(firestore, "products"));
        const list = [];
        snap.forEach((row) => list.push({ id: row.id, ...row.data() }));
        list.sort((a, b) =>
          String(a.nameAr || a.name || "").localeCompare(
            String(b.nameAr || b.name || ""),
            "ar"
          )
        );
        setProducts(list);
      } catch (e) {
        console.error("خطأ في تحميل المنتجات", e);
      } finally {
        setLoadingProducts(false);
      }
    };
    loadProducts();
  }, []);

  const categories = useMemo(() => {
    const cats = new Set();
    for (const p of products) {
      const c = String(p.category || "").trim();
      if (c) cats.add(c);
    }
    for (const d of drinks) {
      const c = String(d.category || "").trim();
      if (c) cats.add(c);
    }
    return Array.from(cats)
      .sort((a, b) => a.localeCompare(b, "ar"))
      .map((x) => x);
  }, [products, drinks]);

  const hasNoCategory = useMemo(() => {
    const pNo = products.some((p) => !String(p.category || "").trim());
    const dNo = drinks.some((d) => !String(d.category || "").trim());
    return pNo || dNo;
  }, [products, drinks]);

  const filteredProducts = useMemo(() => {
    const cat = String(selectedCategory || "").trim();
    if (!cat) return products;
    if (cat === "__no_category__") {
      return products.filter((p) => !String(p.category || "").trim());
    }
    return products.filter((p) => String(p.category || "").trim() === cat);
  }, [products, selectedCategory]);

  const filteredDrinks = useMemo(() => {
    const cat = String(selectedCategory || "").trim();
    if (!cat) return drinks;
    if (cat === "__no_category__") {
      return drinks.filter((d) => !String(d.category || "").trim());
    }
    return drinks.filter((d) => String(d.category || "").trim() === cat);
  }, [drinks, selectedCategory]);

  const catalogEntries = useMemo(() => {
    const productEntries = filteredProducts.map((p) => ({
      kind: "product",
      id: p.id,
      title: p.nameAr || p.name || "منتج",
      subtitle: p.barcode ? `باركود: ${p.barcode}` : "",
      price: Number(p.sellingPrice || 0),
      availableQuantity:
        typeof p.quantity === "number" ? p.quantity : Number(p.quantity || 0),
      raw: p,
    }));

    const drinkEntries = filteredDrinks.map((d) => ({
      kind: "drink",
      id: d.id,
      title: d.name || "مشروب",
      subtitle: "",
      price: Number(d.price || 0),
      availableQuantity: null,
      raw: d,
    }));

    return [...productEntries, ...drinkEntries].sort((a, b) =>
      String(a.title || "").localeCompare(String(b.title || ""), "ar")
    );
  }, [filteredProducts, filteredDrinks]);

  const showNotification = (message, type = "error") => {
    const id = Date.now();
    const notification = { id, message, type };
    setNotifications((prev) => [...prev, notification]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  };

  const locale = useMemo(() => {
    if (typeof window === "undefined") return "ar-EG-u-nu-latn";
    const lang = String(window.navigator?.language || "ar-EG").toLowerCase();
    if (lang.startsWith("ar")) return "ar-EG-u-nu-latn";
    return "en-US";
  }, []);

  const formatCurrency = (value) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EGP",
      maximumFractionDigits: 0,
    }).format(value || 0);

  const escapeHtml = (v) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const printReceiptInWindow = (receipt) => {
    if (typeof window === "undefined") return;
    const rows = (receipt.items || [])
      .map(
        (it) => `
          <tr>
            <td>${escapeHtml(it.nameAr)}</td>
            <td>${escapeHtml(it.quantity)}</td>
            <td>${escapeHtml(formatCurrency(it.total))}</td>
          </tr>
        `
      )
      .join("");

    const invoiceDate = new Date(receipt.createdAt).toLocaleString(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    const html = `<!doctype html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <title>فاتورة ${escapeHtml(receipt.invoiceNumber)}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; font-family: "Segoe UI", Tahoma, Arial, sans-serif; }
    .receipt { width: 80mm; box-sizing: border-box; padding: 10px 7px; color: #111827; }
    .logo-wrap { text-align: center; margin-bottom: 6px; }
    .logo { width: 68px; height: auto; display: block; margin: 0 auto 3px; }
    .brand { font-weight: 900; font-size: 14px; letter-spacing: .3px; }
    .title { text-align: center; font-size: 13px; font-weight: 800; margin: 4px 0 8px; }
    .meta { font-size: 11px; line-height: 1.6; margin-bottom: 8px; }
    .meta-row { display: flex; justify-content: space-between; gap: 8px; }
    .divider { border-top: 1px dashed #9ca3af; margin: 7px 0; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 11px; }
    th, td { border: 1px solid #d1d5db; padding: 5px 4px; text-align: center; }
    th:first-child, td:first-child { text-align: right; width: 58%; }
    th:nth-child(2), td:nth-child(2) { width: 14%; }
    th:last-child, td:last-child { text-align: left; width: 28%; }
    th { background: #f3f4f6; font-weight: 800; }
    .total { margin-top: 8px; display: flex; justify-content: space-between; font-size: 12px; font-weight: 800; }
    .thanks { margin-top: 10px; text-align: center; font-size: 12px; font-weight: 800; }
    @media print { .receipt { margin: 0 auto; } }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="logo-wrap">
      <img src="/images/logo.png" alt="logo" class="logo" onerror="this.style.display='none'" />
      <div class="brand">NMART</div>
    </div>
    <div class="title">فاتورة بيع</div>
    <div class="meta">
      <div class="meta-row"><span>رقم الفاتورة</span><strong>${escapeHtml(receipt.invoiceNumber)}</strong></div>
      <div class="meta-row"><span>التاريخ</span><strong>${escapeHtml(invoiceDate)}</strong></div>
    </div>
    <div class="divider"></div>
    <table>
      <thead>
        <tr><th>الصنف</th><th>الكمية</th><th>الإجمالي</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="divider"></div>
    <div class="total"><span>الإجمالي:</span><span>${escapeHtml(formatCurrency(receipt.totalAmount))}</span></div>
    <div class="thanks">شكراً لتعاملكم معنا</div>
  </div>
  <script>
    setTimeout(() => { window.focus(); window.print(); }, 60);
  </script>
</body>
</html>`;

    const w = window.open("", "_blank", "width=420,height=720");
    if (!w) {
      showNotification("اسمح بفتح نافذة الطباعة (Popup) من المتصفح", "warning");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const cartTotal = useMemo(
    () =>
      cartItems.reduce(
        (sum, it) => sum + (it.quantity || 0) * (it.unitPrice || 0),
        0
      ),
    [cartItems]
  );

  const findProductByBarcode = async (value) => {
    const cleaned = String(value || "").trim();
    if (!cleaned) return null;

    const productsRef = collection(firestore, "products");

    // Firestore تطابق النوع exact (string/number). نجرب string أولاً.
    const qBarcodeStr = query(
      productsRef,
      where("barcode", "==", cleaned)
    );
    const snapStr = await getDocs(qBarcodeStr);
    if (!snapStr.empty) {
      const docSnap = snapStr.docs[0];
      return { id: docSnap.id, ...docSnap.data() };
    }

    // لو الباركود أرقام فقط، جرّب كرقم (توافق مع بيانات قديمة كانت تخزن number).
    if (/^\d+$/.test(cleaned)) {
      const barcodeNum = Number(cleaned);
      const qBarcodeNum = query(
        productsRef,
        where("barcode", "==", barcodeNum)
      );
      const snapNum = await getDocs(qBarcodeNum);
      if (!snapNum.empty) {
        const docSnap = snapNum.docs[0];
        return { id: docSnap.id, ...docSnap.data() };
      }
    }

    return null;
  };

  const syncProductFromPurchases = async (codeOrBarcode) => {
    const cleaned = String(codeOrBarcode || "").trim();
    if (!cleaned) return null;

    const purchasesRef = collection(firestore, "purchases");
    const purchasesSnap = await getDocs(purchasesRef);

    let foundLine = null;
    let totalPurchasedQty = 0;
    purchasesSnap.forEach((d) => {
      const data = d.data();
      const items = Array.isArray(data.products) ? data.products : [];
      items.forEach((p) => {
        const barcode = String(p.barcode ?? "").trim();
        if (barcode === cleaned) {
          foundLine = foundLine || p;
          totalPurchasedQty += Number(p.quantity || 0);
        }
      });
    });

    if (!foundLine) return null;

    let totalSoldQty = 0;
    try {
      const salesRef = collection(firestore, "sales");
      const salesSnap = await getDocs(salesRef);
      salesSnap.forEach((d) => {
        const data = d.data();
        const items = Array.isArray(data.items) ? data.items : [];
        items.forEach((it) => {
          if (it.itemType === "drink") return;
          const barcode = String(it.barcode ?? "").trim();
          if (barcode === cleaned) {
            totalSoldQty += Number(it.quantity || 0);
          }
        });
      });
    } catch (e) {
      // ignore
    }

    const netQty = Math.max(0, totalPurchasedQty - totalSoldQty);

    const nameAr = String(foundLine.name ?? foundLine.nameAr ?? "منتج").trim();
    const barcode = String(foundLine.barcode ?? cleaned).trim();
    const costPrice = Number(foundLine.wholesalePrice || 0);
    const sellingPrice = Number(foundLine.sellingPrice || 0);

    const productsRef = collection(firestore, "products");
    const now = new Date().toISOString();

    const newDocRef = await addDoc(productsRef, {
      nameAr,
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
      barcode,
      quantity: netQty,
      costPrice,
      sellingPrice,
    };
  };

  const lineKeyProduct = (id) => `product:${id}`;
  const lineKeyDrink = (id) => `drink:${id}`;

  const addProductToCart = (product) => {
    const available = typeof product.quantity === "number" ? product.quantity : 0;
    if (available < 1) {
      showNotification("هذا المنتج نفد من المخزون", "warning");
      return;
    }

    const key = lineKeyProduct(product.id);

    setCartItems((prev) => {
      const existing = prev.find((x) => x.lineKey === key);
      if (!existing) {
        return [
          ...prev,
          {
            lineKey: key,
            kind: "product",
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
        x.lineKey === key ? { ...x, quantity: newQty } : x
      );
    });
  };

  const addDrinkToCart = (drink) => {
    const price = Number(drink.price || 0);
    const key = lineKeyDrink(drink.id);

    setCartItems((prev) => {
      const existing = prev.find((x) => x.lineKey === key);
      if (!existing) {
        return [
          ...prev,
          {
            lineKey: key,
            kind: "drink",
            drinkId: drink.id,
            nameAr: drink.name || "مشروب",
            barcode: "",
            quantity: 1,
            unitPrice: price,
            costPrice: 0,
            availableQuantity: null,
          },
        ];
      }
      return prev.map((x) =>
        x.lineKey === key ? { ...x, quantity: (x.quantity || 0) + 1 } : x
      );
    });
  };

  const handleBarcodeSubmit = async (e) => {
    e?.preventDefault?.();
    const barcode = barcodeInput.trim();
    if (!barcode) return;

    try {
      setSearching(true);
      let product = await findProductByBarcode(barcode);

      if (!product) {
        const synced = await syncProductFromPurchases(barcode);
        if (synced) {
          product = synced;
          showNotification("تمت مزامنة المنتج من فواتير الشراء إلى المخزون", "success");
        }
      }

      if (!product) {
        showNotification("لم يتم العثور على منتج بهذا الباركود", "error");
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

  const removeCartItem = (lineKey) => {
    setCartItems((prev) => prev.filter((x) => x.lineKey !== lineKey));
  };

  const setCartItemQuantity = (lineKey, nextQty) => {
    const qty = Math.floor(Number(nextQty || 0));
    if (qty < 1) return;

    setCartItems((prev) =>
      prev.map((x) => {
        if (x.lineKey !== lineKey) return x;
        if (x.kind === "drink") {
          return { ...x, quantity: qty };
        }
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

  const incQty = (lineKey) => {
    const it = cartItems.find((x) => x.lineKey === lineKey);
    if (!it) return;
    if (it.kind === "drink") {
      setCartItemQuantity(lineKey, (it.quantity || 0) + 1);
      return;
    }
    setCartItemQuantity(lineKey, (it.quantity || 0) + 1);
  };

  const decQty = (lineKey) => {
    const it = cartItems.find((x) => x.lineKey === lineKey);
    if (!it) return;
    const next = (it.quantity || 0) - 1;
    if (next < 1) return;
    setCartItemQuantity(lineKey, next);
  };

  const generateSaleInvoiceNumber = () => `S-${Date.now()}`;

  const handleSubmitSale = async () => {
    if (cartItems.length === 0) {
      showNotification("السلة فارغة", "warning");
      return;
    }

    try {
      setSubmitting(true);
      const invoiceNumber = generateSaleInvoiceNumber();
      const createdAt = new Date().toISOString();
      const productLines = cartItems.filter((it) => it.kind === "product");
      const totalAmountForReceipt = cartItems.reduce(
        (sum, it) => sum + (it.quantity || 0) * (it.unitPrice || 0),
        0
      );
      const totalCostForReceipt = cartItems.reduce(
        (sum, it) => sum + (it.quantity || 0) * (it.costPrice || 0),
        0
      );
      const itemsForReceipt = cartItems.map((it) => ({
        kind: it.kind,
        nameAr: it.nameAr,
        barcode: it.kind === "product" ? it.barcode : "",
        quantity: it.quantity || 0,
        unitPrice: it.unitPrice || 0,
        total: (it.quantity || 0) * (it.unitPrice || 0),
      }));

      await runTransaction(firestore, async (tx) => {
        const productSnaps = {};
        for (const it of productLines) {
          const ref = doc(firestore, "products", it.productId);
          const snap = await tx.get(ref);
          if (!snap.exists()) {
            throw new Error("PRODUCT_NOT_FOUND:" + it.productId);
          }
          productSnaps[it.productId] = { ref, snap };
        }

        for (const it of productLines) {
          const { snap } = productSnaps[it.productId];
          const data = snap.data();
          const available =
            typeof data.quantity === "number" ? data.quantity : 0;
          if ((it.quantity || 0) > available) {
            throw new Error("INSUFFICIENT_STOCK:" + (data.nameAr || "منتج"));
          }
        }

        for (const it of productLines) {
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

        const salesRef = collection(firestore, "sales");
        const totalAmount = cartItems.reduce(
          (sum, it) => sum + (it.quantity || 0) * (it.unitPrice || 0),
          0
        );
        const totalCost = cartItems.reduce(
          (sum, it) => sum + (it.quantity || 0) * (it.costPrice || 0),
          0
        );

        const itemsPayload = cartItems.map((it) => {
          if (it.kind === "drink") {
            return {
              itemType: "drink",
              drinkId: it.drinkId,
              nameAr: it.nameAr,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              total: (it.quantity || 0) * (it.unitPrice || 0),
              costPrice: 0,
              barcode: "",
            };
          }
          return {
            productId: it.productId,
            nameAr: it.nameAr,
            barcode: it.barcode,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            total: (it.quantity || 0) * (it.unitPrice || 0),
            costPrice: it.costPrice || 0,
          };
        });

        tx.set(doc(salesRef), {
          invoiceNumber,
          items: itemsPayload,
          totalAmount,
          totalCost,
          paymentMethod: "نقدي",
          createdAt,
          createdBy: user?.uid || "",
        });
      });

      showNotification("تم إتمام عملية البيع بنجاح", "success");
      const receiptPayload = {
        invoiceNumber,
        createdAt,
        totalAmount: totalAmountForReceipt,
        items: itemsForReceipt,
      };
      printReceiptInWindow(receiptPayload);
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
    <>
      <div className={`${styles.wrapper} ${styles.noPrint}`}>
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

      <div className={styles.posMain}>
        <div className={styles.posGrid}>
          <section className={styles.catalogSection}>
            <div className={styles.catalogHeader}>
              <h3 className={styles.catalogTitle}>المشروبات والمنتجات</h3>
            </div>

            {loadingProducts || loadingDrinks ? (
              <p className={styles.drinksHint}>جارٍ تحميل الأصناف...</p>
            ) : catalogEntries.length === 0 ? (
              <p className={styles.drinksHint}>لا توجد منتجات أو مشروبات مفعّلة حالياً.</p>
            ) : (
              <>
                {isMobile ? (
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
                        className={`${styles.categoryBtn} ${!selectedCategory ? styles.categoryBtnActive : ""}`}
                        onClick={() => setSelectedCategory("")}
                      >
                        الكل
                      </button>
                    </SwiperSlide>

                    {categories.map((cat) => (
                      <SwiperSlide key={cat} className={styles.categorySlide}>
                        <button
                          type="button"
                          className={`${styles.categoryBtn} ${selectedCategory === cat ? styles.categoryBtnActive : ""}`}
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
                          className={`${styles.categoryBtn} ${selectedCategory === "__no_category__" ? styles.categoryBtnActive : ""}`}
                          onClick={() => setSelectedCategory("__no_category__")}
                        >
                          بدون قسم
                        </button>
                      </SwiperSlide>
                    ) : null}
                  </Swiper>
                ) : null}

                <div className={styles.catalogGrid}>
                  {catalogEntries.map((it) => {
                    const disabled =
                      submitting ||
                      (it.kind === "product" && (it.availableQuantity ?? 0) < 1);
                    return (
                      <div
                        key={`${it.kind}:${it.id}`}
                        role="button"
                        tabIndex={disabled ? -1 : 0}
                        aria-disabled={disabled}
                        className={styles.catalogItem}
                        onClick={() => {
                          if (disabled) return;
                          if (it.kind === "product") addProductToCart(it.raw);
                          else addDrinkToCart(it.raw);
                        }}
                        onKeyDown={(e) => {
                          if (disabled) return;
                          if (e.key !== "Enter" && e.key !== " ") return;
                          e.preventDefault();
                          if (it.kind === "product") addProductToCart(it.raw);
                          else addDrinkToCart(it.raw);
                        }}
                      >
                        <span className={styles.catalogItemInner}>
                          <span className={styles.catalogKind}>
                            {it.kind === "product" ? "منتج" : "مشروب"}
                          </span>
                          <span className={styles.catalogName}>{it.title}</span>
                          {it.subtitle ? (
                            <span className={styles.catalogSub}>{it.subtitle}</span>
                          ) : null}
                          <span className={styles.catalogFoot}>
                            <span className={styles.catalogPrice}>
                              {formatCurrency(it.price)}
                            </span>
                            {it.kind === "product" ? (
                              <span className={styles.catalogAvailable}>
                                المتاح: {it.availableQuantity ?? 0}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>

          <aside className={styles.sidePane}>
            {!isMobile ? (
              <div className={styles.categoryPanel} aria-label="أقسام الأصناف">
                <div className={styles.categoryPanelTitle}>الأقسام</div>
                <div className={styles.categoryCards}>
                  <button
                    type="button"
                    className={`${styles.categoryCard} ${!selectedCategory ? styles.categoryCardActive : ""}`}
                    onClick={() => setSelectedCategory("")}
                    aria-pressed={!selectedCategory}
                  >
                    <span className={styles.categoryCardName}>الكل</span>
                    <span className={styles.categoryCardMeta}>
                      {products.length + drinks.length} صنف
                    </span>
                  </button>

                  {categories.map((cat) => {
                    const count =
                      products.filter((p) => String(p.category || "").trim() === cat).length +
                      drinks.filter((d) => String(d.category || "").trim() === cat).length;
                    return (
                      <button
                        key={cat}
                        type="button"
                        className={`${styles.categoryCard} ${selectedCategory === cat ? styles.categoryCardActive : ""}`}
                        onClick={() => setSelectedCategory(cat)}
                        aria-pressed={selectedCategory === cat}
                      >
                        <span className={styles.categoryCardName}>{cat}</span>
                        <span className={styles.categoryCardMeta}>{count} صنف</span>
                      </button>
                    );
                  })}

                  {hasNoCategory ? (
                    <button
                      type="button"
                      className={`${styles.categoryCard} ${selectedCategory === "__no_category__" ? styles.categoryCardActive : ""}`}
                      onClick={() => setSelectedCategory("__no_category__")}
                      aria-pressed={selectedCategory === "__no_category__"}
                    >
                      <span className={styles.categoryCardName}>بدون قسم</span>
                      <span className={styles.categoryCardMeta}>
                        {products.filter((p) => !String(p.category || "").trim()).length +
                          drinks.filter((d) => !String(d.category || "").trim()).length}{" "}
                        صنف
                      </span>
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </aside>
        </div>

        {cartItems.length === 0 ? (
          <div className={styles.emptyState}>
            <p>السلة فارغة. اختر منتج أو مشروب من الأقسام أو استخدم الباركود.</p>
          </div>
        ) : (
          <div className={styles.cartSection}>
            <div className={styles.cartTable}>
              <table>
                <thead>
                  <tr>
                    <th>الصنف</th>
                    <th>الباركود</th>
                    <th>الكمية</th>
                    <th>سعر الوحدة</th>
                    <th>الإجمالي</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cartItems.map((it) => (
                    <tr key={it.lineKey}>
                      <td className={styles.nameCell}>
                        <div className={styles.nameMain}>{it.nameAr}</div>
                        <div className={styles.nameSub}>
                          {it.kind === "product" ? (
                            <>المتاح: {it.availableQuantity ?? 0}</>
                          ) : (
                            <>مشروب</>
                          )}
                        </div>
                      </td>
                      <td>{it.kind === "product" ? it.barcode : "—"}</td>
                      <td>
                        <div className={styles.qtyControls}>
                          <button
                            type="button"
                            className={styles.qtyBtn}
                            onClick={() => decQty(it.lineKey)}
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
                              setCartItemQuantity(it.lineKey, e.target.value)
                            }
                            disabled={submitting}
                          />
                          <button
                            type="button"
                            className={styles.qtyBtn}
                            onClick={() => incQty(it.lineKey)}
                            disabled={
                              submitting ||
                              (it.kind === "product" &&
                                (it.quantity || 0) >= (it.availableQuantity ?? 0))
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
                          onClick={() => removeCartItem(it.lineKey)}
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
      </div>

    </>
  );
}

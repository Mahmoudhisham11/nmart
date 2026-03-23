"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
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
  const [printReceipt, setPrintReceipt] = useState(null);
  const [printImageSrc, setPrintImageSrc] = useState("");
  const [printing, setPrinting] = useState(false);

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
    // بعد انتهاء الطباعة: نخفي الـ receipt حتى ما يفضل ظاهر.
    const afterPrint = () => {
      setPrinting(false);
      setPrintReceipt(null);
      setPrintImageSrc("");
    };

    if (typeof window !== "undefined") {
      window.addEventListener("afterprint", afterPrint);
      return () => window.removeEventListener("afterprint", afterPrint);
    }
    return undefined;
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

  const buildReceiptImage = async (receipt) => {
    if (typeof window === "undefined") return "";
    const width = 576; // 80mm @ 203dpi تقريباً
    const marginX = 24;
    const tableHeaderH = 36;
    const rowH = 34;
    const titleBlockH = 140;
    const footerBlockH = 90;
    const totalHeight =
      titleBlockH + tableHeaderH + receipt.items.length * rowH + footerBlockH;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = Math.max(360, totalHeight);
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#111827";
    ctx.textBaseline = "middle";

    // Logo (optional)
    try {
      const logoImg = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = "/images/logo.png";
      });
      const logoW = 78;
      const logoH = 52;
      ctx.drawImage(logoImg, (width - logoW) / 2, 10, logoW, logoH);
    } catch (e) {
      // ignore missing logo
    }

    ctx.font = "700 30px Arial";
    ctx.textAlign = "center";
    ctx.fillText("NMART", width / 2, 80);

    ctx.font = "700 22px Arial";
    ctx.fillText("فاتورة بيع", width / 2, 112);

    ctx.font = "600 18px Arial";
    ctx.textAlign = "right";
    ctx.fillText(`رقم الفاتورة: ${receipt.invoiceNumber}`, width - marginX, 142);
    ctx.fillText(
      `التاريخ: ${new Date(receipt.createdAt).toLocaleString(locale, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })}`,
      width - marginX,
      166
    );

    let y = 186;
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(marginX, y);
    ctx.lineTo(width - marginX, y);
    ctx.stroke();

    // Table
    y += 10;
    const tableX = marginX;
    const tableW = width - marginX * 2;
    const colNameW = Math.floor(tableW * 0.56);
    const colQtyW = Math.floor(tableW * 0.14);
    const colTotalW = tableW - colNameW - colQtyW;

    ctx.strokeStyle = "#9ca3af";
    ctx.strokeRect(tableX, y, tableW, tableHeaderH);
    ctx.beginPath();
    ctx.moveTo(tableX + colNameW, y);
    ctx.lineTo(tableX + colNameW, y + tableHeaderH);
    ctx.moveTo(tableX + colNameW + colQtyW, y);
    ctx.lineTo(tableX + colNameW + colQtyW, y + tableHeaderH);
    ctx.stroke();

    ctx.font = "700 17px Arial";
    ctx.textAlign = "right";
    ctx.fillText("الصنف", tableX + colNameW - 8, y + tableHeaderH / 2);
    ctx.textAlign = "center";
    ctx.fillText("الكمية", tableX + colNameW + colQtyW / 2, y + tableHeaderH / 2);
    ctx.textAlign = "left";
    ctx.fillText("الإجمالي", tableX + colNameW + colQtyW + 8, y + tableHeaderH / 2);

    y += tableHeaderH;
    ctx.font = "600 16px Arial";
    for (const it of receipt.items) {
      ctx.strokeRect(tableX, y, tableW, rowH);
      ctx.beginPath();
      ctx.moveTo(tableX + colNameW, y);
      ctx.lineTo(tableX + colNameW, y + rowH);
      ctx.moveTo(tableX + colNameW + colQtyW, y);
      ctx.lineTo(tableX + colNameW + colQtyW, y + rowH);
      ctx.stroke();

      ctx.textAlign = "right";
      ctx.fillText(String(it.nameAr || ""), tableX + colNameW - 8, y + rowH / 2);
      ctx.textAlign = "center";
      ctx.fillText(String(it.quantity || 0), tableX + colNameW + colQtyW / 2, y + rowH / 2);
      ctx.textAlign = "left";
      ctx.fillText(formatCurrency(it.total || 0), tableX + colNameW + colQtyW + 8, y + rowH / 2);
      y += rowH;
    }

    y += 16;
    ctx.beginPath();
    ctx.moveTo(marginX, y);
    ctx.lineTo(width - marginX, y);
    ctx.stroke();

    y += 24;
    ctx.font = "700 20px Arial";
    ctx.textAlign = "right";
    ctx.fillText("الإجمالي:", width - marginX, y);
    ctx.textAlign = "left";
    ctx.fillText(formatCurrency(receipt.totalAmount || 0), marginX, y);

    y += 34;
    ctx.textAlign = "center";
    ctx.font = "700 18px Arial";
    ctx.fillText("شكراً لتعاملكم معنا", width / 2, y);

    return canvas.toDataURL("image/png");
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
      const today = new Date();
      const startOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );
      const dayKey = startOfDay.toISOString().slice(0, 10);
      try {
        const closeRef = doc(firestore, "dayClosures", dayKey);
        const closeSnap = await getDoc(closeRef);
        if (closeSnap.exists()) {
          showNotification("تم تقفيل اليوم، لا يمكن تنفيذ مبيعات جديدة", "warning");
          return;
        }
      } catch (e) {
        // ignore
      }

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
      // اطبع الفاتورة كصورة لتحسين دعم العربي مع الطابعات الحرارية.
      const receiptPayload = {
        invoiceNumber,
        createdAt,
        totalAmount: totalAmountForReceipt,
        items: itemsForReceipt,
      };
      setPrintReceipt(receiptPayload);
      const receiptImage = await buildReceiptImage(receiptPayload);
      setPrintImageSrc(receiptImage);
      setPrinting(true);
      setTimeout(() => window.print(), 100);
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
            <div className={styles.categoryBarDesktop} role="tablist" aria-label="أقسام الأصناف">
              <button
                type="button"
                className={`${styles.categoryBtn} ${!selectedCategory ? styles.categoryBtnActive : ""}`}
                onClick={() => setSelectedCategory("")}
              >
                الكل
              </button>

              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`${styles.categoryBtn} ${selectedCategory === cat ? styles.categoryBtnActive : ""}`}
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
                  className={`${styles.categoryBtn} ${selectedCategory === "__no_category__" ? styles.categoryBtnActive : ""}`}
                  onClick={() => setSelectedCategory("__no_category__")}
                >
                  بدون قسم
                </button>
              ) : null}
            </div>

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
                  submitting || (it.kind === "product" && (it.availableQuantity ?? 0) < 1);
                return (
                  <button
                    key={`${it.kind}:${it.id}`}
                    type="button"
                    className={styles.catalogItem}
                    onClick={() => {
                      // UX: يمكنك إضافة المنتج/المشروب مباشرة من القائمة بدون باركود.
                      if (it.kind === "product") addProductToCart(it.raw);
                      else addDrinkToCart(it.raw);
                    }}
                    disabled={disabled}
                  >
                    <span className={styles.catalogKind}>
                      {it.kind === "product" ? "منتج" : "مشروب"}
                    </span>
                    <span className={styles.catalogName}>{it.title}</span>
                    {it.subtitle ? <span className={styles.catalogSub}>{it.subtitle}</span> : null}
                    <span className={styles.catalogPrice}>{formatCurrency(it.price)}</span>
                    {it.kind === "product" ? (
                      <span className={styles.catalogAvailable}>المتاح: {it.availableQuantity ?? 0}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>

        {cartItems.length === 0 ? (
          <div className={styles.emptyState}>
            <p>
              السلة فارغة. اختر منتج أو مشروب من الأقسام أو استخدم
              الباركود.
            </p>
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

      {printReceipt ? (
        <div className={styles.printReceiptRoot}>
          <div className={styles.receiptPaper}>
            {printImageSrc ? (
              <img
                src={printImageSrc}
                alt={`receipt-${printReceipt.invoiceNumber}`}
                className={styles.receiptPrintImage}
              />
            ) : (
              <div className={styles.receiptFallbackText}>جارٍ تجهيز الفاتورة...</div>
            )}

            {printing ? <div className={styles.printingHint} /> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

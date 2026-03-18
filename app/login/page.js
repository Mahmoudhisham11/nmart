"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from "firebase/auth";
import { doc, getDoc, setDoc, query, collection, where, getDocs } from "firebase/firestore";
import { firebaseAuth, firestore } from "@/lib/firebase";
import styles from "./page.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showInactiveModal, setShowInactiveModal] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, (user) => {
      if (user) {
        // التحقق من حالة active قبل السماح بالدخول
        checkUserActive(user.uid);
      }
    });
    return () => unsub();
  }, [router]);

  // إضافة إشعار
  const showNotification = (message, type = "error") => {
    const id = Date.now();
    const notification = { id, message, type };
    setNotifications((prev) => [...prev, notification]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  };

  // التحقق من حالة active للمستخدم
  const checkUserActive = async (uid) => {
    try {
      const userRef = doc(firestore, "users", uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const userData = snap.data();
        if (userData.active === false) {
          await signOut(firebaseAuth);
          setShowInactiveModal(true);
          showNotification("حسابك في انتظار التفعيل من قبل المالك", "warning");
        } else {
          router.replace("/home");
        }
      }
    } catch (err) {
      console.error("Error checking user active status:", err);
    }
  };

  // التحقق من وجود حساب بنفس الاسم
  const checkUserExists = async (username) => {
    try {
      const usersRef = collection(firestore, "users");
      const q = query(usersRef, where("username", "==", username.toLowerCase()));
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (err) {
      console.error("Error checking user exists:", err);
      return false;
    }
  };

  // إنشاء حساب جديد
  const handleCreateAccount = async () => {
    setError("");
    setLoading(true);

    // Validation
    if (!name.trim()) {
      setError("الرجاء إدخال اسم المستخدم");
      showNotification("الرجاء إدخال اسم المستخدم", "error");
      setLoading(false);
      return;
    }

    if (!password || password.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      showNotification("كلمة المرور يجب أن تكون 6 أحرف على الأقل", "error");
      setLoading(false);
      return;
    }

    try {
      const normalizedName = name.trim().toLowerCase();
      const internalEmail = normalizedName.replace(/\s+/g, ".") + "@nmart.local";

      // التحقق من وجود حساب بنفس الاسم في Firestore (اختياري - للتحقق الإضافي)
      const userExists = await checkUserExists(normalizedName);
      if (userExists) {
        setError("اسم المستخدم موجود بالفعل. استخدم زر تسجيل الدخول.");
        showNotification("اسم المستخدم موجود بالفعل. استخدم زر تسجيل الدخول.", "error");
        setLoading(false);
        return;
      }

      // محاولة إنشاء مستخدم جديد مباشرة
      // Firebase سيرمي خطأ auth/email-already-in-use إذا كان الحساب موجوداً
      const cred = await createUserWithEmailAndPassword(
        firebaseAuth,
        internalEmail,
        password
      );

      if (name) {
        await updateProfile(cred.user, { displayName: name });
      }

      const user = cred.user;
      const userRef = doc(firestore, "users", user.uid);

      // إنشاء حساب جديد مع active = false
      await setDoc(userRef, {
        uid: user.uid,
        displayName: name || user.displayName || internalEmail,
        username: normalizedName,
        role: "cashier",
        active: false, // الحساب الجديد غير مفعّل افتراضياً
        createdAt: new Date().toISOString(),
      });

      showNotification("تم إنشاء حسابك بنجاح! في انتظار تفعيل الحساب من قبل المالك", "success");
      await signOut(firebaseAuth);
      setShowInactiveModal(true);
      setName("");
      setPassword("");
    } catch (err) {
      console.error("Create account error:", err);
      let errorMessage = "فشل إنشاء الحساب. تأكد من البيانات وحاول مرة أخرى.";

      if (err.code === "auth/email-already-in-use") {
        // الحساب موجود في Firebase Auth
        errorMessage = "الحساب موجود بالفعل. استخدم زر تسجيل الدخول.";
        showNotification(errorMessage, "error");
        setError(errorMessage);
        setLoading(false);
        return;
      } else if (err.code === "auth/weak-password") {
        errorMessage = "كلمة المرور ضعيفة. استخدم كلمة مرور أقوى (6 أحرف على الأقل).";
      } else if (err.code === "auth/network-request-failed") {
        errorMessage = "خطأ في الاتصال. تحقق من اتصالك بالإنترنت.";
      } else if (err.code === "auth/invalid-email") {
        errorMessage = "اسم المستخدم غير صالح. استخدم أحرف وأرقام فقط.";
      }

      setError(errorMessage);
      showNotification(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Validation
    if (!name.trim()) {
      setError("الرجاء إدخال اسم المستخدم");
      showNotification("الرجاء إدخال اسم المستخدم", "error");
      setLoading(false);
      return;
    }

    if (!password || password.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      showNotification("كلمة المرور يجب أن تكون 6 أحرف على الأقل", "error");
      setLoading(false);
      return;
    }

    try {
      const normalizedName = name.trim().toLowerCase();
      const internalEmail = normalizedName.replace(/\s+/g, ".") + "@nmart.local";

      let cred;
      let isNewUser = false;

      // محاولة تسجيل الدخول
      try {
        cred = await signInWithEmailAndPassword(
          firebaseAuth,
          internalEmail,
          password
        );
      } catch (err) {
        // معالجة أخطاء تسجيل الدخول
        if (err.code === "auth/user-not-found") {
          // الحساب غير موجود - اطلب من المستخدم إنشاء حساب جديد
          setError("الحساب غير موجود. استخدم زر إنشاء حساب جديد.");
          showNotification("الحساب غير موجود. استخدم زر إنشاء حساب جديد.", "error");
          setLoading(false);
          return;
        } else if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
          // التحقق من وجود حساب في Firestore لتأكيد أن المشكلة في كلمة المرور
          const userExists = await checkUserExists(normalizedName);
          if (userExists) {
            setError("كلمة المرور غير صحيحة");
            showNotification("كلمة المرور غير صحيحة", "error");
          } else {
            setError("اسم المستخدم أو كلمة المرور غير صحيحة");
            showNotification("اسم المستخدم أو كلمة المرور غير صحيحة", "error");
          }
          setLoading(false);
          return;
        } else {
          // أي خطأ آخر
          throw err;
        }
      }

      const user = cred.user;
      const userRef = doc(firestore, "users", user.uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        // إنشاء حساب جديد مع active = false
        await setDoc(userRef, {
          uid: user.uid,
          displayName: name || user.displayName || internalEmail,
          username: normalizedName,
          role: "cashier",
          active: false, // الحساب الجديد غير مفعّل افتراضياً
          createdAt: new Date().toISOString(),
        });
        showNotification("تم إنشاء حسابك بنجاح! في انتظار تفعيل الحساب من قبل المالك", "success");
        await signOut(firebaseAuth);
        setShowInactiveModal(true);
        setLoading(false);
        return;
      }

      // التحقق من حالة active
      const userData = snap.data();
      if (userData.active === false) {
        await signOut(firebaseAuth);
        setShowInactiveModal(true);
        showNotification("حسابك في انتظار التفعيل من قبل المالك", "warning");
        setLoading(false);
        return;
      }

      // تسجيل الدخول بنجاح
      showNotification("تم تسجيل الدخول بنجاح", "success");
      router.replace("/home");
    } catch (err) {
      console.error(err);
      let errorMessage = "فشل الدخول أو إنشاء حساب جديد. تأكد من البيانات وحاول مرة أخرى.";
      
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        errorMessage = "اسم المستخدم أو كلمة المرور غير صحيحة";
      } else if (err.code === "auth/user-not-found") {
        errorMessage = "الحساب غير موجود. استخدم زر إنشاء حساب جديد.";
      } else if (err.code === "auth/too-many-requests") {
        errorMessage = "تم تجاوز عدد المحاولات المسموح بها. حاول مرة أخرى لاحقاً.";
      } else if (err.code === "auth/network-request-failed") {
        errorMessage = "خطأ في الاتصال. تحقق من اتصالك بالإنترنت.";
      }

      setError(errorMessage);
      showNotification(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.page}>
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

      {/* Inactive Account Modal */}
      {showInactiveModal && (
        <div className={styles.modalOverlay} onClick={() => setShowInactiveModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>حسابك في انتظار التفعيل</h2>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalText}>
                حسابك في انتظار تفعيل من قبل المالك. سيتم إشعارك عند تفعيل الحساب.
              </p>
              <p className={styles.modalText}>
                يرجى التواصل مع المالك لتفعيل حسابك.
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button
                className={styles.modalButton}
                onClick={() => setShowInactiveModal(false)}
              >
                فهمت
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.container}>
        {/* Logo Section */}
        <div className={styles.logoSection}>
          <Image
            src="/images/logo.png"
            alt="Nmart Logo"
            width={650}
            height={650}
            className={styles.logo}
            priority
          />
        </div>

        {/* Form Section */}
        <section className={styles.formSection}>
          <h1 className={styles.title}>تسجيل الدخول</h1>
          <p className={styles.subtitle}>
            أدخل اسم المستخدم وكلمة المرور للمتابعة
          </p>

          {error && <div className={styles.error}>{error}</div>}

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.fieldGroup}>
              <div className={styles.inputWrapper}>
                <svg
                  className={styles.inputIcon}
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M10 9C11.6569 9 13 7.65685 13 6C13 4.34315 11.6569 3 10 3C8.34315 3 7 4.34315 7 6C7 7.65685 8.34315 9 10 9Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M3 17C3 14.2386 5.23858 12 8 12H12C14.7614 12 17 14.2386 17 17"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <input
                  id="name"
                  type="text"
                  className={styles.input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="اسم المستخدم"
                  required
                />
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <div className={styles.inputWrapper}>
                <svg
                  className={styles.inputIcon}
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M15 8H15.01M5 8H15C16.1046 8 17 8.89543 17 10V14C17 15.1046 16.1046 16 15 16H5C3.89543 16 3 15.1046 3 14V10C3 8.89543 3.89543 8 5 8Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className={styles.input}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="كلمة المرور"
                  required
                  minLength={6}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M2 2L18 18M8.5 8.5C8.22386 8.77614 8 9.22386 8 9.5C8 9.77614 8.22386 10 8.5 10C8.77614 10 9.22386 9.77614 9.5 9.5M13.5 13.5C12.5 14.5 11.5 15 10 15C6 15 3 10 3 10C3.5 9 4.5 7.5 6 6.5M11.5 6.5C12.5 5.5 13.5 5 15 5C19 5 22 10 22 10C21.5 11 20.5 12.5 19 13.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M10 12C11.1046 12 12 11.1046 12 10C12 8.89543 11.1046 8 10 8C8.89543 8 8 8.89543 8 10C8 11.1046 8.89543 12 10 12Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M3 10C3 10 6 5 10 5C14 5 17 10 17 10C17 10 14 15 10 15C6 15 3 10 3 10Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className={styles.submitButton}
              disabled={loading}
            >
              {loading ? "جارٍ الدخول..." : "تسجيل الدخول"}
            </button>
          </form>

          <button
            type="button"
            className={styles.createAccountButton}
            onClick={handleCreateAccount}
            disabled={loading}
          >
            إنشاء حساب جديد
          </button>
        </section>
      </div>
    </main>
  );
}


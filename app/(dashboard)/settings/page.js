"use client";

import { useEffect, useState } from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { collection, doc, getDocs, updateDoc } from "firebase/firestore";
import { useAuth } from "@/components/AuthContext";
import { firestore } from "@/lib/firebase";
import styles from "./page.module.css";

export default function SettingsPage() {
  const { user, profile, loading } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [rolesMessage, setRolesMessage] = useState("");
  const [rolesError, setRolesError] = useState("");
  const [savingRoleUid, setSavingRoleUid] = useState("");

  const role = (profile?.role || "cashier").toLowerCase();
  const isOwner = role === "owner";

  useEffect(() => {
    setDisplayName(profile?.displayName || user?.displayName || "");
  }, [profile?.displayName, user?.displayName]);

  useEffect(() => {
    const loadUsers = async () => {
      if (!isOwner) return;

      setLoadingUsers(true);
      setRolesError("");
      try {
        const snap = await getDocs(collection(firestore, "users"));
        const allUsers = [];
        snap.forEach((row) => {
          allUsers.push({ id: row.id, ...row.data() });
        });
        allUsers.sort((a, b) =>
          (a.displayName || a.username || "").localeCompare(
            b.displayName || b.username || "",
            "ar"
          )
        );
        setUsersList(allUsers);
      } catch (error) {
        console.error("Failed to load users", error);
        setRolesError("تعذر تحميل الحسابات. حاول مرة أخرى.");
      } finally {
        setLoadingUsers(false);
      }
    };

    loadUsers();
  }, [isOwner]);

  const handleUpdateProfile = async (event) => {
    event.preventDefault();
    setProfileMessage("");
    setProfileError("");

    const nextName = displayName.trim();
    if (!nextName) {
      setProfileError("الاسم مطلوب.");
      return;
    }
    if (!user) {
      setProfileError("لا يوجد مستخدم مسجل الدخول.");
      return;
    }

    setSavingProfile(true);
    try {
      await updateDoc(doc(firestore, "users", user.uid), { displayName: nextName });
      await updateProfile(user, { displayName: nextName });
      setProfileMessage("تم تحديث الاسم بنجاح.");
    } catch (error) {
      console.error("Failed to update profile", error);
      setProfileError("تعذر تحديث البيانات. حاول مرة أخرى.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    setPasswordMessage("");
    setPasswordError("");

    if (!user?.email) {
      setPasswordError("تعذر قراءة بريد الحساب الحالي.");
      return;
    }
    if (!currentPassword.trim()) {
      setPasswordError("ادخل كلمة المرور الحالية.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("تأكيد كلمة المرور غير مطابق.");
      return;
    }

    setSavingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setPasswordMessage("تم تغيير كلمة المرور بنجاح.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Failed to change password", error);
      if (error?.code === "auth/wrong-password" || error?.code === "auth/invalid-credential") {
        setPasswordError("كلمة المرور الحالية غير صحيحة.");
      } else {
        setPasswordError("تعذر تغيير كلمة المرور. حاول مرة أخرى.");
      }
    } finally {
      setSavingPassword(false);
    }
  };

  const handleRoleChange = async (uid, nextRole) => {
    if (!isOwner || !uid) return;
    setRolesMessage("");
    setRolesError("");
    setSavingRoleUid(uid);
    try {
      await updateDoc(doc(firestore, "users", uid), { role: nextRole });
      setUsersList((prev) =>
        prev.map((item) => (item.id === uid ? { ...item, role: nextRole } : item))
      );
      setRolesMessage("تم تحديث الصلاحية بنجاح.");
    } catch (error) {
      console.error("Failed to update role", error);
      setRolesError("تعذر تحديث الصلاحية. حاول مرة أخرى.");
    } finally {
      setSavingRoleUid("");
    }
  };

  const handleActiveChange = async (uid, nextActive) => {
    if (!isOwner || !uid) return;
    setRolesMessage("");
    setRolesError("");
    setSavingRoleUid(uid);
    try {
      await updateDoc(doc(firestore, "users", uid), { active: nextActive });
      setUsersList((prev) =>
        prev.map((item) => (item.id === uid ? { ...item, active: nextActive } : item))
      );
      setRolesMessage("تم تحديث حالة التفعيل بنجاح.");
    } catch (error) {
      console.error("Failed to update active state", error);
      setRolesError("تعذر تحديث حالة التفعيل. حاول مرة أخرى.");
    } finally {
      setSavingRoleUid("");
    }
  };

  if (loading) {
    return <div className={styles.wrapper}>جارٍ تحميل الإعدادات...</div>;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.grid}>
        <section className={styles.card}>
          <h2 className={styles.title}>حسابي</h2>
          <p className={styles.description}>تعديل الاسم الخاص بالحساب الحالي.</p>

          <form className={styles.form} onSubmit={handleUpdateProfile}>
            <label className={styles.label} htmlFor="displayName">
              الاسم
            </label>
            <input
              id="displayName"
              className={styles.input}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="ادخل الاسم"
            />
            <button type="submit" className={styles.button} disabled={savingProfile}>
              {savingProfile ? "جارٍ الحفظ..." : "حفظ الاسم"}
            </button>
          </form>
          {profileMessage ? <p className={styles.success}>{profileMessage}</p> : null}
          {profileError ? <p className={styles.error}>{profileError}</p> : null}
        </section>

        <section className={styles.card}>
          <h2 className={styles.title}>تغيير كلمة المرور</h2>
          <p className={styles.description}>استخدم كلمة المرور الحالية ثم اختر كلمة جديدة.</p>

          <form className={styles.form} onSubmit={handleChangePassword}>
            <label className={styles.label} htmlFor="currentPassword">
              كلمة المرور الحالية
            </label>
            <input
              id="currentPassword"
              type="password"
              className={styles.input}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder="********"
            />

            <label className={styles.label} htmlFor="newPassword">
              كلمة المرور الجديدة
            </label>
            <input
              id="newPassword"
              type="password"
              className={styles.input}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="6 أحرف على الأقل"
            />

            <label className={styles.label} htmlFor="confirmPassword">
              تأكيد كلمة المرور الجديدة
            </label>
            <input
              id="confirmPassword"
              type="password"
              className={styles.input}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="اعد إدخال كلمة المرور"
            />

            <button type="submit" className={styles.button} disabled={savingPassword}>
              {savingPassword ? "جارٍ التحديث..." : "تحديث كلمة المرور"}
            </button>
          </form>
          {passwordMessage ? <p className={styles.success}>{passwordMessage}</p> : null}
          {passwordError ? <p className={styles.error}>{passwordError}</p> : null}
        </section>
      </div>

      {isOwner ? (
        <section className={styles.card}>
          <h2 className={styles.title}>إدارة أدوار الحسابات</h2>
          <p className={styles.description}>
            يمكنك تعديل الدور وحالة التفعيل لأي حساب (owner / manager / cashier).
          </p>

          {loadingUsers ? <p className={styles.muted}>جارٍ تحميل الحسابات...</p> : null}
          {!loadingUsers && usersList.length === 0 ? (
            <p className={styles.muted}>لا توجد حسابات متاحة لتعديل الدور.</p>
          ) : null}

          {!loadingUsers ? (
            <div className={styles.list}>
              {usersList.map((account) => (
                <div key={account.id} className={styles.listItem}>
                  <div className={styles.userData}>
                    <strong>{account.displayName || account.username || "بدون اسم"}</strong>
                    <span>{account.username || account.id}</span>
                  </div>
                  <div className={styles.controls}>
                    <select
                      className={styles.select}
                      value={(account.role || "cashier").toLowerCase()}
                      onChange={(event) => handleRoleChange(account.id, event.target.value)}
                      disabled={savingRoleUid === account.id}
                    >
                      <option value="owner">owner</option>
                      <option value="manager">manager</option>
                      <option value="cashier">cashier</option>
                    </select>
                    <label className={styles.activeToggle}>
                      <input
                        type="checkbox"
                        checked={Boolean(account.active)}
                        onChange={(event) => handleActiveChange(account.id, event.target.checked)}
                        disabled={savingRoleUid === account.id}
                      />
                      <span>{account.active ? "active" : "inactive"}</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {rolesMessage ? <p className={styles.success}>{rolesMessage}</p> : null}
          {rolesError ? <p className={styles.error}>{rolesError}</p> : null}
        </section>
      ) : null}
    </div>
  );
}


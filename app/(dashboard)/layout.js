"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { FaMoon, FaSun, FaSignOutAlt } from "react-icons/fa";
import { AuthProvider, useAuth } from "@/components/AuthContext";
import styles from "./dashboardLayout.module.css";

const NAV_ITEMS = [
  { href: "/home", label: "الرئيسية", roles: ["owner", "manager", "cashier"] },
  { href: "/pos", label: "نقطة البيع", roles: ["owner", "manager", "cashier"] },
  { href: "/products", label: "المنتجات", roles: ["owner", "manager"] },
  { href: "/suppliers", label: "الموردون", roles: ["owner", "manager"] },
  { href: "/purchases", label: "فواتير الشراء", roles: ["owner", "manager"] },
  { href: "/employees", label: "الموظفون", roles: ["owner"] },
  { href: "/reports", label: "التقارير", roles: ["owner", "manager"] },
  { href: "/settings", label: "الإعدادات", roles: ["owner"] },
];

function DashboardShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, loading, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [theme, setTheme] = useState("light");
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    // قراءة الوضع من localStorage
    const savedTheme = localStorage.getItem("nmart-theme") || "light";
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);
  }, []);

  useEffect(() => {
    // إغلاق الـ dropdown عند الضغط خارجه
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown]);

  if (loading || !user) {
    return (
      <main className={styles.root}>
        <div className={styles.main}>
          <div className={styles.content}>جارٍ تحميل الحساب...</div>
        </div>
      </main>
    );
  }

  const role = profile?.role || "cashier";

  const visibleNav = NAV_ITEMS.filter((item) =>
    item.roles.includes(role.toLowerCase())
  );

  const handleNavClick = (href) => {
    router.push(href);
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("nmart-theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    setShowDropdown(false);
  };

  const getInitial = () => {
    const name = profile?.displayName || user?.email || "U";
    return name.charAt(0).toUpperCase();
  };

  const today = new Date();
  const formattedDate = today.toLocaleDateString("ar-EG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <main className={styles.root}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <Image
            src="/images/logo.png"
            alt="Nmart Logo"
            width={120}
            height={120}
            className={styles.logo}
            priority
          />
        </div>
        <nav className={styles.nav}>
          {visibleNav.map((item) => {
            const active = pathname === item.href;
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => handleNavClick(item.href)}
                className={`${styles.navItem} ${
                  active ? styles.navItemActive : styles.navItemInactive
                }`}
              >
                <span className={styles.navLabel}>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
      <section className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.searchContainer}>
            <input
              type="text"
              placeholder="...ابحث هنا"
              className={styles.searchInput}
            />
          </div>
          <div className={styles.topbarRight}>
            <div className={styles.userInfo}>
              <span>{profile?.displayName || user.email}</span>
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                {role === "owner" ? "مالك" : role === "manager" ? "مدير" : "كاشير"}
              </span>
            </div>
            <div className={styles.userAvatarContainer} ref={dropdownRef}>
              <button
                type="button"
                className={styles.userAvatar}
                onClick={() => setShowDropdown(!showDropdown)}
              >
                {getInitial()}
              </button>
              {showDropdown && (
                <div className={styles.dropdown}>
                  <button
                    type="button"
                    className={styles.dropdownItem}
                    onClick={toggleTheme}
                  >
                    <span>{theme === "light" ? <FaMoon /> : <FaSun />}</span>
                    <span>{theme === "light" ? "الوضع الداكن" : "الوضع الفاتح"}</span>
                  </button>
                  <div className={styles.dropdownDivider}></div>
                  <button
                    type="button"
                    className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`}
                    onClick={handleLogout}
                  >
                    <span><FaSignOutAlt /></span>
                    <span>تسجيل الخروج</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <section className={styles.content}>
          {pathname !== "/suppliers" && pathname !== "/purchases" && pathname !== "/pos" && (
            <div className={styles.pageHeader}>
              <h1 className={styles.pageTitle}>لوحة التحكم</h1>
              <p className={styles.pageDescription}>
                هنا تفاصيل تحليلات المتجر الخاصة بك
              </p>
            </div>
          )}
          {children}
        </section>
      </section>
    </main>
  );
}

export default function DashboardLayout({ children }) {
  return (
    <AuthProvider>
      <DashboardShell>{children}</DashboardShell>
    </AuthProvider>
  );
}



"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { FaBars, FaMoon, FaSignOutAlt, FaSun } from "react-icons/fa";
import { AuthProvider, useAuth } from "@/components/AuthContext";
import styles from "./dashboardLayout.module.css";

const NAV_ITEMS = [
  { href: "/home", label: "الرئيسية", roles: ["owner", "manager", "cashier"] },
  { href: "/drinks", label: "المشاريب", roles: ["owner", "manager"] },
  { href: "/products", label: "المنتجات", roles: ["owner", "manager"] },
  { href: "/pos", label: "نقطة البيع", roles: ["owner", "manager", "cashier"] },
  { href: "/day-closures", label: "تقفيلات الأيام", roles: ["owner", "manager"] },
  { href: "/settings", label: "الإعدادات", roles: ["owner", "manager", "cashier"] },
];

function DashboardShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, loading, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobileNav, setIsMobileNav] = useState(false);
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
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => setIsMobileNav(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
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

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

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
    setSidebarOpen(false);
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

  const pageMeta = {
    "/home": {
      title: "لوحة التحكم",
      description: "متابعة المبيعات والمخزون اليومي",
    },
    "/settings": {
      title: "صفحة الإعدادات",
      description: "هنا يمكنك تعديل بيانات حسابك وإدارة صلاحيات المستخدمين",
    },
    "/drinks": {
      title: "إدارة المشاريب",
      description: "إضافة وتحديث أسعار المشاريب المتاحة للبيع",
    },
    "/products": {
      title: "إدارة المنتجات",
      description: "عرض وإضافة دفعات وتعديل وحذف المنتجات والمخزون",
    },
    "/day-closures": {
      title: "تقفيلات الأيام",
      description: "مراجعة تقفيلات سابقة وفواتير كل يوم بعد الأرشفة",
    },
  };
  const pageTitle = pageMeta[pathname]?.title || "لوحة التحكم";
  const pageDescription = pageMeta[pathname]?.description || "متابعة المبيعات والمخزون";

  return (
    <main className={styles.root}>
      {sidebarOpen ? (
        <button
          type="button"
          className={styles.backdrop}
          aria-label="إغلاق القائمة"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <aside
        className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ""}`}
        id="dashboard-sidebar"
        aria-hidden={isMobileNav && !sidebarOpen ? true : undefined}
      >
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
        <nav className={styles.nav} aria-label="التنقل الرئيسي">
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
          <button
            type="button"
            className={styles.menuButton}
            aria-label="فتح القائمة"
            aria-expanded={sidebarOpen}
            aria-controls="dashboard-sidebar"
            onClick={() => setSidebarOpen((o) => !o)}
          >
            <FaBars />
          </button>
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
          {pathname !== "/pos" && (
            <div className={styles.pageHeader}>
              <h1 className={styles.pageTitle}>{pageTitle}</h1>
              <p className={styles.pageDescription}>{pageDescription}</p>
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



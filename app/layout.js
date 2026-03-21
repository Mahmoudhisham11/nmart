import { Tajawal } from "next/font/google";
import "./globals.css";
import { PWAInitializer } from "@/components/PWAInitializer";

const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["400", "500", "700"],
});

export const metadata = {
  title: "Nmart - نظام كاشير وإدارة ماركت",
  description: "نظام Nmart لإدارة المبيعات والمخزون والموردين بالعربي.",
  applicationName: "Nmart",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Nmart",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#0f172a" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Nmart" />
        <link rel="apple-touch-icon" href="/images/logo.png" />
      </head>
      <body className={tajawal.className}>
        <PWAInitializer />
        {children}
      </body>
    </html>
  );
}

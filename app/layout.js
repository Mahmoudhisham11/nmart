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
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#0f172a" />
      </head>
      <body className={tajawal.className}>
        <PWAInitializer />
        {children}
      </body>
    </html>
  );
}


import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  reloadOnOnline: true,
  cacheOnFrontEndNav: true,
  fallbacks: {
    document: "/",
  },
  workboxOptions: {
    disableDevLogs: true,
    skipWaiting: true,
    clientsClaim: true,
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  /** يمنع خطأ Next 16 الافتراضي (Turbopack) مع إعدادات Webpack التي تضيفها next-pwa */
  turbopack: {},
};

export default withPWA(nextConfig);

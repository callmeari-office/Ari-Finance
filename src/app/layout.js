import { Outfit } from "next/font/google";
import "./globals.css";
import RegisterSW from "@/components/RegisterSW";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata = {
  applicationName: "ARI Finance",
  title: "ARI Finance — Quản lý Tài chính Shop Thời Trang",
  description: "Hệ thống quản lý tài chính nội bộ cho shop thời trang SME: đề xuất chi phí, duyệt thanh toán, dòng tiền, doanh thu và lợi nhuận.",
  keywords: "quản lý tài chính, tài chính shop thời trang, quản lý đề xuất chi phí, doanh thu, lợi nhuận, dòng tiền",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ARI Finance",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#634d3e",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi" className={`${outfit.variable}`} suppressHydrationWarning>
      <head>
        {/* Áp dụng theme đã lưu TRƯỚC khi paint để tránh nhấp nháy (FOUC) */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('ari-theme');if(t==='dark'){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();",
          }}
        />
      </head>
      <body suppressHydrationWarning>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}

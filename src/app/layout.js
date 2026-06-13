import { Outfit, Quicksand } from "next/font/google";
import "./globals.css";
import RegisterSW from "@/components/RegisterSW";
import PetalsTransition from "@/components/PetalsTransition";
import Providers from "@/components/Providers";
import Script from "next/script";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

export const metadata = {
  applicationName: "ARI Finance",
  title: "ARI Finance — Quản lý Tài chính Nội bộ",
  description: "Hệ thống quản lý tài chính nội bộ cho doanh nghiệp SME: đề xuất chi phí, duyệt thanh toán, dòng tiền, doanh thu và lợi nhuận.",
  keywords: "quản lý tài chính, tài chính nội bộ, quản lý đề xuất chi phí, doanh thu, lợi nhuận, dòng tiền",
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
    <html lang="vi" className={`${outfit.variable} ${quicksand.variable}`} suppressHydrationWarning>
      <head />
      <body suppressHydrationWarning>
        {/* Áp dụng theme đã lưu TRƯỚC khi paint để tránh nhấp nháy (FOUC) */}
        <Script
          id="theme-initializer"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('ari-theme');if(t){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();",
          }}
        />
        <Providers>
          {children}
        </Providers>
        <PetalsTransition />
        <RegisterSW />
      </body>
    </html>
  );
}

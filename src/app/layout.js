import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata = {
  title: "Q-Finance — Quản lý Thu Chi Shop Thời Trang",
  description: "Hệ thống quản lý đề xuất chi phí và dòng tiền thu chi nội bộ chuyên nghiệp dành cho shop thời trang SME.",
  keywords: "quản lý thu chi, tài chính shop thời trang, quản lý đề xuất chi phí, hoàn ứng, dòng tiền",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi" className={`${outfit.variable}`} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}

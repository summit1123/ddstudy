import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "다음한걸음",
  description: "느린학습자 실행기능 지원 교육 서비스"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import localFont from "next/font/local";
import { connection } from "next/server";
import "./globals.css";

export const metadata: Metadata = { title: "Jev Interface Hub" };
const geist = localFont({ src: "./fonts/Geist-Regular.ttf", variable: "--font-geist", display: "swap" });

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();
  return <html lang="zh-CN" className={geist.variable}><body>{children}</body></html>;
}

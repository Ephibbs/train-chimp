import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextAuthProvider } from "@/components/providers/auth-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TrainChimp - AI Fine-Tuning & Inference Cloud",
  description: "The open-source serverless AI fine-tuning & inference cloud",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable}`}
      >
        <NextAuthProvider>
          {children}
        </NextAuthProvider>
      </body>
    </html>
  );
}

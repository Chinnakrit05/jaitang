import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_Thai } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ThemeProvider, themeBootScript } from "@/components/theme-provider";
import { IconStyleProvider } from "@/components/icons";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoThai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Jaitang — บันทึกรายรับ-รายจ่าย",
  description: "สมุดบัญชีในใจ จดเงินเข้า-ออกง่าย ๆ ทั้งของตัวเองและแชร์กับคนอื่น",
  manifest: "/manifest.json",
  // iOS Safari needs `apple-mobile-web-app-capable=yes` to launch the
  // home-screen shortcut without its URL bar / nav chrome. Android
  // Chrome already honors manifest.display=standalone, so this is
  // mainly an iOS fix.
  appleWebApp: {
    capable: true,
    title: "Jaitang",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  width: "device-width",
  initialScale: 1,
  // Extend the page into the device's safe-area (notch / Dynamic
  // Island / home indicator) so standalone mode looks edge-to-edge
  // like a native app. Children must opt-in via `env(safe-area-inset-*)`
  // padding where needed.
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} ${notoThai.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Apply OLED / accent / seasonal preferences before paint to avoid
            a flash of the default cyan theme on every page load. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        {/* Apple deprecated `apple-mobile-web-app-capable` in favor of
            the W3C-standard `mobile-web-app-capable`, which Next now
            emits via `metadata.appleWebApp.capable`. iOS ≤16 still
            requires the legacy tag, so we add it explicitly. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-full">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider>
            <IconStyleProvider>{children}</IconStyleProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

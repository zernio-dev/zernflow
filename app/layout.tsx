import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "ZernFlow - L'alternative open source à ManyChat",
    template: "%s | ZernFlow",
  },
  description:
    "Automate DMs, comments, and flows across Instagram, Facebook, Telegram, X, Bluesky, and Reddit. Free, self-hostable, and open source.",
  metadataBase: new URL("https://zernflow.com"),
  openGraph: {
    title: "ZernFlow - L'alternative open source à ManyChat",
    description:
      "Automate DMs, comments, and flows across Instagram, Facebook, Telegram, X, Bluesky, and Reddit. Free, self-hostable, and open source.",
    url: "https://zernflow.com",
    siteName: "ZernFlow",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ZernFlow - L'alternative open source à ManyChat",
    description:
      "Automate DMs, comments, and flows across 6 platforms. Free, self-hostable, open source.",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("theme")==="dark"||(!localStorage.getItem("theme")&&matchMedia("(prefers-color-scheme:dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`,
          }}
        />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

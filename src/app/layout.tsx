import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});
const body = Inter({ subsets: ["latin"], variable: "--font-body-sans" });
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: {
    default: "MediaScrub — Private, in-browser image, video & metadata tools",
    template: "%s · MediaScrub",
  },
  description:
    "Free, privacy-first media processing. Convert, compress, resize and inspect images and videos entirely in your browser. No uploads, no accounts, no tracking of your files.",
  metadataBase: new URL("https://mediascrub.app"),
};

export const viewport: Viewport = {
  themeColor: "#07080b",
};

const themeBoot = `
(function(){try{var t=localStorage.getItem("mediascrub-theme");if(t==="light"){document.documentElement.dataset.theme="light";}}catch(e){}})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body className={`${display.variable} ${body.variable} ${mono.variable} bg-void text-ink antialiased`}>
        <div className="flex min-h-dvh flex-col">
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}

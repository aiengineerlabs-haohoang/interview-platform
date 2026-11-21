import type { Metadata, Viewport } from "next";
import "./globals.css";

const title = "Interview Tower: practise the AI interview, no login";
const description = "Walk into a tower of interview rooms, get asked the questions senior AI engineers actually get asked, and see the confident wrong answer before you say it.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:8788"),
  title,
  description,
  openGraph: { title, description, type: "website", images: ["/og.png"] },
  twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f1e6d2" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

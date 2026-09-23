import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Holotype — The Vivarium",
  description: "Observe Holo, the first digital fruit fly, as it thinks, spends, learns, and evolves.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

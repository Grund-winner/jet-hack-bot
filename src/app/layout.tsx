import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EURO54 Diagnostic Panel",
  description: "Super Panneau d'Administration Diagnostique - EURO54 Bots",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">
        <div className="bg-mesh" />
        <div className="grid-pattern" />
        <div className="relative z-10 min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}

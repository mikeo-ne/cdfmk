import type { Metadata, Viewport } from "next";
import "@fontsource/anton/400.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/dancing-script/600.css";
import "@fontsource/dancing-script/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "CDF Muhoozi 2031 — National Candidate Endorsement & Digital Signature Portal",
  description:
    "Stand with CDF General Muhoozi Kainerugaba. Add your digital signature endorsement for 2031 — secure, grassroots-driven, official mobilization portal for Uganda.",
  keywords: [
    "Muhoozi",
    "Kainerugaba",
    "CDF",
    "Uganda 2031",
    "endorsement",
    "digital signature",
    "campaign",
  ],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0B0E14",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

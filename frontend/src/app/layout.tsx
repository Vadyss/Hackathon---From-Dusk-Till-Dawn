import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Frankenstein",
  description: "An AI agent that builds, tests and validates detection rules for SOC analysts.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

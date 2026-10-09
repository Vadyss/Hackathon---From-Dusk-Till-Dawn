// Copyright (c) 2026 Adam Krúpa and Ondra Csajka. All rights reserved.
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Frankenstein",
  description: "Build, test, and review detection rules.",
  authors: [{ name: "Adam Krúpa, Ondra Csajka" }],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-US">
      <body>
        {children}
        <footer className="workspace-footer">© 2026 Adam Krúpa &amp; Ondra Csajka. All rights reserved.</footer>
      </body>
    </html>
  );
}

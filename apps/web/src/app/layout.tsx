import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wish Studio | Make a moment mean more",
  description: "Create a personal birthday, anniversary, retirement, or graduation wish.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

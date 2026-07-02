import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "CensusScope — India Demographics Explorer",
  description:
    "Interactive analysis of India's 2011 Census across states and districts — choropleth maps, rankings, comparisons and insights.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

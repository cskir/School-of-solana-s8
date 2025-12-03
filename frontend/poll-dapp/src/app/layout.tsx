import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";
import { WalletContextProvider } from "../components/WalletContextProvider";

export const metadata: Metadata = {
  title: "Poll dApp",
  description: "Simple yes/no poll dApp on Solana devnet",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletContextProvider>
          {children}
        </WalletContextProvider>
      </body>
    </html>
  );
}
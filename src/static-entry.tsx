import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WalletsApp } from "@/components/wallets-app";
import "@/styles.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <WalletsApp />
    </StrictMode>,
  );
}

import React from "react";
import { createRoot } from "react-dom/client";
import RemotionPlayerWidget from "./widget.js";

const rootElement = document.getElementById("root");

if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <RemotionPlayerWidget />
    </React.StrictMode>,
  );
}
import { createRoot } from "react-dom/client";
import RemotionPlayerWidget from "./widget";

const rootElement = document.getElementById("root");

if (rootElement) {
  createRoot(rootElement).render(
    <RemotionPlayerWidget />
  );
}
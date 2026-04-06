import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Editor } from "./pages/Editor";
import { Projects } from "./pages/Projects";
import { Assets } from "./pages/Assets";
import { TemplateCreator } from "./pages/TemplateCreator";
import "./index.css";

// Apply saved theme before first paint to prevent flash
const savedTheme = localStorage.getItem("theme");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
  document.documentElement.classList.add("dark");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/templates/new" element={<TemplateCreator />} />
          <Route path="/templates/:id/edit" element={<TemplateCreator />} />
          <Route path="/editor/:templateId" element={<Editor />} />
          <Route path="/editor/:templateId/:projectId" element={<Editor />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/assets" element={<Assets />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);

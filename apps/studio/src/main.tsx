import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Editor } from "./pages/Editor";
import { Projects } from "./pages/Projects";
import { Assets } from "./pages/Assets";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/editor/:templateId" element={<Editor />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/assets" element={<Assets />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);

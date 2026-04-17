import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { RequireAuth } from "./components/RequireAuth";
import { Dashboard } from "./pages/Dashboard";
import { Editor } from "./pages/Editor";
import { Projects } from "./pages/Projects";
import { Assets } from "./pages/Assets";
import { TemplateCreator } from "./pages/TemplateCreator";
import { Login } from "./pages/Login";
import { NewOrg } from "./pages/NewOrg";
import { Automations } from "./pages/Automations";
import { AutomationDetail } from "./pages/AutomationDetail";
import { BillingSettings } from "./pages/settings/BillingSettings";
import { MembersSettings } from "./pages/settings/MembersSettings";
import { ProfileSettings } from "./pages/settings/ProfileSettings";
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
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Login />} />

        {/* Protected routes — wrapped in RequireAuth + Layout */}
        <Route element={<RequireAuth />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/templates/new" element={<TemplateCreator />} />
            <Route path="/templates/:id/edit" element={<TemplateCreator />} />
            <Route path="/editor/:templateId" element={<Editor />} />
            <Route path="/editor/:templateId/:projectId" element={<Editor />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/assets" element={<Assets />} />
            <Route path="/automations" element={<Automations />} />
            <Route path="/automations/:id" element={<AutomationDetail />} />
            <Route path="/orgs/new" element={<NewOrg />} />
            <Route path="/settings/profile" element={<ProfileSettings />} />
            <Route path="/settings/members" element={<MembersSettings />} />
            <Route path="/settings/billing" element={<BillingSettings />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);

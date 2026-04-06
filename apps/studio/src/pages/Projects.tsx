import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ASPECT_RATIO_PRESETS } from "@studio/shared-types";
import type { Project, TemplateManifest } from "@studio/shared-types";

export const Projects: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<Record<string, TemplateManifest>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"updated" | "created" | "name">("updated");
  const [templateFilter, setTemplateFilter] = useState("all");
  const [busyProjectId, setBusyProjectId] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const [projectsRes, templatesRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/templates"),
      ]);
      if (!projectsRes.ok) throw new Error(`Server error: ${projectsRes.status}`);
      if (!templatesRes.ok) throw new Error(`Server error: ${templatesRes.status}`);

      const [projectsData, templatesData] = await Promise.all([
        projectsRes.json() as Promise<Project[]>,
        templatesRes.json() as Promise<TemplateManifest[]>,
      ]);

      setProjects(projectsData);
      setTemplates(
        Object.fromEntries(templatesData.map((template) => [template.id, template])),
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this project?")) return;
    setBusyProjectId(id);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error ?? "Failed to delete project");
      }
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete project");
    } finally {
      setBusyProjectId(null);
    }
  };

  const handleDuplicate = async (project: Project) => {
    setBusyProjectId(project.id);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `${project.name} Copy` }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error ?? "Failed to duplicate project");
      }
      const duplicate = await res.json() as Project;
      setProjects((prev) => [duplicate, ...prev]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to duplicate project");
    } finally {
      setBusyProjectId(null);
    }
  };

  const templateOptions = useMemo(
    () =>
      Array.from(new Set(projects.map((project) => project.templateId))).sort((a, b) =>
        (templates[a]?.name ?? a).localeCompare(templates[b]?.name ?? b),
      ),
    [projects, templates],
  );

  const filteredProjects = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const next = projects.filter((project) => {
      const templateName = templates[project.templateId]?.name ?? project.templateId;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        project.name.toLowerCase().includes(normalizedSearch) ||
        templateName.toLowerCase().includes(normalizedSearch);
      const matchesTemplate = templateFilter === "all" || project.templateId === templateFilter;
      return matchesSearch && matchesTemplate;
    });

    next.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "created") return b.createdAt.localeCompare(a.createdAt);
      return b.updatedAt.localeCompare(a.updatedAt);
    });
    return next;
  }, [projects, search, sortBy, templateFilter, templates]);

  const recentProjects = useMemo(
    () => [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5),
    [projects],
  );

  const getAspectRatioLabel = (preset: string) =>
    ASPECT_RATIO_PRESETS[preset as keyof typeof ASPECT_RATIO_PRESETS]?.label ?? preset;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">Projects</h1>
          <p className="text-zinc-400">Your saved projects</p>
        </div>
        <Link
          to="/"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
        >
          New Project
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.6fr,1fr,1fr] mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by project or template…"
          className="px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
        <select
          value={templateFilter}
          onChange={(e) => setTemplateFilter(e.target.value)}
          className="px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
        >
          <option value="all">All templates</option>
          {templateOptions.map((templateId) => (
            <option key={templateId} value={templateId}>
              {templates[templateId]?.name ?? templateId}
            </option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
        >
          <option value="updated">Sort by last modified</option>
          <option value="created">Sort by created</option>
          <option value="name">Sort by name</option>
        </select>
      </div>

      {!loading && !error && recentProjects.length > 0 && (
        <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400 mb-3">
            Recent
          </h2>
          <div className="flex flex-wrap gap-2">
            {recentProjects.map((project) => (
              <button
                key={project.id}
                onClick={() => navigate(`/editor/${project.templateId}/${project.id}`)}
                className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-left transition-colors"
              >
                <div className="text-sm font-medium text-zinc-100">{project.name}</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">
                  {templates[project.templateId]?.name ?? project.templateId}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="text-zinc-400 text-center py-20">Loading…</div>
      )}

      {error && (
        <div className="text-red-400 bg-red-900/20 rounded-xl p-4 text-sm">
          {error}{" "}
          <button onClick={fetchProjects} className="underline ml-2">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && projects.length === 0 && (
        <div className="text-center py-20 text-zinc-500">
          <p className="text-lg mb-4">No saved projects yet</p>
          <Link
            to="/"
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
          >
            Browse Templates
          </Link>
        </div>
      )}

      {!loading && !error && projects.length > 0 && filteredProjects.length === 0 && (
        <div className="text-center py-20 text-zinc-500">
          <p className="text-lg mb-2">No projects match your filters</p>
          <p className="text-sm text-zinc-600">Try a different search or template filter.</p>
        </div>
      )}

      {!loading && !error && filteredProjects.length > 0 && (
        <div className="space-y-3">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="flex items-center gap-4 p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-zinc-100 truncate">{project.name}</h2>
                <p className="text-sm text-zinc-500 mt-0.5">
                  Template: {templates[project.templateId]?.name ?? project.templateId} &nbsp;·&nbsp;
                  {getAspectRatioLabel(project.aspectRatio.preset)} &nbsp;·&nbsp;
                  v{project.version}
                </p>
                <p className="text-xs text-zinc-600 mt-0.5">
                  Updated {new Date(project.updatedAt).toLocaleString()}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => navigate(`/editor/${project.templateId}/${project.id}`)}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-lg transition-colors"
                >
                  Open
                </button>
                <button
                  onClick={() => handleDuplicate(project)}
                  disabled={busyProjectId === project.id}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 text-sm rounded-lg transition-colors"
                >
                  Duplicate
                </button>
                <button
                  onClick={() => handleDelete(project.id)}
                  disabled={busyProjectId === project.id}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-red-900 disabled:opacity-50 text-zinc-400 hover:text-red-300 text-sm rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

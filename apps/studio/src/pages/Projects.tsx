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

  const inputClasses = "px-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors";

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-1">Projects</h1>
          <p className="text-gray-500 dark:text-zinc-400 text-sm sm:text-base">Your saved projects</p>
        </div>
        <Link
          to="/"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
        >
          New Project
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1.6fr,1fr,1fr] mb-5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by project or template…"
          className={`${inputClasses} placeholder-gray-400 dark:placeholder-zinc-500`}
        />
        <select
          value={templateFilter}
          onChange={(e) => setTemplateFilter(e.target.value)}
          className={inputClasses}
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
          className={inputClasses}
        >
          <option value="updated">Last modified</option>
          <option value="created">Created</option>
          <option value="name">Name</option>
        </select>
      </div>

      {!loading && !error && recentProjects.length > 0 && (
        <div className="mb-5 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/70 p-4 transition-colors">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-3">
            Recent
          </h2>
          <div className="flex flex-wrap gap-2">
            {recentProjects.map((project) => (
              <button
                key={project.id}
                onClick={() => navigate(`/editor/${project.templateId}/${project.id}`)}
                className="px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-transparent hover:bg-gray-100 dark:hover:bg-zinc-700 text-left transition-colors shadow-sm"
              >
                <div className="text-sm font-medium text-gray-900 dark:text-zinc-100">{project.name}</div>
                <div className="text-[11px] text-gray-500 dark:text-zinc-500 mt-0.5">
                  {templates[project.templateId]?.name ?? project.templateId}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="text-gray-400 dark:text-zinc-400 text-center py-20">Loading…</div>
      )}

      {error && (
        <div className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-transparent rounded-xl p-4 text-sm">
          {error}{" "}
          <button onClick={fetchProjects} className="underline ml-2">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && projects.length === 0 && (
        <div className="text-center py-20 text-gray-500 dark:text-zinc-500">
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
        <div className="text-center py-20 text-gray-500 dark:text-zinc-500">
          <p className="text-lg mb-2">No projects match your filters</p>
          <p className="text-sm text-gray-400 dark:text-zinc-600">Try a different search or template filter.</p>
        </div>
      )}

      {!loading && !error && filteredProjects.length > 0 && (
        <div className="space-y-2 sm:space-y-3">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl hover:border-gray-300 dark:hover:border-zinc-700 transition-colors shadow-sm"
            >
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-gray-900 dark:text-zinc-100 truncate text-sm sm:text-base">{project.name}</h2>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-zinc-500 mt-0.5">
                  {templates[project.templateId]?.name ?? project.templateId} &nbsp;·&nbsp;
                  {getAspectRatioLabel(project.aspectRatio.preset)} &nbsp;·&nbsp;
                  v{project.version}
                </p>
                <p className="text-xs text-gray-400 dark:text-zinc-600 mt-0.5">
                  Updated {new Date(project.updatedAt).toLocaleString()}
                </p>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button
                  onClick={() => navigate(`/editor/${project.templateId}/${project.id}`)}
                  className="px-2.5 sm:px-3 py-1.5 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 text-xs sm:text-sm rounded-lg transition-colors"
                >
                  Open
                </button>
                <button
                  onClick={() => handleDuplicate(project)}
                  disabled={busyProjectId === project.id}
                  className="hidden sm:block px-3 py-1.5 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 disabled:opacity-50 text-gray-700 dark:text-zinc-300 text-sm rounded-lg transition-colors"
                >
                  Duplicate
                </button>
                <button
                  onClick={() => handleDelete(project.id)}
                  disabled={busyProjectId === project.id}
                  className="px-2.5 sm:px-3 py-1.5 bg-gray-100 dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-900 disabled:opacity-50 text-gray-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-300 text-xs sm:text-sm rounded-lg transition-colors"
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

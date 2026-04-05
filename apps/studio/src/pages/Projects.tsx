import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Project } from "@studio/shared-types";

export const Projects: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data: Project[] = await res.json();
      setProjects(data);
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
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

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

      {!loading && !error && projects.length > 0 && (
        <div className="space-y-3">
          {projects.map((project) => (
            <div
              key={project.id}
              className="flex items-center gap-4 p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-zinc-100 truncate">{project.name}</h2>
                <p className="text-sm text-zinc-500 mt-0.5">
                  Template: {project.templateId} &nbsp;·&nbsp;
                  {project.aspectRatio.preset} &nbsp;·&nbsp;
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
                  onClick={() => handleDelete(project.id)}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-red-900 text-zinc-400 hover:text-red-300 text-sm rounded-lg transition-colors"
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

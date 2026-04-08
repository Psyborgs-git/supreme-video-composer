import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAllTemplates,
  deleteTemplate,
  updateTemplateManifest,
} from "@studio/template-registry";
import type { RegisteredTemplate } from "@studio/template-registry";
import {
  ASPECT_RATIO_PRESETS,
  DEFAULT_ASPECT_RATIO_PRESET,
} from "@studio/shared-types";
import type { AspectRatioPreset } from "@studio/shared-types";
import { TemplateThumbnail } from "@/components/TemplateThumbnail";
import { PropsForm } from "@/components/PropsForm";
import { AspectRatioSelector } from "@/components/AspectRatioSelector";

const CATEGORIES = ["all", "social", "music", "educational", "marketing"] as const;
type Category = (typeof CATEGORIES)[number];

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const visibleTemplates = () => getAllTemplates().filter((template) => template.manifest.category !== "system");
  const [templates, setTemplates] = useState(visibleTemplates);
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [search, setSearch] = useState("");

  // New Video modal
  const [selectedTemplate, setSelectedTemplate] = useState<RegisteredTemplate | null>(null);
  const [videoName, setVideoName] = useState("");
  const [videoProps, setVideoProps] = useState<Record<string, unknown>>({});
  const [videoAspectRatio, setVideoAspectRatio] = useState<AspectRatioPreset>(DEFAULT_ASPECT_RATIO_PRESET);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit template modal
  const [editingTemplate, setEditingTemplate] = useState<RegisteredTemplate | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", category: "", tags: "" });

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const refresh = () => setTemplates([...visibleTemplates()]);

  const filtered = templates.filter((t) => {
    const matchCat = activeCategory === "all" || t.manifest.category === activeCategory;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      t.manifest.name.toLowerCase().includes(q) ||
      t.manifest.description.toLowerCase().includes(q) ||
      t.manifest.tags.some((tag) => tag.toLowerCase().includes(q));
    return matchCat && matchSearch;
  });

  const openNewVideoModal = (template: RegisteredTemplate) => {
    setSelectedTemplate(template);
    setVideoName("");
    setVideoProps({ ...template.manifest.defaultProps });
    const firstRatio = (template.manifest.supportedAspectRatios[0] ?? DEFAULT_ASPECT_RATIO_PRESET) as AspectRatioPreset;
    setVideoAspectRatio(firstRatio);
    setCreateError(null);
  };

  const handleCreate = async () => {
    if (!selectedTemplate || !videoName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate.manifest.id,
          name: videoName.trim(),
          inputProps: videoProps,
          aspectRatio: videoAspectRatio,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Failed to create video");
      }
      const project = await res.json();
      navigate(`/editor/${selectedTemplate.manifest.id}/${project.id}`);
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (e: React.MouseEvent, template: RegisteredTemplate) => {
    e.stopPropagation();
    setEditingTemplate(template);
    setEditForm({
      name: template.manifest.name,
      description: template.manifest.description,
      category: template.manifest.category,
      tags: template.manifest.tags.join(", "),
    });
    setDeleteConfirm(null);
  };

  const handleSaveEdit = () => {
    if (!editingTemplate) return;
    updateTemplateManifest(editingTemplate.manifest.id, {
      name: editForm.name.trim() || editingTemplate.manifest.name,
      description: editForm.description.trim(),
      category: editForm.category.trim() || editingTemplate.manifest.category,
      tags: editForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
    });
    refresh();
    setEditingTemplate(null);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (deleteConfirm === id) {
      deleteTemplate(id);
      refresh();
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(id);
    }
  };

  const inputClasses =
    "w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors";

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto" onClick={() => setDeleteConfirm(null)}>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-1">Templates</h1>
        <p className="text-gray-500 dark:text-zinc-400 text-sm sm:text-base">Pick a template to create a new video</p>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap items-center">
        <input
          type="text"
          placeholder="Search templates…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-600 w-48 sm:w-56 transition-colors"
        />
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium capitalize transition-colors ${
              activeCategory === cat
                ? "bg-blue-600 text-white"
                : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-gray-200 dark:hover:bg-zinc-700"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-400 dark:text-zinc-500 text-center py-16">No templates found</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filtered.map((template) => (
            <div
              key={template.manifest.id}
              className="group relative rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden hover:border-gray-300 dark:hover:border-zinc-600 transition-colors cursor-pointer shadow-sm hover:shadow-md"
              onClick={() => openNewVideoModal(template)}
            >
              {/* Action buttons */}
              <div
                className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={(e) => openEditModal(e, template)}
                  className="w-8 h-8 flex items-center justify-center bg-white/90 dark:bg-zinc-800/90 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 transition-colors backdrop-blur-sm text-sm border border-gray-200 dark:border-transparent"
                  title="Edit template metadata"
                >
                  ✎
                </button>
                <button
                  onClick={(e) => handleDelete(e, template.manifest.id)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-colors backdrop-blur-sm border ${
                    deleteConfirm === template.manifest.id
                      ? "bg-red-600 border-red-600 text-white"
                      : "bg-white/90 dark:bg-zinc-800/90 border-gray-200 dark:border-transparent hover:bg-red-50 dark:hover:bg-red-900 text-gray-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-300"
                  }`}
                  title={
                    deleteConfirm === template.manifest.id
                      ? "Click again to confirm"
                      : "Delete template"
                  }
                >
                  {deleteConfirm === template.manifest.id ? "✓" : "✕"}
                </button>
              </div>

              <div className="aspect-video bg-gray-100 dark:bg-zinc-800 overflow-hidden pointer-events-none">
                <TemplateThumbnail template={template} width={480} height={270} />
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-base sm:text-lg group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-tight">
                    {template.manifest.name}
                  </h3>
                  <span className="shrink-0 text-xs text-gray-500 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded capitalize">
                    {template.manifest.category}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1 line-clamp-2">
                  {template.manifest.description}
                </p>
                <div className="flex gap-2 mt-3 flex-wrap">
                  {template.manifest.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-xs text-gray-500 dark:text-zinc-400">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-gray-400 dark:text-zinc-500">
                  <span>
                    {template.manifest.supportedAspectRatios
                      .map((preset) => ASPECT_RATIO_PRESETS[preset as keyof typeof ASPECT_RATIO_PRESETS]?.label ?? preset)
                      .join(" · ")}
                  </span>
                  <span>
                    {(template.manifest.defaultDurationInFrames / template.manifest.defaultFps).toFixed(1)}s
                    &nbsp;·&nbsp;{template.manifest.defaultFps}fps
                  </span>
                </div>
                <button className="mt-3 w-full py-2 bg-blue-50 dark:bg-blue-600/10 hover:bg-blue-600 border border-blue-200 dark:border-blue-600/30 hover:border-blue-600 text-blue-600 dark:text-blue-400 hover:text-white text-sm font-medium rounded-lg transition-all">
                  Use Template →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Video Modal */}
      {selectedTemplate && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelectedTemplate(null)}
        >
          <div
            className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-zinc-800">
              <div>
                <h2 className="text-lg sm:text-xl font-bold">New Video</h2>
                <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">Template: {selectedTemplate.manifest.name}</p>
              </div>
              <button
                onClick={() => setSelectedTemplate(null)}
                className="text-gray-400 dark:text-zinc-500 hover:text-gray-900 dark:hover:text-zinc-100 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-lg transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
                  Video Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="My awesome video…"
                  value={videoName}
                  onChange={(e) => setVideoName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors"
                />
              </div>

              {selectedTemplate.manifest.supportedAspectRatios.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">Aspect Ratio</label>
                  <AspectRatioSelector
                    value={videoAspectRatio}
                    supported={selectedTemplate.manifest.supportedAspectRatios as AspectRatioPreset[]}
                    onChange={setVideoAspectRatio}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
                  Content &amp; Properties
                </label>
                <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-gray-200 dark:border-zinc-700/50 transition-colors">
                  <PropsForm
                    schema={selectedTemplate.manifest.propsSchema}
                    values={videoProps}
                    onChange={(key, val) => setVideoProps((prev) => ({ ...prev, [key]: val }))}
                  />
                </div>
              </div>

              {createError && (
                <p className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{createError}</p>
              )}
            </div>

            <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-zinc-800 flex justify-end gap-3">
              <button
                onClick={() => setSelectedTemplate(null)}
                className="px-5 py-2 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 text-sm font-medium rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!videoName.trim() || creating}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors"
              >
                {creating ? "Creating…" : "Create Video →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Template Modal */}
      {editingTemplate && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setEditingTemplate(null)}
        >
          <div
            className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-zinc-800">
              <h2 className="text-lg sm:text-xl font-bold">Edit Template</h2>
              <button
                onClick={() => setEditingTemplate(null)}
                className="text-gray-400 dark:text-zinc-500 hover:text-gray-900 dark:hover:text-zinc-100 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-lg transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              <p className="text-xs text-gray-500 dark:text-zinc-500 bg-gray-50 dark:bg-zinc-800/80 rounded-lg px-3 py-2">
                Metadata changes are session-only and reset on server restart.
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Name</label>
                <input type="text" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} className={inputClasses} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Description</label>
                <textarea rows={2} value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} className={`${inputClasses} resize-none`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Category</label>
                <input type="text" value={editForm.category} onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))} className={inputClasses} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Tags <span className="text-gray-400 dark:text-zinc-600 font-normal">(comma-separated)</span></label>
                <input type="text" value={editForm.tags} onChange={(e) => setEditForm((f) => ({ ...f, tags: e.target.value }))} className={inputClasses} />
              </div>
            </div>

            <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-zinc-800 flex justify-end gap-3">
              <button onClick={() => setEditingTemplate(null)} className="px-5 py-2 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 text-sm font-medium rounded-xl transition-colors">
                Cancel
              </button>
              <button onClick={handleSaveEdit} className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

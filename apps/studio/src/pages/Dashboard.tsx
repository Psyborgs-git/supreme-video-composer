import { useState } from "react";
import { Link } from "react-router-dom";
import { getAllTemplates } from "@studio/template-registry";
import { TemplateThumbnail } from "@/components/TemplateThumbnail";

const CATEGORIES = ["all", "social", "music", "educational", "marketing"] as const;
type Category = (typeof CATEGORIES)[number];

export const Dashboard: React.FC = () => {
  const templates = getAllTemplates();
  const [activeCategory, setActiveCategory] = useState<Category>("all");

  const filtered =
    activeCategory === "all"
      ? templates
      : templates.filter((t) => t.manifest.category === activeCategory);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1">Templates</h1>
        <p className="text-zinc-400">Choose a template to start creating</p>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 mb-8 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
              activeCategory === cat
                ? "bg-blue-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Template grid */}
      {filtered.length === 0 ? (
        <p className="text-zinc-500 text-center py-16">No templates in this category</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((template) => (
            <Link
              key={template.manifest.id}
              to={`/editor/${template.manifest.id}`}
              className="group rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden hover:border-zinc-600 transition-colors"
            >
              {/* Live still-frame thumbnail */}
              <div className="aspect-video bg-zinc-800 overflow-hidden pointer-events-none">
                <TemplateThumbnail template={template} width={480} height={270} />
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-lg group-hover:text-blue-400 transition-colors leading-tight">
                    {template.manifest.name}
                  </h3>
                  <span className="shrink-0 text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded capitalize">
                    {template.manifest.category}
                  </span>
                </div>
                <p className="text-sm text-zinc-400 mt-1 line-clamp-2">
                  {template.manifest.description}
                </p>
                <div className="flex gap-2 mt-3 flex-wrap">
                  {template.manifest.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-full bg-zinc-800 text-xs text-zinc-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                  <span>{template.manifest.supportedAspectRatios.join(" · ")}</span>
                  <span>
                    {(template.manifest.defaultDurationInFrames / template.manifest.defaultFps).toFixed(1)}s
                    &nbsp;·&nbsp;
                    {template.manifest.defaultFps}fps
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

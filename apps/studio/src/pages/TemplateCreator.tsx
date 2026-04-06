import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ASPECT_RATIO_PRESETS } from "@studio/shared-types";
import type { AspectRatioPreset } from "@studio/shared-types";
import {
  getTemplate,
  registerTemplate,
} from "@studio/template-registry";
import Editor from "@monaco-editor/react";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES = [
  "storytelling",
  "music-reactive",
  "social",
  "product",
  "typography",
  "custom",
] as const;
type Category = (typeof CATEGORIES)[number];

const ASPECT_RATIO_OPTIONS: {
  id: AspectRatioPreset;
  label: string;
  ratio: string;
  width: number;
  height: number;
}[] = (
  ["tiktok", "instagram-reel", "youtube", "instagram-post", "youtube-shorts", "pinterest"] as const
).map((id) => {
  const p = ASPECT_RATIO_PRESETS[id];
  return { id, label: p.label, ratio: p.ratio, width: p.width, height: p.height };
});

const FPS_OPTIONS = [24, 25, 30, 60] as const;

const FIELD_TYPES = [
  "string",
  "number",
  "boolean",
  "color",
  "asset-image",
  "asset-audio",
  "asset-video",
  "string-array",
  "asset-image-array",
] as const;
type FieldType = (typeof FIELD_TYPES)[number];

// ---------------------------------------------------------------------------
// Field definition
// ---------------------------------------------------------------------------

interface FieldDef {
  id: string; // internal uuid for React keys
  key: string;
  type: FieldType;
  label: string;
  description: string;
  required: boolean;
  defaultValue: string;
  // validation
  min?: string;
  max?: string;
  maxLength?: string;
}

function emptyField(): FieldDef {
  return {
    id: crypto.randomUUID(),
    key: "",
    type: "string",
    label: "",
    description: "",
    required: false,
    defaultValue: "",
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toKebabCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function formatLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function defaultForType(type: FieldType): string {
  switch (type) {
    case "number":
      return "0";
    case "boolean":
      return "false";
    case "color":
      return "#000000";
    case "string-array":
    case "asset-image-array":
      return "[]";
    default:
      return "";
  }
}

function parseDefault(type: FieldType, raw: string): unknown {
  switch (type) {
    case "number":
      return Number(raw) || 0;
    case "boolean":
      return raw === "true";
    case "string-array":
    case "asset-image-array":
      try {
        return JSON.parse(raw);
      } catch {
        return [];
      }
    default:
      return raw;
  }
}

// ---------------------------------------------------------------------------
// Scaffold code generation
// ---------------------------------------------------------------------------

function generateScaffold(
  name: string,
  id: string,
  fields: FieldDef[],
): string {
  const propsType = fields
    .map((f) => {
      let tsType: string;
      switch (f.type) {
        case "number":
          tsType = "number";
          break;
        case "boolean":
          tsType = "boolean";
          break;
        case "string-array":
        case "asset-image-array":
          tsType = "string[]";
          break;
        default:
          tsType = "string";
      }
      return `  ${f.key}${f.required ? "" : "?"}: ${tsType};`;
    })
    .join("\n");

  const componentName = name
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");

  return `import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Auto-generated composition scaffold for "${name}"
 * Template ID: ${id}
 */

interface ${componentName}Props {
${propsType}
}

export const ${componentName}: React.FC<${componentName}Props> = (props) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#111",
        color: "#fff",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "sans-serif",
      }}
    >
      <h1 style={{ fontSize: 48 }}>${name}</h1>
      <p style={{ opacity: 0.6 }}>
        Frame {frame} / {durationInFrames} — {width}×{height} @ {fps}fps
      </p>
    </AbsoluteFill>
  );
};
`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const inputClasses =
  "w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors";

const labelClasses = "block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1";

// ---------------------------------------------------------------------------
// FieldRow
// ---------------------------------------------------------------------------

interface FieldRowProps {
  field: FieldDef;
  index: number;
  total: number;
  onChange: (index: number, updates: Partial<FieldDef>) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, direction: -1 | 1) => void;
}

const FieldRow: React.FC<FieldRowProps> = ({
  field,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden transition-colors">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-zinc-800/50">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors"
          aria-label={expanded ? "Collapse field" : "Expand field"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`w-4 h-4 transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <span className="font-mono text-sm text-gray-700 dark:text-zinc-300 flex-1 truncate">
          {field.key || <span className="italic text-gray-400 dark:text-zinc-500">untitled</span>}
          <span className="ml-2 text-xs text-gray-400 dark:text-zinc-500">({field.type})</span>
        </span>

        {/* Reorder buttons */}
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onMove(index, -1)}
          className="w-7 h-7 flex items-center justify-center rounded text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-200 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Move up"
        >
          ↑
        </button>
        <button
          type="button"
          disabled={index === total - 1}
          onClick={() => onMove(index, 1)}
          className="w-7 h-7 flex items-center justify-center rounded text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-200 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Move down"
        >
          ↓
        </button>

        <button
          type="button"
          onClick={() => onRemove(index)}
          className="w-7 h-7 flex items-center justify-center rounded text-gray-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
          title="Delete field"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      {expanded && (
        <div className="p-4 space-y-3">
          {/* Row 1: key + type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClasses}>Key</label>
              <input
                type="text"
                placeholder="e.g. primaryText"
                value={field.key}
                onChange={(e) =>
                  onChange(index, {
                    key: e.target.value.replace(/[^a-zA-Z0-9_]/g, ""),
                  })
                }
                className={inputClasses}
              />
            </div>
            <div>
              <label className={labelClasses}>Type</label>
              <select
                value={field.type}
                onChange={(e) => {
                  const newType = e.target.value as FieldType;
                  onChange(index, {
                    type: newType,
                    defaultValue: defaultForType(newType),
                  });
                }}
                className={inputClasses}
              >
                {FIELD_TYPES.map((ft) => (
                  <option key={ft} value={ft}>
                    {ft}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: label + description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClasses}>Label</label>
              <input
                type="text"
                placeholder="Human-readable label"
                value={field.label}
                onChange={(e) => onChange(index, { label: e.target.value })}
                className={inputClasses}
              />
            </div>
            <div>
              <label className={labelClasses}>Description</label>
              <input
                type="text"
                placeholder="Helper text"
                value={field.description}
                onChange={(e) => onChange(index, { description: e.target.value })}
                className={inputClasses}
              />
            </div>
          </div>

          {/* Row 3: required + default */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div className="flex items-center gap-2 py-1">
              <button
                type="button"
                onClick={() => onChange(index, { required: !field.required })}
                className={`relative w-10 h-6 rounded-full transition-colors ${
                  field.required
                    ? "bg-blue-600"
                    : "bg-gray-300 dark:bg-zinc-600"
                }`}
                role="switch"
                aria-checked={field.required}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    field.required ? "translate-x-4" : ""
                  }`}
                />
              </button>
              <span className="text-sm text-gray-600 dark:text-zinc-400">Required</span>
            </div>

            <div>
              <label className={labelClasses}>Default Value</label>
              {field.type === "boolean" ? (
                <select
                  value={field.defaultValue}
                  onChange={(e) => onChange(index, { defaultValue: e.target.value })}
                  className={inputClasses}
                >
                  <option value="false">false</option>
                  <option value="true">true</option>
                </select>
              ) : field.type === "color" ? (
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={field.defaultValue || "#000000"}
                    onChange={(e) => onChange(index, { defaultValue: e.target.value })}
                    className="w-10 h-[38px] rounded-lg border border-gray-300 dark:border-zinc-700 cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={field.defaultValue}
                    onChange={(e) => onChange(index, { defaultValue: e.target.value })}
                    className={inputClasses}
                  />
                </div>
              ) : (
                <input
                  type={field.type === "number" ? "number" : "text"}
                  value={field.defaultValue}
                  onChange={(e) => onChange(index, { defaultValue: e.target.value })}
                  placeholder={
                    field.type === "string-array" || field.type === "asset-image-array"
                      ? '["item1", "item2"]'
                      : undefined
                  }
                  className={inputClasses}
                />
              )}
            </div>
          </div>

          {/* Validation row */}
          {(field.type === "number" || field.type === "string") && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {field.type === "number" && (
                <>
                  <div>
                    <label className={labelClasses}>Min</label>
                    <input
                      type="number"
                      value={field.min ?? ""}
                      onChange={(e) => onChange(index, { min: e.target.value })}
                      placeholder="No min"
                      className={inputClasses}
                    />
                  </div>
                  <div>
                    <label className={labelClasses}>Max</label>
                    <input
                      type="number"
                      value={field.max ?? ""}
                      onChange={(e) => onChange(index, { max: e.target.value })}
                      placeholder="No max"
                      className={inputClasses}
                    />
                  </div>
                </>
              )}
              {field.type === "string" && (
                <div>
                  <label className={labelClasses}>Max Length</label>
                  <input
                    type="number"
                    value={field.maxLength ?? ""}
                    onChange={(e) => onChange(index, { maxLength: e.target.value })}
                    placeholder="No limit"
                    className={inputClasses}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// FormPreview
// ---------------------------------------------------------------------------

interface FormPreviewProps {
  fields: FieldDef[];
}

const FormPreview: React.FC<FormPreviewProps> = ({ fields }) => {
  const [values, setValues] = useState<Record<string, unknown>>({});

  // Re-initialize defaults when fields change
  useEffect(() => {
    const defaults: Record<string, unknown> = {};
    for (const f of fields) {
      if (f.key) defaults[f.key] = parseDefault(f.type, f.defaultValue);
    }
    setValues(defaults);
  }, [fields]);

  if (fields.length === 0 || fields.every((f) => !f.key)) {
    return (
      <p className="text-sm text-gray-400 dark:text-zinc-500 text-center py-8">
        Add fields to see a live preview
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {fields
        .filter((f) => f.key)
        .map((f) => {
          const val = values[f.key];
          const label = f.label || formatLabel(f.key);
          return (
            <div key={f.id}>
              <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                {label}
                {f.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              {f.description && (
                <p className="text-xs text-gray-400 dark:text-zinc-500 mb-1">{f.description}</p>
              )}

              {f.type === "string" && (
                <input
                  type="text"
                  value={String(val ?? "")}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className={inputClasses}
                />
              )}
              {f.type === "number" && (
                <input
                  type="number"
                  value={String(val ?? 0)}
                  min={f.min || undefined}
                  max={f.max || undefined}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: Number(e.target.value) }))}
                  className={inputClasses}
                />
              )}
              {f.type === "boolean" && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(val)}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-600"
                  />
                  <span className="text-sm text-gray-600 dark:text-zinc-400">
                    {val ? "Enabled" : "Disabled"}
                  </span>
                </label>
              )}
              {f.type === "color" && (
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={String(val || "#000000")}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    className="w-10 h-[38px] rounded-lg border border-gray-300 dark:border-zinc-700 cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={String(val ?? "")}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    className={inputClasses}
                  />
                </div>
              )}
              {(f.type === "asset-image" ||
                f.type === "asset-audio" ||
                f.type === "asset-video") && (
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder={`Select ${f.type.replace("asset-", "")} file…`}
                    value={String(val ?? "")}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    className={inputClasses}
                  />
                  <button
                    type="button"
                    className="shrink-0 px-3 py-2 bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600 text-sm text-gray-700 dark:text-zinc-300 rounded-lg transition-colors"
                  >
                    Browse
                  </button>
                </div>
              )}
              {(f.type === "string-array" || f.type === "asset-image-array") && (
                <textarea
                  rows={3}
                  value={
                    typeof val === "string" ? val : JSON.stringify(val ?? [], null, 2)
                  }
                  onChange={(e) => {
                    try {
                      setValues((v) => ({ ...v, [f.key]: JSON.parse(e.target.value) }));
                    } catch {
                      setValues((v) => ({ ...v, [f.key]: e.target.value }));
                    }
                  }}
                  className={`${inputClasses} resize-none font-mono text-xs`}
                />
              )}
            </div>
          );
        })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// TemplateCreator (main page)
// ---------------------------------------------------------------------------

export const TemplateCreator: React.FC = () => {
  const { id: editId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(editId);

  // Metadata
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("social");
  const [defaultAspectRatio, setDefaultAspectRatio] = useState<AspectRatioPreset>("youtube");
  const [supportedRatios, setSupportedRatios] = useState<Set<AspectRatioPreset>>(
    new Set(["youtube"]),
  );
  const [duration, setDuration] = useState(10);
  const [fps, setFps] = useState<number>(30);

  // Fields
  const [fields, setFields] = useState<FieldDef[]>([]);

  // Saved state
  const [saved, setSaved] = useState(false);
  const [scaffoldCode, setScaffoldCode] = useState("");

  // Detect dark mode for Monaco
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  // Load template data when editing
  useEffect(() => {
    if (!editId) return;
    const tpl = getTemplate(editId);
    if (!tpl) return;
    const m = tpl.manifest;
    setName(m.name);
    setDescription(m.description);
    setCategory((m.category as Category) || "custom");
    setDefaultAspectRatio((m.supportedAspectRatios[0] ?? "youtube") as AspectRatioPreset);
    setSupportedRatios(new Set(m.supportedAspectRatios as AspectRatioPreset[]));
    setFps(m.defaultFps);
    setDuration(Math.round(m.defaultDurationInFrames / m.defaultFps));
  }, [editId]);

  const generatedId = useMemo(() => toKebabCase(name), [name]);

  // Field operations
  const handleFieldChange = useCallback(
    (index: number, updates: Partial<FieldDef>) => {
      setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...updates } : f)));
      setSaved(false);
    },
    [],
  );
  const handleFieldRemove = useCallback((index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
    setSaved(false);
  }, []);
  const handleFieldMove = useCallback(
    (index: number, direction: -1 | 1) => {
      setFields((prev) => {
        const next = [...prev];
        const target = index + direction;
        if (target < 0 || target >= next.length) return prev;
        [next[index], next[target]] = [next[target], next[index]];
        return next;
      });
      setSaved(false);
    },
    [],
  );
  const addField = () => {
    setFields((prev) => [...prev, emptyField()]);
    setSaved(false);
  };

  // Toggle aspect ratio support
  const toggleRatio = (preset: AspectRatioPreset) => {
    setSupportedRatios((prev) => {
      const next = new Set(prev);
      if (next.has(preset)) {
        next.delete(preset);
        // keep at least one
        if (next.size === 0) return prev;
      } else {
        next.add(preset);
      }
      return next;
    });
  };

  // Build default props from fields
  const buildDefaultProps = useCallback((): Record<string, unknown> => {
    const props: Record<string, unknown> = {};
    for (const f of fields) {
      if (f.key) props[f.key] = parseDefault(f.type, f.defaultValue);
    }
    return props;
  }, [fields]);

  // Save handler
  const handleSave = () => {
    if (!name.trim()) return;

    const templateId = editId || generatedId;
    const code = generateScaffold(name, templateId, fields.filter((f) => f.key));
    setScaffoldCode(code);

    // Build a minimal Zod-like schema descriptor (plain object) for runtime.
    // In a real scenario this would be a full Zod schema, but since we're
    // generating a scaffold, we store a simple passthrough-compatible object.
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const f of fields) {
      if (!f.key) continue;
      let s: z.ZodTypeAny;
      switch (f.type) {
        case "number": {
          let n = z.number();
          if (f.min) n = n.min(Number(f.min));
          if (f.max) n = n.max(Number(f.max));
          s = n;
          break;
        }
        case "boolean":
          s = z.boolean();
          break;
        case "string-array":
        case "asset-image-array":
          s = z.array(z.string());
          break;
        default:
          s = f.maxLength ? z.string().max(Number(f.maxLength)) : z.string();
      }
      if (!f.required) s = s.optional();
      if (f.defaultValue !== "") s = s.default(parseDefault(f.type, f.defaultValue) as never);
      shape[f.key] = s;
    }
    const propsSchema = z.object(shape);

    const ratioArray = Array.from(supportedRatios);

    // Ensure default aspect ratio is in supported list
    const effectiveDefaultRatio = ratioArray.includes(defaultAspectRatio)
      ? defaultAspectRatio
      : ratioArray[0];

    try {
      registerTemplate({
        manifest: {
          id: templateId,
          name: name.trim(),
          description: description.trim(),
          category,
          tags: [category],
          defaultDurationInFrames: duration * fps,
          defaultFps: fps,
          supportedAspectRatios: [effectiveDefaultRatio, ...ratioArray.filter((r) => r !== effectiveDefaultRatio)],
          propsSchema,
          defaultProps: buildDefaultProps(),
          thumbnailFrame: 0,
          compositionId: templateId,
        },
        component: () => null, // placeholder until code is compiled
      });
    } catch {
      // Template may already be registered in edit mode
    }

    setSaved(true);
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            {isEdit ? "Edit Template" : "Create Template"}
          </h1>
          <p className="text-gray-500 dark:text-zinc-400 text-sm mt-0.5">
            {isEdit
              ? `Editing template "${editId}"`
              : "Define metadata, fields, and generate a composition scaffold"}
          </p>
        </div>
        <Link
          to="/"
          className="shrink-0 px-4 py-2 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 text-sm font-medium rounded-xl transition-colors"
        >
          ← Back
        </Link>
      </div>

      {/* ================================================================= */}
      {/* METADATA SECTION */}
      {/* ================================================================= */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-gray-200 dark:border-zinc-800">
          Template Metadata
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Name */}
          <div>
            <label className={labelClasses}>
              Template Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="My Awesome Template"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
              className={inputClasses}
            />
            {name.trim() && (
              <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
                ID: <code className="font-mono">{generatedId}</code>
              </p>
            )}
          </div>

          {/* Category */}
          <div>
            <label className={labelClasses}>Category</label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as Category);
                setSaved(false);
              }}
              className={inputClasses}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="lg:col-span-2">
            <label className={labelClasses}>Description</label>
            <textarea
              rows={2}
              placeholder="Describe what this template does…"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setSaved(false);
              }}
              className={`${inputClasses} resize-none`}
            />
          </div>

          {/* Duration */}
          <div>
            <label className={labelClasses}>Default Duration (seconds)</label>
            <input
              type="number"
              min={1}
              max={600}
              value={duration}
              onChange={(e) => {
                setDuration(Number(e.target.value) || 1);
                setSaved(false);
              }}
              className={inputClasses}
            />
          </div>

          {/* FPS */}
          <div>
            <label className={labelClasses}>Default FPS</label>
            <div className="flex gap-2">
              {FPS_OPTIONS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    setFps(f);
                    setSaved(false);
                  }}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    fps === f
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-white dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Aspect Ratio Picker */}
        <div className="mt-6">
          <label className={labelClasses}>Default Aspect Ratio</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-1">
            {ASPECT_RATIO_OPTIONS.map((opt) => {
              const isSelected = defaultAspectRatio === opt.id;
              // Compute visual ratio for the mini preview (max 80px wide, 64px tall)
              const scale = Math.min(64 / opt.width, 48 / opt.height);
              const w = Math.round(opt.width * scale);
              const h = Math.round(opt.height * scale);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setDefaultAspectRatio(opt.id);
                    setSupportedRatios((prev) => new Set(prev).add(opt.id));
                    setSaved(false);
                  }}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-colors ${
                    isSelected
                      ? "border-blue-600 bg-blue-50 dark:bg-blue-600/10"
                      : "border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-gray-300 dark:hover:border-zinc-600"
                  }`}
                >
                  <div
                    className={`rounded border-2 ${
                      isSelected
                        ? "border-blue-600 bg-blue-200 dark:bg-blue-600/30"
                        : "border-gray-300 dark:border-zinc-600 bg-gray-100 dark:bg-zinc-800"
                    }`}
                    style={{ width: w, height: h }}
                  />
                  <div className="text-center">
                    <p className={`text-xs font-medium ${isSelected ? "text-blue-600 dark:text-blue-400" : "text-gray-700 dark:text-zinc-300"}`}>
                      {opt.label}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-zinc-500">{opt.ratio}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Supported Aspect Ratios */}
        <div className="mt-4">
          <label className={labelClasses}>Supported Aspect Ratios</label>
          <div className="flex flex-wrap gap-3 mt-1">
            {ASPECT_RATIO_OPTIONS.map((opt) => {
              const checked = supportedRatios.has(opt.id);
              return (
                <label
                  key={opt.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                    checked
                      ? "border-blue-600 bg-blue-50 dark:bg-blue-600/10"
                      : "border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      toggleRatio(opt.id);
                      setSaved(false);
                    }}
                    className="w-4 h-4 rounded border-gray-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-zinc-300">{opt.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* FIELD BUILDER + PREVIEW (side-by-side) */}
      {/* ================================================================= */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-gray-200 dark:border-zinc-800">
          Field Schema Builder
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Field list */}
          <div className="lg:col-span-3 space-y-3">
            {fields.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-zinc-500 text-center py-8 rounded-xl border border-dashed border-gray-300 dark:border-zinc-700">
                No fields defined yet. Click "Add Field" below to start.
              </p>
            )}

            {fields.map((field, i) => (
              <FieldRow
                key={field.id}
                field={field}
                index={i}
                total={fields.length}
                onChange={handleFieldChange}
                onRemove={handleFieldRemove}
                onMove={handleFieldMove}
              />
            ))}

            <button
              type="button"
              onClick={addField}
              className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-zinc-700 hover:border-blue-400 dark:hover:border-blue-600 rounded-xl text-sm font-medium text-gray-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              + Add Field
            </button>
          </div>

          {/* Right: Form Preview */}
          <div className="lg:col-span-2">
            <div className="sticky top-20 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-zinc-800/50 border-b border-gray-200 dark:border-zinc-700">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300">
                  Form Preview
                </h3>
                <p className="text-xs text-gray-400 dark:text-zinc-500">
                  Live preview of the generated input form
                </p>
              </div>
              <div className="p-4 max-h-[60vh] overflow-y-auto">
                <FormPreview fields={fields} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* SAVE BUTTON */}
      {/* ================================================================= */}
      <div className="flex items-center justify-between gap-4 mb-8 pb-6 border-b border-gray-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors"
          >
            {saved ? "✓ Saved" : "Save Template"}
          </button>
          {saved && (
            <span className="text-sm text-green-600 dark:text-green-400">
              Template registered successfully
            </span>
          )}
        </div>
        <Link
          to="/"
          className="text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>

      {/* ================================================================= */}
      {/* CODE EDITOR */}
      {/* ================================================================= */}
      {saved && scaffoldCode && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-gray-200 dark:border-zinc-800">
            Generated Composition Code
          </h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mb-3">
            Copy this scaffold into your composition file and customize it.
          </p>
          <div className="rounded-xl border border-gray-200 dark:border-zinc-700 overflow-hidden">
            <Editor
              height="400px"
              defaultLanguage="typescript"
              value={scaffoldCode}
              theme={isDark ? "vs-dark" : "light"}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                wordWrap: "on",
                padding: { top: 12 },
              }}
            />
          </div>
        </section>
      )}
    </div>
  );
};

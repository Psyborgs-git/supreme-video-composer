/**
 * SlotEditor — structured, slot-aware form editor that replaces PropsForm.
 *
 * Detects slot types from field names and renders:
 *   - `string` → text input + optional "Generate with AI" mini-button
 *   - `*ImageUrl` / `*VideoUrl` / `*AudioUrl` / `*Url` → asset picker button
 *   - `scenes` / `items` (array of objects) → accordion per item
 *   - `color` / `*Color` → color swatch + hex input
 *   - boolean → toggle
 *   - number → number input
 *   - enum → styled button group
 *
 * The component introspects the same Zod schema that PropsForm uses, but adds
 * asset-picker integration and generation shortcuts.
 */
import React, { useMemo, useState } from "react";
import type { z } from "zod";
import { AssetPickerModal } from "./AssetPickerModal";
import type { AssetMimeFilter } from "./AssetPickerModal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SlotEditorProps {
  schema: z.ZodType;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

type SlotKind =
  | "string"
  | "number"
  | "boolean"
  | "color"
  | "asset-image"
  | "asset-video"
  | "asset-audio"
  | "object-array"
  | "enum"
  | "unknown";

interface SlotInfo {
  key: string;
  kind: SlotKind;
  enumValues?: string[];
  itemSchema?: z.ZodType;
  description?: string;
}

// ─── Schema introspection ─────────────────────────────────────────────────────

function getShape(schema: z.ZodType): Record<string, z.ZodType> | null {
  const def = (schema as unknown as { _def?: { shape?: unknown; schema?: z.ZodType } })._def;
  if (!def) return null;
  if (def.shape) {
    const shape = typeof def.shape === "function" ? (def.shape as () => Record<string, z.ZodType>)() : def.shape;
    return shape as Record<string, z.ZodType>;
  }
  if (def.schema) return getShape(def.schema);
  return null;
}

function unwrapSchema(schema: z.ZodType): z.ZodType {
  const def = (schema as unknown as { _def?: { innerType?: z.ZodType; typeName?: string } })._def;
  if (!def) return schema;
  if (def.innerType) return unwrapSchema(def.innerType);
  return schema;
}

function getEnumValues(schema: z.ZodType): string[] | undefined {
  const def = (schema as unknown as { _def?: { values?: unknown; options?: unknown } })._def;
  if (!def) return undefined;
  if (Array.isArray(def.values)) return def.values as string[];
  if (Array.isArray(def.options)) return (def.options as z.ZodType[]).map((o) => {
    const oDef = (o as unknown as { _def?: { value?: unknown } })._def;
    return String(oDef?.value ?? "");
  });
  return undefined;
}

function inferKind(key: string, schema: z.ZodType): SlotKind {
  const typeName = (schema as unknown as { _def?: { typeName?: string } })._def?.typeName ?? "";
  const lk = key.toLowerCase();

  if (typeName === "ZodEnum" || typeName === "ZodNativeEnum") return "enum";
  if (typeName === "ZodBoolean") return "boolean";
  if (typeName === "ZodNumber") return "number";

  if (typeName === "ZodArray") return "object-array";

  if (typeName === "ZodString") {
    if (lk.includes("color")) return "color";
    if (lk.includes("imageurl") || lk.endsWith("_image") || lk === "imageurl") return "asset-image";
    if (lk.includes("videourl") || lk.endsWith("_video") || lk === "videourl") return "asset-video";
    if (lk.includes("audiourl") || lk.includes("narration") || lk.includes("music")) return "asset-audio";
    return "string";
  }

  return "unknown";
}

function extractSlots(schema: z.ZodType): SlotInfo[] {
  const shape = getShape(schema);
  if (!shape) return [];
  return Object.entries(shape).map(([key, fieldSchema]) => {
    const unwrapped = unwrapSchema(fieldSchema as z.ZodType);
    const kind = inferKind(key, unwrapped);
    const enumValues = kind === "enum" ? getEnumValues(unwrapped) : undefined;
    const description = (fieldSchema as unknown as { description?: string }).description;
    return { key, kind, enumValues, description };
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLabel(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ").replace(/^./, (c) => c.toUpperCase()).trim();
}

// ─── Slot renderers ───────────────────────────────────────────────────────────

function StringSlot({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (v: string) => void;
}) {
  const [genOpen, setGenOpen] = useState(false);
  const [genPrompt, setGenPrompt] = useState("");
  const [genLoading, setGenLoading] = useState(false);

  const handleGenerate = async () => {
    if (!genPrompt.trim()) return;
    setGenLoading(true);
    try {
      const res = await fetch("/api/generation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: genPrompt.trim(), modality: "script" }),
      });
      const job = await res.json() as { id: string };
      for (let i = 0; i < 20; i++) {
        await new Promise<void>((r) => setTimeout(r, 2000));
        const poll = await fetch(`/api/generation/${job.id}`).then((r) => r.json()) as {
          status: string;
          outputs?: { scenePlan?: { narrationScript?: string } };
        };
        if (poll.status === "completed") {
          const text = poll.outputs?.scenePlan?.narrationScript ?? "";
          if (text) onChange(text);
          break;
        }
        if (poll.status === "failed") break;
      }
    } finally {
      setGenLoading(false);
      setGenOpen(false);
    }
  };

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => setGenOpen((o) => !o)}
          title="Generate with AI"
          className="px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors"
        >
          ✨
        </button>
      </div>
      {genOpen && (
        <div className="mt-2 p-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/20 space-y-2">
          <p className="text-xs text-indigo-700 dark:text-indigo-400 font-medium">Generate with AI</p>
          <input
            value={genPrompt}
            onChange={(e) => setGenPrompt(e.target.value)}
            placeholder="Describe what you want…"
            className="w-full px-3 py-2 text-xs rounded-lg border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={handleGenerate}
            disabled={genLoading || !genPrompt.trim()}
            className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium"
          >
            {genLoading ? "Generating…" : "Generate"}
          </button>
        </div>
      )}
    </div>
  );
}

function AssetSlot({
  value,
  assetType,
  onChange,
}: {
  value: unknown;
  assetType: AssetMimeFilter;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const url = typeof value === "string" ? value : "";
  const icons: Record<AssetMimeFilter, string> = { image: "🖼️", video: "🎬", audio: "🎵" };

  return (
    <>
      <div className="flex gap-2 items-center">
        {url && assetType === "image" && (
          <img src={url} alt="" className="h-10 w-16 object-cover rounded-lg border border-gray-200 dark:border-zinc-700" />
        )}
        {url && assetType !== "image" && (
          <span className="text-xs text-gray-500 dark:text-zinc-500 truncate max-w-[140px]">{url.split("/").pop()}</span>
        )}
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-zinc-700 hover:border-blue-400 dark:hover:border-blue-500 text-gray-600 dark:text-zinc-400 transition-colors"
        >
          {icons[assetType]} {url ? "Change" : "Pick"} {assetType}
        </button>
        {url && (
          <button onClick={() => onChange("")} className="text-xs text-red-400 hover:text-red-600" title="Clear">✕</button>
        )}
      </div>
      {open && (
        <AssetPickerModal
          type={assetType}
          onSelect={(u) => { onChange(u); setOpen(false); }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ColorSlot({ value, onChange }: { value: unknown; onChange: (v: string) => void }) {
  const color = typeof value === "string" ? value : "#000000";
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-14 cursor-pointer rounded-lg border border-gray-300 dark:border-zinc-700 p-0.5 bg-white"
      />
      <input
        value={color}
        onChange={(e) => onChange(e.target.value)}
        maxLength={9}
        className="px-3 py-2 text-sm font-mono rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 w-28"
      />
    </div>
  );
}

function EnumSlot({
  value,
  enumValues,
  onChange,
}: {
  value: unknown;
  enumValues: string[];
  onChange: (v: string) => void;
}) {
  if (enumValues.length <= 5) {
    return (
      <div className="flex flex-wrap gap-2">
        {enumValues.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium border transition-colors ${
              value === opt
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-400 border-gray-300 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }
  return (
    <select
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {enumValues.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
    </select>
  );
}

function ObjectArraySlot({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (v: unknown[]) => void;
}) {
  const items = Array.isArray(value) ? value : [];
  const [expanded, setExpanded] = useState<number | null>(null);

  const handleItemChange = (idx: number, key: string, val: unknown) => {
    const next = items.map((item, i) =>
      i === idx && typeof item === "object" && item !== null
        ? { ...(item as Record<string, unknown>), [key]: val }
        : item,
    );
    onChange(next);
  };

  const addItem = () => {
    onChange([...items, {}]);
    setExpanded(items.length);
  };

  const removeItem = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
    if (expanded === idx) setExpanded(null);
  };

  return (
    <div className="space-y-2">
      {items.map((item, idx) => {
        const isOpen = expanded === idx;
        const itemKeys =
          typeof item === "object" && item !== null ? Object.keys(item) : [];
        return (
          <div key={idx} className="border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            <div
              className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-zinc-950/60 cursor-pointer"
              onClick={() => setExpanded(isOpen ? null : idx)}
            >
              <span className="text-xs font-medium text-gray-700 dark:text-zinc-300">
                {label} {idx + 1}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); removeItem(idx); }}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  ✕
                </button>
                <span className="text-xs text-gray-400">{isOpen ? "▲" : "▼"}</span>
              </div>
            </div>
            {isOpen && (
              <div className="p-3 space-y-3">
                {itemKeys.map((k) => (
                  <div key={k}>
                    <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">{formatLabel(k)}</label>
                    <input
                      value={typeof (item as Record<string, unknown>)[k] === "string" ? (item as Record<string, unknown>)[k] as string : ""}
                      onChange={(e) => handleItemChange(idx, k, e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <button
        onClick={addItem}
        className="w-full py-2 rounded-xl border border-dashed border-gray-300 dark:border-zinc-700 text-xs text-gray-500 dark:text-zinc-500 hover:border-blue-400 dark:hover:border-blue-600 hover:text-blue-600 transition-colors"
      >
        + Add {label.toLowerCase()}
      </button>
    </div>
  );
}

// ─── Main SlotEditor ──────────────────────────────────────────────────────────

export const SlotEditor: React.FC<SlotEditorProps> = ({ schema, values, onChange }) => {
  const slots = useMemo(() => extractSlots(schema), [schema]);

  if (slots.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-zinc-500 italic">
        No configurable properties for this template.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {slots.map((slot) => (
        <div key={slot.key}>
          <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1.5">
            {formatLabel(slot.key)}
          </label>
          {slot.kind === "string" && (
            <StringSlot
              label={formatLabel(slot.key)}
              value={values[slot.key]}
              onChange={(v) => onChange(slot.key, v)}
            />
          )}
          {(slot.kind === "asset-image" || slot.kind === "asset-video" || slot.kind === "asset-audio") && (
            <AssetSlot
              value={values[slot.key]}
              assetType={
                slot.kind === "asset-image" ? "image" : slot.kind === "asset-video" ? "video" : "audio"
              }
              onChange={(v) => onChange(slot.key, v)}
            />
          )}
          {slot.kind === "color" && (
            <ColorSlot value={values[slot.key]} onChange={(v) => onChange(slot.key, v)} />
          )}
          {slot.kind === "enum" && slot.enumValues && (
            <EnumSlot
              value={values[slot.key]}
              enumValues={slot.enumValues}
              onChange={(v) => onChange(slot.key, v)}
            />
          )}
          {slot.kind === "boolean" && (
            <button
              onClick={() => onChange(slot.key, !values[slot.key])}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                values[slot.key] ? "bg-blue-600" : "bg-gray-200 dark:bg-zinc-700"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                  values[slot.key] ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          )}
          {slot.kind === "number" && (
            <input
              type="number"
              value={typeof values[slot.key] === "number" ? (values[slot.key] as number) : ""}
              onChange={(e) => onChange(slot.key, Number(e.target.value))}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
          {slot.kind === "object-array" && (
            <ObjectArraySlot
              label={formatLabel(slot.key)}
              value={values[slot.key]}
              onChange={(v) => onChange(slot.key, v)}
            />
          )}
          {slot.kind === "unknown" && (
            <textarea
              rows={2}
              value={typeof values[slot.key] === "string" ? (values[slot.key] as string) : JSON.stringify(values[slot.key] ?? "")}
              onChange={(e) => {
                try { onChange(slot.key, JSON.parse(e.target.value)); }
                catch { onChange(slot.key, e.target.value); }
              }}
              className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>
      ))}
    </div>
  );
};

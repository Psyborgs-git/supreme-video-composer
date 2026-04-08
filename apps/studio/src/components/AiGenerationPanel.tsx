/**
 * AI Generation Panel — floating side panel for generating image/audio/video
 * assets directly from the Assets page.
 *
 * Does not import from @studio/ai-generation (server-only) — it calls the
 * Studio API endpoints that proxy to the generation pipelines.
 */

import { useState } from "react";
import type { GenerationJob } from "@studio/shared-types";

type Modality = "script" | "image" | "audio" | "video";

interface AiGenerationPanelProps {
  onClose: () => void;
  onJobCreated?: (job: GenerationJob) => void;
}

export const AiGenerationPanel: React.FC<AiGenerationPanelProps> = ({
  onClose,
  onJobCreated,
}) => {
  const [modality, setModality] = useState<Modality>("image");
  const [prompt, setPrompt] = useState("");
  const [sceneCount, setSceneCount] = useState(5);
  const [style, setStyle] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationJob | null>(null);

  const modalityLabels: Record<Modality, string> = {
    script: "📝 Scene Script",
    image: "🖼️ Images",
    audio: "🔊 Audio",
    video: "🎬 Video Clips",
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }
    setGenerating(true);
    setError(null);
    setResult(null);

    try {
      const body: Record<string, unknown> = {
        modality,
        prompt: prompt.trim(),
        name: `AI ${modalityLabels[modality]}: ${prompt.slice(0, 30)}`,
      };

      if (modality === "script") {
        body.inputs = { sceneCount, style: style || undefined };
      }

      const res = await fetch("/api/generation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error ?? `Server error: ${res.status}`);
      }

      const job = await res.json() as GenerationJob;
      setResult(job);
      onJobCreated?.(job);

      // Poll for completion
      let attempts = 0;
      const poll = async () => {
        if (attempts++ > 30) return; // max ~15s
        const pollRes = await fetch(`/api/generation/${job.id}`);
        if (!pollRes.ok) return;
        const updated = await pollRes.json() as GenerationJob;
        setResult(updated);
        if (updated.status === "completed" || updated.status === "failed" || updated.status === "cancelled") {
          return;
        }
        setTimeout(() => void poll(), 500);
      };

      void poll();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const getOutputSummary = (job: GenerationJob): string | null => {
    for (const output of job.outputs) {
      if (output.step === "scenePlan") {
        const plan = output.data as { scenes?: unknown[]; title?: string };
        return `Generated "${plan.title}" with ${plan.scenes?.length ?? 0} scene(s)`;
      }
      if (output.step === "sceneImages") {
        const images = output.data as unknown[];
        return `Generated ${images.length} image(s)`;
      }
      if (output.step === "narrationAudio") {
        return "Generated narration audio";
      }
      if (output.step === "videoClips") {
        const clips = output.data as unknown[];
        return `Generated ${clips.length} video clip(s)`;
      }
    }
    return null;
  };

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-white dark:bg-gray-900 shadow-xl border-l border-gray-200 dark:border-gray-700 flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">✨ AI Generation</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none"
          aria-label="Close AI generation panel"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Modality selector */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            What to generate
          </label>
          <div className="grid grid-cols-2 gap-1">
            {(Object.entries(modalityLabels) as [Modality, string][]).map(([m, label]) => (
              <button
                key={m}
                onClick={() => setModality(m)}
                className={`py-1.5 px-2 rounded text-xs font-medium transition-colors ${
                  modality === m
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Prompt */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Prompt
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              modality === "script"
                ? "e.g. A 4-scene documentary about space exploration"
                : modality === "image"
                  ? "e.g. A futuristic city at night, photorealistic"
                  : modality === "audio"
                    ? "e.g. Welcome to the future of technology..."
                    : "e.g. A rocket launching with cinematic slow-motion"
            }
            rows={3}
            className="w-full text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
          />
        </div>

        {/* Script-specific options */}
        {modality === "script" && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Number of scenes: {sceneCount}
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={sceneCount}
                onChange={(e) => setSceneCount(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Style (optional)
              </label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Default</option>
                <option value="fast">Fast</option>
                <option value="slow">Slow & cinematic</option>
                <option value="dramatic">Dramatic</option>
                <option value="playful">Playful</option>
              </select>
            </div>
          </>
        )}

        {/* Error */}
        {error && (
          <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded px-2 py-1.5">
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="text-xs rounded border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div
              className={`px-2 py-1.5 font-medium ${
                result.status === "completed"
                  ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                  : result.status === "failed"
                    ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                    : "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
              }`}
            >
              {result.status === "completed"
                ? "✅ Completed"
                : result.status === "failed"
                  ? `❌ Failed: ${result.error ?? "Unknown error"}`
                  : result.status === "cancelled"
                    ? "⛔ Cancelled"
                    : "⏳ Running…"}
            </div>
            {result.status === "completed" && (
              <div className="px-2 py-1.5 text-gray-600 dark:text-gray-400">
                {getOutputSummary(result) ?? "Generation complete"}
              </div>
            )}
            <div className="px-2 py-1 border-t border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600">
              Job ID: <code className="select-all">{result.id}</code>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => void handleGenerate()}
          disabled={generating || !prompt.trim()}
          className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium rounded transition-colors"
        >
          {generating ? "Generating…" : `Generate ${modalityLabels[modality]}`}
        </button>
        <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-1.5 text-center">
          Configure providers via AI_TEXT_PROVIDER, AI_IMAGE_PROVIDER env vars
        </p>
      </div>
    </div>
  );
};

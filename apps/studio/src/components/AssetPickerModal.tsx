/**
 * AssetPickerModal — browse, upload, or generate assets then return a URL.
 *
 * Props:
 *   type  — "image" | "video" | "audio" (filters the asset list)
 *   onSelect  — called with the chosen asset URL
 *   onClose  — close the modal without selecting
 */
import React, { useState, useEffect, useRef } from "react";
import { useAuthStore } from "../stores/authStore";

export type AssetMimeFilter = "image" | "video" | "audio";

interface AssetRecord {
  id: string;
  name: string;
  type: string;
  url: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

interface AssetPickerModalProps {
  type: AssetMimeFilter;
  onSelect: (url: string) => void;
  onClose: () => void;
}

export const AssetPickerModal: React.FC<AssetPickerModalProps> = ({ type, onSelect, onClose }) => {
  const { currentOrg } = useAuthStore();
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<"browse" | "upload" | "generate">("browse");
  const [search, setSearch] = useState("");
  const [uploadLoading, setUploadLoading] = useState(false);
  const [generatePrompt, setGeneratePrompt] = useState("");
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!currentOrg) return;
    setIsLoading(true);
    fetch(`/api/orgs/${currentOrg.slug}/assets?type=${type}`)
      .then((r) => r.json())
      .then((d) => setAssets((d as { assets: AssetRecord[] }).assets ?? []))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [currentOrg?.slug, type]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !currentOrg) return;
    setUploadLoading(true);
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      const res = await fetch(`/api/orgs/${currentOrg.slug}/assets`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json() as { assets: AssetRecord[] };
      if (data.assets) {
        setAssets((a) => [...data.assets, ...a]);
        setTab("browse");
      }
    } finally {
      setUploadLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!generatePrompt.trim()) return;
    setGenerateError(null);
    setGenerateLoading(true);
    try {
      const modality =
        type === "image" ? "image" : type === "audio" ? "audio" : "video";
      const res = await fetch("/api/generation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: generatePrompt.trim(),
          modality,
        }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? "Generation failed");
      }
      const job = await res.json() as { id: string };

      // Poll until job completes
      for (let i = 0; i < 60; i++) {
        await new Promise<void>((r) => setTimeout(r, 3000));
        const poll = await fetch(`/api/generation/${job.id}`).then((r) => r.json()) as {
          status: string;
          outputs?: Record<string, unknown>;
        };
        if (poll.status === "completed") {
          const key = modality === "image" ? "sceneImages" : modality === "audio" ? "narrationAudio" : "sceneClips";
          const output = poll.outputs?.[key];
          let url: string | null = null;
          if (Array.isArray(output) && output.length > 0) {
            const first = output[0] as Record<string, string>;
            url = first.imageUrl ?? first.url ?? null;
          } else if (output && typeof (output as Record<string, string>).url === "string") {
            url = (output as Record<string, string>).url;
          }
          if (url) {
            onSelect(url);
            return;
          }
          setGenerateError("Generation completed but no output URL found.");
          break;
        }
        if (poll.status === "failed") {
          setGenerateError("Generation failed.");
          break;
        }
      }
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Generation error");
    } finally {
      setGenerateLoading(false);
    }
  };

  const filtered = assets.filter((a) =>
    a.type === type && a.name.toLowerCase().includes(search.toLowerCase()),
  );

  const mimeIcons: Record<string, string> = {
    image: "🖼️",
    video: "🎬",
    audio: "🎵",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100">
            {mimeIcons[type]} Pick {type}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-zinc-800 px-5">
          {(["browse", "upload", "generate"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-2.5 px-3 text-sm font-medium capitalize transition-colors ${
                tab === t
                  ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                  : "text-gray-500 dark:text-zinc-500 hover:text-gray-900 dark:hover:text-zinc-300"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === "browse" && (
            <>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${type}s…`}
                className="w-full mb-4 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {isLoading ? (
                <p className="text-sm text-gray-400 dark:text-zinc-600">Loading…</p>
              ) : filtered.length === 0 ? (
                <div className="text-center py-10 text-gray-400 dark:text-zinc-600">
                  <p className="text-4xl mb-2">{mimeIcons[type]}</p>
                  <p className="text-sm">No {type}s found. Upload or generate one.</p>
                </div>
              ) : (
                <div className={type === "audio" ? "space-y-2" : "grid grid-cols-2 sm:grid-cols-3 gap-3"}>
                  {filtered.map((a) => (
                    type === "audio" ? (
                      <button
                        key={a.id}
                        onClick={() => onSelect(a.url)}
                        className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-800 hover:border-blue-400 dark:hover:border-blue-500 text-left transition-colors bg-white dark:bg-zinc-950/40"
                      >
                        <span className="text-2xl">🎵</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">{a.name}</p>
                          <p className="text-xs text-gray-400 dark:text-zinc-500">{a.mimeType ?? a.type}</p>
                        </div>
                      </button>
                    ) : (
                      <button
                        key={a.id}
                        onClick={() => onSelect(a.url)}
                        className="group rounded-xl border border-gray-200 dark:border-zinc-800 hover:border-blue-400 dark:hover:border-blue-500 overflow-hidden transition-colors"
                      >
                        {type === "image" ? (
                          <img
                            src={a.url}
                            alt={a.name}
                            className="w-full h-28 object-cover bg-gray-100 dark:bg-zinc-800"
                          />
                        ) : (
                          <div className="w-full h-28 flex items-center justify-center bg-gray-100 dark:bg-zinc-800 text-3xl">
                            🎬
                          </div>
                        )}
                        <p className="px-2 py-1.5 text-xs text-gray-700 dark:text-zinc-300 truncate text-left">{a.name}</p>
                      </button>
                    )
                  ))}
                </div>
              )}
            </>
          )}

          {tab === "upload" && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div
                className="border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-2xl p-10 w-full text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <p className="text-4xl mb-3">{mimeIcons[type]}</p>
                <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                  Click to upload {type} files
                </p>
                <p className="text-xs text-gray-400 dark:text-zinc-600 mt-1">
                  {type === "image" ? "PNG, JPG, WebP, GIF" : type === "audio" ? "MP3, WAV, OGG" : "MP4, WebM, MOV"}
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept={type === "image" ? "image/*" : type === "audio" ? "audio/*" : "video/*"}
                onChange={handleUpload}
                className="hidden"
              />
              {uploadLoading && <p className="text-sm text-blue-500">Uploading…</p>}
            </div>
          )}

          {tab === "generate" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-zinc-400">
                Describe what you want to generate and an AI provider will create it for you.
              </p>
              <textarea
                rows={3}
                value={generatePrompt}
                onChange={(e) => setGeneratePrompt(e.target.value)}
                placeholder={`Describe the ${type} you want to generate…`}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {generateError && (
                <p className="text-sm text-red-500">{generateError}</p>
              )}
              <button
                onClick={handleGenerate}
                disabled={generateLoading || !generatePrompt.trim()}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium"
              >
                {generateLoading ? "Generating…" : `✨ Generate ${type}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

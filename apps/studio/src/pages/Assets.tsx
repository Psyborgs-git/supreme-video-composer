import { useEffect, useMemo, useRef, useState } from "react";
import type { Asset, AssetType } from "@studio/shared-types";
import { AiGenerationPanel } from "../components/AiGenerationPanel";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ACCEPT = "image/*,video/*,audio/*";

export const Assets: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | AssetType>("all");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [renamingAssetId, setRenamingAssetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchAssets = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("type", filter);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/assets${params.toString() ? `?${params.toString()}` : ""}`);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json() as { assets: Asset[] };
      setAssets(data.assets);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load assets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [filter]);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files", file));

      const res = await fetch("/api/assets", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error ?? "Failed to upload assets");
      }
      const data = await res.json() as { assets: Asset[] };
      setAssets((prev) => [...data.assets, ...prev]);
      const firstId = data.assets[0]?.id ?? null;
      setSelectedAssetId(firstId);
      if (firstId) setDetailsOpen(true);
      if (inputRef.current) inputRef.current.value = "";
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to upload assets");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    void handleFiles(e.dataTransfer.files);
  };

  const assetUrl = (asset: Asset) => asset.url ?? `/api/assets/${asset.id}/content`;

  const handleCopy = async (asset: Asset) => {
    const url = new URL(assetUrl(asset), window.location.origin).toString();
    await navigator.clipboard.writeText(url);
    const id = asset.id;
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Delete this asset?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/assets/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({})) as { error?: string; projectIds?: string[] };
        const suffix = payload.projectIds?.length
          ? ` (${payload.projectIds.length} project reference${payload.projectIds.length === 1 ? "" : "s"})`
          : "";
        throw new Error((payload.error ?? "Failed to delete asset") + suffix);
      }
      setAssets((prev) => prev.filter((asset) => asset.id !== id));
      setSelectedAssetId((prev) => (prev === id ? null : prev));
      setDetailsOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete asset");
    }
  };

  const filteredAssets = useMemo(() => {
    const query = search.trim().toLowerCase();
    return assets.filter((asset) => {
      const matchesSearch = query.length === 0 || asset.name.toLowerCase().includes(query);
      const matchesType = filter === "all" || asset.type === filter;
      return matchesSearch && matchesType;
    });
  }, [assets, filter, search]);

  const selectedAsset = useMemo(
    () => filteredAssets.find((asset) => asset.id === selectedAssetId) ?? assets.find((asset) => asset.id === selectedAssetId) ?? filteredAssets[0] ?? assets[0] ?? null,
    [assets, filteredAssets, selectedAssetId],
  );

  const beginRename = (asset: Asset) => {
    setRenamingAssetId(asset.id);
    setRenameValue(asset.name);
  };

  const handleRename = async (assetId: string) => {
    if (!renameValue.trim()) return;
    setError(null);
    try {
      const res = await fetch(`/api/assets/${assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error ?? "Failed to rename asset");
      }
      const updated = await res.json() as Asset;
      setAssets((prev) => prev.map((asset) => (asset.id === updated.id ? updated : asset)));
      setRenamingAssetId(null);
      setRenameValue("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to rename asset");
    }
  };

  const selectAsset = (id: string) => {
    setSelectedAssetId(id);
    setDetailsOpen(true);
  };

  const inputBase = "px-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors";

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="mb-5 sm:mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-1">Assets</h1>
          <p className="text-gray-500 dark:text-zinc-400 text-sm sm:text-base">Upload and manage media files for your templates</p>
        </div>
        <button
          onClick={() => setAiPanelOpen(true)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          title="Generate assets with AI"
        >
          ✨ <span className="hidden sm:inline">AI Generate</span>
        </button>
      </div>

      {aiPanelOpen && (
        <AiGenerationPanel
          onClose={() => setAiPanelOpen(false)}
          onJobCreated={() => void fetchAssets()}
        />
      )}

      <div className="grid gap-2 sm:gap-4 grid-cols-2 sm:grid-cols-[1.4fr,180px,120px] mb-5 sm:mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search assets…"
          className={`${inputBase} col-span-2 sm:col-span-1 placeholder-gray-400 dark:placeholder-zinc-500`}
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className={inputBase}
        >
          <option value="all">All types</option>
          <option value="image">Images</option>
          <option value="video">Videos</option>
          <option value="audio">Audio</option>
          <option value="font">Fonts</option>
        </select>
        <button
          onClick={() => fetchAssets()}
          className={`${inputBase} text-center hover:border-gray-300 dark:hover:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800`}
        >
          Refresh
        </button>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-300 dark:border-zinc-700 hover:border-blue-400 dark:hover:border-blue-500 rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-colors mb-6 sm:mb-8 group"
      >
        <div className="text-3xl sm:text-4xl mb-3 opacity-40 group-hover:opacity-70 transition-opacity">
          ⬆
        </div>
        <p className="text-gray-700 dark:text-zinc-300 font-medium text-sm sm:text-base">
          {uploading ? "Uploading…" : "Drop files here or click to upload"}
        </p>
        <p className="text-gray-400 dark:text-zinc-500 text-xs sm:text-sm mt-1">Images, videos, and audio files</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>

      {error && (
        <div className="mb-5 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-transparent rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {loading && <p className="text-gray-400 dark:text-zinc-500 text-center py-8">Loading assets…</p>}

      {!loading && assets.length === 0 && (
        <p className="text-gray-400 dark:text-zinc-600 text-center py-8">No assets uploaded yet</p>
      )}

      {!loading && assets.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[1.7fr,0.9fr]">
          <div>
            {filteredAssets.length === 0 ? (
              <div className="text-center py-14 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/60 text-gray-400 dark:text-zinc-500">
                No assets match your filters.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {filteredAssets.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => selectAsset(asset.id)}
                    className={`text-left bg-white dark:bg-zinc-900 border rounded-xl overflow-hidden transition-colors shadow-sm hover:shadow-md ${
                      selectedAsset?.id === asset.id
                        ? "border-blue-500 ring-2 ring-blue-500/20"
                        : "border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700"
                    }`}
                  >
                    <div className="aspect-square bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                      {asset.type === "image" && (
                        <img
                          src={assetUrl(asset)}
                          alt={asset.name}
                          className="w-full h-full object-cover"
                        />
                      )}
                      {asset.type === "video" && (
                        <video src={assetUrl(asset)} className="w-full h-full object-cover" muted />
                      )}
                      {asset.type === "audio" && (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3">
                          <div className="text-3xl opacity-40">♫</div>
                          <div className="text-xs text-gray-400 dark:text-zinc-500">Audio</div>
                        </div>
                      )}
                      {asset.type === "font" && (
                        <div className="w-full h-full flex items-center justify-center text-4xl text-gray-400 dark:text-zinc-500">
                          Aa
                        </div>
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="text-xs sm:text-sm text-gray-800 dark:text-zinc-200 truncate font-medium" title={asset.name}>
                        {asset.name}
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5 capitalize">
                        {asset.type} · {formatBytes(asset.sizeBytes ?? asset.size)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details panel: desktop sidebar / mobile slide-up */}
          {selectedAsset && detailsOpen && (
            <>
              {/* Mobile: overlay panel */}
              <div className="lg:hidden fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 rounded-t-2xl shadow-2xl max-h-[70vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-800">
                  <h2 className="font-semibold text-gray-900 dark:text-zinc-100">{selectedAsset.name}</h2>
                  <button onClick={() => setDetailsOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 text-lg">✕</button>
                </div>
                <div className="p-4">
                  {renderAssetDetails(selectedAsset, assetUrl, renamingAssetId, renameValue, setRenameValue, setRenamingAssetId, beginRename, handleRename, handleCopy, handleRemove, copied)}
                </div>
              </div>
              {/* Mobile backdrop */}
              <div className="lg:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setDetailsOpen(false)} />
            </>
          )}

          {/* Desktop: sticky sidebar */}
          <aside className="hidden lg:block rounded-2xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/70 p-4 h-fit sticky top-[73px] transition-colors">
            {selectedAsset ? (
              renderAssetDetails(selectedAsset, assetUrl, renamingAssetId, renameValue, setRenameValue, setRenamingAssetId, beginRename, handleRename, handleCopy, handleRemove, copied)
            ) : (
              <div className="text-gray-400 dark:text-zinc-500 text-sm">Select an asset to inspect it.</div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
};

function renderAssetDetails(
  asset: Asset,
  assetUrl: (a: Asset) => string,
  renamingAssetId: string | null,
  renameValue: string,
  setRenameValue: (v: string) => void,
  setRenamingAssetId: (id: string | null) => void,
  beginRename: (a: Asset) => void,
  handleRename: (id: string) => Promise<void>,
  handleCopy: (a: Asset) => Promise<void>,
  handleRemove: (id: string) => Promise<void>,
  copied: string | null,
) {
  return (
    <>
      <div className="mb-4">
        {asset.type === "image" && (
          <img
            src={assetUrl(asset)}
            alt={asset.name}
            className="w-full rounded-xl border border-gray-200 dark:border-zinc-800 object-cover"
          />
        )}
        {asset.type === "video" && (
          <video
            src={assetUrl(asset)}
            controls
            className="w-full rounded-xl border border-gray-200 dark:border-zinc-800"
          />
        )}
        {asset.type === "audio" && (
          <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 p-4">
            <audio src={assetUrl(asset)} controls className="w-full" />
          </div>
        )}
        {asset.type === "font" && (
          <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 p-6 text-center text-4xl text-gray-400 dark:text-zinc-300">
            Aa
          </div>
        )}
      </div>

      {renamingAssetId === asset.id ? (
        <div className="mb-4 flex gap-2">
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            className="flex-1 px-3 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors"
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleRename(asset.id);
              else if (e.key === "Escape") setRenamingAssetId(null);
            }}
            autoFocus
          />
          <button
            onClick={() => void handleRename(asset.id)}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
          >
            Save
          </button>
        </div>
      ) : (
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">{asset.name}</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-500 capitalize mt-1">{asset.type}</p>
        </div>
      )}

      <div className="space-y-2 text-sm text-gray-500 dark:text-zinc-400 mb-4">
        <div className="flex justify-between gap-4">
          <span>Size</span>
          <span className="text-gray-800 dark:text-zinc-200">{formatBytes(asset.sizeBytes ?? asset.size)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>MIME</span>
          <span className="text-gray-800 dark:text-zinc-200 break-all text-right">{asset.mimeType}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Created</span>
          <span className="text-gray-800 dark:text-zinc-200 text-right">
            {new Date(asset.createdAt).toLocaleString()}
          </span>
        </div>
      </div>

      {asset.metadata && Object.keys(asset.metadata).length > 0 && (
        <div className="mb-4 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/70 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500 mb-2">
            Metadata
          </h3>
          <div className="space-y-1 text-sm text-gray-700 dark:text-zinc-300">
            {Object.entries(asset.metadata).map(([key, value]) => (
              <div key={key} className="flex justify-between gap-4">
                <span className="text-gray-500 dark:text-zinc-500">{key}</span>
                <span className="text-right">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => void handleCopy(asset)}
          className="px-3 py-2 bg-gray-100 dark:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-700 rounded-lg text-sm text-gray-700 dark:text-zinc-300 hover:text-blue-700 dark:hover:text-white transition-colors"
        >
          {copied === asset.id ? "✓ Copied" : "Copy URL"}
        </button>
        <button
          onClick={() => beginRename(asset)}
          className="px-3 py-2 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-lg text-sm text-gray-700 dark:text-zinc-300 transition-colors"
        >
          Rename
        </button>
        <button
          onClick={() => void handleRemove(asset.id)}
          className="px-3 py-2 bg-gray-100 dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg text-sm text-gray-500 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-300 transition-colors"
        >
          Delete
        </button>
      </div>
    </>
  );
}


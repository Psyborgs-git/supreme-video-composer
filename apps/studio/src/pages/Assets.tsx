import { useRef, useState } from "react";
import type { AssetType } from "@studio/shared-types";

interface LocalAsset {
  id: string;
  name: string;
  type: AssetType;
  objectUrl: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

function mimeToAssetType(mime: string): AssetType {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "image";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ACCEPT = "image/*,video/*,audio/*";

export const Assets: React.FC = () => {
  const [assets, setAssets] = useState<LocalAsset[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const newAssets: LocalAsset[] = Array.from(files).map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: file.name,
      type: mimeToAssetType(file.type),
      objectUrl: URL.createObjectURL(file),
      mimeType: file.type,
      size: file.size,
      createdAt: new Date().toISOString(),
    }));
    setAssets((prev) => [...prev, ...newAssets]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const handleCopy = async (url: string, id: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleRemove = (id: string) => {
    setAssets((prev) => {
      const asset = prev.find((a) => a.id === id);
      if (asset) URL.revokeObjectURL(asset.objectUrl);
      return prev.filter((a) => a.id !== id);
    });
  };

  const assetsByType: Record<AssetType, LocalAsset[]> = {
    image: assets.filter((a) => a.type === "image"),
    video: assets.filter((a) => a.type === "video"),
    audio: assets.filter((a) => a.type === "audio"),
    font: assets.filter((a) => a.type === "font"),
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1">Assets</h1>
        <p className="text-zinc-400">Upload and manage media files for your templates</p>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-zinc-700 hover:border-blue-500 rounded-2xl p-12 text-center cursor-pointer transition-colors mb-8 group"
      >
        <div className="text-4xl mb-3 opacity-50 group-hover:opacity-80 transition-opacity">
          ⬆
        </div>
        <p className="text-zinc-300 font-medium">Drop files here or click to upload</p>
        <p className="text-zinc-500 text-sm mt-1">Images, videos, and audio files</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {assets.length === 0 && (
        <p className="text-zinc-600 text-center py-8">No assets uploaded yet</p>
      )}

      {/* Asset groups */}
      {(["image", "video", "audio"] as AssetType[]).map((type) => {
        const group = assetsByType[type];
        if (group.length === 0) return null;

        return (
          <div key={type} className="mb-8">
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3 capitalize">
              {type}s ({group.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {group.map((asset) => (
                <div
                  key={asset.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden group/card"
                >
                  {/* Preview */}
                  <div className="aspect-square bg-zinc-800 overflow-hidden">
                    {asset.type === "image" && (
                      <img
                        src={asset.objectUrl}
                        alt={asset.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                    {asset.type === "video" && (
                      <video
                        src={asset.objectUrl}
                        className="w-full h-full object-cover"
                        muted
                      />
                    )}
                    {asset.type === "audio" && (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3">
                        <div className="text-3xl opacity-40">♫</div>
                        <audio src={asset.objectUrl} controls className="w-full" />
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="p-2">
                    <p className="text-xs text-zinc-300 truncate font-medium" title={asset.name}>
                      {asset.name}
                    </p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">{formatBytes(asset.size)}</p>

                    <div className="flex gap-1 mt-2">
                      <button
                        onClick={() => handleCopy(asset.objectUrl, asset.id)}
                        className="flex-1 py-1 text-[10px] bg-zinc-800 hover:bg-blue-700 rounded text-zinc-400 hover:text-white transition-colors"
                      >
                        {copied === asset.id ? "✓ Copied" : "Copy URL"}
                      </button>
                      <button
                        onClick={() => handleRemove(asset.id)}
                        className="py-1 px-2 text-[10px] bg-zinc-800 hover:bg-red-900 rounded text-zinc-500 hover:text-red-300 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

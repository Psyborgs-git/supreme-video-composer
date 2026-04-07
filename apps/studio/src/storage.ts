import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Asset, AssetType, Project } from "@studio/shared-types";
import {
  DEFAULT_ASPECT_RATIO_PRESET,
  normalizeAspectRatioConfig,
} from "@studio/shared-types";

export interface StorageConfig {
  projectsDir?: string;
  assetsDir?: string;
}

const ASSET_REGISTRY_FILE = "registry.json";
const ASSET_SUBDIRS: Record<AssetType, string> = {
  image: "images",
  video: "video",
  audio: "audio",
  font: "fonts",
};

function ensureDir(dirPath?: string) {
  if (!dirPath) return;
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

function writeJsonFile(filePath: string, value: unknown) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf-8");
}

function sanitizeSegment(value: string) {
  return value
    .trim()
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function getAssetRegistryPath(assetsDir?: string) {
  return assetsDir ? path.join(assetsDir, ASSET_REGISTRY_FILE) : null;
}

function getExtension(fileName: string) {
  return path.extname(fileName).replace(/^\./, "").toLowerCase();
}

function getAssetType(fileName: string, mimeType: string): AssetType | null {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (
    mimeType.startsWith("font/") ||
    ["ttf", "otf", "woff", "woff2"].includes(getExtension(fileName))
  ) {
    return "font";
  }
  return null;
}

function ensureUniqueFilePath(dirPath: string, originalName: string) {
  const ext = path.extname(originalName);
  const baseName = sanitizeSegment(originalName) || "asset";
  let candidate = `${baseName}${ext}`;
  let fullPath = path.join(dirPath, candidate);
  let counter = 1;

  while (fs.existsSync(fullPath)) {
    candidate = `${baseName}-${counter}${ext}`;
    fullPath = path.join(dirPath, candidate);
    counter += 1;
  }

  return { fileName: candidate, filePath: fullPath };
}

function normalizeStoredProject(project: Project): Project {
  const fallback = DEFAULT_ASPECT_RATIO_PRESET;
  return {
    ...project,
    aspectRatio: normalizeAspectRatioConfig(
      project.aspectRatio?.preset,
      project.aspectRatio,
      fallback,
    ),
  };
}

export function loadProjectsFromDisk(projectsDir?: string) {
  const store = new Map<string, Project>();
  if (!projectsDir) return store;

  ensureDir(projectsDir);
  for (const entry of fs.readdirSync(projectsDir)) {
    if (!entry.endsWith(".json")) continue;
    const project = readJsonFile<Project>(path.join(projectsDir, entry));
    if (!project?.id) continue;
    store.set(project.id, normalizeStoredProject(project));
  }

  return store;
}

export function persistProject(projectsDir: string | undefined, project: Project) {
  if (!projectsDir) return;
  ensureDir(projectsDir);
  writeJsonFile(path.join(projectsDir, `${project.id}.json`), project);
}

export function deletePersistedProject(projectsDir: string | undefined, projectId: string) {
  if (!projectsDir) return;
  const filePath = path.join(projectsDir, `${projectId}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export function loadAssetsFromDisk(assetsDir?: string) {
  const store = new Map<string, Asset>();
  if (!assetsDir) return store;

  ensureDir(assetsDir);
  for (const subdir of Object.values(ASSET_SUBDIRS)) {
    ensureDir(path.join(assetsDir, subdir));
  }

  const registryPath = getAssetRegistryPath(assetsDir);
  if (!registryPath) return store;

  const assets = readJsonFile<Asset[]>(registryPath) ?? [];
  for (const asset of assets) {
    if (!asset?.id) continue;
    store.set(asset.id, asset);
  }
  return store;
}

export function persistAssetRegistry(assetsDir: string | undefined, assetStore: Map<string, Asset>) {
  const registryPath = getAssetRegistryPath(assetsDir);
  if (!registryPath) return;
  writeJsonFile(registryPath, Array.from(assetStore.values()));
}

export async function saveUploadedAssets(
  assetsDir: string | undefined,
  files: File[],
  assetStore: Map<string, Asset>,
) {
  if (!assetsDir) {
    return [] as Asset[];
  }

  ensureDir(assetsDir);
  const nextAssets: Asset[] = [];

  for (const file of files) {
    const type = getAssetType(file.name, file.type);
    if (!type) {
      throw new Error(`Unsupported file type: ${file.name}`);
    }

    const targetDir = path.join(assetsDir, ASSET_SUBDIRS[type]);
    ensureDir(targetDir);
    const { fileName, filePath } = ensureUniqueFilePath(targetDir, file.name);
    const baseName = path.basename(fileName, path.extname(fileName));
    const data = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, data);

    const asset: Asset = {
      id: randomUUID(),
      name: baseName,
      type,
      extension: getExtension(fileName),
      path: filePath,
      url: "",
      size: data.byteLength,
      sizeBytes: data.byteLength,
      mimeType: file.type || "application/octet-stream",
      metadata: {},
      createdAt: new Date().toISOString(),
    };

    asset.url = `/api/assets/${asset.id}/content`;
    assetStore.set(asset.id, asset);
    nextAssets.push(asset);
  }

  persistAssetRegistry(assetsDir, assetStore);
  return nextAssets;
}

export function renameAsset(
  assetsDir: string | undefined,
  assetStore: Map<string, Asset>,
  assetId: string,
  nextName: string,
) {
  const asset = assetStore.get(assetId);
  if (!asset) return null;
  asset.name = sanitizeSegment(nextName) || asset.name;
  assetStore.set(assetId, asset);
  persistAssetRegistry(assetsDir, assetStore);
  return asset;
}

export function registerExistingAsset(
  assetsDir: string | undefined,
  assetStore: Map<string, Asset>,
  input: {
    id: string;
    name: string;
    type: AssetType;
    path: string;
    mimeType: string;
    sizeBytes: number;
  },
) {
  if (assetStore.has(input.id)) {
    throw new Error(`Asset "${input.id}" already exists`);
  }

  if (!fs.existsSync(input.path)) {
    throw new Error(`Asset file not found at ${input.path}`);
  }

  const asset: Asset = {
    id: input.id,
    name: sanitizeSegment(input.name) || input.name,
    type: input.type,
    path: input.path,
    mimeType: input.mimeType,
    size: input.sizeBytes,
    sizeBytes: input.sizeBytes,
    extension: getExtension(input.path),
    url: "",
    metadata: {},
    createdAt: new Date().toISOString(),
  };

  asset.url = `/api/assets/${asset.id}/content`;
  assetStore.set(asset.id, asset);
  persistAssetRegistry(assetsDir, assetStore);
  return asset;
}

export function deleteAssetFromDisk(
  assetsDir: string | undefined,
  assetStore: Map<string, Asset>,
  assetId: string,
) {
  const asset = assetStore.get(assetId);
  if (!asset) return null;

  if (fs.existsSync(asset.path)) {
    fs.unlinkSync(asset.path);
  }
  assetStore.delete(assetId);
  persistAssetRegistry(assetsDir, assetStore);
  return asset;
}

export function getAssetContentPath(assetStore: Map<string, Asset>, assetId: string) {
  return assetStore.get(assetId)?.path ?? null;
}

function hasAssetReference(value: unknown, assetId: string): boolean {
  if (typeof value === "string") return value === assetId;
  if (Array.isArray(value)) return value.some((entry) => hasAssetReference(entry, assetId));
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((entry) => hasAssetReference(entry, assetId));
  }
  return false;
}

export function findProjectsUsingAsset(projectStore: Map<string, Project>, assetId: string) {
  return Array.from(projectStore.values())
    .filter((project) => hasAssetReference(project.inputProps, assetId))
    .map((project) => project.id);
}

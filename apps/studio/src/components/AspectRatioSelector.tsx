import {
  ASPECT_RATIO_PRESETS,
} from "@studio/shared-types";
import type { AspectRatioPreset } from "@studio/shared-types";

interface AspectRatioSelectorProps {
  value: AspectRatioPreset;
  supported: AspectRatioPreset[];
  onChange: (preset: AspectRatioPreset) => void;
}

const LEGACY_LABELS: Record<AspectRatioPreset, { title: string; subtitle: string }> = {
  "instagram-post": { title: ASPECT_RATIO_PRESETS["instagram-post"].label, subtitle: `${ASPECT_RATIO_PRESETS["instagram-post"].ratio} · ${ASPECT_RATIO_PRESETS["instagram-post"].platform}` },
  "instagram-reel": { title: ASPECT_RATIO_PRESETS["instagram-reel"].label, subtitle: `${ASPECT_RATIO_PRESETS["instagram-reel"].ratio} · ${ASPECT_RATIO_PRESETS["instagram-reel"].platform}` },
  youtube: { title: ASPECT_RATIO_PRESETS.youtube.label, subtitle: `${ASPECT_RATIO_PRESETS.youtube.ratio} · ${ASPECT_RATIO_PRESETS.youtube.platform}` },
  "youtube-shorts": { title: ASPECT_RATIO_PRESETS["youtube-shorts"].label, subtitle: `${ASPECT_RATIO_PRESETS["youtube-shorts"].ratio} · ${ASPECT_RATIO_PRESETS["youtube-shorts"].platform}` },
  "twitter-post": { title: ASPECT_RATIO_PRESETS["twitter-post"].label, subtitle: `${ASPECT_RATIO_PRESETS["twitter-post"].ratio} · ${ASPECT_RATIO_PRESETS["twitter-post"].platform}` },
  tiktok: { title: ASPECT_RATIO_PRESETS.tiktok.label, subtitle: `${ASPECT_RATIO_PRESETS.tiktok.ratio} · ${ASPECT_RATIO_PRESETS.tiktok.platform}` },
  "linkedin-post": { title: ASPECT_RATIO_PRESETS["linkedin-post"].label, subtitle: `${ASPECT_RATIO_PRESETS["linkedin-post"].ratio} · ${ASPECT_RATIO_PRESETS["linkedin-post"].platform}` },
  "linkedin-landscape": { title: ASPECT_RATIO_PRESETS["linkedin-landscape"].label, subtitle: `${ASPECT_RATIO_PRESETS["linkedin-landscape"].ratio} · ${ASPECT_RATIO_PRESETS["linkedin-landscape"].platform}` },
  "facebook-post": { title: ASPECT_RATIO_PRESETS["facebook-post"].label, subtitle: `${ASPECT_RATIO_PRESETS["facebook-post"].ratio} · ${ASPECT_RATIO_PRESETS["facebook-post"].platform}` },
  pinterest: { title: ASPECT_RATIO_PRESETS.pinterest.label, subtitle: `${ASPECT_RATIO_PRESETS.pinterest.ratio} · ${ASPECT_RATIO_PRESETS.pinterest.platform}` },
  "square-hd": { title: ASPECT_RATIO_PRESETS["square-hd"].label, subtitle: `${ASPECT_RATIO_PRESETS["square-hd"].ratio} · ${ASPECT_RATIO_PRESETS["square-hd"].platform}` },
  "landscape-hd": { title: ASPECT_RATIO_PRESETS["landscape-hd"].label, subtitle: `${ASPECT_RATIO_PRESETS["landscape-hd"].ratio} · ${ASPECT_RATIO_PRESETS["landscape-hd"].platform}` },
  "16:9": { title: "16:9", subtitle: "Legacy landscape" },
  "9:16": { title: "9:16", subtitle: "Legacy portrait" },
  "1:1": { title: "1:1", subtitle: "Legacy square" },
  "4:5": { title: "4:5", subtitle: "Legacy portrait" },
  "4:3": { title: "4:3", subtitle: "Legacy classic" },
  "2:3": { title: "2:3", subtitle: "Legacy portrait" },
  "21:9": { title: "21:9", subtitle: "Legacy ultrawide" },
  custom: { title: "Custom", subtitle: "Custom dimensions" },
};

export const AspectRatioSelector: React.FC<AspectRatioSelectorProps> = ({
  value,
  supported,
  onChange,
}) => {
  return (
    <div className="flex flex-wrap gap-2">
      {supported.map((preset) => {
        const meta = LEGACY_LABELS[preset];
        return (
        <button
          key={preset}
          onClick={() => onChange(preset)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            value === preset
              ? "bg-blue-600 text-white"
              : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700 hover:text-gray-900 dark:hover:text-zinc-200"
          }`}
        >
          <span className="block">{meta.title}</span>
          <span className="block text-[10px] opacity-70">{meta.subtitle}</span>
        </button>
        );
      })}
    </div>
  );
};

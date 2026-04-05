import type { AspectRatioPreset } from "@studio/shared-types";

interface AspectRatioSelectorProps {
  value: AspectRatioPreset;
  supported: AspectRatioPreset[];
  onChange: (preset: AspectRatioPreset) => void;
}

const LABELS: Record<AspectRatioPreset, string> = {
  "16:9": "Landscape",
  "9:16": "Portrait",
  "1:1": "Square",
  "4:5": "Portrait 4:5",
  "4:3": "Classic",
  "2:3": "Portrait 2:3",
  "21:9": "Ultrawide",
  custom: "Custom",
};

export const AspectRatioSelector: React.FC<AspectRatioSelectorProps> = ({
  value,
  supported,
  onChange,
}) => {
  return (
    <div className="flex flex-wrap gap-2">
      {supported.map((preset) => (
        <button
          key={preset}
          onClick={() => onChange(preset)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            value === preset
              ? "bg-blue-600 text-white"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
          }`}
        >
          <span className="block">{preset}</span>
          <span className="block text-[10px] opacity-70">{LABELS[preset]}</span>
        </button>
      ))}
    </div>
  );
};

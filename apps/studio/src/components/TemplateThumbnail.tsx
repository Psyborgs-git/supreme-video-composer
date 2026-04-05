import { Player } from "@remotion/player";
import type { RegisteredTemplate } from "@studio/template-registry";
import { ASPECT_RATIO_DIMENSIONS } from "@studio/shared-types";

interface TemplateThumbnailProps {
  template: RegisteredTemplate;
  width?: number;
  height?: number;
}

/** Renders a still-frame of the template at its declared thumbnailFrame. */
export const TemplateThumbnail: React.FC<TemplateThumbnailProps> = ({
  template,
  width = 480,
  height = 270,
}) => {
  const { manifest, component } = template;

  const firstRatio = manifest.supportedAspectRatios[0];
  const dims =
    firstRatio && firstRatio !== "custom"
      ? ASPECT_RATIO_DIMENSIONS[firstRatio as keyof typeof ASPECT_RATIO_DIMENSIONS]
      : { width: 1920, height: 1080 };

  return (
    <Player
      component={component}
      durationInFrames={manifest.defaultDurationInFrames}
      fps={manifest.defaultFps}
      compositionWidth={dims.width}
      compositionHeight={dims.height}
      inputProps={manifest.defaultProps}
      initialFrame={manifest.thumbnailFrame}
      style={{ width, height, display: "block" }}
      controls={false}
      loop={false}
      autoPlay={false}
      acknowledgeRemotionLicense
    />
  );
};

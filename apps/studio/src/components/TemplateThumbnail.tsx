import { Player } from "@remotion/player";
import type { RegisteredTemplate } from "@studio/template-registry";

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

  // @remotion/player v4: render a still by setting initialFrame + durationInFrames=manifest value
  // and pausing at the thumbnail frame. The `inputProps` initialise with defaults.
  return (
    <Player
      component={component}
      durationInFrames={manifest.defaultDurationInFrames}
      fps={manifest.defaultFps}
      compositionWidth={manifest.supportedAspectRatios.includes("16:9") ? 1920 : 1080}
      compositionHeight={manifest.supportedAspectRatios.includes("16:9") ? 1080 : 1080}
      inputProps={manifest.defaultProps}
      initialFrame={manifest.thumbnailFrame}
      style={{ width, height, display: "block" }}
      // No controls – this is a static thumbnail
      controls={false}
      loop={false}
      autoPlay={false}
      acknowledgeRemotionLicense
    />
  );
};

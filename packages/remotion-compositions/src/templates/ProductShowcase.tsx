import { z } from "zod";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  AbsoluteFill,
  Series,
  Img,
  Audio,
} from "remotion";

// ─── Schema ──────────────────────────────────────────────────────

const ProductSchema = z.object({
  name: z.string(),
  price: z.string(),
  imageUrl: z.string(),
  tagline: z.string().optional(),
});

export const ProductShowcaseSchema = z.object({
  products: z.array(ProductSchema).min(1).default([
    {
      name: "Premium Headphones",
      price: "$299",
      imageUrl: "https://picsum.photos/600/600",
      tagline: "Immersive Sound",
    },
    {
      name: "Smart Watch",
      price: "$199",
      imageUrl: "https://picsum.photos/600/600?random=2",
      tagline: "Stay Connected",
    },
  ]),
  durationPerProductInFrames: z.number().min(30).default(120),
  backgroundColor: z.string().default("#fafaf9"),
  primaryColor: z.string().default("#18181b"),
  accentColor: z.string().default("#dc2626"),
  showPriceBadge: z.boolean().default(true),
  musicUrl: z.string().optional(),
  musicVolume: z.number().min(0).max(1).default(0.15),
});

export type ProductShowcaseProps = z.infer<typeof ProductShowcaseSchema>;

// ─── Single Product Card ─────────────────────────────────────────

const ProductCard: React.FC<{
  product: z.infer<typeof ProductSchema>;
  backgroundColor: string;
  primaryColor: string;
  accentColor: string;
  showPriceBadge: boolean;
}> = ({ product, backgroundColor, primaryColor, accentColor, showPriceBadge }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Image entry: scale spring
  const imageScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 80 },
  });

  // Text stagger
  const nameSpring = spring({
    frame: frame - 10,
    fps,
    config: { damping: 14, stiffness: 70 },
  });

  const taglineSpring = spring({
    frame: frame - 20,
    fps,
    config: { damping: 14, stiffness: 70 },
  });

  const priceSpring = spring({
    frame: frame - 25,
    fps,
    config: { damping: 10, stiffness: 100 },
  });

  const nameY = interpolate(nameSpring, [0, 1], [30, 0]);
  const taglineY = interpolate(taglineSpring, [0, 1], [20, 0]);

  const imgSize = Math.min(width, height) * 0.4;

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: height * 0.03,
        }}
      >
        {/* Product image */}
        <div style={{ position: "relative" }}>
          <Img
            src={product.imageUrl}
            style={{
              width: imgSize,
              height: imgSize,
              objectFit: "cover",
              borderRadius: 20,
              transform: `scale(${imageScale})`,
              boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
            }}
          />

          {/* Price badge */}
          {showPriceBadge && (
            <div
              style={{
                position: "absolute",
                top: -10,
                right: -10,
                backgroundColor: accentColor,
                color: "#ffffff",
                fontSize: height * 0.035,
                fontWeight: 800,
                padding: "8px 16px",
                borderRadius: 12,
                transform: `scale(${priceSpring})`,
                fontFamily: "sans-serif",
              }}
            >
              {product.price}
            </div>
          )}
        </div>

        {/* Product name */}
        <div
          style={{
            fontSize: height * 0.06,
            fontWeight: 800,
            color: primaryColor,
            opacity: Math.max(0, nameSpring),
            transform: `translateY(${nameY}px)`,
            textAlign: "center",
            fontFamily: "sans-serif",
          }}
        >
          {product.name}
        </div>

        {/* Tagline */}
        {product.tagline && (
          <div
            style={{
              fontSize: height * 0.03,
              color: primaryColor,
              opacity: Math.max(0, taglineSpring) * 0.7,
              transform: `translateY(${taglineY}px)`,
              textAlign: "center",
              fontFamily: "sans-serif",
            }}
          >
            {product.tagline}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// ─── Main Composition ────────────────────────────────────────────

export const ProductShowcase: React.FC<ProductShowcaseProps> = (props) => {
  const {
    products = [
      {
        name: "Premium Headphones",
        price: "$299",
        imageUrl: "https://picsum.photos/600/600",
        tagline: "Immersive Sound",
      },
      {
        name: "Smart Watch",
        price: "$199",
        imageUrl: "https://picsum.photos/600/600?random=2",
        tagline: "Stay Connected",
      },
    ],
    durationPerProductInFrames = 120,
    backgroundColor = "#fafaf9",
    primaryColor = "#18181b",
    accentColor = "#dc2626",
    showPriceBadge = true,
    musicUrl,
    musicVolume = 0.15,
  } = props || {};

  return (
    <AbsoluteFill style={{ backgroundColor }}>
      {musicUrl && <Audio src={musicUrl} volume={musicVolume} />}

      <Series>
        {products.map((product, i) => (
          <Series.Sequence key={i} durationInFrames={durationPerProductInFrames}>
            <ProductCard
              product={product}
              backgroundColor={backgroundColor}
              primaryColor={primaryColor}
              accentColor={accentColor}
              showPriceBadge={showPriceBadge}
            />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};

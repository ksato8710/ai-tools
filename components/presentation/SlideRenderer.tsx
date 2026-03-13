"use client";

import {
  Slide,
  DesignSystem,
  defaultDesignSystem,
  TitleBody,
  BulletsBody,
  TwoColumnBody,
  StatsBody,
  QuoteBody,
  ImageTextBody,
  CtaBody,
} from "@/lib/presentation-schema";

interface SlideRendererProps {
  slide: Slide;
  ds?: DesignSystem;
  scale?: number;
  onClick?: () => void;
  isActive?: boolean;
}

export default function SlideRenderer({
  slide,
  ds = defaultDesignSystem,
  scale = 1,
  onClick,
  isActive,
}: SlideRendererProps) {
  const slideW = 960;
  const slideH = 540;

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden select-none ${
        onClick ? "cursor-pointer" : ""
      } ${isActive ? "ring-2 ring-accent-leaf" : ""}`}
      style={{
        width: slideW * scale,
        height: slideH * scale,
        borderRadius: (ds.radius.md / 2) * scale,
        boxShadow: ds.shadows?.md || "0 2px 12px rgba(0,0,0,0.10)",
      }}
    >
      <div
        style={{
          width: slideW,
          height: slideH,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          fontFamily: ds.typography.bodyFont,
          background: ds.colors.background,
          color: ds.colors.text,
          position: "relative",
        }}
      >
        {slide.backgroundImage && slide.layout !== "image-text" && (
          <>
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `url(${slide.backgroundImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: slide.backgroundOverlay || "rgba(0,0,0,0.45)",
              }}
            />
          </>
        )}
        <div style={{ position: "relative", height: "100%" }}>
          {renderSlideContent(slide, ds)}
        </div>
      </div>
    </div>
  );
}

function renderSlideContent(slide: Slide, ds: DesignSystem) {
  switch (slide.layout) {
    case "title":
      return <TitleSlide slide={slide} ds={ds} />;
    case "section-divider":
      return <SectionDividerSlide slide={slide} ds={ds} />;
    case "bullets":
      return <BulletsSlide slide={slide} ds={ds} />;
    case "two-column":
      return <TwoColumnSlide slide={slide} ds={ds} />;
    case "stats":
      return <StatsSlide slide={slide} ds={ds} />;
    case "quote":
      return <QuoteSlide slide={slide} ds={ds} />;
    case "image-text":
      return <ImageTextSlide slide={slide} ds={ds} />;
    case "cta":
      return <CtaSlide slide={slide} ds={ds} />;
    default:
      return <DefaultSlide slide={slide} ds={ds} />;
  }
}

type SProps = { slide: Slide; ds: DesignSystem };

// --- Title ---
function TitleSlide({ slide, ds }: SProps) {
  const body = slide.body as TitleBody | undefined;
  const { colors: c, typography: ty, decorations: dec } = ds;
  const hasBg = !!slide.backgroundImage;
  return (
    <div
      className="flex flex-col items-center justify-center h-full text-center px-16"
      style={{
        background: hasBg ? "transparent" : `linear-gradient(135deg, ${c.primaryDark} 0%, ${c.primary} 100%)`,
        color: c.textInverse,
      }}
    >
      <div
        style={{
          fontSize: ty.heroSize,
          fontFamily: ty.headingFont,
          fontWeight: ty.headingWeight,
          lineHeight: ty.headingLineHeight,
          letterSpacing: ty.headingLetterSpacing ? `${ty.headingLetterSpacing}em` : undefined,
        }}
      >
        {slide.title}
      </div>
      {slide.subtitle && (
        <div
          className="mt-4 opacity-90"
          style={{
            fontSize: ty.h2Size,
            fontWeight: ty.bodyWeight,
          }}
        >
          {slide.subtitle}
        </div>
      )}
      {body?.tagline && (
        <div
          className="mt-8 opacity-70 italic max-w-[600px]"
          style={{ fontSize: ty.bodySize }}
        >
          {body.tagline}
        </div>
      )}
      {body?.description && (
        <div
          className="mt-6 opacity-60 max-w-[560px] whitespace-pre-line"
          style={{
            fontSize: ty.bodySize,
            lineHeight: ty.bodyLineHeight,
          }}
        >
          {body.description}
        </div>
      )}
      <div
        className="mt-8 rounded-full"
        style={{
          width: dec.accentBarWidth,
          height: dec.accentBarHeight,
          background: c.accent,
        }}
      />
    </div>
  );
}

// --- Section Divider ---
function SectionDividerSlide({ slide, ds }: SProps) {
  const { colors: c, typography: ty, decorations: dec } = ds;
  const hasBg = !!slide.backgroundImage;
  return (
    <div
      className="flex flex-col items-center justify-center h-full px-16"
      style={{ background: hasBg ? "transparent" : c.backgroundAlt }}
    >
      {dec.sectionDividerStyle === "bar" && (
        <div
          className="rounded-full mb-8"
          style={{
            width: dec.accentBarWidth,
            height: dec.accentBarHeight,
            background: c.accent,
          }}
        />
      )}
      {dec.sectionDividerStyle === "line" && (
        <div
          className="mb-8"
          style={{
            width: 120,
            height: 1,
            background: c.accent,
          }}
        />
      )}
      <div
        style={{
          fontSize: ty.h1Size,
          fontFamily: ty.headingFont,
          fontWeight: ty.headingWeight,
          lineHeight: ty.headingLineHeight,
          color: hasBg ? c.textInverse : c.primary,
          letterSpacing: ty.headingLetterSpacing ? `${ty.headingLetterSpacing}em` : undefined,
        }}
      >
        {slide.title}
      </div>
      {slide.subtitle && (
        <div
          className="mt-4 opacity-60"
          style={{ fontSize: ty.h3Size, color: hasBg ? c.textInverse : c.textMuted }}
        >
          {slide.subtitle}
        </div>
      )}
    </div>
  );
}

// --- Bullets ---
function BulletsSlide({ slide, ds }: SProps) {
  const body = slide.body as BulletsBody;
  const { colors: c, typography: ty, decorations: dec } = ds;

  const bulletEl = (size?: number) => {
    const s = size || dec.bulletSize;
    const style = dec.bulletStyle;
    if (style === "dash") return <span className="mt-1.5 shrink-0" style={{ color: c.accent }}>—</span>;
    if (style === "square") return <span className="mt-1.5 shrink-0" style={{ width: s, height: s, background: c.accent }} />;
    return (
      <span
        className="rounded-full mt-2 shrink-0"
        style={{ width: s, height: s, background: c.accent }}
      />
    );
  };

  return (
    <div className="flex flex-col h-full px-14 py-12">
      <SlideHeader title={slide.title} subtitle={slide.subtitle} ds={ds} />
      <div className="flex-1 flex flex-col justify-center mt-4">
        <ul style={{ display: "flex", flexDirection: "column", gap: ds.spacing.sm }}>
          {body.items.map((item, i) => (
            <li key={i}>
              <div className="flex items-start gap-3">
                {bulletEl()}
                <div>
                  <span
                    style={{
                      fontSize: ty.h3Size,
                      fontWeight: ty.boldWeight,
                      color: c.text,
                    }}
                  >
                    {item.text}
                  </span>
                  {item.subItems && (
                    <ul className="mt-1.5 ml-1" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {item.subItems.map((sub, j) => (
                        <li
                          key={j}
                          className="flex items-start gap-2"
                          style={{
                            fontSize: ty.bodySize - 1,
                            color: c.textMuted,
                          }}
                        >
                          <span className="mt-1.5">—</span>
                          <span>{sub}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// --- Two Column ---
function TwoColumnSlide({ slide, ds }: SProps) {
  const body = slide.body as TwoColumnBody;
  return (
    <div className="flex flex-col h-full px-14 py-12">
      <SlideHeader title={slide.title} subtitle={slide.subtitle} ds={ds} />
      <div className="flex-1 grid grid-cols-2 mt-6" style={{ gap: ds.spacing.lg }}>
        <ColumnBlock col={body.left} ds={ds} />
        <ColumnBlock col={body.right} ds={ds} />
      </div>
    </div>
  );
}

function ColumnBlock({
  col,
  ds,
}: {
  col: TwoColumnBody["left"];
  ds: DesignSystem;
}) {
  const { colors: c, typography: ty, decorations: dec } = ds;
  return (
    <div className="flex flex-col">
      {col.heading && (
        <div
          className="mb-4 pb-2"
          style={{
            fontSize: ty.h3Size,
            fontFamily: ty.headingFont,
            fontWeight: ty.boldWeight,
            color: c.primary,
            borderBottom: `2px solid ${c.accent}`,
          }}
        >
          {col.heading}
        </div>
      )}
      {col.items && (
        <ul style={{ display: "flex", flexDirection: "column", gap: ds.spacing.xs + 4 }}>
          {col.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2" style={{ fontSize: ty.bodySize - 1 }}>
              <span
                className="rounded-full mt-1.5 shrink-0"
                style={{
                  width: dec.bulletSize - 2,
                  height: dec.bulletSize - 2,
                  background: c.accent,
                }}
              />
              <span style={{ lineHeight: 1.45 }}>
                {typeof item === "string" ? item : (item as { text?: string }).text || ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      {col.description && (
        <p
          className="mt-2 opacity-70"
          style={{
            fontSize: ty.bodySize - 1,
            lineHeight: ty.bodyLineHeight,
          }}
        >
          {col.description}
        </p>
      )}
    </div>
  );
}

// --- Stats ---
function StatsSlide({ slide, ds }: SProps) {
  const body = slide.body as StatsBody;
  const { colors: c, typography: ty } = ds;
  return (
    <div className="flex flex-col h-full px-14 py-12">
      <SlideHeader title={slide.title} subtitle={slide.subtitle} ds={ds} />
      <div className="flex-1 flex items-center justify-center">
        <div className="flex" style={{ gap: ds.spacing.lg + 8 }}>
          {body.stats.map((stat, i) => (
            <div key={i} className="text-center flex-1 min-w-[160px]">
              <div
                className="leading-none"
                style={{
                  fontSize: ty.heroSize + 8,
                  fontFamily: ty.headingFont,
                  fontWeight: ty.headingWeight,
                  color: c.primary,
                }}
              >
                {stat.value}
              </div>
              <div
                className="mt-2"
                style={{
                  fontSize: ty.h3Size,
                  fontWeight: ty.boldWeight,
                  color: c.accent,
                }}
              >
                {stat.label}
              </div>
              {stat.description && (
                <div
                  className="mt-2 opacity-50 leading-snug"
                  style={{ fontSize: ty.smallSize + 2, color: c.textMuted }}
                >
                  {stat.description}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {body.footnote && (
        <div
          className="opacity-40 text-center mt-2"
          style={{ fontSize: ty.smallSize + 1, color: c.textMuted }}
        >
          {body.footnote}
        </div>
      )}
    </div>
  );
}

// --- Quote ---
function QuoteSlide({ slide, ds }: SProps) {
  const body = slide.body as QuoteBody;
  const { colors: c, typography: ty } = ds;
  return (
    <div
      className="flex flex-col items-center justify-center h-full px-20 text-center"
      style={{ background: c.backgroundAlt }}
    >
      <div
        className="mb-6 tracking-widest uppercase opacity-40"
        style={{
          fontSize: ty.bodySize - 1,
          fontWeight: ty.boldWeight,
          letterSpacing: "0.15em",
        }}
      >
        {slide.title}
      </div>
      <div
        className="leading-none opacity-20 -mb-6"
        style={{ fontSize: 60, color: c.primary }}
      >
        &ldquo;
      </div>
      <blockquote
        className="max-w-[640px] italic"
        style={{
          fontSize: ty.h2Size,
          fontFamily: ty.headingFont,
          lineHeight: 1.5,
          color: c.primary,
        }}
      >
        {body.quote}
      </blockquote>
      {body.attribution && (
        <div
          className="mt-6"
          style={{
            fontSize: ty.bodySize - 1,
            fontWeight: ty.boldWeight,
            color: c.accent,
          }}
        >
          — {body.attribution}
        </div>
      )}
      {body.context && (
        <div
          className="mt-4 opacity-50 max-w-[500px]"
          style={{
            fontSize: ty.smallSize + 2,
            lineHeight: ty.bodyLineHeight,
            color: c.textMuted,
          }}
        >
          {body.context}
        </div>
      )}
    </div>
  );
}

// --- Image + Text ---
function ImageTextSlide({ slide, ds }: SProps) {
  const body = slide.body as ImageTextBody;
  const { colors: c, typography: ty } = ds;
  const imgLeft = body.imagePosition !== "right";
  const imgUrl = body.imageUrl || slide.backgroundImage;
  return (
    <div className={`flex h-full ${imgLeft ? "" : "flex-row-reverse"}`}>
      <div
        className="w-1/2 flex items-center justify-center overflow-hidden"
        style={{ background: c.backgroundAlt, position: "relative" }}
      >
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={slide.title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div className="opacity-40 p-8" style={{ fontSize: ty.bodySize - 1 }}>
            {body.imagePlaceholder || "[Image]"}
          </div>
        )}
      </div>
      <div className="w-1/2 flex flex-col justify-center px-12">
        <div
          className="mb-4"
          style={{
            fontSize: ty.h2Size,
            fontFamily: ty.headingFont,
            fontWeight: ty.headingWeight,
            color: c.primary,
          }}
        >
          {slide.title}
        </div>
        <p
          className="opacity-70"
          style={{
            fontSize: ty.bodySize,
            lineHeight: ty.bodyLineHeight,
          }}
        >
          {body.text}
        </p>
      </div>
    </div>
  );
}

// --- CTA ---
function CtaSlide({ slide, ds }: SProps) {
  const body = slide.body as CtaBody;
  const { colors: c, typography: ty, decorations: dec, radius } = ds;
  return (
    <div
      className="flex flex-col items-center justify-center h-full px-16 text-center"
      style={{
        background: `linear-gradient(135deg, ${c.primaryDark} 0%, ${c.primary} 100%)`,
        color: c.textInverse,
      }}
    >
      <div
        className="mb-4 tracking-widest uppercase opacity-60"
        style={{
          fontSize: ty.smallSize,
          letterSpacing: "0.15em",
        }}
      >
        {slide.title}
      </div>
      <div
        className="mb-4"
        style={{
          fontSize: ty.h1Size,
          fontFamily: ty.headingFont,
          fontWeight: ty.headingWeight,
        }}
      >
        {body.heading}
      </div>
      {body.description && (
        <p
          className="opacity-80 max-w-[560px] mb-8"
          style={{
            fontSize: ty.h3Size,
            lineHeight: ty.bodyLineHeight,
          }}
        >
          {body.description}
        </p>
      )}
      {body.actions && (
        <ul className="mb-6" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {body.actions.map((a, i) => (
            <li key={i} className="flex items-center gap-2 opacity-90" style={{ fontSize: ty.bodySize }}>
              <span style={{ color: c.accent }}>→</span>
              <span>{a}</span>
            </li>
          ))}
        </ul>
      )}
      {body.contactInfo && (
        <div
          className="mt-4 px-4 py-2"
          style={{
            fontSize: ty.smallSize + 2,
            background: "rgba(255,255,255,0.15)",
            borderRadius: radius.full,
          }}
        >
          {body.contactInfo}
        </div>
      )}
    </div>
  );
}

// --- Default ---
function DefaultSlide({ slide, ds }: SProps) {
  const { colors: c, typography: ty } = ds;
  return (
    <div className="flex flex-col items-center justify-center h-full px-16">
      <div
        style={{
          fontSize: ty.h1Size,
          fontFamily: ty.headingFont,
          fontWeight: ty.headingWeight,
          color: c.primary,
        }}
      >
        {slide.title}
      </div>
      {slide.subtitle && (
        <div
          className="mt-2 opacity-60"
          style={{ fontSize: ty.h3Size, color: c.textMuted }}
        >
          {slide.subtitle}
        </div>
      )}
    </div>
  );
}

// --- Shared ---
function SlideHeader({
  title,
  subtitle,
  ds,
}: {
  title: string;
  subtitle?: string;
  ds: DesignSystem;
}) {
  const { colors: c, typography: ty, decorations: dec } = ds;
  return (
    <div>
      <div
        style={{
          fontSize: ty.h2Size,
          fontFamily: ty.headingFont,
          fontWeight: ty.headingWeight,
          lineHeight: ty.headingLineHeight,
          color: c.primary,
          letterSpacing: ty.headingLetterSpacing ? `${ty.headingLetterSpacing}em` : undefined,
        }}
      >
        {title}
      </div>
      {subtitle && (
        <div
          className="mt-1 opacity-50"
          style={{ fontSize: ty.bodySize, color: c.textMuted }}
        >
          {subtitle}
        </div>
      )}
      {dec.headerUnderline && (
        <div
          className="mt-3 rounded-full"
          style={{
            width: dec.accentBarWidth * 0.75,
            height: dec.accentBarHeight,
            background: c.accent,
          }}
        />
      )}
    </div>
  );
}

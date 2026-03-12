"use client";

import {
  Slide,
  PresentationTheme,
  defaultTheme,
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
  theme?: PresentationTheme;
  scale?: number;
  onClick?: () => void;
  isActive?: boolean;
}

export default function SlideRenderer({
  slide,
  theme = defaultTheme,
  scale = 1,
  onClick,
  isActive,
}: SlideRendererProps) {
  const t = theme;
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
        borderRadius: 4 * scale,
        boxShadow: "0 2px 12px rgba(0,0,0,0.10)",
      }}
    >
      <div
        style={{
          width: slideW,
          height: slideH,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          fontFamily: "'Inter', 'Noto Sans JP', sans-serif",
          background: t.backgroundColor,
          color: t.textColor,
        }}
      >
        {renderSlideContent(slide, t)}
      </div>
    </div>
  );
}

function renderSlideContent(slide: Slide, t: PresentationTheme) {
  switch (slide.layout) {
    case "title":
      return <TitleSlide slide={slide} theme={t} />;
    case "section-divider":
      return <SectionDividerSlide slide={slide} theme={t} />;
    case "bullets":
      return <BulletsSlide slide={slide} theme={t} />;
    case "two-column":
      return <TwoColumnSlide slide={slide} theme={t} />;
    case "stats":
      return <StatsSlide slide={slide} theme={t} />;
    case "quote":
      return <QuoteSlide slide={slide} theme={t} />;
    case "image-text":
      return <ImageTextSlide slide={slide} theme={t} />;
    case "cta":
      return <CtaSlide slide={slide} theme={t} />;
    default:
      return <DefaultSlide slide={slide} theme={t} />;
  }
}

// --- Layout Components ---

function TitleSlide({
  slide,
  theme,
}: {
  slide: Slide;
  theme: PresentationTheme;
}) {
  const body = slide.body as TitleBody | undefined;
  return (
    <div
      className="flex flex-col items-center justify-center h-full text-center px-16"
      style={{
        background: `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`,
        color: "#fff",
      }}
    >
      <div
        className="text-[56px] font-bold tracking-tight leading-tight"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        {slide.title}
      </div>
      {slide.subtitle && (
        <div className="text-[24px] mt-4 opacity-90 font-light">
          {slide.subtitle}
        </div>
      )}
      {body?.tagline && (
        <div className="text-[16px] mt-8 opacity-70 italic max-w-[600px]">
          {body.tagline}
        </div>
      )}
      {body?.description && (
        <div className="text-[15px] mt-6 opacity-60 max-w-[560px] leading-relaxed whitespace-pre-line">
          {body.description}
        </div>
      )}
      {/* Decorative accent bar */}
      <div
        className="w-16 h-1 mt-8 rounded-full"
        style={{ background: theme.accentColor }}
      />
    </div>
  );
}

function SectionDividerSlide({
  slide,
  theme,
}: {
  slide: Slide;
  theme: PresentationTheme;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-16">
      <div
        className="w-12 h-1 rounded-full mb-8"
        style={{ background: theme.accentColor }}
      />
      <div
        className="text-[40px] font-bold tracking-tight"
        style={{ color: theme.primaryColor }}
      >
        {slide.title}
      </div>
      {slide.subtitle && (
        <div className="text-[18px] mt-4 opacity-60">{slide.subtitle}</div>
      )}
    </div>
  );
}

function BulletsSlide({
  slide,
  theme,
}: {
  slide: Slide;
  theme: PresentationTheme;
}) {
  const body = slide.body as BulletsBody;
  return (
    <div className="flex flex-col h-full px-14 py-12">
      <SlideHeader title={slide.title} subtitle={slide.subtitle} theme={theme} />
      <div className="flex-1 flex flex-col justify-center mt-4">
        <ul className="space-y-4">
          {body.items.map((item, i) => (
            <li key={i}>
              <div className="flex items-start gap-3">
                <span
                  className="w-2 h-2 rounded-full mt-2 shrink-0"
                  style={{ background: theme.accentColor }}
                />
                <div>
                  <span className="text-[18px] font-medium">{item.text}</span>
                  {item.subItems && (
                    <ul className="mt-1.5 space-y-1 ml-1">
                      {item.subItems.map((sub, j) => (
                        <li
                          key={j}
                          className="text-[14px] opacity-60 flex items-start gap-2"
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

function TwoColumnSlide({
  slide,
  theme,
}: {
  slide: Slide;
  theme: PresentationTheme;
}) {
  const body = slide.body as TwoColumnBody;
  return (
    <div className="flex flex-col h-full px-14 py-12">
      <SlideHeader title={slide.title} subtitle={slide.subtitle} theme={theme} />
      <div className="flex-1 grid grid-cols-2 gap-10 mt-6">
        <ColumnBlock col={body.left} theme={theme} />
        <ColumnBlock col={body.right} theme={theme} />
      </div>
    </div>
  );
}

function ColumnBlock({
  col,
  theme,
}: {
  col: TwoColumnBody["left"];
  theme: PresentationTheme;
}) {
  return (
    <div className="flex flex-col">
      {col.heading && (
        <div
          className="text-[16px] font-bold mb-4 pb-2 border-b-2"
          style={{
            color: theme.primaryColor,
            borderColor: theme.accentColor,
          }}
        >
          {col.heading}
        </div>
      )}
      {col.items && (
        <ul className="space-y-3">
          {col.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-[14px]">
              <span
                className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                style={{ background: theme.accentColor }}
              />
              <span className="leading-snug">{item}</span>
            </li>
          ))}
        </ul>
      )}
      {col.description && (
        <p className="text-[14px] leading-relaxed opacity-70 mt-2">
          {col.description}
        </p>
      )}
    </div>
  );
}

function StatsSlide({
  slide,
  theme,
}: {
  slide: Slide;
  theme: PresentationTheme;
}) {
  const body = slide.body as StatsBody;
  return (
    <div className="flex flex-col h-full px-14 py-12">
      <SlideHeader title={slide.title} subtitle={slide.subtitle} theme={theme} />
      <div className="flex-1 flex items-center justify-center">
        <div className="flex gap-12">
          {body.stats.map((stat, i) => (
            <div key={i} className="text-center flex-1 min-w-[160px]">
              <div
                className="text-[52px] font-bold leading-none"
                style={{ color: theme.primaryColor }}
              >
                {stat.value}
              </div>
              <div
                className="text-[16px] font-semibold mt-2"
                style={{ color: theme.accentColor }}
              >
                {stat.label}
              </div>
              {stat.description && (
                <div className="text-[13px] mt-2 opacity-50 leading-snug">
                  {stat.description}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {body.footnote && (
        <div className="text-[12px] opacity-40 text-center mt-2">
          {body.footnote}
        </div>
      )}
    </div>
  );
}

function QuoteSlide({
  slide,
  theme,
}: {
  slide: Slide;
  theme: PresentationTheme;
}) {
  const body = slide.body as QuoteBody;
  return (
    <div className="flex flex-col items-center justify-center h-full px-20 text-center">
      <div className="text-[14px] font-semibold mb-6 tracking-widest uppercase opacity-40">
        {slide.title}
      </div>
      <div
        className="text-[60px] leading-none opacity-20 -mb-6"
        style={{ color: theme.primaryColor }}
      >
        &ldquo;
      </div>
      <blockquote
        className="text-[22px] leading-relaxed max-w-[640px] italic"
        style={{ color: theme.primaryColor }}
      >
        {body.quote}
      </blockquote>
      {body.attribution && (
        <div
          className="text-[14px] mt-6 font-semibold"
          style={{ color: theme.accentColor }}
        >
          — {body.attribution}
        </div>
      )}
      {body.context && (
        <div className="text-[13px] mt-4 opacity-50 max-w-[500px] leading-relaxed">
          {body.context}
        </div>
      )}
    </div>
  );
}

function ImageTextSlide({
  slide,
  theme,
}: {
  slide: Slide;
  theme: PresentationTheme;
}) {
  const body = slide.body as ImageTextBody;
  const imgLeft = body.imagePosition !== "right";
  return (
    <div className={`flex h-full ${imgLeft ? "" : "flex-row-reverse"}`}>
      <div
        className="w-1/2 flex items-center justify-center"
        style={{ background: `${theme.primaryColor}10` }}
      >
        <div className="text-[14px] opacity-40 p-8">
          {body.imagePlaceholder || "[Image]"}
        </div>
      </div>
      <div className="w-1/2 flex flex-col justify-center px-12">
        <div
          className="text-[28px] font-bold mb-4"
          style={{ color: theme.primaryColor }}
        >
          {slide.title}
        </div>
        <p className="text-[15px] leading-relaxed opacity-70">{body.text}</p>
      </div>
    </div>
  );
}

function CtaSlide({
  slide,
  theme,
}: {
  slide: Slide;
  theme: PresentationTheme;
}) {
  const body = slide.body as CtaBody;
  return (
    <div
      className="flex flex-col items-center justify-center h-full px-16 text-center"
      style={{
        background: `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`,
        color: "#fff",
      }}
    >
      <div className="text-[14px] font-semibold mb-4 tracking-widest uppercase opacity-60">
        {slide.title}
      </div>
      <div className="text-[36px] font-bold mb-4">{body.heading}</div>
      {body.description && (
        <p className="text-[16px] opacity-80 max-w-[560px] leading-relaxed mb-8">
          {body.description}
        </p>
      )}
      {body.actions && (
        <ul className="space-y-2 mb-6">
          {body.actions.map((a, i) => (
            <li key={i} className="flex items-center gap-2 text-[15px] opacity-90">
              <span style={{ color: theme.accentColor }}>→</span>
              <span>{a}</span>
            </li>
          ))}
        </ul>
      )}
      {body.contactInfo && (
        <div
          className="text-[13px] mt-4 px-4 py-2 rounded-full"
          style={{ background: "rgba(255,255,255,0.15)" }}
        >
          {body.contactInfo}
        </div>
      )}
    </div>
  );
}

function DefaultSlide({
  slide,
  theme,
}: {
  slide: Slide;
  theme: PresentationTheme;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-16">
      <div
        className="text-[32px] font-bold"
        style={{ color: theme.primaryColor }}
      >
        {slide.title}
      </div>
      {slide.subtitle && (
        <div className="text-[16px] mt-2 opacity-60">{slide.subtitle}</div>
      )}
    </div>
  );
}

// --- Shared Components ---

function SlideHeader({
  title,
  subtitle,
  theme,
}: {
  title: string;
  subtitle?: string;
  theme: PresentationTheme;
}) {
  return (
    <div>
      <div
        className="text-[28px] font-bold leading-tight"
        style={{ color: theme.primaryColor }}
      >
        {title}
      </div>
      {subtitle && (
        <div className="text-[15px] mt-1 opacity-50">{subtitle}</div>
      )}
      <div
        className="w-10 h-0.5 mt-3 rounded-full"
        style={{ background: theme.accentColor }}
      />
    </div>
  );
}

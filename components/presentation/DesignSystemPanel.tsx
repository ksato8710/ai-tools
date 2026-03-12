"use client";

import { useState } from "react";
import type {
  DesignSystem,
  DesignColors,
  DesignTypography,
  DesignRadius,
  DesignDecorations,
} from "@/lib/presentation-schema";

interface DesignSystemPanelProps {
  current: DesignSystem;
  builtIn: Record<string, DesignSystem>;
  onChange: (ds: DesignSystem) => void;
}

export default function DesignSystemPanel({
  current,
  builtIn,
  onChange,
}: DesignSystemPanelProps) {
  const [showJson, setShowJson] = useState(false);
  const [jsonDraft, setJsonDraft] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  const updateColors = (patch: Partial<DesignColors>) => {
    onChange({ ...current, colors: { ...current.colors, ...patch } });
  };

  const updateTypography = (patch: Partial<DesignTypography>) => {
    onChange({
      ...current,
      typography: { ...current.typography, ...patch },
    });
  };

  const updateRadius = (patch: Partial<DesignRadius>) => {
    onChange({ ...current, radius: { ...current.radius, ...patch } });
  };

  const updateDecorations = (patch: Partial<DesignDecorations>) => {
    onChange({
      ...current,
      decorations: { ...current.decorations, ...patch },
    });
  };

  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(jsonDraft) as DesignSystem;
      if (!parsed.name || !parsed.colors || !parsed.typography) {
        setJsonError("name, colors, typography are required");
        return;
      }
      onChange(parsed);
      setJsonError(null);
      setShowJson(false);
    } catch {
      setJsonError("Invalid JSON");
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border-light flex items-center justify-between">
        <h3 className="text-xs font-bold tracking-widest uppercase text-text-muted">
          デザインシステム
        </h3>
        <button
          className="text-[10px] text-accent-leaf hover:underline"
          onClick={() => {
            setJsonDraft(JSON.stringify(current, null, 2));
            setShowJson(!showJson);
          }}
        >
          {showJson ? "閉じる" : "JSON編集"}
        </button>
      </div>

      {showJson ? (
        <div className="p-4 flex flex-col gap-2 flex-1">
          <textarea
            className="flex-1 text-[11px] font-mono border border-border rounded-md p-3 bg-white focus:outline-none focus:border-accent-leaf resize-none"
            value={jsonDraft}
            onChange={(e) => setJsonDraft(e.target.value)}
            spellCheck={false}
          />
          {jsonError && (
            <div className="text-xs text-error">{jsonError}</div>
          )}
          <button
            className="px-3 py-1.5 text-xs rounded-md bg-accent-leaf text-white hover:bg-accent-leaf-hover transition-colors"
            onClick={handleImportJson}
          >
            適用
          </button>
        </div>
      ) : (
        <div className="p-5 space-y-6">
          {/* Preset selector */}
          <section>
            <SectionLabel>プリセット</SectionLabel>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(builtIn).map(([key, ds]) => (
                <button
                  key={key}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs transition-colors ${
                    current.name === ds.name
                      ? "border-accent-leaf bg-accent-leaf/5 text-text-primary"
                      : "border-border-light text-text-secondary hover:border-border"
                  }`}
                  onClick={() => onChange(ds)}
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ background: ds.colors.accent }}
                  />
                  {ds.name}
                </button>
              ))}
            </div>
          </section>

          {/* Colors */}
          <section>
            <SectionLabel>カラー</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              <ColorField label="Primary" value={current.colors.primary} onChange={(v) => updateColors({ primary: v })} />
              <ColorField label="Dark" value={current.colors.primaryDark} onChange={(v) => updateColors({ primaryDark: v })} />
              <ColorField label="Accent" value={current.colors.accent} onChange={(v) => updateColors({ accent: v })} />
              <ColorField label="Background" value={current.colors.background} onChange={(v) => updateColors({ background: v })} />
              <ColorField label="Alt BG" value={current.colors.backgroundAlt} onChange={(v) => updateColors({ backgroundAlt: v })} />
              <ColorField label="Surface" value={current.colors.surface} onChange={(v) => updateColors({ surface: v })} />
              <ColorField label="Text" value={current.colors.text} onChange={(v) => updateColors({ text: v })} />
              <ColorField label="Inverse" value={current.colors.textInverse} onChange={(v) => updateColors({ textInverse: v })} />
              <ColorField label="Muted" value={current.colors.textMuted} onChange={(v) => updateColors({ textMuted: v })} />
            </div>
          </section>

          {/* Typography */}
          <section>
            <SectionLabel>タイポグラフィ</SectionLabel>
            <div className="space-y-2">
              <TextFieldRow
                label="見出しフォント"
                value={current.typography.headingFont}
                onChange={(v) => updateTypography({ headingFont: v })}
              />
              <TextFieldRow
                label="本文フォント"
                value={current.typography.bodyFont}
                onChange={(v) => updateTypography({ bodyFont: v })}
              />
              <div className="grid grid-cols-3 gap-2 mt-2">
                <NumberField label="Hero" value={current.typography.heroSize} onChange={(v) => updateTypography({ heroSize: v })} />
                <NumberField label="H1" value={current.typography.h1Size} onChange={(v) => updateTypography({ h1Size: v })} />
                <NumberField label="H2" value={current.typography.h2Size} onChange={(v) => updateTypography({ h2Size: v })} />
                <NumberField label="H3" value={current.typography.h3Size} onChange={(v) => updateTypography({ h3Size: v })} />
                <NumberField label="Body" value={current.typography.bodySize} onChange={(v) => updateTypography({ bodySize: v })} />
                <NumberField label="Small" value={current.typography.smallSize} onChange={(v) => updateTypography({ smallSize: v })} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <NumberField label="見出しW" value={current.typography.headingWeight} onChange={(v) => updateTypography({ headingWeight: v })} step={100} />
                <NumberField label="本文W" value={current.typography.bodyWeight} onChange={(v) => updateTypography({ bodyWeight: v })} step={100} />
                <NumberField label="太字W" value={current.typography.boldWeight} onChange={(v) => updateTypography({ boldWeight: v })} step={100} />
              </div>
            </div>
          </section>

          {/* Radius */}
          <section>
            <SectionLabel>角丸 (px)</SectionLabel>
            <div className="grid grid-cols-4 gap-2">
              <NumberField label="SM" value={current.radius.sm} onChange={(v) => updateRadius({ sm: v })} />
              <NumberField label="MD" value={current.radius.md} onChange={(v) => updateRadius({ md: v })} />
              <NumberField label="LG" value={current.radius.lg} onChange={(v) => updateRadius({ lg: v })} />
              <NumberField label="Full" value={current.radius.full} onChange={(v) => updateRadius({ full: v })} />
            </div>
            {/* Radius preview */}
            <div className="flex gap-3 mt-3 items-end">
              {[current.radius.sm, current.radius.md, current.radius.lg].map((r, i) => (
                <div
                  key={i}
                  className="w-10 h-10 border-2"
                  style={{
                    borderColor: current.colors.accent,
                    borderRadius: r,
                    background: `${current.colors.accent}15`,
                  }}
                />
              ))}
              <div
                className="w-10 h-10 border-2"
                style={{
                  borderColor: current.colors.accent,
                  borderRadius: current.radius.full,
                  background: `${current.colors.accent}15`,
                }}
              />
            </div>
          </section>

          {/* Decorations */}
          <section>
            <SectionLabel>装飾</SectionLabel>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">ビュレットスタイル</span>
                <select
                  className="text-xs border border-border rounded px-2 py-1 bg-white focus:outline-none"
                  value={current.decorations.bulletStyle}
                  onChange={(e) =>
                    updateDecorations({
                      bulletStyle: e.target.value as DesignDecorations["bulletStyle"],
                    })
                  }
                >
                  <option value="dot">Dot</option>
                  <option value="circle">Circle</option>
                  <option value="dash">Dash</option>
                  <option value="square">Square</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">セクション区切り</span>
                <select
                  className="text-xs border border-border rounded px-2 py-1 bg-white focus:outline-none"
                  value={current.decorations.sectionDividerStyle}
                  onChange={(e) =>
                    updateDecorations({
                      sectionDividerStyle: e.target.value as DesignDecorations["sectionDividerStyle"],
                    })
                  }
                >
                  <option value="bar">Bar</option>
                  <option value="line">Line</option>
                  <option value="gradient">Gradient</option>
                  <option value="none">None</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">タイトル下線</span>
                <button
                  className={`px-2 py-0.5 text-[10px] rounded-full border transition-colors ${
                    current.decorations.headerUnderline
                      ? "bg-accent-leaf/10 border-accent-leaf text-accent-leaf"
                      : "border-border-light text-text-muted"
                  }`}
                  onClick={() =>
                    updateDecorations({
                      headerUnderline: !current.decorations.headerUnderline,
                    })
                  }
                >
                  {current.decorations.headerUnderline ? "ON" : "OFF"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <NumberField
                  label="バー高さ"
                  value={current.decorations.accentBarHeight}
                  onChange={(v) => updateDecorations({ accentBarHeight: v })}
                />
                <NumberField
                  label="バー幅"
                  value={current.decorations.accentBarWidth}
                  onChange={(v) => updateDecorations({ accentBarWidth: v })}
                />
                <NumberField
                  label="ビュレットサイズ"
                  value={current.decorations.bulletSize}
                  onChange={(v) => updateDecorations({ bulletSize: v })}
                />
              </div>
            </div>
          </section>

          {/* Color preview strip */}
          <section>
            <SectionLabel>プレビュー</SectionLabel>
            <div className="flex rounded-lg overflow-hidden h-8">
              {[
                current.colors.primary,
                current.colors.primaryDark,
                current.colors.accent,
                current.colors.background,
                current.colors.backgroundAlt,
                current.colors.textMuted,
              ].map((color, i) => (
                <div key={i} className="flex-1" style={{ background: color }} />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

// --- Field components ---

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold tracking-widest uppercase text-text-muted mb-2">
      {children}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-5 h-5 rounded cursor-pointer border border-border-light p-0"
      />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-text-muted leading-none mb-0.5">
          {label}
        </div>
        <input
          className="w-full text-[10px] font-mono text-text-secondary bg-transparent focus:outline-none"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <div>
      <div className="text-[10px] text-text-muted mb-0.5">{label}</div>
      <input
        type="number"
        className="w-full text-xs border border-border rounded px-1.5 py-1 bg-white focus:outline-none focus:border-accent-leaf"
        value={value}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function TextFieldRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-[10px] text-text-muted mb-0.5">{label}</div>
      <input
        className="w-full text-xs border border-border rounded px-2 py-1 bg-white focus:outline-none focus:border-accent-leaf"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

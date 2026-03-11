"use client";

interface VariantToolbarProps {
  sessionName: string;
  sessionPrompt: string;
  variantCount: number;
  selectedCount: number;
  columns: 1 | 2 | 3;
  onColumnsChange: (cols: 1 | 2 | 3) => void;
  filter: "all" | "starred" | "selected";
  onFilterChange: (filter: "all" | "starred" | "selected") => void;
  responsive: "desktop" | "mobile";
  onResponsiveChange: (mode: "desktop" | "mobile") => void;
  onBack: () => void;
}

export default function VariantToolbar({
  sessionName,
  sessionPrompt,
  variantCount,
  selectedCount,
  columns,
  onColumnsChange,
  filter,
  onFilterChange,
  responsive,
  onResponsiveChange,
  onBack,
}: VariantToolbarProps) {
  return (
    <div className="sticky top-0 z-40 bg-cream/95 backdrop-blur border-b border-border-light px-6 py-3">
      <div className="flex items-center justify-between gap-4">
        {/* Left: session info */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-2 rounded-full hover:bg-card transition-colors text-text-secondary"
            title="Back to sessions"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="min-w-0">
            <h2 className="font-[family-name:var(--font-nunito)] font-bold text-text-primary truncate">
              {sessionName}
            </h2>
            <p className="text-xs text-text-muted truncate">{sessionPrompt}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-text-muted whitespace-nowrap">
            <span>{variantCount} variants</span>
            {selectedCount > 0 && (
              <span className="text-accent-leaf font-medium">{selectedCount} selected</span>
            )}
          </div>
        </div>

        {/* Right: controls */}
        <div className="flex items-center gap-2">
          {/* Filter */}
          <div className="flex rounded-full border border-border overflow-hidden">
            {(["all", "starred", "selected"] as const).map((f) => (
              <button
                key={f}
                onClick={() => onFilterChange(f)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === f
                    ? "bg-accent-leaf text-white"
                    : "text-text-secondary hover:bg-card"
                }`}
              >
                {f === "all" ? "All" : f === "starred" ? "Starred" : "Selected"}
              </button>
            ))}
          </div>

          {/* Responsive toggle */}
          <div className="flex rounded-full border border-border overflow-hidden">
            <button
              onClick={() => onResponsiveChange("desktop")}
              className={`p-1.5 transition-colors ${
                responsive === "desktop" ? "bg-accent-leaf text-white" : "text-text-secondary hover:bg-card"
              }`}
              title="Desktop"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="3" width="14" height="10" rx="1" />
                <path d="M6 15h6M9 13v2" strokeLinecap="round" />
              </svg>
            </button>
            <button
              onClick={() => onResponsiveChange("mobile")}
              className={`p-1.5 transition-colors ${
                responsive === "mobile" ? "bg-accent-leaf text-white" : "text-text-secondary hover:bg-card"
              }`}
              title="Mobile"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="5" y="2" width="8" height="14" rx="1.5" />
                <circle cx="9" cy="13.5" r="0.75" fill="currentColor" />
              </svg>
            </button>
          </div>

          {/* Columns */}
          <div className="flex rounded-full border border-border overflow-hidden">
            {([1, 2, 3] as const).map((c) => (
              <button
                key={c}
                onClick={() => onColumnsChange(c)}
                className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  columns === c
                    ? "bg-accent-leaf text-white"
                    : "text-text-secondary hover:bg-card"
                }`}
              >
                {c}col
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import Button from "@/components/ui/Button";
import type { ERDiagram } from "@/lib/er-schema";

interface ToolbarProps {
  diagramName: string;
  onDiagramNameChange: (name: string) => void;
  onExport: () => void;
  onImport: (diagram: ERDiagram) => void;
  onSave: () => void;
  onToggleOpen: () => void;
  onToggleAI: () => void;
  onToggleEnums: () => void;
  saving?: boolean;
  aiOpen: boolean;
  enumsOpen: boolean;
  hiddenCount: number;
  onShowAll: () => void;
}

export default function Toolbar({
  diagramName,
  onDiagramNameChange,
  onExport,
  onImport,
  onSave,
  onToggleOpen,
  onToggleAI,
  onToggleEnums,
  saving,
  aiOpen,
  enumsOpen,
  hiddenCount,
  onShowAll,
}: ToolbarProps) {
  const handleImportClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const diagram = JSON.parse(text) as ERDiagram;
        if (diagram.version !== "1.0" || !diagram.entities) {
          alert("Invalid ER diagram file format.");
          return;
        }
        onImport(diagram);
      } catch {
        alert("Failed to parse JSON file.");
      }
    };
    input.click();
  };

  return (
    <div className="h-12 bg-surface border-b border-border-light flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={diagramName}
          onChange={(e) => onDiagramNameChange(e.target.value)}
          className="text-sm font-medium bg-transparent border-b border-transparent hover:border-border focus:border-accent-leaf focus:outline-none px-1 py-0.5 text-text-primary"
          placeholder="Diagram name"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" variant="primary" onClick={onSave} disabled={saving}>
          <SaveIcon /> {saving ? "Saving..." : "Save"}
        </Button>
        <Button size="sm" variant="secondary" onClick={onToggleOpen}>
          <OpenIcon /> Open
        </Button>
        <div className="w-px h-5 bg-border-light mx-1" />
        <Button size="sm" variant="ghost" onClick={handleImportClick}>
          <ImportIcon /> Import
        </Button>
        <Button size="sm" variant="ghost" onClick={onExport}>
          <ExportIcon /> Export
        </Button>
        {hiddenCount > 0 && (
          <Button size="sm" variant="secondary" onClick={onShowAll}>
            <EyeIcon /> Show All ({hiddenCount} hidden)
          </Button>
        )}
        <Button
          size="sm"
          variant={enumsOpen ? "primary" : "secondary"}
          onClick={onToggleEnums}
        >
          <EnumIcon /> Enums
        </Button>
        <Button
          size="sm"
          variant={aiOpen ? "primary" : "secondary"}
          onClick={onToggleAI}
        >
          <AIIcon /> AI Assist
        </Button>
      </div>
    </div>
  );
}

function SaveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M11 13H3a1 1 0 01-1-1V2a1 1 0 011-1h6l3 3v8a1 1 0 01-1 1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 13V8H5v5M5 1v3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function OpenIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 12V3a1 1 0 011-1h3l1.5 1.5H11a1 1 0 011 1V12a1 1 0 01-1 1H3a1 1 0 01-1-1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ImportIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1v8M3 5l4 4 4-4M2 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 9V1M3 5l4-4 4 4M2 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function EnumIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 2h8M3 7h6M3 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="2" cy="2" r="1" fill="currentColor" />
      <circle cx="2" cy="7" r="1" fill="currentColor" />
      <circle cx="2" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

function AIIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1l1.5 4H13l-3.5 2.5L11 12 7 9l-4 3 1.5-4.5L1 5h4.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

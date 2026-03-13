"use client";

export type WorkflowStep = "capture" | "review" | "report" | "share";

interface StepDef {
  key: WorkflowStep;
  label: string;
  icon: string;
  description: string;
}

const STEPS: StepDef[] = [
  { key: "capture", label: "画面キャプチャ", icon: "📸", description: "アプリ画面を取得" },
  { key: "review",  label: "確認・追加取得", icon: "🔍", description: "スクリーンショットを確認" },
  { key: "report",  label: "AI分析レポート", icon: "📊", description: "包括的な分析を生成" },
  { key: "share",   label: "登録・共有",     icon: "📤", description: "Viewerに登録" },
];

export default function WorkflowStepper({
  currentStep,
  onStepClick,
  screenCount,
  hasReport,
}: {
  currentStep: WorkflowStep;
  onStepClick?: (step: WorkflowStep) => void;
  screenCount: number;
  hasReport: boolean;
}) {
  const currentIdx = STEPS.findIndex((s) => s.key === currentStep);

  const isStepAccessible = (step: WorkflowStep) => {
    if (step === "capture") return true;
    if (step === "review") return screenCount > 0;
    if (step === "report") return screenCount > 0;
    if (step === "share") return hasReport;
    return false;
  };

  return (
    <div className="bg-surface border border-border-light rounded-2xl p-4 mb-5">
      <div className="flex items-center gap-1">
        {STEPS.map((step, i) => {
          const isActive = step.key === currentStep;
          const isCompleted = i < currentIdx;
          const accessible = isStepAccessible(step.key);
          const isLast = i === STEPS.length - 1;

          return (
            <div key={step.key} className="flex items-center flex-1 min-w-0">
              <button
                onClick={() => accessible && onStepClick?.(step.key)}
                disabled={!accessible}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-xl transition-all w-full min-w-0
                  ${isActive
                    ? "bg-indigo-50 border border-indigo-200 shadow-sm"
                    : isCompleted
                      ? "bg-green-50/50 hover:bg-green-50 cursor-pointer"
                      : accessible
                        ? "hover:bg-gray-50 cursor-pointer"
                        : "opacity-40 cursor-not-allowed"
                  }
                `}
              >
                <span className={`
                  w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0
                  ${isActive
                    ? "bg-indigo-600 text-white font-bold"
                    : isCompleted
                      ? "bg-green-500 text-white"
                      : "bg-gray-100 text-gray-500"
                  }
                `}>
                  {isCompleted ? "✓" : step.icon}
                </span>
                <div className="min-w-0 text-left hidden sm:block">
                  <p className={`text-xs font-semibold truncate ${isActive ? "text-indigo-700" : "text-text-primary"}`}>
                    {step.label}
                  </p>
                  <p className="text-[10px] text-text-muted truncate">{step.description}</p>
                </div>
              </button>
              {!isLast && (
                <div className={`w-4 h-px mx-0.5 shrink-0 ${i < currentIdx ? "bg-green-300" : "bg-gray-200"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { ArrowLeft, ChevronRight } from "lucide-react";

interface Props {
  onClick: () => void;
  toolName: string;
}

export default function BackToToolsButton({ onClick, toolName }: Props) {
  return (
    <div className="inline-flex w-fit items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-ink-secondary transition-colors hover:bg-surface-subtle hover:text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-emphasis"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to tools
      </button>
      <ChevronRight className="h-3.5 w-3.5 text-ink-disabled" aria-hidden="true" />
      <span className="text-xs font-semibold text-ink-strong">{toolName}</span>
    </div>
  );
}

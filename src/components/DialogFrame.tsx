import type { MouseEvent, PropsWithChildren } from "react";

interface Props extends PropsWithChildren {
  labelledBy: string;
  describedBy?: string;
  panelClassName: string;
  onBackdropDismiss?: () => void;
  backdropDismissOn?: "click" | "mouseDown";
}

export default function DialogFrame({
  labelledBy,
  describedBy,
  panelClassName,
  onBackdropDismiss,
  backdropDismissOn = "click",
  children,
}: Props) {
  const dismissFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onBackdropDismiss?.();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/45 p-4 backdrop-blur-sm"
      onClick={backdropDismissOn === "click" ? dismissFromBackdrop : undefined}
      onMouseDown={
        backdropDismissOn === "mouseDown" ? dismissFromBackdrop : undefined
      }
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={panelClassName}
      >
        {children}
      </section>
    </div>
  );
}

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

interface TooltipContent {
  target: HTMLElement;
  label: string;
  shortcut?: string;
}

interface TooltipPosition {
  left: number;
  top: number;
  side: "top" | "bottom" | "left" | "right";
}

function findTrigger(target: EventTarget | null) {
  return target instanceof Element
    ? target.closest<HTMLElement>("[data-tooltip]")
    : null;
}

export default function SmartTooltipProvider({
  children,
}: {
  children: ReactNode;
}) {
  const tooltipId = useId();
  const [tooltip, setTooltip] = useState<TooltipContent | null>(null);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const pointerTarget = useRef<HTMLElement | null>(null);
  const focusTarget = useRef<HTMLElement | null>(null);
  const keyboardNavigation = useRef(true);
  const activeTarget = useRef<HTMLElement | null>(null);
  const timer = useRef<number | null>(null);
  const describedElement = useRef<{
    target: HTMLElement;
    previousValue: string | null;
  } | null>(null);

  useEffect(() => {
    const clearTimer = () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
    };

    const clearDescription = () => {
      const current = describedElement.current;
      if (!current) return;
      if (current.previousValue === null) {
        current.target.removeAttribute("aria-describedby");
      } else {
        current.target.setAttribute(
          "aria-describedby",
          current.previousValue,
        );
      }
      describedElement.current = null;
    };

    const hide = () => {
      clearTimer();
      clearDescription();
      activeTarget.current = null;
      setTooltip(null);
      setPosition(null);
    };

    const show = (target: HTMLElement | null, delay: number) => {
      const label = target?.dataset.tooltip?.trim();
      if (!target || !label) {
        hide();
        return;
      }
      if (activeTarget.current === target) return;

      clearTimer();
      clearDescription();
      activeTarget.current = target;
      setTooltip(null);
      setPosition(null);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        if (!target.isConnected) {
          hide();
          return;
        }

        const shortcut =
          target.dataset.tooltipShortcut ??
          label.match(/^(.*?)\s+\(((?:Ctrl|Cmd)(?:\/Cmd)?\+[^)]+)\)$/i)?.[2];
        const visibleLabel = shortcut
          ? label.replace(/\s+\((?:Ctrl|Cmd)(?:\/Cmd)?\+[^)]+\)$/i, "")
          : label;
        const previousValue = target.getAttribute("aria-describedby");
        const describedBy = previousValue
          ? `${previousValue} ${tooltipId}`
          : tooltipId;
        target.setAttribute("aria-describedby", describedBy);
        describedElement.current = { target, previousValue };
        setTooltip({ target, label: visibleLabel, shortcut });
      }, delay);
    };

    const updateFromActiveInputs = (delay: number) => {
      show(focusTarget.current ?? pointerTarget.current, delay);
    };

    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      pointerTarget.current = findTrigger(event.target);
      updateFromActiveInputs(450);
    };

    const onPointerOut = (event: PointerEvent) => {
      const current = pointerTarget.current;
      if (!current) return;
      if (
        event.relatedTarget instanceof Node &&
        current.contains(event.relatedTarget)
      ) {
        return;
      }
      if (
        event.target instanceof Node &&
        (current === event.target || current.contains(event.target))
      ) {
        pointerTarget.current = null;
        updateFromActiveInputs(0);
      }
    };

    const onFocusIn = (event: FocusEvent) => {
      focusTarget.current = keyboardNavigation.current
        ? findTrigger(event.target)
        : null;
      updateFromActiveInputs(100);
    };

    const onFocusOut = (event: FocusEvent) => {
      const current = focusTarget.current;
      if (!current) return;
      if (
        event.relatedTarget instanceof Node &&
        current.contains(event.relatedTarget)
      ) {
        return;
      }
      if (
        event.target instanceof Node &&
        (current === event.target || current.contains(event.target))
      ) {
        focusTarget.current = null;
        updateFromActiveInputs(pointerTarget.current ? 450 : 0);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (["Tab", "ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Enter", " "].includes(event.key)) {
        keyboardNavigation.current = true;
      }
      if (event.key !== "Escape") return;
      pointerTarget.current = null;
      focusTarget.current = null;
      hide();
    };

    const onPointerDown = () => {
      keyboardNavigation.current = false;
      focusTarget.current = null;
    };

    document.addEventListener("pointerover", onPointerOver, true);
    document.addEventListener("pointerout", onPointerOut, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", onFocusOut, true);
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("pointerover", onPointerOver, true);
      document.removeEventListener("pointerout", onPointerOut, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusout", onFocusOut, true);
      document.removeEventListener("keydown", onKeyDown, true);
      clearTimer();
      clearDescription();
    };
  }, [tooltipId]);

  useLayoutEffect(() => {
    if (!tooltip) return;

    const updatePosition = () => {
      const { target } = tooltip;
      const tooltipElement = tooltipRef.current;
      if (!tooltipElement || !target.isConnected) return;

      const triggerBounds = target.getBoundingClientRect();
      const tooltipBounds = tooltipElement.getBoundingClientRect();
      const gap = 8;
      const hasRoomRight =
        window.innerWidth - triggerBounds.right >= tooltipBounds.width + gap + 8;
      const hasRoomLeft =
        triggerBounds.left >= tooltipBounds.width + gap + 8;
      const hasRoomAbove = triggerBounds.top >= tooltipBounds.height + gap + 8;
      const hasRoomBelow =
        window.innerHeight - triggerBounds.bottom >= tooltipBounds.height + gap + 8;
      const preferredSide = target.dataset.tooltipSide;
      const side =
        preferredSide === "right"
          ? hasRoomRight ? "right" : hasRoomLeft ? "left" : hasRoomAbove ? "top" : "bottom"
          : preferredSide === "left"
            ? hasRoomLeft ? "left" : hasRoomRight ? "right" : hasRoomAbove ? "top" : "bottom"
            : preferredSide === "bottom"
              ? hasRoomBelow ? "bottom" : hasRoomAbove ? "top" : hasRoomRight ? "right" : "left"
              : preferredSide === "top"
                ? hasRoomAbove ? "top" : hasRoomBelow ? "bottom" : hasRoomRight ? "right" : "left"
                : hasRoomAbove
                  ? "top"
                  : hasRoomBelow
                    ? "bottom"
                    : hasRoomRight
                      ? "right"
                      : hasRoomLeft
                        ? "left"
                        : "top";
      const halfWidth = tooltipBounds.width / 2;
      const halfHeight = tooltipBounds.height / 2;
      const left = side === "right"
        ? triggerBounds.right + gap
        : side === "left"
          ? triggerBounds.left - gap
          : Math.max(
              halfWidth + 8,
              Math.min(
                triggerBounds.left + triggerBounds.width / 2,
                window.innerWidth - halfWidth - 8,
              ),
            );
      const top = side === "top"
        ? Math.max(8, triggerBounds.top - tooltipBounds.height - gap)
        : side === "bottom"
          ? Math.min(
              triggerBounds.bottom + gap,
              window.innerHeight - tooltipBounds.height - 8,
            )
          : Math.max(
              halfHeight + 8,
              Math.min(
                triggerBounds.top + triggerBounds.height / 2,
                window.innerHeight - halfHeight - 8,
              ),
            );

      setPosition({ left, top, side });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [tooltip]);

  return (
    <>
      {children}
      {tooltip && createPortal(
        <div
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          style={{
            left: position?.left ?? -1000,
            top: position?.top ?? -1000,
            visibility: position ? "visible" : "hidden",
          }}
          className={`pointer-events-none fixed z-[150] flex max-w-[min(220px,calc(100vw-16px))] items-center gap-2 rounded-md border border-preview-muted bg-preview px-2.5 py-1.5 text-[11px] font-medium leading-4 text-ink-inverse shadow-md shadow-ink-primary/20 ${
            position?.side === "left"
              ? "-translate-x-full -translate-y-1/2"
              : position?.side === "right"
                ? "-translate-y-1/2"
                : "-translate-x-1/2"
          }`}
        >
          <span className="min-w-0">{tooltip.label}</span>
          {tooltip.shortcut && (
            <kbd className="shrink-0 rounded border border-ink-inverse/20 bg-ink-inverse/10 px-1 py-0.5 font-sans text-[9px] leading-3 text-ink-inverse/80">
              {tooltip.shortcut}
            </kbd>
          )}
          {position && (
            <span
              aria-hidden="true"
              className={`absolute h-2 w-2 rotate-45 border-preview-muted bg-preview ${
                position.side === "top"
                  ? "bottom-[-5px] left-1/2 -translate-x-1/2 border-b border-r"
                  : position.side === "bottom"
                    ? "left-1/2 top-[-5px] -translate-x-1/2 border-l border-t"
                    : position.side === "right"
                      ? "left-[-5px] top-1/2 -translate-y-1/2 border-b border-l"
                      : "right-[-5px] top-1/2 -translate-y-1/2 border-r border-t"
              }`}
            />
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

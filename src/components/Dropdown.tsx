import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
  groupHeader?: boolean;
}

interface Props {
  options: DropdownOption[];
  value: string | number;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
  "aria-label"?: string;
  disabled?: boolean;
}

interface MenuPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

export default function Dropdown({
  options,
  value,
  onChange,
  className = "",
  id,
  "aria-label": ariaLabel,
  disabled = false,
}: Props) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const menuId = `${controlId}-options`;
  const controlRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const selectedIndex = options.findIndex((option) => option.value === String(value));
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const focusOption = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    setActiveIndex(index);
    optionRefs.current[index]?.focus();
  };

  const openMenu = (index = selectedIndex >= 0 ? selectedIndex : 0) => {
    const firstEnabled = options.findIndex((option) => !option.disabled);
    const nextIndex = options[index] && !options[index].disabled ? index : firstEnabled;
    if (nextIndex < 0) return;
    setActiveIndex(nextIndex);
    setOpen(true);
  };

  const closeMenu = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) controlRef.current?.focus();
  };

  const chooseOption = (option: DropdownOption) => {
    if (option.disabled) return;
    onChange(option.value);
    closeMenu(true);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }

      const direction = event.key === "ArrowDown" ? 1 : -1;
      let nextIndex = activeIndex;
      for (let step = 0; step < options.length; step += 1) {
        nextIndex = (nextIndex + direction + options.length) % options.length;
        if (!options[nextIndex].disabled) {
          focusOption(nextIndex);
          break;
        }
      }
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      let index = options.findIndex((option) => !option.disabled);
      if (event.key === "End") {
        index = -1;
        for (let optionIndex = options.length - 1; optionIndex >= 0; optionIndex -= 1) {
          if (!options[optionIndex].disabled) {
            index = optionIndex;
            break;
          }
        }
      }
      focusOption(index);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) {
        chooseOption(options[activeIndex]);
      } else {
        openMenu();
      }
      return;
    }

    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const start = open ? activeIndex + 1 : selectedIndex + 1;
      const search = event.key.toLocaleLowerCase();
      const matches = options.map((option, index) => ({ option, index }))
        .filter(({ option }) =>
          !option.disabled &&           option.label.toLocaleLowerCase().startsWith(search),
        );
      if (matches.length) {
        const next = matches.find(({ index }) => index >= start) ?? matches[0];
        if (open) focusOption(next.index);
        else {
          onChange(next.option.value);
          openMenu(next.index);
        }
        event.preventDefault();
      }
    }
  };

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const rect = controlRef.current?.getBoundingClientRect();
      if (!rect) return;
      const below = window.innerHeight - rect.bottom;
      const above = rect.top;
      const opensAbove = below < 220 && above > below;
      const maxHeight = Math.max(100, Math.min(280, (opensAbove ? above : below) - 8));
      setPosition({
        top: opensAbove ? Math.max(8, rect.top - maxHeight - 4) : rect.bottom + 4,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
        width: rect.width,
        maxHeight,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!controlRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.focus();
  }, [activeIndex, open]);

  return (
    <>
      <button
        ref={controlRef}
        id={controlId}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={() => open ? closeMenu() : openMenu()}
        onKeyDown={handleKeyDown}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-ui bg-surface px-3 py-2 text-left text-sm font-medium text-ink-strong outline-none transition hover:border-ui-strong focus:border-action-accent focus:ring-2 focus:ring-action-soft disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-faint ${className}`}
      >
        <span className="min-w-0 flex-1 truncate">
          {selectedOption?.label ?? ""}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-ink-faint transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && position && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          role="listbox"
          aria-label={ariaLabel}
          onKeyDown={handleKeyDown}
          style={{
            position: "fixed",
            top: position.top,
            left: position.left,
            width: position.width,
            maxHeight: position.maxHeight,
          }}
          className="z-[100] overflow-y-auto rounded-xl border border-ui bg-surface p-1.5 shadow-xl shadow-ink-primary/10"
        >
          {options.map((option, index) => (
            option.groupHeader ? (
              <div
                key={option.value}
                role="presentation"
                className="px-2.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-ink-faint first:pt-1"
              >
                {option.label}
              </div>
            ) : (
              <button
                key={option.value}
                ref={(element) => { optionRefs.current[index] = element; }}
                type="button"
                role="option"
                aria-selected={selectedIndex === index}
                disabled={option.disabled}
                tabIndex={activeIndex === index ? 0 : -1}
                onClick={() => chooseOption(option)}
                onMouseMove={() => {
                  if (!option.disabled) setActiveIndex(index);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  selectedIndex === index
                    ? "bg-action-subtle font-semibold text-action-hover"
                    : "text-ink-strong hover:bg-surface-muted"
                }`}
              >
                <span className="min-w-0 flex-1">{option.label}</span>
                {selectedIndex === index && <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-action-emphasis" />}
              </button>
            )
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

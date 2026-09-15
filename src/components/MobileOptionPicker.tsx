import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { CheckIcon, ChevronDownIcon, CloseIcon } from "./Icons";

export type MobileOptionPickerOption = {
  value: string;
  label: string;
  description?: string;
};

type Props = {
  title: string;
  ariaLabel: string;
  value: string;
  options: ReadonlyArray<MobileOptionPickerOption>;
  disabled?: boolean;
  layout?: "list" | "grid";
  onChange: (value: string) => void;
};

const CLOSE_DURATION_MS = 180;

export function MobileOptionPicker({
  title,
  ariaLabel,
  value,
  options,
  disabled = false,
  layout = "list",
  onChange,
}: Props) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const closeTimerRef = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const selected = options[selectedIndex] ?? options[0];
  const listboxId = `${id}-listbox`;
  const titleId = `${id}-title`;

  function clearCloseTimer() {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function openPicker(initialIndex = selectedIndex) {
    if (disabled || options.length === 0) return;
    clearCloseTimer();
    setActiveIndex(initialIndex);
    setMounted(true);
  }

  function closePicker() {
    setVisible(false);
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setMounted(false);
      triggerRef.current?.focus();
      closeTimerRef.current = null;
    }, CLOSE_DURATION_MS);
  }

  function focusOption(index: number) {
    setActiveIndex(index);
    window.requestAnimationFrame(() => optionRefs.current[index]?.focus());
  }

  function choose(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    closePicker();
  }

  useEffect(() => {
    return () => clearCloseTimer();
  }, []);

  useEffect(() => {
    if (!disabled) return;
    setVisible(false);
    setMounted(false);
  }, [disabled]);

  useEffect(() => {
    if (!mounted) return;

    const bodyOverflow = document.body.style.overflow;
    const rootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const frame = window.requestAnimationFrame(() => {
      setVisible(true);
      window.requestAnimationFrame(() => optionRefs.current[activeIndex]?.focus());
    });

    function handleDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closePicker();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        sheetRef.current?.querySelectorAll<HTMLButtonElement>(
          'button:not([disabled])',
        ) ?? [],
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleDocumentKeyDown);
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = rootOverflow;
    };
  }, [mounted]);

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    openPicker(event.key === "ArrowUp" ? options.length - 1 : selectedIndex);
  }

  function handleListKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      nextIndex = (activeIndex + 1) % options.length;
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      nextIndex = (activeIndex - 1 + options.length) % options.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = options.length - 1;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    focusOption(nextIndex);
  }

  const sheet = mounted ? (
    <div
      className={`mobile-option-picker-backdrop ${visible ? "visible" : ""}`}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) closePicker();
      }}
    >
      <div
        ref={sheetRef}
        className={`mobile-option-picker-sheet ${layout}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header>
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="mobile-option-picker-close"
            aria-label={`Đóng ${title.toLocaleLowerCase("vi-VN")}`}
            onClick={closePicker}
          >
            <CloseIcon />
          </button>
        </header>
        <div
          id={listboxId}
          className="mobile-option-picker-options"
          role="listbox"
          aria-label={title}
          onKeyDown={handleListKeyDown}
        >
          {options.map((option, index) => (
            <button
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              id={`${id}-option-${index}`}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={index === activeIndex ? "active" : ""}
              key={option.value}
              onFocus={() => setActiveIndex(index)}
              onClick={() => choose(index)}
            >
              <span className="mobile-option-picker-check" aria-hidden="true">
                {option.value === value && <CheckIcon />}
              </span>
              <span className="mobile-option-picker-option-copy">
                <strong>{option.label}</strong>
                {option.description && <small>{option.description}</small>}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="mobile-option-picker-trigger"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={mounted}
        aria-controls={listboxId}
        aria-activedescendant={mounted ? `${id}-option-${activeIndex}` : undefined}
        disabled={disabled}
        onClick={() => (mounted ? closePicker() : openPicker())}
        onKeyDown={handleTriggerKeyDown}
      >
        <span>{selected?.label ?? ""}</span>
        <span className="mobile-option-picker-chevron" aria-hidden="true">
          <ChevronDownIcon />
        </span>
      </button>
      {sheet && createPortal(sheet, document.body)}
    </>
  );
}

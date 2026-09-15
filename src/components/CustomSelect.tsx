import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { CheckIcon, ChevronDownIcon } from "./Icons";

export type CustomSelectOption = { value: string; label: string };

type Props = {
  value: string;
  options: CustomSelectOption[];
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  renderValue?: (option: CustomSelectOption) => ReactNode;
  renderOption?: (option: CustomSelectOption) => ReactNode;
  onChange: (value: string) => void;
};

export function CustomSelect({
  value,
  options,
  ariaLabel,
  className = "",
  disabled = false,
  renderValue,
  renderOption,
  onChange,
}: Props) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const [menuMaxHeight, setMenuMaxHeight] = useState(252);
  const [activeIndex, setActiveIndex] = useState(0);
  const selectedIndex = Math.max(0, options.findIndex((item) => item.value === value));
  const selected = options[selectedIndex] ?? options[0];

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (open) {
      optionRefs.current[activeIndex]?.scrollIntoView?.({ block: "nearest" });
    }
  }, [activeIndex, open]);

  function show() {
    if (disabled || options.length === 0) return;
    const rect = rootRef.current?.getBoundingClientRect();
    const menuHeight = Math.min(252, options.length * 42 + 12);
    if (rect) {
      const below = Math.max(0, window.innerHeight - rect.bottom - 12);
      const above = Math.max(0, rect.top - 12);
      const shouldOpenUp = below < menuHeight && above > below;
      setOpenUp(shouldOpenUp);
      setMenuMaxHeight(Math.min(252, shouldOpenUp ? above : below));
    }
    setActiveIndex(selectedIndex);
    setOpen(true);
  }

  function choose(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        show();
        return;
      }
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) =>
        (current + direction + options.length) % options.length,
      );
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && open) {
      event.preventDefault();
      choose(activeIndex);
    }
  }

  return (
    <div
      className={`custom-select ${className} ${open ? "open" : ""} ${openUp ? "open-up" : ""}`.trim()}
      ref={rootRef}
    >
      <button
        ref={buttonRef}
        type="button"
        className="custom-select-control"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-activedescendant={open ? `${id}-option-${activeIndex}` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
      >
        <span className="custom-select-value">
          {selected
            ? renderValue?.(selected) ?? selected.label
            : ""}
        </span>
        <span className="custom-select-chevron" aria-hidden="true">
          <ChevronDownIcon />
        </span>
      </button>
      {open && (
        <div
          className="custom-select-menu"
          id={`${id}-listbox`}
          role="listbox"
          style={{ maxHeight: menuMaxHeight }}
        >
          {options.map((option, index) => (
            <button
              ref={(node) => {
                optionRefs.current[index] = node;
              }}
              id={`${id}-option-${index}`}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={index === activeIndex ? "active" : ""}
              key={option.value}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(index)}
            >
              <span className="custom-select-option-content">
                {renderOption?.(option) ?? option.label}
              </span>
              {option.value === value && (
                <span className="custom-select-check" aria-hidden="true">
                  <CheckIcon />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, className, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={`ui-icon ${className ?? ""}`.trim()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return <IconBase {...props}><path d="m6 9 6 6 6-6" /></IconBase>;
}

export function ChevronUpIcon(props: IconProps) {
  return <IconBase {...props}><path d="m6 15 6-6 6 6" /></IconBase>;
}

export function ChevronLeftIcon(props: IconProps) {
  return <IconBase {...props}><path d="m15 18-6-6 6-6" /></IconBase>;
}

export function ChevronRightIcon(props: IconProps) {
  return <IconBase {...props}><path d="m9 18 6-6-6-6" /></IconBase>;
}

export function ArrowUpIcon(props: IconProps) {
  return <IconBase {...props}><path d="m6 10 6-6 6 6M12 4v16" /></IconBase>;
}

export function ArrowDownIcon(props: IconProps) {
  return <IconBase {...props}><path d="m6 14 6 6 6-6M12 20V4" /></IconBase>;
}

export function ArrowRightIcon(props: IconProps) {
  return <IconBase {...props}><path d="M5 12h14M13 6l6 6-6 6" /></IconBase>;
}

export function ArrowLeftRightIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 7 3 11l4 4M3 11h18M17 17l4-4-4-4" />
    </IconBase>
  );
}

export function CloseIcon(props: IconProps) {
  return <IconBase {...props}><path d="M6 6l12 12M18 6 6 18" /></IconBase>;
}

export function CheckIcon(props: IconProps) {
  return <IconBase {...props}><path d="m5 12 4 4L19 6" /></IconBase>;
}

export function PlusIcon(props: IconProps) {
  return <IconBase {...props}><path d="M12 5v14M5 12h14" /></IconBase>;
}

export function RefreshIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M20 6v5h-5M4 18v-5h5" />
      <path d="M6.1 9a7 7 0 0 1 11.5-2.5L20 9M4 15l2.4 2.5A7 7 0 0 0 17.9 15" />
    </IconBase>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 3v3M17 3v3M4.5 9h15M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
    </IconBase>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </IconBase>
  );
}

export function AlertTriangleIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M10.3 3.7 2.4 17.4A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.6L13.7 3.7a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </IconBase>
  );
}

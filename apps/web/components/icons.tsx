// Line icons drawn on a 24px grid with a 1.6px stroke.
import type { ReactNode } from 'react';

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const HandIcon = () => (
  <Icon>
    <circle cx="9" cy="7.5" r="3.2" />
    <path d="M3.5 20c.6-3.6 2.8-5.8 5.5-5.8 1.5 0 2.8.6 3.8 1.7" />
    <path d="m14.5 18 2.2 2.2L21 15.8" />
  </Icon>
);

export const ShieldIcon = () => (
  <Icon>
    <path d="M12 3 19 6v5.2c0 4.3-2.9 8-7 9.8-4.1-1.8-7-5.5-7-9.8V6l7-3Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </Icon>
);

export const BanIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m6 6 12 12" />
  </Icon>
);

export const ServerIcon = () => (
  <Icon>
    <rect x="3.5" y="4" width="17" height="6.5" rx="1.8" />
    <rect x="3.5" y="13.5" width="17" height="6.5" rx="1.8" />
    <path d="M7.5 7.25h.01M7.5 16.75h.01M11 7.25h5M11 16.75h5" />
  </Icon>
);

export const CodeIcon = () => (
  <Icon>
    <path d="m8.5 7.5-5 4.5 5 4.5M15.5 7.5l5 4.5-5 4.5M13.5 5l-3 14" />
  </Icon>
);

export const CompassIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
  </Icon>
);

export const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor">
    <path d="M12 2.2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.35 1.09 2.92.83.09-.65.35-1.09.64-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.3 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.93.36.31.68.92.68 1.86v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2.2Z" />
  </svg>
);

export const ArrowIcon = () => (
  <svg
    viewBox="0 0 20 20"
    width="16"
    height="16"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 10h11M11 5.5 15.5 10 11 14.5" />
  </svg>
);

import type { ReactNode } from 'react';

// Minimal highlighting for the short snippets on this page. Code is passed as a plain string, so
// indentation and line breaks are exactly what you see.
const TOKENS =
  /(#.*$|(?<!:)\/\/.*$)|('[^']*')|\b(const|await|import|from)\b|(^\$|^you ›)|([A-Za-z_][\w.]*)(?=\()/gm;

function highlight(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of code.matchAll(TOKENS)) {
    const index = m.index ?? 0;
    if (index > last) out.push(code.slice(last, index));
    const [text, comment, string, keyword, prompt, fn] = m;
    const cls =
      comment || prompt ? 'c-dim' : string ? 'c-str' : keyword ? 'c-key' : fn ? 'c-fn' : '';
    out.push(
      <span key={index} className={cls}>
        {text}
      </span>,
    );
    last = index + text.length;
  }
  out.push(code.slice(last));
  return out;
}

export function Code({
  code,
  label,
  className = '',
}: {
  code: string;
  label: string;
  className?: string;
}) {
  return (
    <pre className={`code ${className}`} aria-label={label}>
      <code>{highlight(code)}</code>
    </pre>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Lightweight inline markup for guide paragraphs:
 * - [label](/path) → internal Link (http(s) → <a>)
 * - **bold**
 * - *italic*
 */
export function GuideRichText({ text }: { text: string }) {
  return <>{parseInline(text)}</>;
}

function parseInline(input: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern =
    /(\[([^\]]+)\]\(([^)]+)\))|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(input)) !== null) {
    if (match.index > last) {
      nodes.push(input.slice(last, match.index));
    }

    if (match[1] && match[2] && match[3]) {
      const href = match[3];
      const label = match[2];
      const className =
        "font-medium text-foreground underline decoration-brand-300 underline-offset-2 transition-colors hover:decoration-brand-500";
      if (href.startsWith("/")) {
        nodes.push(
          <Link key={key++} href={href} className={className}>
            {label}
          </Link>
        );
      } else {
        nodes.push(
          <a
            key={key++}
            href={href}
            className={className}
            target="_blank"
            rel="noopener noreferrer"
          >
            {label}
          </a>
        );
      }
    } else if (match[4] && match[5]) {
      nodes.push(
        <strong key={key++} className="font-semibold text-foreground">
          {match[5]}
        </strong>
      );
    } else if (match[6] && match[7]) {
      nodes.push(
        <em key={key++} className="italic">
          {match[7]}
        </em>
      );
    }

    last = match.index + match[0].length;
  }

  if (last < input.length) {
    nodes.push(input.slice(last));
  }

  return nodes;
}

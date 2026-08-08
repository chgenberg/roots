import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Lightweight inline markup for guide paragraphs:
 * - [label](/path) → internal Link (same-origin path only)
 * - [label](https://…) → external <a> (http/https only)
 * - **bold**
 * - *italic*
 *
 * Protocol-relative (`//evil.com`) must NOT be treated as internal: it
 * starts with "/" but leaves the origin. javascript:/data: are dropped.
 */
export function GuideRichText({ text }: { text: string }) {
  return <>{parseInline(text)}</>;
}

function isSafeInternalHref(href: string): boolean {
  // Same-origin path only — reject "//host", "/\", and scheme-smuggling.
  return (
    href.startsWith("/") &&
    !href.startsWith("//") &&
    !href.startsWith("/\\") &&
    !/^[a-z][a-z0-9+.-]*:/i.test(href)
  );
}

function isSafeExternalHref(href: string): boolean {
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
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
      const href = match[3].trim();
      const label = match[2];
      const className =
        "font-medium text-foreground underline decoration-brand-300 underline-offset-2 transition-colors hover:decoration-brand-500";
      if (isSafeInternalHref(href)) {
        nodes.push(
          <Link key={key++} href={href} className={className}>
            {label}
          </Link>
        );
      } else if (isSafeExternalHref(href)) {
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
      } else {
        // Unsafe / unrecognized scheme — render label as plain text.
        nodes.push(label);
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

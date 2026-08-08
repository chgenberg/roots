"use client";

import Link, { type LinkProps } from "next/link";
import {
  forwardRef,
  type ReactNode,
  type AnchorHTMLAttributes,
} from "react";
import { useLocale } from "@/i18n/locale-context";

type Props = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    children: ReactNode;
    /** Skip locale prefix (e.g. /login stays unprefixed). */
    localeNeutral?: boolean;
  };

/**
 * Next Link that prefixes `/en` when the active locale is English.
 * Pass `localeNeutral` only for rare paths that must stay unprefixed.
 */
export const LocaleLink = forwardRef<HTMLAnchorElement, Props>(
  function LocaleLink({ href, localeNeutral, children, ...rest }, ref) {
    const { href: localize } = useLocale();
    const raw = typeof href === "string" ? href : href.pathname || "/";
    const resolved = localeNeutral
      ? href
      : typeof href === "string"
        ? localize(href)
        : href;

    return (
      <Link ref={ref} href={resolved} {...rest}>
        {children}
      </Link>
    );
  }
);

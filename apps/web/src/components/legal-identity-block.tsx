"use client";

import { LEGAL_IDENTITY, formatAddressSingleLine } from "@/lib/legal-identity";
import { useLocale } from "@/i18n/locale-context";

interface LegalIdentityBlockProps {
  /** "compact" = comma-separated inline; "block" = stacked multi-line. */
  variant?: "compact" | "block";
  className?: string;
  showContact?: boolean;
}

/**
 * Displays the company's legal identity — organisation number, VAT ID,
 * registered address. Must appear in footer, contract-like pages (villkor,
 * integritet) and order confirmations to satisfy Swedish disclosure rules
 * (Bokföringslagen, e-handelslagen) and build buyer trust.
 */
export function LegalIdentityBlock({
  variant = "compact",
  className,
  showContact = false,
}: LegalIdentityBlockProps) {
  const { locale } = useLocale();
  const orgLabel = locale === "en" ? "Org no." : "Org.nr";
  const vatLabel = locale === "en" ? "VAT no." : "Momsreg.nr";
  const phoneDigits = LEGAL_IDENTITY.contact.phone.replace(/\s+/g, "");

  if (variant === "block") {
    return (
      <address
        className={
          className ??
          "not-italic text-xs leading-relaxed text-muted-foreground"
        }
      >
        <strong className="font-semibold not-italic text-foreground">
          {LEGAL_IDENTITY.legalName}
        </strong>
        <br />
        {LEGAL_IDENTITY.address.street}
        <br />
        {LEGAL_IDENTITY.address.postalCode} {LEGAL_IDENTITY.address.city}
        <br />
        {orgLabel} {LEGAL_IDENTITY.orgNumber} · {vatLabel}{" "}
        {LEGAL_IDENTITY.vatId}
        {showContact && (
          <>
            <br />
            <a
              href={`mailto:${LEGAL_IDENTITY.contact.email}`}
              className="hover:text-foreground"
            >
              {LEGAL_IDENTITY.contact.email}
            </a>
            {" · "}
            <a
              href={`tel:${phoneDigits}`}
              className="hover:text-foreground"
            >
              {LEGAL_IDENTITY.contact.phone}
            </a>
          </>
        )}
      </address>
    );
  }

  return (
    <span className={className ?? "text-xs text-muted-foreground"}>
      {LEGAL_IDENTITY.legalName} · {formatAddressSingleLine()} · {orgLabel}{" "}
      {LEGAL_IDENTITY.orgNumber} · {vatLabel} {LEGAL_IDENTITY.vatId}
      {showContact && (
        <>
          {" · "}
          <a
            href={`mailto:${LEGAL_IDENTITY.contact.email}`}
            className="hover:text-foreground"
          >
            {LEGAL_IDENTITY.contact.email}
          </a>
          {" · "}
          <a
            href={`tel:${phoneDigits}`}
            className="hover:text-foreground"
          >
            {LEGAL_IDENTITY.contact.phone}
          </a>
        </>
      )}
    </span>
  );
}

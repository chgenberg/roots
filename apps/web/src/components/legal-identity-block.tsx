import { LEGAL_IDENTITY, formatAddressSingleLine } from "@/lib/legal-identity";

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
        Org.nr {LEGAL_IDENTITY.orgNumber} · Momsreg.nr {LEGAL_IDENTITY.vatId}
        {showContact && (
          <>
            <br />
            <a
              href={`mailto:${LEGAL_IDENTITY.contact.email}`}
              className="hover:text-foreground"
            >
              {LEGAL_IDENTITY.contact.email}
            </a>
          </>
        )}
      </address>
    );
  }

  return (
    <span className={className ?? "text-xs text-muted-foreground"}>
      {LEGAL_IDENTITY.legalName} · {formatAddressSingleLine()} · Org.nr{" "}
      {LEGAL_IDENTITY.orgNumber} · Momsreg.nr {LEGAL_IDENTITY.vatId}
      {showContact && (
        <>
          {" · "}
          <a
            href={`mailto:${LEGAL_IDENTITY.contact.email}`}
            className="hover:text-foreground"
          >
            {LEGAL_IDENTITY.contact.email}
          </a>
        </>
      )}
    </span>
  );
}

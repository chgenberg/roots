"use client";

import * as React from "react";
import { Label } from "./label";
import { cn } from "@/lib/utils";

/**
 * MASTERPLAN_01 KC6.6: standard-wrapper för formulär-fält som
 * automatiskt wirar upp tillgänglighet:
 *
 *   - `<Label htmlFor>` ↔ kontrollens `id`
 *   - `description`-text får eget `id` som läggs i `aria-describedby`
 *   - `error`-text får eget `id` som också läggs i `aria-describedby`,
 *     plus `role="alert"` så skärmläsare hör nya valideringsfel direkt
 *   - `error` triggar `aria-invalid="true"` på kontrollen
 *   - `required`-stjärna visas och `aria-required` sätts
 *
 * Tidigare hade vi handcraftade `<div><Label/><Input/></div>`-block
 * överallt utan aria-describedby. Skärmläsare hörde labeln men ALDRIG
 * hjälptexten — och valideringsfel-spans var bara visuella.
 *
 * Användning:
 *
 *   <FormField
 *     label="E-post"
 *     description="Vi skickar bekräftelsen hit"
 *     error={errors.email}
 *     required
 *   >
 *     <Input type="email" autoComplete="email" />
 *   </FormField>
 *
 * Wrappar ETT kontroll-element. Multiple inputs (radio-grupp etc):
 * använd `as="group"` så blir det `role="group"` istället för label-for.
 */
export interface FormFieldProps {
  label: string;
  description?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  /** Optionellt id; auto-genereras annars. */
  id?: string;
  /** "control" (default) klona child + sätt id/aria. "group" för radio/checkbox-grupp. */
  as?: "control" | "group";
  /** Extra className på yttre containern. */
  className?: string;
  children: React.ReactNode;
}

export function FormField({
  label,
  description,
  error,
  required,
  id,
  as = "control",
  className,
  children,
}: FormFieldProps) {
  const reactId = React.useId();
  const fieldId = id ?? `f-${reactId}`;
  const descId = description ? `${fieldId}-desc` : undefined;
  const errorId = error ? `${fieldId}-err` : undefined;
  const describedBy = [descId, errorId].filter(Boolean).join(" ") || undefined;

  // Klona child-elementet och injicera aria/id. Vi tar bara första
  // child-noden — alla relevanta formulär-kontroller (Input, Select,
  // Textarea) är ett enda element.
  let renderedChild: React.ReactNode = children;
  if (as === "control" && React.isValidElement(children)) {
    const childProps = children.props as Record<string, unknown>;
    renderedChild = React.cloneElement(
      children as React.ReactElement<Record<string, unknown>>,
      {
        id: (childProps.id as string | undefined) ?? fieldId,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : (childProps["aria-invalid"] ?? undefined),
        "aria-required": required ? true : (childProps["aria-required"] ?? undefined),
        required: required ?? (childProps.required as boolean | undefined),
      } as Record<string, unknown>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {as === "control" ? (
        <Label htmlFor={fieldId} className={cn(error && "text-destructive")}>
          {label}
          {required && (
            <span aria-hidden="true" className="ml-0.5 text-destructive">
              *
            </span>
          )}
        </Label>
      ) : (
        <span
          id={fieldId}
          className={cn(
            "text-sm font-medium leading-none",
            error && "text-destructive"
          )}
        >
          {label}
          {required && (
            <span aria-hidden="true" className="ml-0.5 text-destructive">
              *
            </span>
          )}
        </span>
      )}

      {as === "group" ? (
        <div
          role="group"
          aria-labelledby={fieldId}
          aria-describedby={describedBy}
        >
          {children}
        </div>
      ) : (
        renderedChild
      )}

      {description && (
        <p id={descId} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="text-xs font-medium text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}

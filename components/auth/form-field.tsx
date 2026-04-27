"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface FieldWrapperProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

export function FieldWrapper({ id, label, error, hint, className, children }: FieldWrapperProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-neutral-200 font-semibold">
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-neutral-500">{hint}</p>
      ) : null}
    </div>
  );
}

interface TextFieldProps extends Omit<React.ComponentProps<"input">, "id"> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
}

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { id, label, error, hint, containerClassName, className, ...props },
  ref,
) {
  return (
    <FieldWrapper id={id} label={label} error={error} hint={hint} className={containerClassName}>
      <Input
        id={id}
        ref={ref}
        aria-invalid={!!error || undefined}
        className={cn(
          "h-11 border-neutral-800 bg-neutral-900/50 text-neutral-100 placeholder:text-neutral-600",
          "focus-visible:border-sky-500 focus-visible:ring-sky-500/30",
          className,
        )}
        {...props}
      />
    </FieldWrapper>
  );
});

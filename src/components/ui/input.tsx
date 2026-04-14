import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  (allProps, ref) => {
    const { className, type, value, defaultValue, ...props } = allProps as React.ComponentProps<'input'> & { value?: any };
    // Prevent React warning about switching between uncontrolled and controlled inputs
    // If a `value` prop is explicitly provided (even null/undefined), normalize it to ''
    // so the input remains controlled. If `value` is not provided, leave it uncontrolled.
    const inputProps: React.ComponentProps<'input'> = { ...props } as any;
    const hasValueProp = Object.prototype.hasOwnProperty.call(allProps, 'value');
    if (hasValueProp) {
      // value was passed (could be undefined/null) — ensure a string
      (inputProps as any).value = value ?? '';
    } else if (defaultValue !== undefined) {
      // preserve defaultValue for uncontrolled inputs
      (inputProps as any).defaultValue = defaultValue as any;
    }

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...inputProps}
      />
    );
  }
)
Input.displayName = "Input"

export { Input }

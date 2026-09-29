import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'button-system relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'button-3d button-3d-primary bg-primary text-primary-foreground border border-primary-border',
        primary: 'button-3d button-3d-primary bg-primary text-primary-foreground border border-primary-border',
        primary3d: 'button-3d button-3d-primary bg-primary text-primary-foreground border border-primary-border',
        destructive:
          'button-3d button-3d-danger bg-destructive text-destructive-foreground border-destructive-border',
        danger: 'button-3d button-3d-danger bg-destructive text-destructive-foreground border-destructive-border',
        success: 'button-3d button-3d-success bg-emerald-500 text-white border-emerald-600',
        outline:
          'button-3d button-3d-secondary border [border-color:var(--button-outline)] bg-transparent',
        secondary:
          'button-3d button-3d-secondary border bg-secondary text-secondary-foreground border-secondary-border',
        secondary3d:
          'button-3d button-3d-secondary border bg-secondary text-secondary-foreground border-secondary-border',
        ghost: 'button-ghost border border-transparent',
        icon: 'button-3d button-3d-icon border border-slate-200 bg-white text-slate-600',
        small3d: 'button-3d button-3d-secondary border bg-secondary text-secondary-foreground border-secondary-border',
        large3d: 'button-3d button-3d-primary bg-primary text-primary-foreground border border-primary-border',
        unstyled: 'button-system-unstyled',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'min-h-11 px-4 py-2.5',
        medium: 'min-h-11 px-4 py-2.5',
        sm: 'min-h-10 rounded-lg px-3 text-xs',
        small: 'min-h-10 rounded-lg px-3 text-xs',
        lg: 'min-h-12 rounded-xl px-8',
        large: 'min-h-12 rounded-xl px-8',
        icon: 'h-10 w-10 p-0',
        fit: 'min-h-0 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  loadingLabel?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, loadingLabel, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        aria-busy={loading || undefined}
        disabled={asChild ? undefined : disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <span className="invisible inline-flex items-center gap-2" aria-hidden="true">
              {children}
            </span>
            <span className="absolute inset-0 inline-flex items-center justify-center gap-2">
              <Loader2 className="animate-spin" aria-hidden="true" />
              {loadingLabel ? <span>{loadingLabel}</span> : null}
            </span>
          </>
        ) : children}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };

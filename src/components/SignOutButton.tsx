"use client";

import { useFormStatus } from "react-dom";
import { logout } from "@/actions/auth";
import { Button, type buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";

interface Props extends VariantProps<typeof buttonVariants> {
  className?: string;
  children?: React.ReactNode;
}

/** Sign-out form with a pending state so the click is acknowledged immediately. */
export default function SignOutButton({ className, variant = "ghost", size = "sm", children }: Props) {
  return (
    <form action={logout} className="contents">
      <Submit className={className} variant={variant} size={size}>{children}</Submit>
    </form>
  );
}

function Submit({ className, variant, size, children }: Props) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} className={className} disabled={pending} aria-busy={pending}>
      {pending ? (
        <>
          <span className="size-3 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden />
          Signing out…
        </>
      ) : (
        children ?? "Sign out"
      )}
    </Button>
  );
}

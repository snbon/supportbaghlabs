import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SetPasswordForm from "@/components/SetPasswordForm";

export default async function SetPasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Not logged in — magic link expired or already used
  if (!user) redirect("/");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex w-10 h-10 rounded-xl bg-[#141f59] items-center justify-center mb-4">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M2 4h12M2 8h8M2 12h10" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-foreground">Set your password</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Choose a password to finish setting up your account.
          </p>
        </div>
        <SetPasswordForm />
      </div>
    </div>
  );
}

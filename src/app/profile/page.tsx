import { redirect } from "next/navigation";
import Link from "next/link";
import { getProfile, getSession } from "@/lib/dal";
import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import ProfileForm from "@/components/ProfileForm";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/");

  const profile = await getProfile(session.userId);
  const name = profile?.company_name || "Your Account";
  const initials = profile?.company_name
    ? profile.company_name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-20 bg-card/95 border-b border-border/60 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" className="text-brand-foreground" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="font-bold text-sm text-foreground truncate">
              {profile?.company_name || "Support Portal"}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-muted-foreground text-xs">
                ← Dashboard
              </Button>
            </Link>
            <form action={logout}>
              <Button variant="ghost" size="sm" type="submit" className="text-muted-foreground text-xs">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 sm:px-6 py-12">
        <div className="w-full max-w-sm animate-fade-up space-y-5">
          <div className="flex flex-col items-center mb-3">
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-3">
              <span className="text-xl font-extrabold text-secondary-foreground">{initials}</span>
            </div>
            <h1 className="text-lg font-bold text-foreground">{name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{profile?.email ?? session.email}</p>
          </div>

          <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-sm">
            <h2 className="text-base font-semibold text-foreground mb-1">Change password</h2>
            <p className="text-sm text-muted-foreground mb-5">Choose a new password for your account.</p>
            <ProfileForm />
          </div>
        </div>
      </main>
    </div>
  );
}

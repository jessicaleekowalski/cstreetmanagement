import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMe } from "@/lib/rpm.functions";
import { Building2, LayoutDashboard, Wrench, Building, Users, Bell, ClipboardList, ShieldCheck, LogOut, PlusCircle, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard };

const managerNav: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/requests", label: "Maintenance", icon: Wrench },
  { to: "/properties", label: "Properties", icon: Building },
  { to: "/vendors", label: "Vendors", icon: Users },
  { to: "/notifications", label: "Notifications", icon: Bell },
];

const ownerNav: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/requests", label: "Pending & History", icon: ClipboardList },
  { to: "/properties", label: "Properties", icon: Building },
  { to: "/notifications", label: "Notifications", icon: Bell },
];

const tenantNav: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/requests/new", label: "Submit Request", icon: PlusCircle },
  { to: "/requests", label: "My Requests", icon: History },
  { to: "/notifications", label: "Notifications", icon: Bell },
];

function navForRole(roles: string[]): NavItem[] {
  if (roles.includes("admin") || roles.includes("property_manager")) return managerNav;
  if (roles.includes("owner")) return ownerNav;
  if (roles.includes("tenant")) return tenantNav;
  return [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }];
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getMeFn = useServerFn(getMe);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMeFn() });

  const pathname = useRouterState({ select: s => s.location.pathname });
  const roles = me?.roles ?? [];
  const nav = navForRole(roles);
  const roleLabel = roles.includes("admin") ? "Admin"
    : roles.includes("property_manager") ? "Property Manager"
    : roles.includes("owner") ? "Property Owner"
    : roles.includes("tenant") ? "Commercial Tenant"
    : "No role yet";

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const needsOnboarding = me && roles.length === 0 && pathname !== "/onboarding";

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2 px-4 h-14 border-b border-sidebar-border">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Cape Fear Ops</div>
            <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">Commercial Maintenance</div>
          </div>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {nav.map(item => {
            const active = pathname === item.to || (item.to !== "/dashboard" && pathname.startsWith(item.to));
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/60 text-sidebar-foreground/80"
              )}>
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3 space-y-2">
          <Link to="/onboarding" className="flex items-center gap-2 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Switch demo role
          </Link>
          <div className="text-xs text-sidebar-foreground/60 truncate">{me?.email}</div>
          <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50">{roleLabel}</div>
          <Button size="sm" variant="ghost" onClick={signOut} className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
            <LogOut className="h-3.5 w-3.5 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden h-14 border-b flex items-center justify-between px-4 bg-card">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Building2 className="h-3.5 w-3.5" />
            </div>
            <span className="font-semibold text-sm">Cape Fear Ops</span>
          </div>
          <Button size="sm" variant="ghost" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
        </header>
        <main className="flex-1 min-w-0">
          {needsOnboarding ? (
            <div className="p-6">
              <div className="max-w-2xl">
                <div className="mb-3 text-sm text-muted-foreground">One quick step:</div>
                <Link to="/onboarding" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                  Choose your demo role to continue
                </Link>
              </div>
            </div>
          ) : children}
        </main>
      </div>
    </div>
  );
}

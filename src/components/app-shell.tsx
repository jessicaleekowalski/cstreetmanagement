import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMe, setDemoRole } from "@/lib/rpm.functions";
import { LayoutDashboard, Wrench, Building, Users, Bell, ClipboardList, LogOut, PlusCircle, History, DollarSign } from "lucide-react";
import logoAsset from "@/assets/c-street-logo.png.asset.json";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PushToggle } from "@/components/push-toggle";
import { toast } from "sonner";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard };

const managerNav: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/requests", label: "Maintenance", icon: Wrench },
  { to: "/properties", label: "Properties", icon: Building },
  { to: "/vendors", label: "Vendors", icon: Users },
  { to: "/finance", label: "Finance", icon: DollarSign },
  { to: "/notifications", label: "Notifications", icon: Bell },
];

const ownerNav: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/requests", label: "Pending & History", icon: ClipboardList },
  { to: "/properties", label: "Properties", icon: Building },
  { to: "/finance", label: "Finance", icon: DollarSign },
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

const demoRoles = [
  { role: "property_manager" as const, label: "Property Manager" },
  { role: "owner" as const, label: "Property Owner" },
  { role: "tenant" as const, label: "Commercial Tenant" },
  { role: "admin" as const, label: "Admin" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getMeFn = useServerFn(getMe);
  const setRoleFn = useServerFn(setDemoRole);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMeFn() });

  const pathname = useRouterState({ select: s => s.location.pathname });
  const roles = me?.roles ?? [];
  const nav = navForRole(roles);
  const current = roles[0];
  const roleLabel = roles.includes("admin") ? "Admin"
    : roles.includes("property_manager") ? "Property Manager"
    : roles.includes("owner") ? "Property Owner"
    : roles.includes("tenant") ? "Commercial Tenant"
    : "No role yet";

  const switchRole = useMutation({
    mutationFn: (role: "admin" | "property_manager" | "owner" | "tenant") =>
      setRoleFn({ data: { role } }),
    onSuccess: async (_d, role) => {
      await qc.invalidateQueries();
      toast.success(`Switched to ${demoRoles.find(r => r.role === role)?.label}`);
      navigate({ to: "/dashboard" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
        <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
          <img src={logoAsset.url} alt="C-Street Property Management" className="h-10 w-10 rounded object-cover" />
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-wide">C-Street Management Group</div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-sidebar-foreground/60">Property Management</div>
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
          <div className="text-[10px] uppercase tracking-[0.14em] text-sidebar-foreground/50 px-1">Demo role</div>
          <div className="grid grid-cols-2 gap-1">
            {demoRoles.map(r => {
              const active = current === r.role;
              return (
                <button
                  key={r.role}
                  onClick={() => !active && switchRole.mutate(r.role)}
                  disabled={switchRole.isPending}
                  className={cn(
                    "rounded-md px-2 py-1.5 text-[11px] font-medium text-left transition-colors disabled:opacity-60",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-ring"
                      : "bg-sidebar-accent/30 hover:bg-sidebar-accent/60 text-sidebar-foreground/80"
                  )}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
          <div className="pt-1 text-xs text-sidebar-foreground/60 truncate">{me?.email}</div>
          <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50">Active: {roleLabel}</div>
          <PushToggle />
          <Button size="sm" variant="ghost" onClick={signOut} className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
            <LogOut className="h-3.5 w-3.5 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden border-b bg-card">
          <div className="h-14 flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <img src={logoAsset.url} alt="C-Street" className="h-8 w-8 rounded object-cover" />
              <span className="font-semibold text-sm tracking-wide">C-Street Management Group</span>
            </div>
            <Button size="sm" variant="ghost" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
          </div>
          <div className="px-3 pb-2 space-y-1.5">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Demo role — click to switch</div>
            <div className="grid grid-cols-2 gap-1">
              {demoRoles.map(r => {
                const active = current === r.role;
                return (
                  <button
                    key={r.role}
                    onClick={() => !active && switchRole.mutate(r.role)}
                    disabled={switchRole.isPending}
                    className={cn(
                      "rounded-md px-2 py-1.5 text-[11px] font-medium text-left transition-colors disabled:opacity-60 border",
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted border-border"
                    )}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
            {nav.map(item => {
              const active = pathname === item.to || (item.to !== "/dashboard" && pathname.startsWith(item.to));
              const Icon = item.icon;
              return (
                <Link key={item.to} to={item.to} className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs whitespace-nowrap transition-colors",
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
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

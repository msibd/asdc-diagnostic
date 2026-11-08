"use client";

import {
  BriefcaseMedical,
  TestTubes,
  CalendarDays,
  ChartNoAxesCombined,
  Globe2,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  MessageSquareText,
  PencilLine,
  Wallet,
  PackageOpen,
  Mail,
  MessageCircleMore,
  ShieldCheck,
  ReceiptText,
  FlaskConical,
  Stethoscope,
  UsersRound,
  X,
} from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { AdminIdentity } from "@/components/shared/admin-session-provider";
import { authClient } from "@/lib/auth-client";
import { useDashboardUiStore } from "@/stores/dashboard-ui-store";
import { initials } from "@/lib/format";
import { can, sectionPermissions } from "@/lib/permissions";

const navigationGroups = [
  {
    label: "Workspace",
    items: [
      { label: "Overview", href: "/dashboard", section: "overview" as const, icon: LayoutDashboard },
      { label: "Bookings", href: "/appointments", section: "appointments" as const, icon: CalendarDays },
      { label: "Patients", href: "/patients", section: "patients" as const, icon: UsersRound },
      { label: "Doctors", href: "/dashboard/doctors", section: "doctors" as const, icon: Stethoscope },
    ],
  },
  {
    label: "Laboratory",
    items: [
      { label: "Test orders", href: "/orders", section: "orders" as const, icon: TestTubes },
      { label: "Tests & services", href: "/services", section: "services" as const, icon: BriefcaseMedical },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Billing", href: "/billing", section: "billing" as const, icon: ReceiptText },
      { label: "Inventory", href: "/inventory", section: "inventory" as const, icon: PackageOpen },
      { label: "Finance", href: "/expenses", section: "expenses" as const, icon: Wallet },
      { label: "Reports", href: "/reports", section: "reports" as const, icon: ChartNoAxesCombined },
    ],
  },
  {
    label: "Website",
    items: [
      { label: "Website content", href: "/website", section: "website" as const, icon: PencilLine },
      { label: "Reviews", href: "/reviews", section: "reviews" as const, icon: MessageSquareText },
      { label: "View public website", href: "/", icon: Globe2, external: true },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Users & roles", href: "/access", section: "access" as const, icon: ShieldCheck },
      { label: "Email & SMTP Settings", href: "/email-settings", section: "email" as const, icon: Mail },
      { label: "SMS Settings", href: "/sms-settings", section: "sms" as const, icon: MessageCircleMore },
      { label: "Security", href: "/security", icon: LockKeyhole },
    ],
  },
];

export default function DashboardSidebar({ user, brandName }: { user: AdminIdentity; /** The centre name from Website content (falls back to the built-in name). */ brandName: string }) {
  const pathname = usePathname();
  const mobileOpen = useDashboardUiStore((state) => state.mobileSidebarOpen);
  const collapsed = useDashboardUiStore((state) => state.sidebarCollapsed);
  const setMobileSidebarOpen = useDashboardUiStore((state) => state.setMobileSidebarOpen);
  const setProfileMenuOpen = useDashboardUiStore((state) => state.setProfileMenuOpen);
  // Show only the pages this role may open (the server enforces the same rule on every page and API).
  const visibleGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.section || can(user.permissions, sectionPermissions[item.section])),
    }))
    .filter((group) => group.items.length > 0);
  // A sub-page (e.g. /patients/123) keeps its section highlighted, and when two entries both match
  // (/dashboard and /dashboard/doctors) the longer, more specific address wins.
  const activeHref = navigationGroups
    .flatMap((group) => group.items as readonly { href: string; external?: boolean }[])
    .filter((item) => !item.external)
    .map((item) => item.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
  const asideRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setMobileSidebarOpen(false);
    setProfileMenuOpen(false);
  }, [pathname, setMobileSidebarOpen, setProfileMenuOpen]);

  useEffect(() => {
    if (!mobileOpen) return;

    // Move focus into the drawer when it opens, and back to its button when Escape closes it.
    asideRef.current?.querySelector<HTMLElement>(".nav-item")?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMobileSidebarOpen(false);
      toggleRef.current?.focus();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen, setMobileSidebarOpen]);

  async function signOut() {
    setSigningOut(true);
    setMessage("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);

    try {
      const result = await authClient.signOut({
        fetchOptions: { signal: controller.signal },
      });
      if (result.error) {
        throw new Error(result.error.message ?? "Could not sign out.");
      }
      window.location.replace("/login");
    } catch (error) {
      setMessage(
        error instanceof DOMException && error.name === "AbortError"
          ? "Signing out timed out. Please try again."
          : error instanceof Error
            ? error.message
            : "Could not sign out.",
      );
      setSigningOut(false);
    } finally {
      window.clearTimeout(timeout);
    }
  }

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <button
        ref={toggleRef}
        type="button"
        className={`icon-button sidebar-toggle${mobileOpen ? " sidebar-toggle-open" : ""}`}
        onClick={() => setMobileSidebarOpen(!mobileOpen)}
        aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={mobileOpen}
        aria-controls="admin-sidebar"
      >
        {mobileOpen ? <X size={19} /> : <Menu size={19} />}
      </button>
      {mobileOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          onClick={() => setMobileSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <aside
        ref={asideRef}
        id="admin-sidebar"
        className={`sidebar${pathname === "/dashboard" ? " sidebar-overview" : ""}${mobileOpen ? " sidebar-mobile-open" : ""}${collapsed ? " sidebar-collapsed" : ""}`}
        aria-label="Main navigation"
      >
        <Link className="brand" href="/dashboard" onClick={() => setMobileSidebarOpen(false)}>
          <div
            className="brand-mark"
          >
            <FlaskConical size={19} />
          </div>
          <div>
            <div className="brand-name">{brandName}</div>
            <div className="brand-caption">{user.roleName}</div>
          </div>
        </Link>

        <nav className="sidebar-nav" aria-label="Admin navigation">
          {visibleGroups.map((group) => (
            <section className="sidebar-nav-group" key={group.label} aria-label={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.items.map((item) => {
                const { label, href, icon: Icon } = item;
                const external = "external" in item && item.external;
                // Exactly one item is highlighted: the most specific one (so /dashboard/doctors lights up Doctors, not Overview).
                const active = !external && href === activeHref;
                return (
                  <Link
                    key={href}
                    href={href}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noopener noreferrer" : undefined}
                    className={`nav-item${active ? " active" : ""}`}
                    aria-current={active ? "page" : undefined}
                    // The text is hidden when the sidebar is collapsed, so the name and tooltip stay on the link.
                    aria-label={external ? `${label} (opens in a new tab)` : label}
                    title={collapsed ? label : undefined}
                    onClick={() => setMobileSidebarOpen(false)}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </section>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="clinic-card">
            <div className="clinic-card-title">Your center, at a glance</div>
            <div className="clinic-card-copy">Bookings, patient details and reports are saved securely in your database.</div>
          </div>
          <div className="sidebar-user">
            <div className="avatar">{initials(user.name) || "AD"}</div>
            <div className="user-copy">
              <div className="user-name">{user.name}</div>
              <div className="user-role">{user.roleName}</div>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={signOut}
              title="Sign out"
              aria-label="Sign out"
              disabled={signingOut}
            >
              <LogOut size={15} />
            </button>
          </div>
          {message && <div className="sidebar-message" role="alert">{message}</div>}
        </div>
      </aside>
    </>
  );
}

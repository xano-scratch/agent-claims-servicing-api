// Small display helpers. Kept dumb: labels, a badge variant per status, money,
// and a readable time. No business logic lives here.

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export function statusLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function titleCase(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function statusVariant(s: string): BadgeVariant {
  switch (s) {
    case "approved":
    case "paid":
      return "default";
    case "under_review":
      return "secondary";
    case "denied":
      return "destructive";
    default:
      return "outline"; // submitted, closed
  }
}

export function money(cents: number | null | undefined): string {
  const n = typeof cents === "number" ? cents : 0;
  return (n / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function when(epochms: number | null | undefined): string {
  if (!epochms) return "";
  try {
    return new Date(epochms).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

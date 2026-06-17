import { getSupabaseAdmin } from "@/lib/supabase";
import { isAuthenticated } from "@/lib/auth";
import Wordmark, { BRAND_GREEN } from "@/components/Wordmark";
import PinGate from "./PinGate";

// Reads live data with the service role at request time.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ComplianceStatus = "pass" | "fail" | "unknown";

interface LogRow {
  id: string;
  created_at: string;
  type: string | null;
  logged_by: string | null;
  raw_input_url: string | null;
  parsed_data: { transcript?: string } | null;
  validation_result: { status?: string } | null;
  corrective_action: string | null;
}

const DUBAI_TZ = "Asia/Dubai";

/**
 * logged_by is stored as "Name (uuid)" for identified staff; show just the
 * readable name. Falls back to the raw value (e.g. "Unidentified", "web").
 */
function loggedByName(value: string | null): string {
  if (!value) return "—";
  const match = value.match(/^(.*) \([0-9a-fA-F-]{36}\)$/);
  return match ? match[1] : value;
}

/** "16 Jun 2026, 2:04 PM" in UAE (Asia/Dubai) time. */
function formatDubai(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: DUBAI_TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("year")}, ${get("hour")}:${get(
    "minute",
  )} ${get("dayPeriod").toUpperCase()}`;
}

/** YYYY-MM-DD for the given instant in Asia/Dubai, for "today" comparisons. */
function dubaiDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DUBAI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function normalizeStatus(row: LogRow): ComplianceStatus {
  const s = row.validation_result?.status;
  if (s === "pass" || s === "fail") return s;
  return "unknown";
}

const STATUS_STYLE: Record<
  ComplianceStatus,
  { bg: string; fg: string; label: string }
> = {
  pass: { bg: "#dcfce7", fg: "#166534", label: "PASS" },
  fail: { bg: "#fee2e2", fg: "#991b1b", label: "FAIL" },
  unknown: { bg: "#e5e7eb", fg: "#374151", label: "UNKNOWN" },
};

function StatusBadge({ status }: { status: ComplianceStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      style={{
        display: "inline-block",
        background: s.bg,
        color: s.fg,
        fontWeight: 700,
        fontSize: "0.8rem",
        letterSpacing: "0.04em",
        padding: "0.25rem 0.6rem",
        borderRadius: 999,
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}

export default async function DashboardPage() {
  // PIN gate (pilot): /record stays open for kitchen staff; this page is locked.
  if (!(await isAuthenticated())) {
    return <PinGate />;
  }

  let rows: LogRow[] = [];
  let loadError: string | null = null;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("compliance_logs")
      .select(
        "id, created_at, type, logged_by, raw_input_url, parsed_data, validation_result, corrective_action",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    rows = (data ?? []) as LogRow[];
  } catch (err) {
    console.error("[dashboard] failed to load logs", err);
    loadError =
      "Could not load compliance logs. Check the database connection and try again.";
  }

  const todayKey = dubaiDateKey(new Date());
  const todays = rows.filter((r) => dubaiDateKey(new Date(r.created_at)) === todayKey);
  const failsToday = todays.filter((r) => normalizeStatus(r) === "fail").length;

  const cellStyle: React.CSSProperties = {
    padding: "0.9rem 1rem",
    borderBottom: "1px solid #e5e7eb",
    verticalAlign: "top",
    fontSize: "0.95rem",
  };
  const headStyle: React.CSSProperties = {
    padding: "0.75rem 1rem",
    textAlign: "left",
    fontSize: "0.75rem",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "#6b7280",
    borderBottom: "2px solid #e5e7eb",
    whiteSpace: "nowrap",
  };

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "2.5rem 1.5rem 4rem",
        color: "#111827",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          paddingBottom: "1.25rem",
          marginBottom: "1.5rem",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <Wordmark />
        <nav style={{ flexShrink: 0, display: "flex", gap: "0.5rem" }}>
          <a
            href="/dashboard/staff"
            style={{
              fontSize: "0.9rem",
              fontWeight: 600,
              color: BRAND_GREEN,
              textDecoration: "none",
              padding: "0.45rem 0.85rem",
              border: "1px solid #cbd5e1",
              borderRadius: 10,
            }}
          >
            Staff
          </a>
          <a
            href="/api/dashboard-logout"
            style={{
              fontSize: "0.9rem",
              fontWeight: 600,
              color: "#475569",
              textDecoration: "none",
              padding: "0.45rem 0.85rem",
              border: "1px solid #cbd5e1",
              borderRadius: 10,
            }}
          >
            Log out
          </a>
        </nav>
      </div>

      <header style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.75rem", margin: "0 0 0.25rem" }}>
          Compliance Dashboard
        </h1>
        <p style={{ color: "#6b7280", margin: 0 }}>
          Immutable food-safety log records, newest first.
        </p>
      </header>

      {/* Summary cards */}
      <section
        style={{
          display: "flex",
          gap: "1rem",
          flexWrap: "wrap",
          marginBottom: "2rem",
        }}
      >
        <SummaryCard label="Logs today" value={todays.length} />
        <SummaryCard
          label="Failures today"
          value={failsToday}
          emphasis={failsToday > 0 ? "fail" : undefined}
        />
      </section>

      {loadError ? (
        <p
          role="alert"
          style={{
            background: "#fee2e2",
            color: "#991b1b",
            padding: "1rem 1.25rem",
            borderRadius: 8,
          }}
        >
          {loadError}
        </p>
      ) : rows.length === 0 ? (
        <p style={{ color: "#6b7280" }}>No compliance logs recorded yet.</p>
      ) : (
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              background: "#ffffff",
            }}
          >
            <thead style={{ background: "#f9fafb" }}>
              <tr>
                <th style={headStyle}>Date &amp; time</th>
                <th style={headStyle}>Logged by</th>
                <th style={headStyle}>Status</th>
                <th style={headStyle}>What the worker said</th>
                <th style={headStyle}>AI reply</th>
                <th style={headStyle}>Audio</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const status = normalizeStatus(row);
                const transcript = row.parsed_data?.transcript ?? "—";
                return (
                  <tr key={row.id}>
                    <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>
                      {formatDubai(row.created_at)}
                    </td>
                    <td style={{ ...cellStyle, fontWeight: 600 }}>
                      {loggedByName(row.logged_by)}
                    </td>
                    <td style={cellStyle}>
                      <StatusBadge status={status} />
                    </td>
                    <td style={{ ...cellStyle, maxWidth: 320 }}>{transcript}</td>
                    <td style={{ ...cellStyle, maxWidth: 320, color: "#374151" }}>
                      {row.corrective_action ?? "—"}
                    </td>
                    <td style={cellStyle}>
                      {row.raw_input_url ? (
                        <audio
                          controls
                          preload="none"
                          style={{ height: 36, maxWidth: 220 }}
                          src={`/api/audio?path=${encodeURIComponent(
                            row.raw_input_url,
                          )}`}
                        />
                      ) : (
                        <span style={{ color: "#9ca3af" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function SummaryCard({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number;
  emphasis?: "fail";
}) {
  return (
    <div
      style={{
        flex: "1 1 200px",
        border: "1px solid #e2e8f0",
        borderRadius: 16,
        padding: "1.25rem 1.5rem",
        background: emphasis === "fail" && value > 0 ? "#fef2f2" : "#ffffff",
        boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
      }}
    >
      <div
        style={{
          fontSize: "0.8rem",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "#6b7280",
          marginBottom: "0.4rem",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "2.25rem",
          fontWeight: 800,
          lineHeight: 1,
          color: emphasis === "fail" && value > 0 ? "#991b1b" : "#111827",
        }}
      >
        {value}
      </div>
    </div>
  );
}

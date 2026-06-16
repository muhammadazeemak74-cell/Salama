import { getSupabaseAdmin } from "@/lib/supabase";
import { isAuthenticated } from "@/lib/auth";
import { DEFAULT_ESTABLISHMENT_ID } from "@/lib/establishment";
import PinGate from "../PinGate";
import StaffManager, { type StaffMember } from "./StaffManager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function StaffPage() {
  // Same PIN gate as /dashboard.
  if (!(await isAuthenticated())) {
    return <PinGate />;
  }

  let staff: StaffMember[] = [];
  let loadError: string | null = null;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("staff")
      .select("id, name")
      .eq("establishment_id", DEFAULT_ESTABLISHMENT_ID)
      .eq("active", true)
      .order("name", { ascending: true });
    if (error) throw error;
    staff = (data ?? []) as StaffMember[];
  } catch (err) {
    console.error("[staff page] failed to load staff", err);
    loadError = "Could not load staff. Check the database connection.";
  }

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "2.5rem 1.5rem 4rem",
        color: "#111827",
        background: "#ffffff",
      }}
    >
      <header
        style={{
          marginBottom: "1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "1rem",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.75rem", margin: "0 0 0.25rem" }}>Staff</h1>
          <p style={{ color: "#6b7280", margin: 0 }}>
            People who can log compliance events.
          </p>
        </div>
        <a
          href="/dashboard"
          style={{
            flexShrink: 0,
            fontSize: "0.9rem",
            fontWeight: 600,
            color: "#2563eb",
            textDecoration: "none",
            padding: "0.4rem 0.75rem",
            border: "1px solid #d1d5db",
            borderRadius: 8,
          }}
        >
          ← Dashboard
        </a>
      </header>

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
      ) : (
        <StaffManager initialStaff={staff} />
      )}
    </main>
  );
}

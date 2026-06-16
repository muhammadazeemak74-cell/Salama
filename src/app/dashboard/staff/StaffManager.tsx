"use client";

import { useState } from "react";

export interface StaffMember {
  id: string;
  name: string;
}

export default function StaffManager({
  initialStaff,
}: {
  initialStaff: StaffMember[];
}) {
  const [staff, setStaff] = useState<StaffMember[]>(initialStaff);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function addStaff(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Could not add staff.");
      setStaff((prev) =>
        [...prev, data.staff].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add staff.");
    } finally {
      setBusy(false);
    }
  }

  async function removeStaff(id: string) {
    setError("");
    const prev = staff;
    // Optimistic remove.
    setStaff((s) => s.filter((m) => m.id !== id));
    try {
      const res = await fetch(`/api/staff?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Could not remove staff.");
      }
    } catch (err) {
      setStaff(prev); // restore on failure
      setError(err instanceof Error ? err.message : "Could not remove staff.");
    }
  }

  return (
    <div>
      <form
        onSubmit={addStaff}
        style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}
      >
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Staff member name"
          aria-label="Staff member name"
          style={{
            flex: 1,
            fontSize: "1rem",
            padding: "0.65rem 0.85rem",
            border: "1px solid #d1d5db",
            borderRadius: 8,
            color: "#111827",
          }}
        />
        <button
          type="submit"
          disabled={busy || name.trim().length === 0}
          style={{
            fontSize: "1rem",
            fontWeight: 700,
            padding: "0.65rem 1.25rem",
            borderRadius: 8,
            border: "none",
            cursor:
              busy || name.trim().length === 0 ? "default" : "pointer",
            background:
              busy || name.trim().length === 0 ? "#93c5fd" : "#2563eb",
            color: "#ffffff",
          }}
        >
          Add
        </button>
      </form>

      {error && (
        <p role="alert" style={{ color: "#991b1b", fontWeight: 600 }}>
          {error}
        </p>
      )}

      {staff.length === 0 ? (
        <p style={{ color: "#6b7280" }}>
          No staff yet. Add the people who log compliance events.
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {staff.map((m) => (
            <li
              key={m.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.85rem 1rem",
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                marginBottom: "0.6rem",
              }}
            >
              <span style={{ fontSize: "1.05rem", fontWeight: 600 }}>
                {m.name}
              </span>
              <button
                type="button"
                onClick={() => removeStaff(m.id)}
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  padding: "0.35rem 0.75rem",
                  borderRadius: 8,
                  border: "1px solid #fca5a5",
                  background: "#fff",
                  color: "#b91c1c",
                  cursor: "pointer",
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

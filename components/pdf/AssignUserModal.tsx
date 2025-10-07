import React, { useEffect, useState } from "react";

type Props = {
  documentId: string;
  open: boolean;
  onClose: () => void;
  onAssigned?: (assignedTo: string) => void; // callback to refresh UI
};

export default function AssignUserModal({
  documentId,
  open,
  onClose,
  onAssigned,
}: Props) {
  const [users, setUsers] = useState<
    { id: string; name: string; email?: string }[]
  >([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    // Replace with your actual users endpoint or pass users in props
    fetch("/api/users?limit=200")
      .then((r) => r.json())
      .then((j) => {
        setUsers(j?.users || []);
      })
      .catch((e) => {
        console.warn("Failed to load users for assign modal", e);
      })
      .finally(() => setLoading(false));
  }, [open]);

  async function handleAssign() {
    if (!selected) return alert("Select a user to notify");
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/documents/${encodeURIComponent(documentId)}/assign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assigned_to: selected,
            giveLock: true,
            notify: true,
          }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json?.error || "Assign failed");
      } else {
        onAssigned?.(selected);
        onClose();
      }
    } catch (err) {
      console.error("assign failed", err);
      alert("Failed to assign, check console");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="bg-white rounded-md shadow-lg z-10 w-full max-w-md p-4">
        <h3 className="text-lg font-medium mb-3">
          Notify / Assign next reviewer
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          Select the user to notify and give them edit access.
        </p>

        <div className="mb-3">
          {loading ? (
            <div className="text-sm text-gray-500">Loading users...</div>
          ) : (
            <select
              className="w-full border p-2 rounded"
              value={selected ?? ""}
              onChange={(e) => setSelected(e.target.value || null)}
            >
              <option value="">-- select user --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.email ? `(${u.email})` : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            className="px-3 py-2 rounded border"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            className="px-3 py-2 rounded bg-primary text-white"
            onClick={handleAssign}
            disabled={submitting || !selected}
          >
            {submitting ? "Assigning..." : "Notify & Transfer Lock"}
          </button>
        </div>
      </div>
    </div>
  );
}

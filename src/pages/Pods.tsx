import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus, Pencil, Trash2, Users, Search, X } from "lucide-react";
import { supabase } from "../lib/supabase";

type Pod = {
  id: string;
  name: string;
  lead_name: string | null;
  created_at: string;
};

export default function Pods() {
  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingPod, setEditingPod] = useState<Pod | null>(null);
  const [name, setName] = useState("");
  const [leadName, setLeadName] = useState("");
  const [saving, setSaving] = useState(false);

  const loadPods = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("pods")
      .select("*")
      .order("name");

    if (error) {
      setError(error.message);
      setPods([]);
    } else {
      setPods(data ?? []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadPods();
  }, [loadPods]);

  function openCreateForm() {
    setEditingPod(null);
    setName("");
    setLeadName("");
    setShowForm(true);
  }

  function openEditForm(pod: Pod) {
    setEditingPod(pod);
    setName(pod.name);
    setLeadName(pod.lead_name ?? "");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingPod(null);
    setName("");
    setLeadName("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Please enter a pod name.");
      return;
    }

    setSaving(true);
    setError("");

    const podData = {
      name: name.trim(),
      lead_name: leadName.trim() || null,
    };

    const result = editingPod
      ? await supabase.from("pods").update(podData).eq("id", editingPod.id)
      : await supabase.from("pods").insert(podData);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    closeForm();
    setSaving(false);
    await loadPods();
  }

  async function deletePod(pod: Pod) {
    const confirmed = window.confirm(
      `Delete the pod "${pod.name}"? Employees in this pod will become unassigned.`,
    );

    if (!confirmed) return;

    const { error } = await supabase.from("pods").delete().eq("id", pod.id);

    if (error) {
      setError(error.message);
      return;
    }

    await loadPods();
  }

  const filteredPods = pods.filter((pod) => {
    const searchText = search.toLowerCase();

    return (
      pod.name.toLowerCase().includes(searchText) ||
      (pod.lead_name ?? "").toLowerCase().includes(searchText)
    );
  });

  return (
    <div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">WORKFORCE ORGANIZATION</span>
          <h1>Pods</h1>
          <p>Organize employees into teams managed by pod leads.</p>
        </div>

        <button className="primary-button" onClick={openCreateForm}>
          <Plus size={17} />
          Add pod
        </button>
      </div>

      <div className="management-toolbar">
        <div className="search-box">
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search pods or pod leads..."
          />
        </div>

        <span className="record-count">
          {pods.length} {pods.length === 1 ? "pod" : "pods"}
        </span>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading-state">Loading pods...</div>
      ) : filteredPods.length === 0 ? (
        <div className="empty-management">
          <div className="empty-icon">
            <Users size={26} />
          </div>
          <h3>{search ? "No matching pods" : "No pods created yet"}</h3>
          <p>
            {search
              ? "Try another search term."
              : "Create your first pod to organize your employees."}
          </p>
          {!search && (
            <button className="primary-button" onClick={openCreateForm}>
              <Plus size={16} />
              Create first pod
            </button>
          )}
        </div>
      ) : (
        <div className="pod-grid">
          {filteredPods.map((pod) => (
            <article className="pod-card" key={pod.id}>
              <div className="pod-card-top">
                <div className="pod-icon">
                  <Users size={19} />
                </div>

                <div className="pod-actions">
                  <button
                    className="small-icon-button"
                    onClick={() => openEditForm(pod)}
                    aria-label={`Edit ${pod.name}`}
                    title="Edit pod"
                  >
                    <Pencil size={15} />
                  </button>

                  <button
                    className="small-icon-button danger-action"
                    onClick={() => void deletePod(pod)}
                    aria-label={`Delete ${pod.name}`}
                    title="Delete pod"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <h3>{pod.name}</h3>

              <div className="pod-lead">
                <span>Pod lead</span>
                <strong>{pod.lead_name || "Not assigned"}</strong>
              </div>

              <div className="pod-footer">
                <span>Employee management coming next</span>
              </div>
            </article>
          ))}
        </div>
      )}

      {showForm && (
        <div className="modal-backdrop" onMouseDown={closeForm}>
          <form
            className="modal-card"
            onSubmit={handleSubmit}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <h2>{editingPod ? "Edit pod" : "Create a pod"}</h2>
                <p>Enter the team's basic information.</p>
              </div>

              <button
                type="button"
                className="small-icon-button"
                onClick={closeForm}
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>

            <label htmlFor="pod-name">Pod name *</label>
            <input
              id="pod-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Pod Alpha"
              required
              autoFocus
            />

            <label htmlFor="pod-lead">Pod lead</label>
            <input
              id="pod-lead"
              value={leadName}
              onChange={(event) => setLeadName(event.target.value)}
              placeholder="e.g. Rahul Sharma"
            />

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={closeForm}
              >
                Cancel
              </button>

              <button className="primary-button" disabled={saving}>
                {saving
                  ? "Saving..."
                  : editingPod
                    ? "Save changes"
                    : "Create pod"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { CalendarDays, Save, Play, Send } from "lucide-react";
import RosterView from "./RosterView";
import {
  previewRoster,
  saveRosterDraft,
  publishRoster,
} from "../lib/roster/rosterService";
import type { GenerationResult } from "../lib/roster/engine";

function currentMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

export default function Roster() {
  const [month, setMonth] = useState(currentMonth());
  const [result, setResult] = useState<GenerationResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [saved, setSaved] = useState(false);
  const [published, setPublished] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [refreshKey, setRefreshKey] = useState(0);

  function resetPreview() {
    setResult(null);
    setSaved(false);
    setPublished(false);
    setMessage("");
    setError("");
  }

  async function handleGenerate() {
    setLoading(true);
    resetPreview();

    try {
      const generated = await previewRoster(month);
      setResult(generated);
      setMessage("Roster preview generated. Review it before saving.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!result) return;

    if (
      !window.confirm(
        "Save this roster as a draft? Any existing unpublished draft for this month will be replaced.",
      )
    ) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await saveRosterDraft(month, result);

      setSaved(true);
      setPublished(false);
      setMessage(
        "Roster draft saved successfully. Your monthly schedule has been refreshed below.",
      );
      setRefreshKey((current) => current + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save roster.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!saved || !result) return;

    if (
      !window.confirm(
        "Publish this roster? The system will revalidate it against the latest employee availability and operating rules.",
      )
    ) {
      return;
    }

    setPublishing(true);
    setError("");
    setMessage("");

    try {
      const publishedResult = await publishRoster(month);

      setResult(publishedResult);
      setPublished(true);
      setSaved(true);
      setMessage(
        "Roster successfully validated and published. The published monthly schedule has been refreshed below.",
      );
      setRefreshKey((current) => current + 1);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not publish roster.",
      );
      // Refresh the view even when validation prevents publication.
      setRefreshKey((current) => current + 1);
    } finally {
      setPublishing(false);
    }
  }

  const uniqueWorkingEmployees = result
    ? new Set(result.allocations.map((allocation) => allocation.employee_id))
        .size
    : 0;

  const hardConflicts =
    result?.conflicts.filter((conflict) => conflict.severity === "hard") ?? [];

  return (
    <div className="page-content roster-page">
      <div className="page-heading">
        <div>
          <h1>Monthly roster</h1>
          <p>
            Generate, validate and publish a monthly schedule using employee
            assignments, availability and process requirements.
          </p>
        </div>
      </div>

      {/* Roster generation controls */}
      <section className="content-card roster-generator">
        <div className="roster-controls">
          <div className="form-field">
            <label htmlFor="roster-month">Roster month</label>
            <input
              id="roster-month"
              type="month"
              value={month}
              disabled={publishing || saving || loading}
              onChange={(event) => {
                setMonth(event.target.value);
                resetPreview();
                setRefreshKey((current) => current + 1);
              }}
            />
          </div>

          <button
            className="primary-button"
            onClick={() => void handleGenerate()}
            disabled={loading || saving || publishing || !month}
          >
            <Play size={15} />
            {loading ? "Generating..." : "Generate roster"}
          </button>

          <button
            className="secondary-button"
            onClick={() => void handleSave()}
            disabled={!result || saving || publishing || published}
          >
            <Save size={15} />
            {saving ? "Saving..." : "Save draft"}
          </button>

          <button
            className="primary-button"
            onClick={() => void handlePublish()}
            disabled={!saved || !result || saving || publishing || published}
          >
            <Send size={15} />
            {publishing
              ? "Publishing..."
              : published
                ? "Published"
                : "Publish roster"}
          </button>
        </div>
      </section>

      {error && <div className="alert-error">{error}</div>}
      {message && <div className="alert-success">{message}</div>}

      {/* Generation preview and validation */}
      {!result ? (
        <section className="content-card roster-empty">
          <CalendarDays size={30} />
          <h2>No roster preview yet</h2>
          <p>Select a month and generate the schedule.</p>
        </section>
      ) : (
        <>
          <div className="roster-summary-grid">
            <div className="content-card roster-summary-item">
              <span>Daily employee records</span>
              <strong>{result.entries.length}</strong>
            </div>

            <div className="content-card roster-summary-item">
              <span>Process allocations</span>
              <strong>{result.allocations.length}</strong>
            </div>

            <div className="content-card roster-summary-item">
              <span>Employees allocated</span>
              <strong>{uniqueWorkingEmployees}</strong>
            </div>

            <div className="content-card roster-summary-item">
              <span>Hard conflicts</span>
              <strong>{hardConflicts.length}</strong>
            </div>
          </div>

          <section className="content-card roster-results">
            <div className="section-heading">
              <div>
                <h2>Generation results</h2>
                <p>
                  {published
                    ? "This roster has been published."
                    : saved
                      ? "This roster has been saved as a draft."
                      : hardConflicts.length === 0
                        ? "No hard coverage conflicts detected in this preview."
                        : "This roster has coverage gaps and cannot be published."}
                </p>
              </div>
            </div>

            {hardConflicts.length === 0 ? (
              <div className="alert-success">
                All operating processes received their required minimum staffing
                under the current scheduling rules.
              </div>
            ) : (
              <div className="roster-conflict-list">
                {hardConflicts.slice(0, 30).map((conflict, index) => (
                  <div
                    className="roster-conflict-row"
                    key={`${conflict.date}-${index}`}
                  >
                    <strong>{conflict.date}</strong>
                    <span>{conflict.message}</span>
                    <small>
                      Coverage: {conflict.assigned_staff}/
                      {conflict.required_staff}
                    </small>
                  </div>
                ))}

                {hardConflicts.length > 30 && (
                  <p className="form-hint">
                    Showing the first 30 of {hardConflicts.length} conflicts.
                    All conflicts are included when the draft is saved.
                  </p>
                )}
              </div>
            )}

            {saved && !published && (
              <p className="form-hint">
                Draft saved. Publishing will run a fresh validation before
                changing the roster status.
              </p>
            )}
          </section>
        </>
      )}

      {/* Saved monthly roster */}
      <section className="content-card" style={{ marginTop: 24 }}>
        <div className="section-heading">
          <div>
            <h2>Saved monthly schedule</h2>
            <p>
              The saved employee allocations and working shifts for {month}.
            </p>
          </div>
        </div>

        <RosterView month={month} refreshKey={refreshKey} />
      </section>
    </div>
  );
}

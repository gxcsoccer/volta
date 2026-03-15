"use client";

import { useState, useEffect, useCallback } from "react";

interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
  created_at: string;
}

function getSecret(): string {
  return localStorage.getItem("volta_secret") ?? "";
}

export default function AdminSkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formCategory, setFormCategory] = useState("general");
  const [formContent, setFormContent] = useState("");
  const [saving, setSaving] = useState(false);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ type, message: msg });
    setTimeout(() => setToast(null), 5000);
  };

  const fetchSkills = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/skills", {
        headers: { Authorization: `Bearer ${getSecret()}` },
      });
      if (res.ok) {
        setSkills(await res.json());
      } else if (res.status === 401) {
        showToast("Admin secret is incorrect. Please lock and re-enter.", "error");
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || `API error: ${res.status}`, "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to connect to API", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const startEdit = (skill: Skill) => {
    setEditing(skill.id);
    setFormName(skill.name);
    setFormDesc(skill.description);
    setFormCategory(skill.category);
    setFormContent(skill.content);
    setCreating(false);
  };

  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    setFormName("");
    setFormDesc("");
    setFormCategory("general");
    setFormContent("");
  };

  const cancel = () => {
    setEditing(null);
    setCreating(false);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);

    try {
      if (creating) {
        await fetch("/api/admin/skills", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getSecret()}`,
          },
          body: JSON.stringify({
            name: formName.trim(),
            description: formDesc.trim(),
            category: formCategory.trim(),
            content: formContent,
          }),
        });
        showToast("Skill created");
      } else if (editing) {
        await fetch(`/api/admin/skills/${editing}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getSecret()}`,
          },
          body: JSON.stringify({
            name: formName.trim(),
            description: formDesc.trim(),
            category: formCategory.trim(),
            content: formContent,
          }),
        });
        showToast("Skill updated");
      }

      cancel();
      await fetchSkills();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (skill: Skill) => {
    if (!confirm(`Delete skill "${skill.name}"?`)) return;
    await fetch(`/api/admin/skills/${skill.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getSecret()}` },
    });
    showToast("Skill deleted");
    await fetchSkills();
  };

  const isEditing = editing !== null || creating;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Skills</h1>
        {!isEditing && (
          <button
            onClick={startCreate}
            className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-gray-950 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
          >
            + New Skill
          </button>
        )}
      </div>

      {toast && (
        <div
          className={`px-4 py-2.5 rounded-lg text-sm border ${
            toast.type === "error"
              ? "bg-red-950/60 text-red-300 border-red-900/60"
              : "bg-emerald-950/60 text-emerald-300 border-emerald-900/60"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Edit/Create Form */}
      {isEditing && (
        <div className="bg-gray-900/50 border border-gray-800/60 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            {creating ? "New Skill" : "Edit Skill"}
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-gray-500">Name</label>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., risk_management"
                className="input-field"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-500">Category</label>
              <input
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                placeholder="strategy"
                className="input-field"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-500">Description</label>
              <input
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Brief description"
                className="input-field"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-gray-500">Content (Markdown)</label>
            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              rows={12}
              placeholder="## Risk Management Framework&#10;&#10;### Position Sizing&#10;- Never allocate more than 25%..."
              className="input-field font-mono text-xs leading-relaxed"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !formName.trim()}
              className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-gray-950 text-sm font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {saving ? "Saving..." : creating ? "Create" : "Save"}
            </button>
            <button
              onClick={cancel}
              className="px-4 py-2 bg-gray-800/60 hover:bg-gray-700 text-gray-300 text-sm rounded-lg border border-gray-700/50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Skills List */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      ) : skills.length === 0 && !isEditing ? (
        <div className="text-center py-16 text-gray-500">
          No skills yet. Skills will be created by the database migration.
        </div>
      ) : (
        <div className="space-y-3">
          {skills.map((skill) => (
            <div
              key={skill.id}
              className={`border rounded-xl p-4 transition-colors ${
                editing === skill.id
                  ? "border-yellow-400/40 bg-yellow-400/5"
                  : "border-gray-800/60 bg-gray-900/40"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-100 font-mono text-sm">
                      {skill.name}
                    </span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
                      {skill.category}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{skill.description}</p>
                  <details className="mt-2">
                    <summary className="text-[11px] text-gray-600 cursor-pointer hover:text-gray-400">
                      Preview content ({skill.content.length} chars)
                    </summary>
                    <pre className="mt-2 text-[11px] text-gray-500 whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-y-auto">
                      {skill.content}
                    </pre>
                  </details>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => startEdit(skill)}
                    className="px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-gray-800/60 hover:bg-gray-700 text-gray-300 border border-gray-700/50 transition-colors cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(skill)}
                    className="px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-red-900/30 hover:bg-red-800/40 text-red-400 border border-red-800/40 transition-colors cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

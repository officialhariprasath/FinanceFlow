import { useEffect, useState } from "react";

import ConfirmModal from "../../components/common/ConfirmModal";
import MainLayout from "../../components/layout/MainLayout";
import { useToast } from "../../context/ToastContext";
import { PageError, PageLoading } from "../../components/common/PageStates";
import {
  createAgent,
  deleteAgent,
  getAgents,
  getPermissionOptions,
  getRolePresets,
  updateAgent,
} from "../../services/agentService";
import {
  assignCustomersToAgent,
  getAgentAssignments,
  listAgentWallets,
} from "../../services/agentWalletService";
import api from "../../api/axios";
import type { AgentWalletBalance } from "../../types/agentWallet";
import type { Agent, AgentCreate, PermissionOption } from "../../types/agent";
import { ROLE_LABELS } from "../../types/agent";
import { fmt } from "../../utils/fmt";

const ROLES = ["COLLECTION_AGENT", "MANAGER", "VIEWER"];

export default function AgentsPage() {
  const toast = useToast();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [wallets, setWallets] = useState<Record<number, AgentWalletBalance>>({});
  const [customerOptions, setCustomerOptions] = useState<
    { id: number; full_name: string }[]
  >([]);
  const [assignAgentId, setAssignAgentId] = useState<number | null>(null);
  const [selectedCustomers, setSelectedCustomers] = useState<number[]>([]);
  const [permissions, setPermissions] = useState<PermissionOption[]>([]);
  const [rolePresets, setRolePresets] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState<AgentCreate>({
    full_name: "",
    phone: "",
    email: "",
    password: "",
    role: "COLLECTION_AGENT",
    permissions: [],
    is_active: true,
  });

  async function load() {
    try {
      setLoading(true);
      setError("");
      const [agentList, permOpts, presets, walletList, namesRes] = await Promise.all([
        getAgents(),
        getPermissionOptions(),
        getRolePresets(),
        listAgentWallets(),
        api.get<{ id: number; full_name: string }[]>("/customers/names").catch(() => ({ data: [] })),
      ]);
      setAgents(agentList);
      const wmap: Record<number, AgentWalletBalance> = {};
      walletList.forEach((w) => {
        if (w.agent_id) wmap[w.agent_id] = w;
      });
      setWallets(wmap);
      setCustomerOptions(namesRes.data);
      setPermissions(permOpts);
      setRolePresets(presets);
    } catch {
      setError("Failed to load agents. Owner access required.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({
      full_name: "",
      phone: "",
      email: "",
      password: "",
      role: "COLLECTION_AGENT",
      permissions: rolePresets.COLLECTION_AGENT ?? [],
      is_active: true,
    });
    setFormError("");
    setShowForm(true);
  }

  function openEdit(agent: Agent) {
    setEditing(agent);
    setForm({
      full_name: agent.full_name,
      phone: agent.phone,
      email: agent.email,
      password: "",
      role: agent.role,
      permissions: agent.permissions,
      is_active: agent.is_active,
      assigned_area: agent.assigned_area ?? "",
    });
    setFormError("");
    setShowForm(true);
  }

  function onRoleChange(role: string) {
    setForm({
      ...form,
      role,
      permissions: rolePresets[role] ?? [],
    });
  }

  function togglePermission(key: string) {
    const set = new Set(form.permissions ?? []);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    setForm({ ...form, permissions: Array.from(set) });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      setFormError("");
      if (editing) {
        await updateAgent(editing.id, {
          full_name: form.full_name,
          phone: form.phone,
          email: form.email,
          password: form.password || undefined,
          role: form.role,
          permissions: form.permissions,
          is_active: form.is_active,
          assigned_area: form.assigned_area || undefined,
        });
      } else {
        await createAgent(form);
      }
      setShowForm(false);
      toast.success(editing ? "Agent updated." : "Agent created.");
      await load();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      setFormError(typeof detail === "string" ? detail : "Failed to save agent.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await deleteAgent(deleteTarget.id);
      toast.success(`Agent ${deleteTarget.full_name} removed.`);
      setDeleteTarget(null);
      await load();
    } catch {
      toast.error("Failed to delete agent.");
    } finally {
      setDeleting(false);
    }
  }

  async function openAssign(agent: Agent) {
    setAssignAgentId(agent.id);
    try {
      const assigned = await getAgentAssignments(agent.id);
      setSelectedCustomers(assigned.map((a: { customer_id: number }) => a.customer_id));
    } catch {
      setSelectedCustomers([]);
    }
  }

  async function saveAssignments() {
    if (!assignAgentId) return;
    try {
      await assignCustomersToAgent(assignAgentId, selectedCustomers);
      setAssignAgentId(null);
    } catch {
      setError("Failed to assign borrowers.");
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <PageLoading message="Loading agents..." />
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <PageError message={error} onRetry={load} />
      </MainLayout>
    );
  }

  return (
    <>
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 sm:text-2xl">Manage Agents</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Add, edit, assign borrowers, and view unsettled balances
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="w-full rounded-lg bg-blue-700 px-4 py-3 text-sm font-medium text-white hover:bg-blue-800 sm:w-auto sm:py-2"
          >
            + Add Agent
          </button>
        </div>

        {showForm && (
          <div className="surface-card p-6">
            <h2 className="section-title">
              {editing ? "Edit Agent" : "New Agent"}
            </h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <input
                  placeholder="Full name"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="rounded-lg border px-3 py-2 text-sm"
                  required
                />
                <input
                  placeholder="Phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="rounded-lg border px-3 py-2 text-sm"
                  required
                />
                <input
                  type="email"
                  placeholder="Email (login)"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="rounded-lg border px-3 py-2 text-sm"
                  required
                />
                <input
                  type="password"
                  placeholder={editing ? "New password (optional)" : "Password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="rounded-lg border px-3 py-2 text-sm"
                  required={!editing}
                />
                <select
                  value={form.role}
                  onChange={(e) => onRoleChange(e.target.value)}
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
                  ))}
                </select>
                <input
                  placeholder="Assigned area"
                  value={form.assigned_area ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, assigned_area: e.target.value })
                  }
                  className="rounded-lg border px-3 py-2 text-sm"
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) =>
                      setForm({ ...form, is_active: e.target.checked })
                    }
                  />
                  Active
                </label>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Permissions</p>
                <div className="flex flex-wrap gap-2">
                  {permissions.map((p) => (
                    <label
                      key={p.key}
                      className="flex items-center gap-1 rounded border px-2 py-1 text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={form.permissions?.includes(p.key)}
                        onChange={() => togglePermission(p.key)}
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>

              {formError && <p className="text-sm text-red-600">{formError}</p>}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save Agent"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border px-4 py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {assignAgentId && (
          <div className="surface-card p-6">
            <h2 className="section-title">Assign Borrowers</h2>
            <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
              {customerOptions.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedCustomers.includes(c.id)}
                    onChange={() => {
                      setSelectedCustomers((prev) =>
                        prev.includes(c.id)
                          ? prev.filter((id) => id !== c.id)
                          : [...prev, c.id]
                      );
                    }}
                  />
                  {c.full_name}
                </label>
              ))}
            </div>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={saveAssignments}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
              >
                Save Assignments
              </button>
              <button
                type="button"
                onClick={() => setAssignAgentId(null)}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="table-responsive table-shell is-wide">
          <table className="min-w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Phone</th>
                <th className="px-4 py-3 text-left">Area</th>
                <th className="px-4 py-3 text-right">Unsettled</th>
                <th className="px-4 py-3 text-right">Pending</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {agents.map((agent) => (
                <tr key={agent.id}>
                  <td className="px-4 py-3 font-medium">{agent.full_name}</td>
                  <td className="px-4 py-3">{agent.email}</td>
                  <td className="px-4 py-3">{agent.phone}</td>
                  <td className="px-4 py-3">{agent.assigned_area || "—"}</td>
                  <td className="px-4 py-3 text-right font-medium">
                    {fmt(wallets[agent.id]?.unsettled_balance ?? wallets[agent.id]?.total_balance ?? "0")}
                  </td>
                  <td className="px-4 py-3 text-right text-amber-700">
                    {wallets[agent.id]?.has_pending_settlement
                      ? fmt(wallets[agent.id]?.pending_settlement_total ?? "0")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">{ROLE_LABELS[agent.role] ?? agent.role}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        agent.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {agent.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openAssign(agent)}
                      className="mr-2 text-amber-600 hover:underline"
                    >
                      Assign
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(agent)}
                      className="mr-2 text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(agent)}
                      className="text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {agents.length === 0 && (
            <p className="px-6 py-10 text-center text-slate-500">No agents yet.</p>
          )}
        </div>
      </div>
    </MainLayout>
    {deleteTarget && (
      <ConfirmModal
        title="Remove agent?"
        message={`Remove ${deleteTarget.full_name}? They will no longer be able to log in.`}
        confirmLabel="Remove"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    )}
    </>
  );
}

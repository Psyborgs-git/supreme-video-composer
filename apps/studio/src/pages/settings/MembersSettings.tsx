import { useState, useEffect } from "react";
import { useAuthStore } from "../../stores/authStore";

interface Member {
  orgId: string;
  userId: string;
  role: string;
  joinedAt: string | null;
  user?: { id: string; email: string; name: string | null };
}

export const MembersSettings: React.FC = () => {
  const { currentOrg, user: currentUser } = useAuthStore();
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const isAdmin = currentOrg?.role === "admin" || currentOrg?.role === "owner";

  useEffect(() => {
    if (!currentOrg) return;
    fetch(`/api/orgs/${currentOrg.slug}/members`)
      .then((r) => r.json())
      .then((d) => setMembers((d as { members: Member[] }).members))
      .catch(console.error);
  }, [currentOrg?.slug]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg) return;
    setInviteError(null);
    setInviteSuccess(null);
    setInviteLoading(true);
    try {
      const res = await fetch(`/api/orgs/${currentOrg.slug}/members/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json() as { invite?: { token: string }; error?: string };
      if (!res.ok) {
        setInviteError(data.error ?? "Failed to send invite");
        return;
      }
      setInviteSuccess(`Invite sent to ${inviteEmail}`);
      setInviteEmail("");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!currentOrg || !confirm("Remove this member?")) return;
    await fetch(`/api/orgs/${currentOrg.slug}/members/${userId}`, { method: "DELETE" });
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 mb-6">Team members</h1>

      {/* Members list */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden mb-8">
        {members.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-zinc-400">No members found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-zinc-800">
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-zinc-400">Member</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-zinc-400">Role</th>
                {isAdmin && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.userId} className="border-b border-gray-100 dark:border-zinc-800 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-zinc-100">{m.user?.name ?? m.user?.email ?? m.userId}</p>
                    {m.user?.name && <p className="text-xs text-gray-400 dark:text-zinc-500">{m.user.email}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="capitalize text-gray-600 dark:text-zinc-400">{m.role}</span>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      {m.userId !== currentUser?.id && (
                        <button
                          onClick={() => handleRemove(m.userId)}
                          className="text-xs text-red-500 hover:text-red-700 transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Invite form */}
      {isAdmin && (
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-4">Invite a member</h2>
          {inviteError && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">{inviteError}</div>
          )}
          {inviteSuccess && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm">{inviteSuccess}</div>
          )}
          <form onSubmit={handleInvite} className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="email@example.com"
              required
              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 text-sm"
            >
              <option value="viewer">Viewer</option>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="submit"
              disabled={inviteLoading}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              {inviteLoading ? "Sending…" : "Invite"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

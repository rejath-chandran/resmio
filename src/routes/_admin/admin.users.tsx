import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import {
	adminDeleteResume,
	deleteUser,
	listUserResumes,
	listUsers,
	setUserRole,
} from "#/lib/admin-functions";
import { Problem } from "./admin.index";

export const Route = createFileRoute("/_admin/admin/users")({
	component: AdminUsers,
});

function AdminUsers() {
	const queryClient = useQueryClient();
	const [q, setQ] = useState("");
	const [page, setPage] = useState(0);
	const [expanded, setExpanded] = useState<string | null>(null);

	const { data, isPending, error } = useQuery({
		queryKey: ["admin", "users", q, page],
		queryFn: () => listUsers({ data: { q, page } }),
	});

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ["admin"] });

	const role = useMutation({
		mutationFn: (v: { id: string; role: "user" | "admin" }) =>
			setUserRole({ data: v }),
		onSuccess: invalidate,
	});
	const remove = useMutation({
		mutationFn: (id: string) => deleteUser({ data: id }),
		onSuccess: invalidate,
	});

	if (error) return <Problem error={error} />;

	const pages = data ? Math.ceil(data.total / data.pageSize) : 0;
	const failure = role.error ?? remove.error;

	return (
		<main className="mx-auto max-w-6xl px-6 py-10">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<h1 className="font-display text-2xl font-bold tracking-tight text-white">
						Users
					</h1>
					<p className="mt-1 text-sm text-neutral-400">
						{data ? `${data.total} total` : "…"} · resume titles only, never
						contents
					</p>
				</div>
				<input
					className="input w-64"
					placeholder="Search name or email"
					value={q}
					onChange={(e) => {
						setQ(e.target.value);
						setPage(0);
					}}
					aria-label="Search users"
				/>
			</div>

			{failure && (
				<p className="mt-4 text-sm text-red-400" role="alert">
					{failure instanceof Error ? failure.message : String(failure)}
				</p>
			)}

			<div className="card mt-6 overflow-hidden">
				<table className="w-full text-left text-sm">
					<thead className="border-b border-neutral-800 text-xs tracking-widest text-neutral-500 uppercase">
						<tr>
							<th className="px-4 py-3 font-medium">User</th>
							<th className="px-4 py-3 font-medium">Role</th>
							<th className="px-4 py-3 font-medium">Resumes</th>
							<th className="px-4 py-3 font-medium">Joined</th>
							<th className="px-4 py-3 font-medium">Actions</th>
						</tr>
					</thead>
					<tbody>
						{isPending && (
							<tr>
								<td colSpan={5} className="px-4 py-8 text-neutral-500">
									…
								</td>
							</tr>
						)}
						{data?.users.length === 0 && (
							<tr>
								<td colSpan={5} className="px-4 py-8 text-neutral-500">
									No users match “{q}”.
								</td>
							</tr>
						)}
						{data?.users.map((u) => (
							<Row
								key={u.id}
								user={u}
								expanded={expanded === u.id}
								onToggle={() => setExpanded(expanded === u.id ? null : u.id)}
								onRole={(next) => role.mutate({ id: u.id, role: next })}
								onDelete={() => {
									if (
										window.confirm(
											`Delete ${u.email} and all their resumes? This cannot be undone.`,
										)
									)
										remove.mutate(u.id);
								}}
							/>
						))}
					</tbody>
				</table>
			</div>

			{pages > 1 && (
				<div className="mt-4 flex items-center gap-3 text-sm text-neutral-400">
					<button
						type="button"
						className="btn-ghost"
						disabled={page === 0}
						onClick={() => setPage(page - 1)}
					>
						← Prev
					</button>
					<span>
						Page {page + 1} of {pages}
					</span>
					<button
						type="button"
						className="btn-ghost"
						disabled={page + 1 >= pages}
						onClick={() => setPage(page + 1)}
					>
						Next →
					</button>
				</div>
			)}
		</main>
	);
}

type UserRow = {
	id: string;
	name: string;
	email: string;
	role: string;
	createdAt: number;
	resumeCount: number;
};

function Row({
	user,
	expanded,
	onToggle,
	onRole,
	onDelete,
}: {
	user: UserRow;
	expanded: boolean;
	onToggle: () => void;
	onRole: (role: "user" | "admin") => void;
	onDelete: () => void;
}) {
	return (
		<>
			<tr className="border-b border-neutral-800/60 last:border-0">
				<td className="px-4 py-3">
					<p className="text-white">{user.name || "—"}</p>
					<p className="text-xs text-neutral-500">{user.email}</p>
				</td>
				<td className="px-4 py-3">
					<select
						className="input w-auto py-1"
						value={user.role}
						onChange={(e) => onRole(e.target.value as "user" | "admin")}
						aria-label={`Role for ${user.email}`}
					>
						<option value="user">user</option>
						<option value="admin">admin</option>
					</select>
				</td>
				<td className="px-4 py-3">
					{user.resumeCount > 0 ? (
						<button type="button" onClick={onToggle} className="btn-ghost">
							{user.resumeCount} {expanded ? "▲" : "▼"}
						</button>
					) : (
						<span className="text-neutral-600">0</span>
					)}
				</td>
				<td className="px-4 py-3 text-neutral-400">
					{new Date(user.createdAt).toLocaleDateString()}
				</td>
				<td className="px-4 py-3">
					<button
						type="button"
						onClick={onDelete}
						className="btn-ghost hover:text-red-400"
					>
						Delete
					</button>
				</td>
			</tr>
			{expanded && (
				<tr className="border-b border-neutral-800/60">
					<td colSpan={5} className="bg-neutral-950/60 px-4 py-3">
						<UserResumes userId={user.id} />
					</td>
				</tr>
			)}
		</>
	);
}

function UserResumes({ userId }: { userId: string }) {
	const queryClient = useQueryClient();
	const { data, isPending } = useQuery({
		queryKey: ["admin", "user-resumes", userId],
		queryFn: () => listUserResumes({ data: userId }),
	});
	const del = useMutation({
		mutationFn: (id: string) => adminDeleteResume({ data: id }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin"] }),
	});

	if (isPending) return <p className="text-xs text-neutral-500">…</p>;
	return (
		<ul className="space-y-1.5">
			{data?.map((r) => (
				<li key={r.id} className="flex items-center gap-3 text-xs">
					<span className="text-neutral-300">{r.title}</span>
					<span className="text-neutral-600">{r.template}</span>
					<span className="text-neutral-600">
						{new Date(r.updatedAt).toLocaleDateString()}
					</span>
					<button
						type="button"
						className="btn-ghost ml-auto hover:text-red-400"
						onClick={() => {
							if (window.confirm(`Delete resume “${r.title}”?`))
								del.mutate(r.id);
						}}
					>
						Delete
					</button>
				</li>
			))}
		</ul>
	);
}

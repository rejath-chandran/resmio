import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { getBillingState } from "#/lib/billing-functions";
import {
	checkSubdomain,
	deleteSite,
	listSites,
	publishSite,
} from "#/lib/sites-functions";
import {
	ALLOWED_EXT,
	MAX_SITE_BYTES,
	MAX_SITE_FILES,
	rootPrefix,
	subdomainError,
} from "#/lib/sites-shared";

export const Route = createFileRoute("/_authenticated/dashboard/sites")({
	component: SitesPage,
});

type Upload = { path: string; data: string; size: number };

const BASE_DOMAIN = "resmio.in";
const ACCEPT = [...ALLOWED_EXT].join(",");

/** Chunked base64 of a byte array — one uniform encoding for text + binary files. */
function bytesToBase64(bytes: Uint8Array): string {
	let bin = "";
	const CH = 0x8000;
	for (let i = 0; i < bytes.length; i += CH)
		bin += String.fromCharCode(...bytes.subarray(i, i + CH));
	return btoa(bin);
}

function extOf(name: string): string {
	const i = name.lastIndexOf(".");
	return i >= 0 ? name.slice(i).toLowerCase() : "";
}

type PickedFile = { path: string; file: File };

/** Recursively read a webkit FileSystemEntry (dropped folder) into {path, file} pairs. */
async function readEntry(
	// biome-ignore lint/suspicious/noExplicitAny: FileSystem* entry types aren't in lib.dom
	entry: any,
	prefix: string,
	out: PickedFile[],
): Promise<void> {
	if (entry.isFile) {
		const file: File = await new Promise((res, rej) => entry.file(res, rej));
		out.push({ path: prefix + entry.name, file });
		return;
	}
	if (entry.isDirectory) {
		const reader = entry.createReader();
		// biome-ignore lint/suspicious/noExplicitAny: same untyped entries API
		const batch = (): Promise<any[]> =>
			new Promise((res, rej) => reader.readEntries(res, rej));
		let kids = await batch();
		while (kids.length) {
			for (const k of kids) await readEntry(k, `${prefix}${entry.name}/`, out);
			kids = await batch(); // readEntries pages; loop until empty
		}
	}
}

/** {path, file} from a drop, preserving folder structure when the browser exposes it. */
async function pickedFromDrop(dt: DataTransfer): Promise<PickedFile[]> {
	const entries = Array.from(dt.items)
		.filter((i) => i.kind === "file")
		// biome-ignore lint/suspicious/noExplicitAny: webkitGetAsEntry not in lib.dom
		.map((i) => (i as any).webkitGetAsEntry?.())
		.filter(Boolean);
	if (entries.length) {
		const out: PickedFile[] = [];
		for (const e of entries) await readEntry(e, "", out);
		return out;
	}
	return Array.from(dt.files).map((f) => ({ path: f.name, file: f })); // fallback
}

/** {path, file} from an <input>, using webkitRelativePath for folder pickers. */
function pickedFromInput(list: FileList): PickedFile[] {
	return Array.from(list).map((f) => ({
		path: (f as { webkitRelativePath?: string }).webkitRelativePath || f.name,
		file: f,
	}));
}

function SitesPage() {
	const { data: billing, isPending: billingPending } = useQuery({
		queryKey: ["billing"],
		queryFn: () => getBillingState(),
	});

	if (billingPending)
		return (
			<main className="mx-auto max-w-3xl px-6 py-12">
				<p className="text-neutral-500">…</p>
			</main>
		);

	return (
		<main className="mx-auto max-w-3xl px-6 py-12">
			<Link to="/dashboard" className="btn-ghost">
				← Dashboard
			</Link>
			<h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-white">
				Portfolio hosting
			</h1>
			<p className="mt-2 text-sm text-neutral-400">
				Drop your portfolio files — or a whole <code>build/</code> folder
				(React, Vite, etc.) — and go live at{" "}
				<code>your-name.{BASE_DOMAIN}</code> with automatic HTTPS. An{" "}
				<code>index.html</code> is required.
			</p>

			{billing?.pro ? <Publisher /> : <LockedCard />}
		</main>
	);
}

function Publisher() {
	const qc = useQueryClient();
	const [files, setFiles] = useState<Upload[]>([]);
	const [subdomain, setSubdomain] = useState("");
	const [title, setTitle] = useState("");
	const [fileErr, setFileErr] = useState("");

	const formatErr = subdomain ? subdomainError(subdomain) : null;

	// Debounced availability check (skips when the format is already invalid).
	const [debounced, setDebounced] = useState("");
	useEffect(() => {
		const t = setTimeout(() => setDebounced(subdomain), 350);
		return () => clearTimeout(t);
	}, [subdomain]);
	const avail = useQuery({
		queryKey: ["subdomain", debounced],
		queryFn: () => checkSubdomain({ data: { subdomain: debounced } }),
		enabled: Boolean(debounced) && !subdomainError(debounced),
	});

	const totalBytes = useMemo(
		() => files.reduce((n, f) => n + f.size, 0),
		[files],
	);
	const hasIndex = files.some((f) => f.path === "index.html");

	async function addPicked(picked: PickedFile[]) {
		setFileErr("");
		if (!picked.length) return;
		// Normalise separators + strip leading slashes, then rebase a build/ or dist/
		// folder so its index.html becomes the site root.
		const norm = picked.map((p) => ({
			...p,
			path: p.path.replace(/\\/g, "/").replace(/^\/+/, ""),
		}));
		const prefix = rootPrefix(norm.map((p) => p.path));
		const rebased = prefix
			? norm
					.filter((p) => p.path.startsWith(prefix))
					.map((p) => ({ ...p, path: p.path.slice(prefix.length) }))
			: norm;

		const next = new Map(files.map((f) => [f.path, f]));
		const rejected: string[] = [];
		for (const p of rebased) {
			if (!ALLOWED_EXT.has(extOf(p.path))) {
				rejected.push(p.path);
				continue;
			}
			const bytes = new Uint8Array(await p.file.arrayBuffer());
			next.set(p.path, {
				path: p.path,
				data: bytesToBase64(bytes),
				size: bytes.length,
			});
		}
		const merged = [...next.values()].slice(0, MAX_SITE_FILES);
		setFiles(merged);
		if (rejected.length)
			setFileErr(
				`Skipped unsupported file(s): ${rejected.slice(0, 5).join(", ")}${
					rejected.length > 5 ? `, +${rejected.length - 5} more` : ""
				}`,
			);
	}

	const publish = useMutation({
		mutationFn: () => publishSite({ data: { subdomain, title, files } }),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["sites"] }),
	});

	const overSize = totalBytes > MAX_SITE_BYTES;
	const canPublish =
		files.length > 0 &&
		hasIndex &&
		!overSize &&
		Boolean(subdomain) &&
		!formatErr &&
		avail.data?.available !== false &&
		!publish.isPending;

	return (
		<div className="mt-6 space-y-4">
			<div className="card p-4 sm:p-6">
				<DropZone onPicked={addPicked} accept={ACCEPT} />
				{fileErr && <p className="mt-2 text-xs text-amber-400">{fileErr}</p>}

				{files.length > 0 && (
					<ul className="mt-4 space-y-1 text-sm">
						{files.map((f) => (
							<li
								key={f.path}
								className="flex items-center justify-between gap-3 border-b border-neutral-800/60 py-1"
							>
								<span className="truncate text-neutral-200">
									{f.path === "index.html" ? "🏠 " : "📄 "}
									{f.path}
								</span>
								<span className="flex shrink-0 items-center gap-3">
									<span className="text-xs text-neutral-500">
										{(f.size / 1024).toFixed(1)} KB
									</span>
									<button
										type="button"
										className="text-neutral-500 hover:text-red-400"
										aria-label={`Remove ${f.path}`}
										onClick={() =>
											setFiles(files.filter((x) => x.path !== f.path))
										}
									>
										✕
									</button>
								</span>
							</li>
						))}
					</ul>
				)}
				{files.length > 0 && (
					<p className="mt-2 text-xs text-neutral-500">
						{files.length} file(s) · {(totalBytes / 1024).toFixed(0)} KB
						{!hasIndex && (
							<span className="ml-2 text-amber-400">index.html required</span>
						)}
						{overSize && (
							<span className="ml-2 text-red-400">over 20 MB limit</span>
						)}
					</p>
				)}

				<div className="mt-5 grid gap-4 sm:grid-cols-2">
					<label className="block text-sm font-medium text-neutral-300">
						Subdomain
						<div className="mt-1.5 flex items-center">
							<input
								className="input w-full rounded-r-none"
								placeholder="your-name"
								value={subdomain}
								onChange={(e) =>
									setSubdomain(e.target.value.trim().toLowerCase())
								}
							/>
							<span className="shrink-0 rounded-r-md border border-l-0 border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-400">
								.{BASE_DOMAIN}
							</span>
						</div>
						<SubdomainHint
							subdomain={subdomain}
							formatErr={formatErr}
							checking={avail.isFetching}
							available={avail.data?.available}
							availErr={avail.data?.error ?? null}
						/>
					</label>
					<label className="block text-sm font-medium text-neutral-300">
						Title (optional)
						<input
							className="input mt-1.5 w-full"
							placeholder="My portfolio"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
						/>
					</label>
				</div>

				<button
					type="button"
					className="btn-primary mt-5 w-full sm:w-auto"
					disabled={!canPublish}
					onClick={() => publish.mutate()}
				>
					{publish.isPending ? "Publishing…" : "Publish site"}
				</button>

				{publish.error && (
					<p className="mt-3 text-sm text-red-400" role="alert">
						{publish.error instanceof Error
							? publish.error.message
							: "Publish failed."}
					</p>
				)}
				{publish.data?.configured === false && (
					<p className="mt-3 text-sm text-amber-400">
						Hosting isn't configured on this environment yet.
					</p>
				)}
				{publish.data?.configured === true && (
					<p className="mt-3 text-sm text-brand-300">
						Live at{" "}
						<a
							href={publish.data.url}
							target="_blank"
							rel="noopener noreferrer"
							className="underline"
						>
							{publish.data.url} ↗
						</a>
					</p>
				)}
			</div>

			<SiteList />
		</div>
	);
}

function DropZone({
	onPicked,
	accept,
}: {
	onPicked: (files: PickedFile[]) => void;
	accept: string;
}) {
	const [dragging, setDragging] = useState(false);
	const fileRef = useRef<HTMLInputElement>(null);
	const folderRef = useRef<HTMLInputElement>(null);

	// webkitdirectory/directory aren't typed on HTMLInputElement — set via attribute.
	useEffect(() => {
		const el = folderRef.current;
		if (el) {
			el.setAttribute("webkitdirectory", "");
			el.setAttribute("directory", "");
		}
	}, []);

	return (
		<>
			{/** biome-ignore lint/a11y/noStaticElementInteractions: drop target wraps real file inputs + buttons */}
			<div
				onDragOver={(e) => {
					e.preventDefault();
					setDragging(true);
				}}
				onDragLeave={() => setDragging(false)}
				onDrop={(e) => {
					e.preventDefault();
					setDragging(false);
					pickedFromDrop(e.dataTransfer).then(onPicked);
				}}
				className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
					dragging
						? "border-brand-500 bg-brand-500/5"
						: "border-neutral-700 hover:border-neutral-600"
				}`}
			>
				<p className="text-sm text-neutral-300">
					Drag your site files or a whole folder here
				</p>
				<div className="mt-2 flex items-center gap-2">
					<button
						type="button"
						className="btn-secondary text-xs"
						onClick={() => fileRef.current?.click()}
					>
						Browse files
					</button>
					<button
						type="button"
						className="btn-secondary text-xs"
						onClick={() => folderRef.current?.click()}
					>
						Upload folder
					</button>
				</div>
				<p className="mt-2 text-xs text-neutral-600">
					index.html + assets, or a build/ folder · max {MAX_SITE_FILES} files,
					20 MB
				</p>
				<input
					ref={fileRef}
					type="file"
					multiple
					accept={accept}
					className="hidden"
					onChange={(e) => {
						if (e.target.files) onPicked(pickedFromInput(e.target.files));
						e.target.value = "";
					}}
				/>
				<input
					ref={folderRef}
					type="file"
					multiple
					className="hidden"
					onChange={(e) => {
						if (e.target.files) onPicked(pickedFromInput(e.target.files));
						e.target.value = "";
					}}
				/>
			</div>
		</>
	);
}

function SubdomainHint({
	subdomain,
	formatErr,
	checking,
	available,
	availErr,
}: {
	subdomain: string;
	formatErr: string | null;
	checking: boolean;
	available?: boolean;
	availErr: string | null;
}) {
	if (!subdomain) return null;
	if (formatErr)
		return <p className="mt-1 text-xs text-red-400">{formatErr}</p>;
	if (checking)
		return <p className="mt-1 text-xs text-neutral-500">Checking…</p>;
	if (available === false)
		return <p className="mt-1 text-xs text-red-400">{availErr}</p>;
	if (available)
		return <p className="mt-1 text-xs text-brand-400">Available ✓</p>;
	return null;
}

function SiteList() {
	const qc = useQueryClient();
	const { data: sites = [], isPending } = useQuery({
		queryKey: ["sites"],
		queryFn: listSites,
	});
	const del = useMutation({
		mutationFn: (id: string) => deleteSite({ data: { id } }),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["sites"] }),
	});

	if (isPending) return null;
	if (sites.length === 0) return null;

	return (
		<section>
			<h2 className="section-title">Your sites</h2>
			<ul className="mt-3 space-y-2">
				{sites.map((s) => (
					<li
						key={s.id}
						className="card flex items-center justify-between gap-4 p-4"
					>
						<div className="min-w-0">
							<a
								href={s.url}
								target="_blank"
								rel="noopener noreferrer"
								className="truncate font-medium text-brand-300 hover:text-brand-200"
							>
								{s.subdomain}.{BASE_DOMAIN} ↗
							</a>
							<p className="truncate text-xs text-neutral-500">
								{s.title ? `${s.title} · ` : ""}
								{s.fileCount} file(s) · {(s.sizeBytes / 1024).toFixed(0)} KB
								{s.status !== "live" ? ` · ${s.status}` : ""}
							</p>
						</div>
						<button
							type="button"
							className="btn-secondary shrink-0"
							disabled={del.isPending}
							onClick={() => {
								if (confirm(`Delete ${s.subdomain}.${BASE_DOMAIN}?`))
									del.mutate(s.id);
							}}
						>
							Delete
						</button>
					</li>
				))}
			</ul>
		</section>
	);
}

function LockedCard() {
	return (
		<div className="card mt-6 p-6 text-center">
			<div className="text-2xl">🔒</div>
			<h2 className="mt-2 font-semibold text-white">
				Portfolio hosting is a Pro feature
			</h2>
			<p className="mx-auto mt-2 max-w-md text-sm text-neutral-400">
				Upgrade to publish your portfolio to a live <code>.{BASE_DOMAIN}</code>{" "}
				address with automatic HTTPS.
			</p>
			<Link to="/dashboard/billing" className="btn-primary mt-5 inline-flex">
				Upgrade to Pro
			</Link>
		</div>
	);
}

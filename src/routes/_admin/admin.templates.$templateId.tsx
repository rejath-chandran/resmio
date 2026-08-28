import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { LAYOUT_IDS } from "#/components/resume-preview/layouts";
import { ResumeSheet } from "#/components/resume-preview/templates";
import {
	createTemplate,
	listAllTemplates,
	updateTemplate,
} from "#/lib/admin-functions";
import { SAMPLE_RESUME } from "#/lib/sample-resume";
import { DEFAULT_THEME, type TemplateTheme } from "#/lib/templates";
import { Problem } from "./admin.index";

export const Route = createFileRoute("/_admin/admin/templates/$templateId")({
	component: TemplateEditor,
});

type Draft = {
	id: string;
	name: string;
	description: string;
	layout: string;
	theme: TemplateTheme;
	isActive: boolean;
	isPro: boolean;
	sortOrder: number;
};

const BLANK: Draft = {
	id: "",
	name: "",
	description: "",
	layout: "modern",
	theme: DEFAULT_THEME,
	isActive: true,
	isPro: false,
	sortOrder: 100,
};

function TemplateEditor() {
	const { templateId } = Route.useParams();
	const isNew = templateId === "new";
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	// The list is already cached by the templates page; reusing it avoids a
	// getTemplate server fn that would exist for this screen alone.
	const {
		data: all,
		isPending,
		error,
	} = useQuery({
		queryKey: ["admin", "templates"],
		queryFn: () => listAllTemplates(),
	});

	const existing = all?.find((t) => t.id === templateId);
	const [draft, setDraft] = useState<Draft | null>(null);
	const current: Draft = draft ?? (isNew ? BLANK : (existing ?? BLANK));
	const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
		setDraft({ ...current, [key]: value });

	const save = useMutation({
		mutationFn: async (d: Draft) => {
			if (isNew) await createTemplate({ data: d });
			else await updateTemplate({ data: d });
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["admin"] });
			await queryClient.invalidateQueries({ queryKey: ["templates"] });
			await navigate({ to: "/admin/templates" });
		},
	});

	if (error) return <Problem error={error} />;
	if (isPending) return <main className="p-10 text-neutral-500">…</main>;
	if (!isNew && !existing) {
		return <Problem error={new Error(`No template “${templateId}”`)} />;
	}

	return (
		<main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10 lg:flex-row">
			<form
				className="w-full max-w-md space-y-4"
				onSubmit={(e) => {
					e.preventDefault();
					save.mutate(current);
				}}
			>
				<h1 className="font-display text-2xl font-bold tracking-tight text-white">
					{isNew ? "New template" : current.name}
				</h1>

				<div>
					<label className="label" htmlFor="t-id">
						Id
					</label>
					<input
						id="t-id"
						className="input"
						value={current.id}
						disabled={!isNew}
						required
						placeholder="nordic-slate"
						onChange={(e) => set("id", e.target.value)}
					/>
					<p className="mt-1 text-xs text-neutral-600">
						{isNew
							? "Lowercase letters, digits and dashes. Permanent — resumes store it."
							: "Ids are permanent: resumes reference them."}
					</p>
				</div>

				<div>
					<label className="label" htmlFor="t-name">
						Name
					</label>
					<input
						id="t-name"
						className="input"
						value={current.name}
						required
						maxLength={60}
						onChange={(e) => set("name", e.target.value)}
					/>
				</div>

				<div>
					<label className="label" htmlFor="t-desc">
						Description
					</label>
					<input
						id="t-desc"
						className="input"
						value={current.description}
						maxLength={200}
						onChange={(e) => set("description", e.target.value)}
					/>
				</div>

				<div>
					<label className="label" htmlFor="t-layout">
						Layout
					</label>
					<select
						id="t-layout"
						className="input"
						value={current.layout}
						onChange={(e) => set("layout", e.target.value)}
					>
						{LAYOUT_IDS.map((id) => (
							<option key={id} value={id}>
								{id}
							</option>
						))}
					</select>
				</div>

				<fieldset className="grid grid-cols-2 gap-4">
					<legend className="label">Theme</legend>
					<Colour
						id="t-accent"
						label="Accent"
						value={current.theme.accent}
						onChange={(accent) => set("theme", { ...current.theme, accent })}
					/>
					<Colour
						id="t-ink"
						label="Ink"
						value={current.theme.ink}
						onChange={(ink) => set("theme", { ...current.theme, ink })}
					/>
					<div>
						<label className="label" htmlFor="t-font">
							Font
						</label>
						<select
							id="t-font"
							className="input"
							value={current.theme.font}
							onChange={(e) =>
								set("theme", {
									...current.theme,
									font: e.target.value as TemplateTheme["font"],
								})
							}
						>
							<option value="sans">sans</option>
							<option value="serif">serif</option>
						</select>
					</div>
					<div>
						<label className="label" htmlFor="t-density">
							Density
						</label>
						<select
							id="t-density"
							className="input"
							value={current.theme.density}
							onChange={(e) =>
								set("theme", {
									...current.theme,
									density: e.target.value as TemplateTheme["density"],
								})
							}
						>
							<option value="tight">tight</option>
							<option value="normal">normal</option>
							<option value="airy">airy</option>
						</select>
					</div>
				</fieldset>

				<div className="flex flex-wrap items-center gap-5">
					<Toggle
						id="t-active"
						label="Active"
						checked={current.isActive}
						onChange={(v) => set("isActive", v)}
					/>
					<Toggle
						id="t-pro"
						label="Pro only"
						checked={current.isPro}
						onChange={(v) => set("isPro", v)}
					/>
					<div className="flex items-center gap-2">
						<label className="label mb-0" htmlFor="t-sort">
							Sort
						</label>
						<input
							id="t-sort"
							type="number"
							className="input w-20"
							value={current.sortOrder}
							onChange={(e) => set("sortOrder", Number(e.target.value))}
						/>
					</div>
				</div>

				{save.error && (
					<p className="text-sm text-red-400" role="alert">
						{save.error instanceof Error
							? save.error.message
							: String(save.error)}
					</p>
				)}

				<div className="flex gap-3 pt-2">
					<button
						type="submit"
						className="btn-primary"
						disabled={save.isPending}
					>
						{save.isPending ? "Saving…" : isNew ? "Create" : "Save"}
					</button>
					<button
						type="button"
						className="btn-secondary"
						onClick={() => navigate({ to: "/admin/templates" })}
					>
						Cancel
					</button>
				</div>
			</form>

			<div className="flex-1">
				<p className="mb-3 text-xs tracking-widest text-neutral-500 uppercase">
					Live preview
				</p>
				<div className="origin-top-left scale-[0.62]">
					<div className="resume-sheet">
						<ResumeSheet
							data={SAMPLE_RESUME}
							layout={current.layout}
							theme={current.theme}
							presentLabel="Present"
						/>
					</div>
				</div>
			</div>
		</main>
	);
}

function Colour({
	id,
	label,
	value,
	onChange,
}: {
	id: string;
	label: string;
	value: string;
	onChange: (v: string) => void;
}) {
	return (
		<div>
			<label className="label" htmlFor={id}>
				{label}
			</label>
			<div className="flex items-center gap-2">
				<input
					id={id}
					type="color"
					className="h-9 w-10 rounded border border-neutral-700 bg-neutral-900"
					value={value}
					onChange={(e) => onChange(e.target.value)}
				/>
				<input
					className="input font-mono"
					value={value}
					aria-label={`${label} hex`}
					onChange={(e) => onChange(e.target.value)}
				/>
			</div>
		</div>
	);
}

function Toggle({
	id,
	label,
	checked,
	onChange,
}: {
	id: string;
	label: string;
	checked: boolean;
	onChange: (v: boolean) => void;
}) {
	return (
		<label
			className="flex items-center gap-2 text-sm text-neutral-300"
			htmlFor={id}
		>
			<input
				id={id}
				type="checkbox"
				checked={checked}
				onChange={(e) => onChange(e.target.checked)}
				className="h-4 w-4 accent-brand-500"
			/>
			{label}
		</label>
	);
}

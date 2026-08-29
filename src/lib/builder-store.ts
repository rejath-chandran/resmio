import { create } from "zustand";

import type { ResumeData } from "#/lib/resume-schema";

type SaveStatus = "idle" | "dirty" | "saving" | "saved";

type BuilderState = {
	resumeId: string;
	title: string;
	template: string;
	data: ResumeData;
	status: SaveStatus;
	/** Milliseconds remaining on the autosave debounce, for tests/introspection. */
	load: (r: {
		id: string;
		title: string;
		template: string;
		data: ResumeData;
	}) => void;
	setTitle: (title: string) => void;
	setTemplate: (template: string) => void;
	update: (fn: (draft: ResumeData) => void) => void;
};

let saveTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Marks the resume dirty and schedules a debounced persist (800ms).
 * `persist` is injected by the builder route so the store stays UI-only.
 */
let persist: ((state: BuilderState) => Promise<void>) | null = null;

export function setPersister(fn: (state: BuilderState) => Promise<void>) {
	persist = fn;
}

function markDirty(set: (partial: Partial<BuilderState>) => void) {
	set({ status: "dirty" });
	clearTimeout(saveTimer);
	saveTimer = setTimeout(() => {
		const state = useBuilderStore.getState();
		if (state.status !== "dirty" || !persist) return;
		set({ status: "saving" });
		void persist(useBuilderStore.getState()).then(() => {
			if (useBuilderStore.getState().status === "saving")
				useBuilderStore.setState({ status: "saved" });
		});
	}, 800);
}

export const useBuilderStore = create<BuilderState>((set) => ({
	resumeId: "",
	title: "",
	template: "modern",
	data: {
		basics: {
			fullName: "",
			email: "",
			phone: "",
			location: "",
			website: "",
			summary: "",
		},
		experience: [],
		education: [],
		projects: [],
		links: [],
		skills: [],
	},
	status: "idle",
	load: (r) => {
		clearTimeout(saveTimer);
		set({
			resumeId: r.id,
			title: r.title,
			template: r.template,
			data: r.data,
			status: "idle",
		});
	},
	setTitle: (title) => {
		set({ title: title.slice(0, 120) });
		markDirty(set);
	},
	setTemplate: (template) => {
		set({ template });
		markDirty(set);
	},
	/** Structured update: mutate a shallow-cloned draft (structuredClone) via fn. */
	update: (fn) => {
		const draft = structuredClone(useBuilderStore.getState().data);
		fn(draft);
		set({ data: draft });
		markDirty(set);
	},
}));

// Offline self-check for the pure job-match helpers (no network/db/deps).
// Run: npx tsx ./jobs.check.mjs
import assert from "node:assert/strict";

import { applyRerank, parseRerankOrder, vecLiteral } from "#/lib/jobs-rerank";

// vecLiteral: matches worker/db.py `_vec` format (6 dp, no spaces).
assert.equal(vecLiteral([0.1, -0.2, 1]), "[0.100000,-0.200000,1.000000]");

// parseRerankOrder: extracts a JSON array, drops out-of-range/dupes, tolerates prose.
assert.deepEqual(parseRerankOrder("Best order: [2,0,1]", 3), [2, 0, 1]);
assert.deepEqual(parseRerankOrder("[0,0,5,1]", 3), [0, 1]); // dedupe + drop OOB
assert.deepEqual(parseRerankOrder("no json here", 3), []);
assert.deepEqual(parseRerankOrder("[]", 3), []);

// applyRerank: reorders by indices; omitted jobs keep order at the end; never drops.
const jobs = [{ id: "a" }, { id: "b" }, { id: "c" }].map((j) => ({
	...j,
	title: "",
	company: "",
	location: "",
	remote: false,
	url: "",
	postedAt: null,
	score: 0,
}));
assert.deepEqual(
	applyRerank(jobs, [2, 0]).map((j) => j.id),
	["c", "a", "b"],
);
assert.deepEqual(
	applyRerank(jobs, []).map((j) => j.id),
	["a", "b", "c"],
);

console.log("PASS jobs.check — vecLiteral + rerank parse/apply");

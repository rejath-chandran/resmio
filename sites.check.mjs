// Offline checks for the portfolio-hosting pure helpers. Run: npx tsx ./sites.check.mjs
import assert from "node:assert/strict";

import {
	ALLOWED_EXT,
	rootPrefix,
	safeRelPath,
	subdomainError,
} from "#/lib/sites-shared";

// subdomainError
assert.equal(subdomainError("my-portfolio"), null);
assert.equal(subdomainError("ab"), // too short
	"3–63 chars: lowercase letters, numbers and hyphens (not at the ends).");
assert.equal(subdomainError("-x"), // leading hyphen
	"3–63 chars: lowercase letters, numbers and hyphens (not at the ends).");
assert.equal(subdomainError("app"), "That name is reserved.");
assert.equal(subdomainError(""), "Enter a subdomain.");
assert.equal(subdomainError("Good-One".toLowerCase()), null);

// safeRelPath
assert.equal(safeRelPath("index.html"), "index.html");
assert.equal(safeRelPath("css/site.css"), "css/site.css");
assert.equal(safeRelPath("/logo.png"), "logo.png"); // leading slash -> root-relative
assert.equal(safeRelPath("../../etc/passwd"), null);
assert.equal(safeRelPath("a/../b.html"), null);
assert.equal(safeRelPath("script.php"), null); // ext not allowed
assert.equal(safeRelPath(".env"), null);

assert.ok(ALLOWED_EXT.has(".html") && ALLOWED_EXT.has(".woff2"));

// rootPrefix — rebase a dropped build/ or dist/ folder to its index.html
assert.equal(rootPrefix(["index.html", "app.js"]), null); // already rooted
assert.equal(
	rootPrefix(["build/index.html", "build/assets/a.js"]),
	"build/",
);
assert.equal(
	rootPrefix(["dist/index.html", "dist/assets/x.css"]),
	"dist/",
);
assert.equal(rootPrefix(["assets/a.js", "readme.txt"]), null); // no index.html
// prefers the shallowest index.html when several exist
assert.equal(
	rootPrefix(["outer/index.html", "outer/sub/index.html"]),
	"outer/",
);

console.log("sites.check PASS");

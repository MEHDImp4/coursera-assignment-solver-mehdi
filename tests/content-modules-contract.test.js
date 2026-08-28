const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const adapterSource = fs.readFileSync(path.join(root, "content-adapters.js"), "utf8");

const expectedContentScripts = [
  "course-requirements.js",
  "assessment-parser.js",
  "coursera-api.js",
  "content.js",
  "content-adapters.js"
];

test("loads extracted modules before legacy content and the adapter after it", () => {
  const isolatedWorld = manifest.content_scripts.find((entry) => !entry.world);
  assert.ok(isolatedWorld);
  assert.deepEqual(isolatedWorld.js, expectedContentScripts);
});

test("all extracted module files exist and are valid JavaScript", () => {
  for (const filename of expectedContentScripts.filter((name) => name !== "content.js")) {
    const source = fs.readFileSync(path.join(root, filename), "utf8");
    assert.doesNotThrow(() => new Function(source), `${filename} must parse as JavaScript`);
  }
});

test("pure extracted modules do not perform Chrome messaging or DOM mutation actions", () => {
  for (const filename of ["course-requirements.js", "assessment-parser.js", "coursera-api.js"]) {
    const source = fs.readFileSync(path.join(root, filename), "utf8");
    assert.doesNotMatch(source, /chrome\.runtime|\.click\(\)|execCommand|dispatchEvent/);
  }
});

test("adapter documents progressive extraction and exposes parser diagnostics", () => {
  assert.match(adapterSource, /progressive-extraction/);
  assert.match(adapterSource, /getParserDiagnostics/);
  assert.match(adapterSource, /CourseRequirementsKit/);
  assert.match(adapterSource, /AssessmentParserKit/);
  assert.match(adapterSource, /CourseraApiKit/);
});

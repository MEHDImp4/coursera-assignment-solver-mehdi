const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const contentSource = fs.readFileSync(path.join(root, "content.js"), "utf8");
const adapterSource = fs.readFileSync(path.join(root, "content-adapters.js"), "utf8");

test("content delegates covered read-only helpers to CourseraReadRuntime", () => {
  assert.match(contentSource, /function readRuntime\(\)/);
  assert.match(contentSource, /globalThis\.CourseraReadRuntime/);
  assert.match(contentSource, /return readRuntime\(\)\.getCurrentCourseSlug\(\);/);
  assert.match(contentSource, /return readRuntime\(\)\.loadCourseMaterials\(\);/);
  assert.match(contentSource, /return readRuntime\(\)\.normalizeCourseRequirements\(materials, courseSlug\);/);
  assert.match(contentSource, /return readRuntime\(\)\.assessmentQuestionBlocks\(\);/);
  assert.match(contentSource, /return readRuntime\(\)\.codeEditorDescriptor\(block\);/);
  assert.match(contentSource, /return readRuntime\(\)\.scrapeAssessmentDetailed\(\);/);
});

test("duplicated read-only implementations do not return to content.js", () => {
  const removedMarkers = [
    "function linkedCourseCollection(",
    "function requirementRoute(",
    "function courseItemType(",
    "function courseItemIsLocked(",
    "function itemIdFromPassable(",
    "showLockedItems",
    "const semanticBlocks = Array.from(document.querySelectorAll"
  ];

  for (const marker of removedMarkers) {
    assert.ok(!contentSource.includes(marker), `content.js must not restore legacy marker: ${marker}`);
  }
});

test("adapter exposes a stable read runtime instead of reassigning legacy helpers", () => {
  assert.match(adapterSource, /globalThis\.CourseraReadRuntime = Object\.freeze\(/);
  assert.match(adapterSource, /normalizeCourseRequirements: requirements\.normalizeCourseRequirements/);
  assert.match(adapterSource, /assessmentQuestionBlocks\(\)/);
  assert.match(adapterSource, /codeEditorDescriptor: monaco\.describeCodeEditor/);

  const legacyAssignments = /(?:^|\n)\s*(?:normalizeCourseRequirements|getCurrentCourseSlug|codeEditorDescriptor|assessmentQuestionBlocks|loadCourseMaterials|scrapeAssessmentDetailed)\s*=/m;
  assert.doesNotMatch(adapterSource, legacyAssignments);
});

test("write-side integration remains outside this read-only cleanup", () => {
  assert.match(contentSource, /function requestMonacoBridge\(action, payload = \{\}\)/);
});

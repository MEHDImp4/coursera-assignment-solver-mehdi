const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const harnessPath = path.join(root, "tests/browser/read-only-smoke.html");
const runnerPath = path.join(root, "tests/browser/run-smoke.sh");
const harness = fs.readFileSync(harnessPath, "utf8");
const runner = fs.readFileSync(runnerPath, "utf8");

test("browser smoke harness uses only local read-only fixtures", () => {
  assert.match(harness, /\.\.\/fixtures\/assessment-basic\.html/);
  assert.match(harness, /\.\.\/\.\.\/assessment-parser\.js/);
  assert.match(harness, /\.\.\/\.\.\/monaco-bridge\.js/);
  assert.doesNotMatch(harness, /https?:\/\//i);
  assert.doesNotMatch(harness, /chrome\.runtime|chrome\.tabs/);
  assert.doesNotMatch(harness, /\.click\s*\(|execCommand\s*\(|dispatchEvent\s*\(/);
});

test("browser smoke harness verifies parser output and unchanged page state", () => {
  assert.match(harness, /single_answer/);
  assert.match(harness, /multiple_answer/);
  assert.match(harness, /text_input/);
  assert.match(harness, /code_expression/);
  assert.match(harness, /before === after/);
  assert.match(harness, /data-smoke-status/);
  assert.match(harness, /data-dom-unchanged/);
});

test("browser smoke runner serves only the repository locally and requires a passing marker", () => {
  assert.match(runner, /python3 -m http\.server/);
  assert.match(runner, /127\.0\.0\.1/);
  assert.match(runner, /--headless=new/);
  assert.match(runner, /data-smoke-status=\\"pass\\"/);
  assert.match(runner, /data-dom-unchanged=\\"true\\"/);
});

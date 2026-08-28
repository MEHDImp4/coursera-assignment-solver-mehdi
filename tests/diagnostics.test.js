const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildDryRunReport,
  formatDryRunSummary,
  summarizeIssue,
  summarizeQuestion
} = require("../diagnostics.js");

test("builds a metadata-only dry-run report", () => {
  const questions = [
    { questionNumber: 1, type: "single_answer", question: "Secret prompt", options: ["A", "B"] },
    { questionNumber: 2, type: "multiple_answer", prompt: "Another prompt", options: ["A", "B", "C"] },
    { questionNumber: 3, type: "text_input", text: "Written response", options: [] }
  ];

  const report = buildDryRunReport(questions, []);

  assert.equal(report.mode, "read-only");
  assert.equal(report.totalQuestions, 3);
  assert.deepEqual(report.questionTypes, {
    single_answer: 1,
    multiple_answer: 1,
    text_input: 1
  });
  assert.deepEqual(report.guarantees, {
    aiCalled: false,
    domModified: false,
    answerFilled: false,
    submitted: false
  });
  assert.equal(JSON.stringify(report).includes("Secret prompt"), false);
});

test("summarizes question capabilities without copying content", () => {
  assert.deepEqual(summarizeQuestion({
    questionNumber: 8,
    type: "programming",
    prompt: "Do not expose me",
    options: [],
    language: "python"
  }, 0), {
    questionNumber: 8,
    type: "programming",
    optionCount: 0,
    hasPrompt: true,
    hasCode: true
  });
});

test("sanitizes parser issue details", () => {
  assert.deepEqual(summarizeIssue({
    questionNumber: 4,
    type: "missing-options",
    message: "Could not map options",
    rawHtml: "<div>private page data</div>"
  }, 0), {
    index: 1,
    message: "Could not map options",
    questionNumber: 4,
    code: "missing-options"
  });
});

test("caps detailed issues while preserving the total count", () => {
  const issues = Array.from({ length: 24 }, (_, index) => `Issue ${index + 1}`);
  const report = buildDryRunReport([], issues);
  assert.equal(report.issueCount, 24);
  assert.equal(report.issues.length, 20);
  assert.equal(report.truncatedIssues, 4);
});

test("formats a human-readable read-only summary", () => {
  assert.equal(
    formatDryRunSummary({ totalQuestions: 2, issueCount: 1 }),
    "Dry run complete: 2 questions detected, 1 parser issue. No page changes were made."
  );
});

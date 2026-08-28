const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const parser = require("../assessment-parser.js");

function fakeNode({ innerText = "", textContent = "", type, dataset = {}, singles = {}, lists = {} } = {}) {
  return {
    innerText,
    textContent,
    type,
    dataset,
    querySelector(selector) {
      return Object.prototype.hasOwnProperty.call(singles, selector) ? singles[selector] : null;
    },
    querySelectorAll(selector) {
      return Object.prototype.hasOwnProperty.call(lists, selector) ? lists[selector] : [];
    }
  };
}

function prompt(text) {
  return fakeNode({ innerText: text });
}

function option(text, type) {
  return fakeNode({
    singles: {
      '[data-testid="cml-viewer"]': fakeNode({ innerText: text }),
      'input[type="radio"], input[type="checkbox"]': fakeNode({ type })
    }
  });
}

test("prefers semantic question blocks and falls back to legacy selectors", () => {
  const semanticBlock = fakeNode({
    singles: { [parser.selectors.semanticPrompt]: prompt("Question") }
  });
  const legacyBlock = fakeNode();
  const semanticDoc = fakeNode({
    lists: {
      [parser.selectors.semanticBlock]: [semanticBlock],
      [parser.selectors.legacyBlock]: [legacyBlock]
    }
  });

  assert.deepEqual(parser.assessmentQuestionBlocks(semanticDoc), [semanticBlock]);
  assert.equal(parser.selectorDiagnostics(semanticDoc).strategy, "semantic");

  const legacyDoc = fakeNode({
    lists: {
      [parser.selectors.semanticBlock]: [],
      [parser.selectors.legacyBlock]: [legacyBlock]
    }
  });
  assert.deepEqual(parser.assessmentQuestionBlocks(legacyDoc), [legacyBlock]);
  assert.equal(parser.selectorDiagnostics(legacyDoc).strategy, "legacy");
});

test("extracts a single-answer question shell", () => {
  const block = fakeNode({
    singles: { [parser.selectors.semanticPrompt]: prompt("Pick one") },
    lists: { [parser.selectors.option]: [option("A", "radio"), option("B", "radio")] }
  });

  assert.deepEqual(parser.extractQuestionShell(block, 1), {
    kind: "standard",
    question: {
      questionNumber: 1,
      type: "single_answer",
      question: "Pick one",
      options: ["A", "B"]
    }
  });
});

test("extracts multiple-answer, text, essay, and code shells", () => {
  const multiple = fakeNode({
    singles: { [parser.selectors.semanticPrompt]: prompt("Pick many") },
    lists: { [parser.selectors.option]: [option("A", "checkbox"), option("B", "checkbox")] }
  });
  assert.equal(parser.extractQuestionShell(multiple, 2).question.type, "multiple_answer");

  const text = fakeNode({
    singles: {
      [parser.selectors.semanticPrompt]: prompt("Type text"),
      'input[type="text"], input:not([type="radio"]):not([type="checkbox"]), textarea:not(.inputarea)': fakeNode()
    },
    lists: { [parser.selectors.option]: [] }
  });
  assert.equal(parser.extractQuestionShell(text, 3).question.type, "text_input");

  const essay = fakeNode({
    singles: {
      [parser.selectors.semanticPrompt]: prompt("Write more"),
      '[data-slate-editor="true"]': fakeNode()
    },
    lists: { [parser.selectors.option]: [] }
  });
  assert.equal(parser.extractQuestionShell(essay, 4).question.type, "essay");

  const code = fakeNode({
    dataset: { testid: "part-Submission_CodeExpressionQuestion" },
    singles: { [parser.selectors.semanticPrompt]: prompt("Inspect code") },
    lists: { [parser.selectors.option]: [] }
  });
  const codeResult = parser.extractQuestionShell(code, 5);
  assert.equal(codeResult.kind, "code");
  assert.equal(codeResult.question.type, "code_expression");
});

test("ignores blocks without a prompt", () => {
  const block = fakeNode({ lists: { [parser.selectors.option]: [] } });
  assert.equal(parser.extractQuestionShell(block, 1), null);
});

test("sanitized HTML fixture preserves the supported structural markers", () => {
  const html = fs.readFileSync(path.join(__dirname, "fixtures", "assessment-basic.html"), "utf8");
  assert.match(html, /part-Submission_MultipleChoiceQuestion/);
  assert.match(html, /part-Submission_MultipleResponseQuestion/);
  assert.match(html, /part-Submission_TextQuestion/);
  assert.match(html, /part-Submission_CodeExpressionQuestion/);
  assert.match(html, /data-uri="inmemory:\/\/model\/example"/);
  assert.doesNotMatch(html, /coursera\.org\/api|Authorization|Cookie|Bearer /i);
});

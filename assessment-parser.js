(function (root, factory) {
  const api = factory();
  root.AssessmentParserKit = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SEMANTIC_BLOCK_SELECTOR = '[data-testid^="part-Submission_"]';
  const SEMANTIC_PROMPT_SELECTOR = '[id^="prompt-"] [data-testid="cml-viewer"]';
  const LEGACY_BLOCK_SELECTOR = ".css-1erl2aq, .css-12u8wr5";
  const OPTION_SELECTOR = ".rc-Option";

  function assessmentQuestionBlocks(doc) {
    const semanticBlocks = Array.from(doc.querySelectorAll(SEMANTIC_BLOCK_SELECTOR))
      .filter((block) => block.querySelector(SEMANTIC_PROMPT_SELECTOR));
    if (semanticBlocks.length > 0) return semanticBlocks;
    return Array.from(doc.querySelectorAll(LEGACY_BLOCK_SELECTOR));
  }

  function promptText(block) {
    const promptNode = block.querySelector(SEMANTIC_PROMPT_SELECTOR);
    return promptNode ? String(promptNode.innerText || promptNode.textContent || "").trim() : "";
  }

  function isCodeQuestion(block) {
    return block?.dataset?.testid === "part-Submission_CodeExpressionQuestion";
  }

  function extractOptionData(block) {
    const options = [];
    let type = "unknown";
    const optionNodes = Array.from(block.querySelectorAll(OPTION_SELECTOR));

    optionNodes.forEach((option) => {
      const textNode = option.querySelector('[data-testid="cml-viewer"]');
      const inputNode = option.querySelector('input[type="radio"], input[type="checkbox"]');
      if (!textNode || !inputNode) return;
      const text = String(textNode.innerText || textNode.textContent || "").trim();
      if (!text) return;
      options.push(text);
      if (type === "unknown") type = inputNode.type === "radio" ? "single_answer" : "multiple_answer";
    });

    return { options, type };
  }

  function detectWrittenType(block) {
    const slateEditor = block.querySelector('[data-slate-editor="true"]');
    const standardInput = block.querySelector(
      'input[type="text"], input:not([type="radio"]):not([type="checkbox"]), textarea:not(.inputarea)'
    );
    if (slateEditor) return "essay";
    if (standardInput) return "text_input";
    return "unknown";
  }

  function extractQuestionShell(block, questionNumber) {
    const question = {
      questionNumber,
      type: "unknown",
      question: promptText(block),
      options: []
    };

    if (!question.question) return null;
    if (isCodeQuestion(block)) {
      question.type = "code_expression";
      return { question, kind: "code" };
    }

    const optionData = extractOptionData(block);
    if (optionData.options.length > 0) {
      question.options = optionData.options;
      question.type = optionData.type;
    } else {
      question.type = detectWrittenType(block);
    }

    return { question, kind: "standard" };
  }

  function selectorDiagnostics(doc) {
    const semanticCandidates = Array.from(doc.querySelectorAll(SEMANTIC_BLOCK_SELECTOR));
    const semanticPrompts = semanticCandidates.filter((block) => block.querySelector(SEMANTIC_PROMPT_SELECTOR)).length;
    const legacyCandidates = Array.from(doc.querySelectorAll(LEGACY_BLOCK_SELECTOR)).length;
    return {
      strategy: semanticPrompts > 0 ? "semantic" : legacyCandidates > 0 ? "legacy" : "none",
      semanticCandidates: semanticCandidates.length,
      semanticPrompts,
      legacyCandidates
    };
  }

  return {
    selectors: {
      semanticBlock: SEMANTIC_BLOCK_SELECTOR,
      semanticPrompt: SEMANTIC_PROMPT_SELECTOR,
      legacyBlock: LEGACY_BLOCK_SELECTOR,
      option: OPTION_SELECTOR
    },
    assessmentQuestionBlocks,
    promptText,
    isCodeQuestion,
    extractOptionData,
    detectWrittenType,
    extractQuestionShell,
    selectorDiagnostics
  };
});

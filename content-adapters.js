(function () {
  "use strict";

  const requirements = globalThis.CourseRequirementsKit;
  const parser = globalThis.AssessmentParserKit;

  if (!requirements || !parser) {
    console.warn("Coursera parser modules were not loaded; keeping legacy content.js implementations.");
    return;
  }

  // Progressive extraction: content.js still owns browser messaging and Monaco I/O,
  // while pure parsing/normalization lives in independently testable modules.
  normalizeCourseRequirements = requirements.normalizeCourseRequirements;
  assessmentQuestionBlocks = function () {
    return parser.assessmentQuestionBlocks(document);
  };

  scrapeAssessmentDetailed = async function () {
    const questions = [];
    const issues = [];
    const nextCodeBindings = new Map();
    const questionBlocks = parser.assessmentQuestionBlocks(document);

    for (let index = 0; index < questionBlocks.length; index += 1) {
      const block = questionBlocks[index];
      const questionNumber = index + 1;
      const extracted = parser.extractQuestionShell(block, questionNumber);
      if (!extracted) continue;

      const question = extracted.question;
      if (extracted.kind === "code") {
        try {
          const descriptor = codeEditorDescriptor(block);
          const modelResponse = await requestMonacoBridge("read-model", {
            modelUri: descriptor.modelUri
          });
          const currentCode = String(modelResponse.value ?? "");

          question.language = descriptor.language;
          question.currentCode = currentCode;
          nextCodeBindings.set(questionNumber, {
            modelUri: descriptor.modelUri,
            expectedValue: currentCode
          });
          questions.push(question);
        } catch (error) {
          issues.push({
            questionNumber,
            error: error.message || "Could not read the code editor."
          });
        }
        continue;
      }

      questions.push(question);
    }

    latestCodeQuestionBindings = nextCodeBindings;
    return { questions, issues };
  };

  globalThis.CourseraContentModules = Object.freeze({
    requirements: "course-requirements.js",
    assessmentParser: "assessment-parser.js",
    mode: "progressive-extraction"
  });
})();

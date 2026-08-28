(function () {
  "use strict";

  const requirements = globalThis.CourseRequirementsKit;
  const parser = globalThis.AssessmentParserKit;
  const courseraApi = globalThis.CourseraApiKit;

  if (!requirements || !parser || !courseraApi) {
    console.warn("Coursera parser modules were not loaded; keeping legacy content.js implementations.");
    return;
  }

  // Progressive extraction: content.js still owns browser messaging, mutation actions,
  // banners, and Monaco I/O. Pure parsing/normalization/request construction lives
  // in independently testable modules and is delegated here.
  normalizeCourseRequirements = requirements.normalizeCourseRequirements;
  getCurrentCourseSlug = function () {
    return courseraApi.courseSlugFromPath(window.location.pathname);
  };
  assessmentQuestionBlocks = function () {
    return parser.assessmentQuestionBlocks(document);
  };

  loadCourseMaterials = async function () {
    if (capturedCourseMaterials?.linked?.["onDemandCourseMaterialItems.v2"]) {
      return capturedCourseMaterials;
    }

    const courseSlug = getCurrentCourseSlug();
    if (!courseSlug) throw new Error("Open a Coursera course page first.");

    const response = await fetch(courseraApi.buildCourseMaterialsUrl(courseSlug), {
      credentials: "include"
    });
    if (!response.ok) throw new Error(courseraApi.courseMaterialsError(response.status));

    const materials = await response.json();
    if (!courseraApi.hasSupportedCourseMaterials(materials)) {
      throw new Error("Coursera returned course materials in an unsupported format.");
    }

    capturedCourseMaterials = materials;
    capturedCourseId = courseSlug;
    return materials;
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

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action !== "getParserDiagnostics") return false;
    sendResponse({
      data: {
        selectors: parser.selectorDiagnostics(document),
        modules: {
          requirements: "course-requirements.js",
          assessmentParser: "assessment-parser.js",
          courseraApi: "coursera-api.js",
          mode: "progressive-extraction"
        }
      }
    });
    return false;
  });

  globalThis.CourseraContentModules = Object.freeze({
    requirements: "course-requirements.js",
    assessmentParser: "assessment-parser.js",
    courseraApi: "coursera-api.js",
    mode: "progressive-extraction"
  });
})();

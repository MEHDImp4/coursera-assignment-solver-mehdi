(function () {
  "use strict";

  const requirements = globalThis.CourseRequirementsKit;
  const parser = globalThis.AssessmentParserKit;
  const courseraApi = globalThis.CourseraApiKit;
  const courseStateKit = globalThis.CourseraStateKit;
  const monaco = globalThis.MonacoBridgeKit;

  if (!requirements || !parser || !courseraApi || !courseStateKit || !monaco) {
    console.warn("Coursera content modules were not loaded; read runtime is unavailable.");
    return;
  }

  const courseState = courseStateKit.createCourseState();
  const monacoClient = monaco.createBridgeClient(window, { timeoutMs: 2600 });

  function currentCourseSlug() {
    return courseraApi.courseSlugFromPath(window.location.pathname);
  }

  function seedCourseStateFromLegacyCache() {
    const slug = capturedCourseId || currentCourseSlug();
    if (slug) courseState.setCourseSlug(slug);
    if (slug && courseraApi.hasSupportedCourseMaterials(capturedCourseMaterials)) {
      try {
        courseState.setCourseMaterials(capturedCourseMaterials, slug);
      } catch {
        // The legacy cache remains available if it cannot be migrated safely.
      }
    }
  }

  seedCourseStateFromLegacyCache();

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    courseState.ingestInterceptMessage(event.data);
  });

  async function loadCourseMaterials() {
    const courseSlug = currentCourseSlug();
    if (!courseSlug) throw new Error("Open a Coursera course page first.");

    courseState.setCourseSlug(courseSlug);
    const modularCache = courseState.getCourseMaterials(courseSlug);
    if (modularCache) return modularCache;

    if (
      capturedCourseId === courseSlug &&
      courseraApi.hasSupportedCourseMaterials(capturedCourseMaterials)
    ) {
      courseState.setCourseMaterials(capturedCourseMaterials, courseSlug);
      return capturedCourseMaterials;
    }

    const response = await fetch(courseraApi.buildCourseMaterialsUrl(courseSlug), {
      credentials: "include"
    });
    if (!response.ok) throw new Error(courseraApi.courseMaterialsError(response.status));

    const materials = await response.json();
    if (!courseraApi.hasSupportedCourseMaterials(materials)) {
      throw new Error("Coursera returned course materials in an unsupported format.");
    }

    courseState.setCourseMaterials(materials, courseSlug);
    capturedCourseMaterials = materials;
    capturedCourseId = courseSlug;
    return materials;
  }

  async function scrapeAssessmentDetailed() {
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
          const descriptor = monaco.describeCodeEditor(block);
          const modelResponse = await monacoClient.request("read-model", {
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
  }

  // content.js owns orchestration and mutation paths. Read-only helpers delegate here.
  globalThis.CourseraReadRuntime = Object.freeze({
    getCurrentCourseSlug: currentCourseSlug,
    loadCourseMaterials,
    normalizeCourseRequirements: requirements.normalizeCourseRequirements,
    assessmentQuestionBlocks() {
      return parser.assessmentQuestionBlocks(document);
    },
    codeEditorDescriptor: monaco.describeCodeEditor,
    scrapeAssessmentDetailed
  });

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action !== "getParserDiagnostics") return false;
    sendResponse({
      data: {
        selectors: parser.selectorDiagnostics(document),
        state: courseState.snapshot(),
        modules: {
          requirements: "course-requirements.js",
          assessmentParser: "assessment-parser.js",
          courseraApi: "coursera-api.js",
          courseState: "coursera-state.js",
          monacoBridge: "monaco-bridge.js",
          presentation: "presentation.js",
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
    courseState: "coursera-state.js",
    monacoBridge: "monaco-bridge.js",
    presentation: "presentation.js",
    mode: "progressive-extraction"
  });
})();

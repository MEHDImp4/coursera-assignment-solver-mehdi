const test = require("node:test");
const assert = require("node:assert/strict");

const {
  INTERCEPT_SOURCE,
  courseSlugFromUrl,
  normalizeHeaderNames,
  createCourseState
} = require("../coursera-state.js");

function materials(id) {
  return {
    linked: {
      "onDemandCourseMaterialItems.v2": [{ id }]
    }
  };
}

test("extracts course slugs from API query strings and course paths", () => {
  assert.equal(
    courseSlugFromUrl("https://www.coursera.org/api/onDemandCourseMaterials.v2/?q=slug&slug=machine-learning"),
    "machine-learning"
  );
  assert.equal(
    courseSlugFromUrl("https://www.coursera.org/learn/data%20science/home/week/1"),
    "data science"
  );
  assert.equal(courseSlugFromUrl("https://www.coursera.org/api/me.v1"), "");
});

test("records only allowlisted observed header names, never values", () => {
  assert.deepEqual(
    normalizeHeaderNames([
      ["Authorization", "Bearer secret"],
      ["Cookie", "private"],
      ["X-CSRF3-Token", "token-value"],
      ["X-Requested-With", "XMLHttpRequest"]
    ]).sort(),
    ["x-csrf3-token", "x-requested-with"]
  );
});

test("scopes cached materials to the active course", () => {
  const state = createCourseState();
  state.setCourseMaterials(materials("item-a"), "course-a");

  assert.equal(state.getCourseMaterials("course-a").linked["onDemandCourseMaterialItems.v2"][0].id, "item-a");
  assert.equal(state.getCourseMaterials("course-b"), null);

  state.setCourseSlug("course-b");
  assert.equal(state.getCourseMaterials("course-a"), null);
  assert.equal(state.snapshot().hasCourseMaterials, false);
  assert.equal(state.snapshot().courseRevision, 2);
});

test("SPA location sync invalidates stale course cache and clears state off course routes", () => {
  const state = createCourseState();
  state.syncLocation("https://www.coursera.org/learn/course-a/home/week/1");
  state.setCourseMaterials(materials("item-a"), "course-a");
  const firstRevision = state.snapshot().courseRevision;

  state.syncLocation("https://www.coursera.org/learn/course-a/quiz/example");
  assert.equal(state.snapshot().courseRevision, firstRevision);
  assert.equal(state.snapshot().hasCourseMaterials, true);

  state.syncLocation("https://www.coursera.org/learn/course-b/home/week/1");
  assert.equal(state.snapshot().courseSlug, "course-b");
  assert.equal(state.snapshot().hasCourseMaterials, false);
  assert.equal(state.snapshot().courseRevision, firstRevision + 1);

  state.syncLocation("https://www.coursera.org/account-settings");
  assert.deepEqual(state.snapshot(), {
    courseSlug: "",
    onCourseRoute: false,
    courseRevision: firstRevision + 2,
    hasCourseMaterials: false,
    observedHeaderNames: [],
    hasUserContext: false
  });
});

test("ingests sanitized interceptor messages without exposing account or header values", () => {
  const state = createCourseState();
  const payload = {
    source: INTERCEPT_SOURCE,
    request: {
      url: "https://www.coursera.org/api/onDemandCourseMaterials.v2/?q=slug&slug=course-a",
      headers: [
        ["x-csrf3-token", "super-secret-token"],
        ["authorization", "Bearer private"]
      ]
    },
    response: {
      ...materials("item-1"),
      context: {
        dispatcher: {
          stores: {
            ApplicationStore: {
              userData: { id: 123456 }
            }
          }
        }
      }
    }
  };

  assert.equal(state.ingestInterceptMessage(payload), true);
  const snapshot = state.snapshot();
  const serialized = JSON.stringify(snapshot);

  assert.deepEqual(snapshot, {
    courseSlug: "course-a",
    onCourseRoute: true,
    courseRevision: 1,
    hasCourseMaterials: true,
    observedHeaderNames: ["x-csrf3-token"],
    hasUserContext: true
  });
  assert.equal(serialized.includes("super-secret-token"), false);
  assert.equal(serialized.includes("123456"), false);
});

test("ignores unrelated window messages", () => {
  const state = createCourseState();
  assert.equal(state.ingestInterceptMessage({ source: "some-page-script" }), false);
  assert.deepEqual(state.snapshot(), {
    courseSlug: "",
    onCourseRoute: false,
    courseRevision: 0,
    hasCourseMaterials: false,
    observedHeaderNames: [],
    hasUserContext: false
  });
});

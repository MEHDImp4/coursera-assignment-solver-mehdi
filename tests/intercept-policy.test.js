const test = require("node:test");
const assert = require("node:assert/strict");
const {
  filterRequestHeaders,
  minimizeResponse,
  normalizeCourseraApiUrl,
  shouldEmit
} = require("../intercept-policy.js");

test("accepts only Coursera API URLs", () => {
  assert.equal(
    normalizeCourseraApiUrl("/api/onDemandCourses.v1?q=slug&slug=test", "https://www.coursera.org/learn/test"),
    "https://www.coursera.org/api/onDemandCourses.v1?q=slug&slug=test"
  );
  assert.equal(normalizeCourseraApiUrl("https://api.openai.com/v1/models"), "");
  assert.equal(normalizeCourseraApiUrl("https://www.coursera.org/learn/test"), "");
});

test("keeps only the CSRF headers needed by the content script", () => {
  assert.deepEqual(filterRequestHeaders([
    ["Authorization", "Bearer secret"],
    ["Cookie", "session=secret"],
    ["X-CSRF3-Token", "csrf-value"],
    ["X-Requested-With", "XMLHttpRequest"],
    ["Content-Type", "application/json"]
  ]), [
    ["x-csrf3-token", "csrf-value"],
    ["x-requested-with", "XMLHttpRequest"]
  ]);
});

test("preserves course-material responses but minimizes dispatcher responses", () => {
  const materials = { linked: { "onDemandCourseMaterialItems.v2": [{ id: "item-1" }] } };
  assert.equal(
    minimizeResponse("https://www.coursera.org/api/onDemandCourseMaterials.v2/?q=slug", materials),
    materials
  );

  const response = {
    context: {
      dispatcher: {
        stores: {
          ApplicationStore: {
            userData: { id: 123, email: "hidden@example.com", name: "Hidden" }
          },
          OtherStore: { secret: "hidden" }
        }
      }
    },
    privatePayload: "hidden"
  };

  assert.deepEqual(
    minimizeResponse("https://www.coursera.org/api/someEndpoint.v1", response),
    {
      context: {
        dispatcher: {
          stores: {
            ApplicationStore: {
              userData: { id: 123 }
            }
          }
        }
      }
    }
  );
});

test("emits only API events useful to the extension", () => {
  assert.equal(shouldEmit("https://www.coursera.org/api/foo", [], undefined), false);
  assert.equal(shouldEmit("https://www.coursera.org/api/foo?slug=course", [], undefined), true);
  assert.equal(shouldEmit("https://www.coursera.org/api/foo", [["x-csrf3-token", "token"]], undefined), true);
  assert.equal(shouldEmit("https://example.com/api/foo?slug=course", [["x-csrf3-token", "token"]], {}), false);
});

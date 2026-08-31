(function (root, factory) {
  const api = factory();
  root.CourseraStateKit = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const INTERCEPT_SOURCE = "auto-coursera-interceptor";
  const OBSERVED_HEADER_NAMES = new Set([
    "x-csrf2-cookie",
    "x-csrf2-token",
    "x-csrf3-token",
    "x-csrftoken",
    "x-requested-with"
  ]);

  function courseSlugFromUrl(value) {
    try {
      const url = new URL(String(value || ""), "https://www.coursera.org/");
      const querySlug = url.searchParams.get("slug");
      if (querySlug) return querySlug;
      const pathMatch = url.pathname.match(/\/learn\/([^/]+)/);
      return pathMatch ? decodeURIComponent(pathMatch[1]) : "";
    } catch {
      return "";
    }
  }

  function normalizeHeaderNames(headers) {
    const entries = Array.isArray(headers)
      ? headers
      : headers && typeof headers === "object"
        ? Object.entries(headers)
        : [];

    return entries
      .filter((entry) => Array.isArray(entry) && entry.length >= 2)
      .map(([name]) => String(name || "").toLowerCase())
      .filter((name) => OBSERVED_HEADER_NAMES.has(name));
  }

  function hasSupportedMaterials(materials) {
    return Array.isArray(materials?.linked?.["onDemandCourseMaterialItems.v2"]);
  }

  function hasUserContext(response) {
    return response?.context?.dispatcher?.stores?.ApplicationStore?.userData?.id != null;
  }

  function createCourseState() {
    let courseSlug = "";
    let materials = null;
    let materialsSlug = "";
    let observedHeaderNames = new Set();
    let observedUserContext = false;
    let courseRevision = 0;

    function invalidateMaterials() {
      materials = null;
      materialsSlug = "";
    }

    function setCourseSlug(nextSlug) {
      const normalized = String(nextSlug || "").trim();
      if (!normalized) return courseSlug;
      if (normalized === courseSlug) return courseSlug;

      courseSlug = normalized;
      courseRevision += 1;
      if (materialsSlug && materialsSlug !== normalized) invalidateMaterials();
      return courseSlug;
    }

    function clearCourse() {
      if (!courseSlug && !materials && !materialsSlug) return false;
      courseSlug = "";
      invalidateMaterials();
      courseRevision += 1;
      return true;
    }

    function syncLocation(value) {
      const nextSlug = courseSlugFromUrl(value);
      if (!nextSlug) {
        clearCourse();
        return "";
      }
      return setCourseSlug(nextSlug);
    }

    function setCourseMaterials(nextMaterials, slug) {
      if (!hasSupportedMaterials(nextMaterials)) {
        throw new Error("Unsupported Coursera course materials payload.");
      }
      const normalizedSlug = String(slug || courseSlug || "").trim();
      if (!normalizedSlug) throw new Error("A course slug is required to cache course materials.");

      setCourseSlug(normalizedSlug);
      materialsSlug = normalizedSlug;
      materials = nextMaterials;
      return materials;
    }

    function getCourseMaterials(slug) {
      const normalizedSlug = String(slug || courseSlug || "").trim();
      if (!normalizedSlug || normalizedSlug !== materialsSlug) return null;
      return materials;
    }

    function ingestInterceptMessage(message) {
      if (!message || message.source !== INTERCEPT_SOURCE) return false;

      const requestUrl = message.request?.url || message.url || "";
      const slug = courseSlugFromUrl(requestUrl);
      if (slug) setCourseSlug(slug);

      normalizeHeaderNames(message.request?.headers).forEach((name) => {
        observedHeaderNames.add(name);
      });

      if (hasUserContext(message.response)) observedUserContext = true;
      if (hasSupportedMaterials(message.response) && slug) {
        setCourseMaterials(message.response, slug);
      }

      return true;
    }

    function snapshot() {
      return {
        courseSlug,
        onCourseRoute: Boolean(courseSlug),
        courseRevision,
        hasCourseMaterials: Boolean(materials && materialsSlug === courseSlug),
        observedHeaderNames: [...observedHeaderNames].sort(),
        hasUserContext: observedUserContext
      };
    }

    return Object.freeze({
      setCourseSlug,
      clearCourse,
      syncLocation,
      setCourseMaterials,
      getCourseMaterials,
      ingestInterceptMessage,
      snapshot
    });
  }

  return {
    INTERCEPT_SOURCE,
    OBSERVED_HEADER_NAMES,
    courseSlugFromUrl,
    normalizeHeaderNames,
    hasSupportedMaterials,
    createCourseState
  };
});

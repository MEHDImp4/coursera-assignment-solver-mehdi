(function (root, factory) {
  const api = factory();
  root.CourseraInterceptPolicy = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CAPTURED_HEADER_NAMES = new Set([
    "x-csrf2-cookie",
    "x-csrf2-token",
    "x-csrf3-token",
    "x-csrftoken",
    "x-requested-with"
  ]);

  function courseraApiUrl(value, baseUrl = "https://www.coursera.org/") {
    try {
      const url = new URL(String(value || ""), baseUrl);
      const hostname = url.hostname.toLowerCase();
      const isCourseraHost = hostname === "coursera.org" || hostname.endsWith(".coursera.org");
      if (!isCourseraHost || !url.pathname.startsWith("/api/")) return null;
      return url;
    } catch {
      return null;
    }
  }

  function normalizeCourseraApiUrl(value, baseUrl) {
    return courseraApiUrl(value, baseUrl)?.href || "";
  }

  function normalizeHeaders(headers) {
    if (!headers) return [];
    if (Array.isArray(headers)) {
      return headers.filter((entry) => Array.isArray(entry) && entry.length >= 2);
    }
    if (typeof headers.entries === "function") {
      try {
        return Array.from(headers.entries());
      } catch {
        return [];
      }
    }
    if (typeof headers === "object") return Object.entries(headers);
    return [];
  }

  function filterRequestHeaders(headers) {
    const safeHeaders = [];
    normalizeHeaders(headers).forEach(([name, value]) => {
      const normalizedName = String(name).toLowerCase();
      if (!CAPTURED_HEADER_NAMES.has(normalizedName) || value == null) return;
      safeHeaders.push([normalizedName, String(value)]);
    });
    return safeHeaders;
  }

  function minimizeResponse(urlValue, responseBody) {
    const url = courseraApiUrl(urlValue);
    if (!url || !responseBody || typeof responseBody !== "object") return undefined;

    if (url.href.includes("onDemandCourseMaterials.v2")) {
      return responseBody;
    }

    const userId = responseBody?.context?.dispatcher?.stores?.ApplicationStore?.userData?.id;
    if (userId == null) return undefined;

    return {
      context: {
        dispatcher: {
          stores: {
            ApplicationStore: {
              userData: { id: userId }
            }
          }
        }
      }
    };
  }

  function shouldEmit(urlValue, headers, responseBody) {
    const url = courseraApiUrl(urlValue);
    if (!url) return false;

    if (Array.isArray(headers) && headers.length > 0) return true;
    if (responseBody) return true;
    if (url.href.includes("onDemandCourses.v1") || url.href.includes("onDemandCourseMaterials.v2")) return true;
    if (url.searchParams.has("slug") || url.searchParams.has("userId")) return true;
    return /\/user\/\d+/.test(url.pathname);
  }

  return {
    CAPTURED_HEADER_NAMES,
    filterRequestHeaders,
    minimizeResponse,
    normalizeCourseraApiUrl,
    shouldEmit
  };
});

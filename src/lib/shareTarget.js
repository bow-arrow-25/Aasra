const SHARE_STORAGE_KEY = "aasra-share-text";

export function isShareRoute() {
  if (typeof window === "undefined") return false;
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const hashRaw = window.location.hash.replace(/^#/, "");
  const hashPath = (hashRaw.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  return path === "/share" || hashPath === "/share";
}

export function readShareText() {
  if (typeof window === "undefined") return "";
  const hashRaw = window.location.hash.replace(/^#/, "");
  const hashQuery = hashRaw.includes("?") ? hashRaw.slice(hashRaw.indexOf("?")) : "";
  const params = new URLSearchParams(window.location.search || "");
  const hashParams = new URLSearchParams(hashQuery.startsWith("?") ? hashQuery : `?${hashQuery}`);
  hashParams.forEach((value, key) => {
    if (!params.get(key)) params.set(key, value);
  });
  return [params.get("title"), params.get("text"), params.get("url")]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function stashShareText(text) {
  if (typeof window === "undefined") return;
  try {
    if (text) sessionStorage.setItem(SHARE_STORAGE_KEY, text);
  } catch {
    /* private mode */
  }
}

export function peekStashedShareText() {
  if (typeof window === "undefined") return "";
  try {
    return sessionStorage.getItem(SHARE_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function clearStashedShareText() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(SHARE_STORAGE_KEY);
  } catch {
    /* private mode */
  }
}

export function captureIncomingShare() {
  if (!isShareRoute()) return "";
  const body = readShareText();
  if (body) stashShareText(body);
  return body;
}

export function clearShareUrl() {
  if (typeof window === "undefined") return;
  const next = `${window.location.origin}/#/parent`;
  window.history.replaceState(null, "", next);
}

if (typeof window !== "undefined") {
  captureIncomingShare();
}

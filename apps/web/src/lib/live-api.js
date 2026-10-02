// One request per URL per page, shared by every script that asks for it (the
// homepage script and the footer both need /api/categories and /api/settings).
const requests = new Map();

/** Resolves to the parsed JSON, or null when the request fails. */
export const fetchLiveJson = (url) => {
  if (!requests.has(url)) {
    requests.set(
      url,
      fetch(url)
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null),
    );
  }
  return requests.get(url);
};

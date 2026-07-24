export const SITE_ORIGIN = "https://cloudmonkey.co.za";

export function canonicalLink(path: string) {
  return {
    rel: "canonical",
    href: `${SITE_ORIGIN}${path === "/" ? "" : path}`,
  };
}

export function ogUrl(path: string) {
  return {
    property: "og:url",
    content: `${SITE_ORIGIN}${path === "/" ? "" : path}`,
  };
}

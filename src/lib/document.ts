import type { CVDocument, ProfileLink } from "./types";

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function listValue(value: unknown, stripMarkers = false): string[] {
  const values = Array.isArray(value) ? value : String(value ?? "").split(/\r?\n/);
  return values
    .map(String)
    .map((item) => item.trim())
    .map((item) => stripMarkers ? item.replace(/^([-*\u2022]|\d+[.)])\s+/, "").trim() : item)
    .filter(Boolean);
}

function legacyProfileLinks(profile: CVDocument["profile"]): ProfileLink[] {
  return [
    { id: "linkedin", label: "LinkedIn", url: profile.linkedin ?? "" },
    { id: "github", label: "GitHub", url: profile.github ?? "" },
    { id: "website", label: "Website", url: profile.website ?? "" }
  ].filter((link) => link.url.trim());
}

export function profileLinks(profile: CVDocument["profile"]): ProfileLink[] {
  const links = profile.links === undefined ? legacyProfileLinks(profile) : profile.links;
  return links
    .map((link, index) => ({
      id: link.id || `profile-link-${index}`,
      label: link.label.trim() || link.url.trim(),
      url: link.url.trim()
    }))
    .filter((link) => link.url);
}

export function createProfileLink(): ProfileLink {
  return { id: uid("profile-link"), label: "", url: "" };
}

export function normalizeDocument(doc: CVDocument): CVDocument {
  return {
    ...doc,
    profile: {
      ...doc.profile,
      ownerNames: listValue(doc.profile.ownerNames),
      links: profileLinks(doc.profile).map((link) => ({ ...link }))
    },
    sections: doc.sections.map((section) => ({
      ...section,
      fields: section.fields.map((field) => ({ ...field })),
      items: section.items.map((item) => ({
        ...item,
        values: {
          ...item.values,
          ...Object.fromEntries(
            section.fields.map((field) => {
              const value = item.values[field.id];
              if (field.kind === "authors") return [field.id, listValue(value)];
              if (field.kind === "bullets" || field.kind === "tags") return [field.id, listValue(value, true)];
              return [field.id, value ?? ""];
            })
          )
        }
      }))
    }))
  };
}

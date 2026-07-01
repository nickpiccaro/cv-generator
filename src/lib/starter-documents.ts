import sampleData from "../data/sample-cv.json";
import { normalizeDocument } from "./document";
import type { CVDocument } from "./types";

const blankProfile: CVDocument["profile"] = {
  name: "",
  credentials: "",
  title: "",
  affiliation: "",
  address: "",
  email: "",
  phone: "",
  location: "",
  website: "",
  linkedin: "",
  github: "",
  links: [],
  ownerNames: []
};

export function createSampleDocument(): CVDocument {
  return normalizeDocument(structuredClone(sampleData as CVDocument));
}

export function createBlankDocument(): CVDocument {
  const template = createSampleDocument();
  return normalizeDocument({
    ...template,
    profile: { ...blankProfile },
    sections: template.sections.map((section) => ({
      ...section,
      hiddenWhenEmpty: true,
      fields: section.fields.map((field) => ({ ...field })),
      items: []
    }))
  });
}

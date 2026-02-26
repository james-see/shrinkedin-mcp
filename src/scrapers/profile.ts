import type { Page } from "patchright";
import { extractPage, extractOverlay, sleep, NAV_DELAY_MS } from "./extractor.js";
import type { PersonSection } from "./fields.js";

const PERSON_PAGE_MAP: Array<{ section: PersonSection; suffix: string; overlay: boolean }> = [
  { section: "experience", suffix: "/details/experience/", overlay: false },
  { section: "education", suffix: "/details/education/", overlay: false },
  { section: "interests", suffix: "/details/interests/", overlay: false },
  { section: "honors", suffix: "/details/honors/", overlay: false },
  { section: "languages", suffix: "/details/languages/", overlay: false },
  { section: "contact_info", suffix: "/overlay/contact-info/", overlay: true },
];

export interface ScrapeResult {
  url: string;
  sections: Record<string, string>;
  pages_visited: string[];
  sections_requested: string[];
}

export async function scrapePerson(
  page: Page,
  username: string,
  sections: Set<PersonSection>
): Promise<ScrapeResult> {
  const baseUrl = `https://www.linkedin.com/in/${username}`;
  const result: ScrapeResult = {
    url: `${baseUrl}/`,
    sections: {},
    pages_visited: [],
    sections_requested: ["main_profile"],
  };

  const mainText = await extractPage(page, baseUrl + "/");
  if (mainText) {
    result.sections["main_profile"] = mainText;
    result.pages_visited.push(baseUrl + "/");
  }
  await sleep(NAV_DELAY_MS);

  for (const { section, suffix, overlay } of PERSON_PAGE_MAP) {
    if (!sections.has(section)) continue;
    const url = baseUrl + suffix;
    try {
      const text = overlay ? await extractOverlay(page, url) : await extractPage(page, url);
      if (text) {
        result.sections[section] = text;
      }
      result.pages_visited.push(url);
      result.sections_requested.push(section);
    } catch (e) {
      result.pages_visited.push(url);
      result.sections_requested.push(section);
      throw e;
    }
    await sleep(NAV_DELAY_MS);
  }

  return result;
}

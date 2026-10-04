import type { UniversityStatus } from "./types.ts";

export type UniversitySourceKind = "university" | "student-government" | "student-services";

export interface UniversityAnnouncementSource {
  id: string;
  universityIds: string[];
  institution: string;
  name: string;
  kind: UniversitySourceKind;
  url: string;
  scope: string;
  /** First-party page used to confirm that this channel belongs to the institution. */
  verifiedBy: string;
}

export interface ReviewedAnnouncementPost {
  institution: string;
  url: string;
  note: string;
}

/**
 * Curated channels that can credibly publish or repeat class-suspension decisions. University
 * administration is ordered before student government because an administrative notice wins if
 * two pages conflict. Every student-government entry is backed by a first-party school directory,
 * handbook, or article.
 */
export const UNIVERSITY_ANNOUNCEMENT_SOURCES: UniversityAnnouncementSource[] = [
  {
    id: "mapua-official",
    universityIds: ["mapua-makati-campus", "mapua-manila"],
    institution: "Mapúa University",
    name: "Mapúa University",
    kind: "university",
    url: "https://www.facebook.com/MapuaUniv",
    scope: "All Mapúa campuses",
    verifiedBy: "https://support.mapua.edu.ph/kb/article/132/shs-or-senior-high-school-application-for-sy-2026-2027",
  },
  {
    id: "ust-official",
    universityIds: ["ust-manila"],
    institution: "University of Santo Tomas",
    name: "UST official",
    kind: "university",
    url: "https://www.facebook.com/UST1611official",
    scope: "University-wide",
    verifiedBy: "https://www.ust.edu.ph/",
  },
  {
    id: "ust-csc",
    universityIds: ["ust-manila"],
    institution: "University of Santo Tomas",
    name: "UST Central Student Council",
    kind: "student-government",
    url: "https://www.facebook.com/USTCSC",
    scope: "Tertiary students",
    verifiedBy: "https://www.ust.edu.ph/campus-life/central-student-council-csc/",
  },
  {
    id: "feu-official",
    universityIds: ["feu-manila"],
    institution: "Far Eastern University",
    name: "Far Eastern University",
    kind: "university",
    url: "https://www.facebook.com/FarEasternUniversity",
    scope: "FEU Manila",
    verifiedBy: "https://www.feu.edu.ph/",
  },
  {
    id: "feu-cso",
    universityIds: ["feu-manila"],
    institution: "Far Eastern University",
    name: "FEU Central Student Organization",
    kind: "student-government",
    url: "https://www.facebook.com/feucentralstudentorganization",
    scope: "FEU Manila students",
    verifiedBy: "https://www.feu.edu.ph/feu-accredited-student-organizations/",
  },
  {
    id: "ue-official",
    universityIds: ["ue-manila", "ue-caloocan"],
    institution: "University of the East",
    name: "University of the East",
    kind: "university",
    url: "https://www.facebook.com/UniversityoftheEastUE",
    scope: "UE Manila and Caloocan",
    verifiedBy: "https://www.ue.edu.ph/",
  },
  {
    id: "ue-usc",
    universityIds: ["ue-manila"],
    institution: "University of the East",
    name: "UE Manila University Student Council",
    kind: "student-government",
    url: "https://www.facebook.com/UEUSC",
    scope: "UE Manila students",
    verifiedBy: "https://www.ue.edu.ph/cal/category/election/",
  },
  {
    id: "sscr-official",
    universityIds: ["san-sebastian-manila"],
    institution: "San Sebastian College-Recoletos",
    name: "SSC-R Manila official website",
    kind: "university",
    url: "https://sscrmnl.edu.ph/",
    scope: "SSC-R Manila",
    verifiedBy: "https://sscrmnl.edu.ph/contact-us/",
  },
  {
    id: "uap-official",
    universityIds: ["uap-pasig"],
    institution: "University of Asia and the Pacific",
    name: "UA&P official website",
    kind: "university",
    url: "https://uap.asia/",
    scope: "UA&P Pasig",
    verifiedBy: "https://uap.asia/",
  },
  {
    id: "uap-usg",
    universityIds: ["uap-pasig"],
    institution: "University of Asia and the Pacific",
    name: "UA&P University Student Government",
    kind: "student-government",
    url: "https://www.facebook.com/uapusg",
    scope: "UA&P students",
    verifiedBy: "https://dragon.uap.asia/portal/public/directory.php",
  },
  {
    id: "plp-official",
    universityIds: ["plp-pasig"],
    institution: "Pamantasan ng Lungsod ng Pasig",
    name: "PLP official",
    kind: "university",
    url: "https://www.facebook.com/pamantasannglungsodngpasig",
    scope: "PLP",
    verifiedBy: "https://plpasig.edu.ph/2026/09/21/applications-for-admission-to-plp-for-a-y-2027-2028-are-now-open/",
  },
  {
    id: "plp-student-services",
    universityIds: ["plp-pasig"],
    institution: "Pamantasan ng Lungsod ng Pasig",
    name: "PLP Student Success Office",
    kind: "student-services",
    url: "https://www.facebook.com/PLPStudentSuccessOffice",
    scope: "Student notices",
    verifiedBy: "https://plpasig.edu.ph/2026/09/21/applications-for-admission-to-plp-for-a-y-2027-2028-are-now-open/",
  },
  {
    id: "jru-official-directory",
    universityIds: ["jru-mandaluyong"],
    institution: "José Rizal University",
    name: "JRU official social directory",
    kind: "university",
    url: "https://jru.edu/social-media-directory/",
    scope: "JRU",
    verifiedBy: "https://jru.edu/social-media-directory/",
  },
  {
    id: "jru-csc",
    universityIds: ["jru-mandaluyong"],
    institution: "José Rizal University",
    name: "JRU Central Student Council",
    kind: "student-government",
    url: "https://www.facebook.com/JRUCsc1994/",
    scope: "Tertiary students",
    verifiedBy: "https://jru.edu/social-media-directory/",
  },
  {
    id: "pup-official",
    universityIds: ["pup-sta-mesa"],
    institution: "Polytechnic University of the Philippines",
    name: "PUP official website",
    kind: "university",
    url: "https://www.pup.edu.ph/",
    scope: "PUP system and Sta. Mesa",
    verifiedBy: "https://www.pup.edu.ph/",
  },
];

/** Posts supplied for source research. They are evidence examples, never treated as active alerts. */
export const REVIEWED_ANNOUNCEMENT_POSTS: ReviewedAnnouncementPost[] = [
  {
    institution: "Mapúa University",
    url: "https://www.facebook.com/photo.php?fbid=1556594469843885&set=pb.100064800395459.-2207520000&type=3",
    note: "Official suspension-announcement example supplied for review.",
  },
  {
    institution: "José Rizal University",
    url: "https://www.facebook.com/photo/?fbid=1508037211353548&set=a.459812702842676",
    note: "Official suspension-announcement example supplied for review.",
  },
  {
    institution: "Polytechnic University of the Philippines",
    url: "https://www.facebook.com/photo/?fbid=1543687571118774&set=a.461115292709346",
    note: "Official suspension-announcement example supplied for review.",
  },
];

export function sourcesForUniversities(universities: UniversityStatus[]): UniversityAnnouncementSource[] {
  const ids = new Set(universities.map((university) => university.id));
  return UNIVERSITY_ANNOUNCEMENT_SOURCES.filter((source) =>
    source.universityIds.some((id) => ids.has(id)));
}

export function primarySourceFor(university: UniversityStatus): UniversityAnnouncementSource | undefined {
  return UNIVERSITY_ANNOUNCEMENT_SOURCES.find((source) =>
    source.kind === "university" && source.universityIds.includes(university.id));
}

import type { Endorsement } from "./types";
import { DISTRICTS } from "./data";
import { mockStrokesForName, strokesToSvg } from "./signature";
import { mulberry32 } from "./signature";
import { regionForDistrict } from "./utils";

interface SeedPerson {
  name: string;
  district: string;
  subCounty: string;
  minutesAgo: number;
}

const SEED_PEOPLE: SeedPerson[] = [
  { name: "Mukasa John Bosco", district: "Kampala", subCounty: "Kawempe Division", minutesAgo: 2 },
  { name: "Nakato Sarah", district: "Wakiso", subCounty: "Nansana Municipality", minutesAgo: 5 },
  { name: "Okello David", district: "Gulu", subCounty: "Bardege Division", minutesAgo: 8 },
  { name: "Acheng Grace", district: "Lira", subCounty: "Adyel Division", minutesAgo: 12 },
  { name: "Tumusiime Robert", district: "Mbarara", subCounty: "Kakoba Division", minutesAgo: 16 },
  { name: "Namutebi Esther", district: "Mukono", subCounty: "Goma Division", minutesAgo: 21 },
  { name: "Kiggundu Joseph", district: "Masaka", subCounty: "Nyendo-Ssenyange", minutesAgo: 27 },
  { name: "Wanyama Peter", district: "Mbale", subCounty: "Industrial City Division", minutesAgo: 34 },
  { name: "Naigaga Florence", district: "Jinja", subCounty: "Walukuba Division", minutesAgo: 41 },
  { name: "Dratu Emmanuel", district: "Arua", subCounty: "Arua Hill Division", minutesAgo: 48 },
  { name: "Atim Brenda", district: "Gulu", subCounty: "Layibi Division", minutesAgo: 56 },
  { name: "Ssempa Daniel", district: "Kampala", subCounty: "Nakawa Division", minutesAgo: 63 },
  { name: "Akello Mercy", district: "Lira", subCounty: "Railway Division", minutesAgo: 74 },
  { name: "Mwesigwa Frank", district: "Mbarara", subCounty: "Nyamitanga Division", minutesAgo: 88 },
  { name: "Nabukeera Joan", district: "Wakiso", subCounty: "Kira Town Council", minutesAgo: 102 },
  { name: "Ongom Vincent", district: "Arua", subCounty: "Ayivuni", minutesAgo: 128 },
  { name: "Babirye Ritah", district: "Mbale", subCounty: "Northern Division", minutesAgo: 151 },
  { name: "Kato Paul", district: "Mukono", subCounty: "Mukono Central", minutesAgo: 176 },
];

const NIN_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

function makeNin(rand: () => number): string {
  let nin = NIN_LETTERS[Math.floor(rand() * NIN_LETTERS.length)];
  nin += String(Math.floor(rand() * 90 + 10)); // birth year-ish 2 digits
  for (let i = 0; i < 11; i++) {
    nin += rand() < 0.35
      ? NIN_LETTERS[Math.floor(rand() * NIN_LETTERS.length)]
      : String(Math.floor(rand() * 10));
  }
  return nin.slice(0, 14);
}

function makePhone(rand: () => number): string {
  // MTN: 077/078/076, Airtel: 070/075
  const prefixes = ["772", "770", "774", "782", "786", "760", "762", "700", "702", "704", "752", "758"];
  const prefix = prefixes[Math.floor(rand() * prefixes.length)];
  let rest = "";
  for (let i = 0; i < 6; i++) rest += Math.floor(rand() * 10);
  return `+256 ${prefix} ${rest.slice(0, 3)} ${rest.slice(3)}`;
}

export function buildSeedEndorsements(now = Date.now()): Endorsement[] {
  return SEED_PEOPLE.map((p, i) => {
    const rand = mulberry32(20260 + i * 977);
    const strokes = mockStrokesForName(p.name, 20260 + i * 977);
    const signatureSvg = strokesToSvg(strokes, {
      idPrefix: `seed${i}`,
      strokeWidth: 2.2,
    });
    return {
      id: `SEED-${String(i + 1).padStart(4, "0")}`,
      fullName: p.name,
      phone: makePhone(rand),
      nin: makeNin(rand),
      district: p.district,
      region: regionForDistrict(p.district),
      subCounty: p.subCounty,
      signatureSvg,
      signatureMode: "drawn",
      termsAccepted: true,
      verified: true,
      createdAt: now - p.minutesAgo * 60_000,
    };
  });
}

/** Extra districts referenced by tally math but not in the form list. */
export const ALL_DISTRICTS = DISTRICTS;

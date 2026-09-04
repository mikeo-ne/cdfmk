import type { Region } from "./types";

/** Major Ugandan districts offered in the endorsement form, with regional mapping. */
export const DISTRICT_REGION: Record<string, Region> = {
  Kampala: "Central",
  Wakiso: "Central",
  Mukono: "Central",
  Masaka: "Central",
  Mbarara: "Western",
  Gulu: "Northern",
  Lira: "Northern",
  Arua: "Northern",
  Jinja: "Eastern",
  Mbale: "Eastern",
};

export const DISTRICTS = Object.keys(DISTRICT_REGION);

export const REGIONS: Region[] = ["Central", "Western", "Northern", "Eastern"];

export const REGION_META: Record<
  Region,
  { color: string; bar: string; ring: string; districts: string[] }
> = {
  Central: {
    color: "text-ugyellow",
    bar: "bg-ugyellow",
    ring: "bg-ugyellow",
    districts: ["Kampala", "Wakiso", "Mukono", "Masaka"],
  },
  Western: {
    color: "text-uggold",
    bar: "bg-uggold",
    ring: "bg-uggold",
    districts: ["Mbarara"],
  },
  Northern: {
    color: "text-ugred",
    bar: "bg-ugred",
    ring: "bg-ugred",
    districts: ["Gulu", "Lira", "Arua"],
  },
  Eastern: {
    color: "text-orange-400",
    bar: "bg-orange-500",
    ring: "bg-orange-500",
    districts: ["Jinja", "Mbale"],
  },
};

export const SUB_COUNTY_HINTS: Record<string, string[]> = {
  Kampala: ["Kawempe Division", "Nakawa Division", "Rubaga Division", "Makindye Division", "Central Division"],
  Wakiso: ["Entebbe Municipality", "Nansana Municipality", "Kira Town Council", "Ssabagabo"],
  Mukono: ["Mukono Central", "Goma Division", "Ntenjeru", "Kyetume"],
  Masaka: ["Katwe-Butego", "Kimaanya-Kyabakuza", "Nyendo-Ssenyange", "Bukoto"],
  Mbarara: ["Kakoba Division", "Nyamitanga Division", "Biharwe Division", "Kakiika"],
  Gulu: ["Bardege Division", "Layibi Division", "Pece Division", "Laroo Division"],
  Lira: ["Lira Municipality", "Adyel Division", "Railway Division", "Ojwina Division"],
  Arua: ["Arua Hill Division", "Arivu", "Ayivuni", "Oli River Camp"],
  Jinja: ["Jinja Municipality", "Walukuba Division", "Mpumudde Division", "Bugembe"],
  Mbale: ["Industrial City Division", "Northern Division", "Wanale Division", "Bungokho"],
};

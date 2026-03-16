export const SCIENCE_FIELDS = [
  "nanotechnology",
  "physics",
  "earth",
  "astronomy_space",
  "chemistry",
  "biology",
  "materials_science",
] as const;

export type ScienceField = (typeof SCIENCE_FIELDS)[number];

export interface ScienceSource {
  name: string;
  url: string;
  field: ScienceField;
  maxPages: number;
  includePatterns?: string[];
  excludePatterns?: string[];
}

export const SCIENCE_SOURCES: ScienceSource[] = [
  // Nanotechnology
  {
    name: "Phys.org - Nanotechnology",
    url: "https://phys.org/nanotech-news/",
    field: "nanotechnology",
    maxPages: 10,
    includePatterns: ["phys.org/news/*"],
    excludePatterns: ["*/video/*", "*/galleries/*"],
  },
  {
    name: "ScienceDaily - Nanotechnology",
    url: "https://www.sciencedaily.com/news/matter_energy/nanotechnology/",
    field: "nanotechnology",
    maxPages: 10,
    includePatterns: ["sciencedaily.com/releases/*"],
    excludePatterns: ["*/video/*"],
  },

  // Physics
  {
    name: "Phys.org - Physics",
    url: "https://phys.org/physics-news/",
    field: "physics",
    maxPages: 15,
    includePatterns: ["phys.org/news/*"],
    excludePatterns: ["*/video/*", "*/galleries/*"],
  },
  {
    name: "Quanta Magazine",
    url: "https://www.quantamagazine.org/physics/",
    field: "physics",
    maxPages: 10,
    includePatterns: ["quantamagazine.org/*/"],
    excludePatterns: ["*/tag/*", "*/author/*"],
  },

  // Earth
  {
    name: "EarthSky - Earth",
    url: "https://earthsky.org/earth/",
    field: "earth",
    maxPages: 10,
    includePatterns: ["earthsky.org/earth/*"],
    excludePatterns: ["*/tag/*"],
  },
  {
    name: "ScienceDaily - Earth",
    url: "https://www.sciencedaily.com/news/earth_climate/",
    field: "earth",
    maxPages: 10,
    includePatterns: ["sciencedaily.com/releases/*"],
    excludePatterns: ["*/video/*"],
  },
  {
    name: "Phys.org - Earth",
    url: "https://phys.org/earth-news/",
    field: "earth",
    maxPages: 10,
    includePatterns: ["phys.org/news/*"],
    excludePatterns: ["*/video/*", "*/galleries/*"],
  },

  // Astronomy & Space
  {
    name: "EarthSky - Space",
    url: "https://earthsky.org/space/",
    field: "astronomy_space",
    maxPages: 10,
    includePatterns: ["earthsky.org/space/*"],
    excludePatterns: ["*/tag/*"],
  },
  {
    name: "Phys.org - Astronomy & Space",
    url: "https://phys.org/space-news/",
    field: "astronomy_space",
    maxPages: 15,
    includePatterns: ["phys.org/news/*"],
    excludePatterns: ["*/video/*", "*/galleries/*"],
  },
  {
    name: "Science News - Astronomy",
    url: "https://www.sciencenews.org/topic/astronomy",
    field: "astronomy_space",
    maxPages: 10,
    includePatterns: ["sciencenews.org/article/*"],
    excludePatterns: ["*/sn-magazine/*"],
  },

  // Chemistry
  {
    name: "Chemistry World",
    url: "https://www.chemistryworld.com/news",
    field: "chemistry",
    maxPages: 10,
    includePatterns: ["chemistryworld.com/news/*"],
    excludePatterns: ["*/opinion/*"],
  },
  {
    name: "Phys.org - Chemistry",
    url: "https://phys.org/chemistry-news/",
    field: "chemistry",
    maxPages: 10,
    includePatterns: ["phys.org/news/*"],
    excludePatterns: ["*/video/*", "*/galleries/*"],
  },

  // Materials Science
  {
    name: "Phys.org - Materials Science",
    url: "https://phys.org/materials-science-news/",
    field: "materials_science",
    maxPages: 10,
    includePatterns: ["phys.org/news/*"],
    excludePatterns: ["*/video/*", "*/galleries/*"],
  },
  {
    name: "ScienceDaily - Materials Science",
    url: "https://www.sciencedaily.com/news/matter_energy/materials_science/",
    field: "materials_science",
    maxPages: 10,
    includePatterns: ["sciencedaily.com/releases/*"],
    excludePatterns: ["*/video/*"],
  },

  // Biology
  {
    name: "ScienceDaily - Biology",
    url: "https://www.sciencedaily.com/news/plants_animals/",
    field: "biology",
    maxPages: 15,
    includePatterns: ["sciencedaily.com/releases/*"],
    excludePatterns: ["*/video/*"],
  },
  {
    name: "Phys.org - Biology",
    url: "https://phys.org/biology-news/",
    field: "biology",
    maxPages: 10,
    includePatterns: ["phys.org/news/*"],
    excludePatterns: ["*/video/*", "*/galleries/*"],
  },
  {
    name: "Nature News",
    url: "https://www.nature.com/news",
    field: "biology",
    maxPages: 10,
    includePatterns: ["nature.com/articles/*"],
    excludePatterns: ["*/supplements/*"],
  },
];

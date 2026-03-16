export interface ScienceSource {
  name: string;
  url: string;
  field: string;
  maxPages: number;
  includePatterns?: string[];
  excludePatterns?: string[];
}

export const SCIENCE_SOURCES: ScienceSource[] = [
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

  // Earth Science
  {
    name: "EarthSky",
    url: "https://earthsky.org/earth/",
    field: "earth_science",
    maxPages: 10,
    includePatterns: ["earthsky.org/earth/*", "earthsky.org/space/*"],
    excludePatterns: ["*/tag/*"],
  },
  {
    name: "ScienceDaily - Earth",
    url: "https://www.sciencedaily.com/news/earth_climate/",
    field: "earth_science",
    maxPages: 10,
    includePatterns: ["sciencedaily.com/releases/*"],
    excludePatterns: ["*/video/*"],
  },

  // General Science
  {
    name: "Science News",
    url: "https://www.sciencenews.org/",
    field: "general",
    maxPages: 15,
    includePatterns: ["sciencenews.org/article/*"],
    excludePatterns: ["*/sn-magazine/*"],
  },
  {
    name: "Nature News",
    url: "https://www.nature.com/news",
    field: "general",
    maxPages: 10,
    includePatterns: ["nature.com/articles/*"],
    excludePatterns: ["*/supplements/*"],
  },
];

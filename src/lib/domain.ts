// Dominios cerrados del dataset (coinciden con las reglas de validación del ETL).

export const CATEGORIES = ["Accessories", "Clothing", "Footwear", "Outerwear"] as const;
export const SEASONS = ["Spring", "Summer", "Fall", "Winter"] as const;
export const GENDERS = ["Female", "Male"] as const;
export const AGE_BANDS = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"] as const;
export const REGIONS = ["Northeast", "Midwest", "South", "West"] as const;
export const SEGMENTS = ["Campeones", "Leales", "En riesgo", "Potenciales", "Ocasionales"] as const;
export const BOOL_STRINGS = ["true", "false"] as const;

export type Category = (typeof CATEGORIES)[number];
export type Season = (typeof SEASONS)[number];

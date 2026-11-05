/** False on the static GitHub Pages build, where there's no server for the AI wild card. */
export const HAS_AI = process.env.NEXT_PUBLIC_STATIC !== "1";

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dinner Dice",
    short_name: "Dinner Dice",
    description: "Roll for a healthy, easy, organic-friendly dinner.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf6ee",
    theme_color: "#fbf6ee",
    orientation: "portrait",
  };
}

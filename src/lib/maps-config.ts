import { createServerFn } from "@tanstack/react-start";

export const getPublicMapsKey = createServerFn({ method: "GET" }).handler(async () => {
  const key =
    process.env["VITE_GOOGLE_MAPS_API_KEY"] ||
    process.env["GOOGLE_MAPS_API_KEY"] ||
    "";
  return { apiKey: key };
});

export function getEnvMapsKey(): string {
  return (import.meta.env["VITE_GOOGLE_MAPS_API_KEY"] as string | undefined) ?? "";
}

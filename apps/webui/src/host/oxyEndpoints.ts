import { NILO_API_URL, OXY_API_URL, OXY_CLIENT_ID } from "../../../browser/src/oxy/config";

declare const __ASTRO_OXY_API_URL__: string;
declare const __ASTRO_NILO_API_URL__: string;
declare const __ASTRO_OXY_CLIENT_ID__: string;

export const oxyEndpoints = {
  baseURL: __ASTRO_OXY_API_URL__ || OXY_API_URL,
  niloURL: __ASTRO_NILO_API_URL__ || NILO_API_URL,
  clientId: __ASTRO_OXY_CLIENT_ID__ || OXY_CLIENT_ID,
};

const accountOrigins = new Set([new URL(oxyEndpoints.baseURL).origin, new URL(oxyEndpoints.niloURL).origin]);

export const isAccountOrigin = (url: URL) => accountOrigins.has(url.origin);

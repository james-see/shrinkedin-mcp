import { resolve } from "path";

export interface Config {
  userDataDir: string;
  headless: boolean;
  timeout: number;
}

let config: Config = {
  userDataDir: resolve(process.env.HOME || "~", ".linkedin-mcp", "profile"),
  headless: true,
  timeout: 5000,
};

export function getConfig(): Config {
  return { ...config };
}

export function setConfig(updates: Partial<Config>): void {
  config = { ...config, ...updates };
}

export function getProfileDir(): string {
  return config.userDataDir.replace(/^~/, process.env.HOME || "~");
}

export function getCookiePath(): string {
  const dir = getProfileDir();
  return dir.replace(/\/profile\/?$/, "") + "/cookies.json";
}

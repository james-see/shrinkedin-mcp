import { homedir } from "os";
import { resolve } from "path";

export interface Config {
  userDataDir: string;
  headless: boolean;
  timeout: number;
}

function getHome(): string {
  return process.env.HOME || homedir();
}

function getDefaultProfileDir(): string {
  return resolve(getHome(), ".linkedin-mcp", "profile");
}

let config: Config = {
  userDataDir: process.env.USER_DATA_DIR
    ? resolve(process.env.USER_DATA_DIR.replace(/^~/, getHome()))
    : getDefaultProfileDir(),
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
  return config.userDataDir.replace(/^~/, getHome());
}

export function getCookiePath(): string {
  const dir = getProfileDir();
  return dir.replace(/\/profile\/?$/, "") + "/cookies.json";
}

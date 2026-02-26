import { existsSync, mkdirSync, readdirSync, rmSync } from "fs";
import { dirname } from "path";
import { getProfileDir } from "./config.js";

export function profileExists(profileDir?: string): boolean {
  const dir = profileDir ?? getProfileDir();
  if (!existsSync(dir)) return false;
  try {
    const entries = readdirSync(dir);
    return entries.length > 0;
  } catch {
    return false;
  }
}

export function clearProfile(profileDir?: string): boolean {
  const dir = profileDir ?? getProfileDir();
  if (!existsSync(dir)) return true;
  try {
    rmSync(dir, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

export function ensureProfileDir(): string {
  const dir = getProfileDir();
  const parent = dirname(dir);
  if (!existsSync(parent)) {
    mkdirSync(parent, { recursive: true });
  }
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

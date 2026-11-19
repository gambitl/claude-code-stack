import { DEFAULTS, type SettingKey, type Settings } from "./settings.js";

/** The block that `cstack next` prints between the run line and a guide. Its format is fixed by ADR-SIC-D. */
export function settingsBlock(settings: Settings): string {
  if (!settings.found) {
    return "Settings of this repository: there is no .cstack/settings.json, so every value is the default.\n\n";
  }
  const lines = (Object.keys(DEFAULTS) as SettingKey[]).map((key) => {
    const value = settings.values[key];
    const shown = key === "testCommands" && value === undefined ? "not set" : JSON.stringify(value);
    return `- ${key}: ${shown}${settings.sources[key] === "default" ? " (default)" : ""}\n`;
  });
  return `Settings of this repository (.cstack/settings.json):\n${lines.join("")}\n`;
}

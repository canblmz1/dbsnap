import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export async function confirm(message: string, defaultValue = false): Promise<boolean> {
  const rl = createInterface({ input, output });
  try {
    const suffix = defaultValue ? "Y/n" : "y/N";
    const answer = (await rl.question(`${message} (${suffix}) `)).trim().toLowerCase();
    if (!answer) return defaultValue;
    return answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}

export async function selectSnapshot(message: string, names: string[]): Promise<string> {
  if (names.length === 0) {
    throw new Error("No snapshots found.");
  }
  if (names.length === 1) return names[0];

  output.write(`${message}\n`);
  names.forEach((name, index) => output.write(`  ${index + 1}. ${name}\n`));
  const rl = createInterface({ input, output });
  try {
    const answer = (await rl.question("Choose a snapshot: ")).trim();
    const index = Number(answer);
    if (!Number.isInteger(index) || index < 1 || index > names.length) {
      throw new Error("Invalid snapshot selection.");
    }
    return names[index - 1];
  } finally {
    rl.close();
  }
}

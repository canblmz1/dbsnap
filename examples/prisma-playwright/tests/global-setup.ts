import { restoreSnapshot } from "@canblmz1/dbsnap";

export default async function globalSetup() {
  await restoreSnapshot("e2e-ready", { yes: true });
}

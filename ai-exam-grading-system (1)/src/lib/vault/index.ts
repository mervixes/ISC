import { CHEMISTRY } from "./chemistry";
import { MATHS } from "./maths";
import { MECHANISMS, TESTS } from "./mechanisms-tests";
import { QUOTES } from "./quotes";
import { PHYSICS } from "./physics";
import type { VaultItem } from "./types";

export * from "./types";

export const VAULT: VaultItem[] = [...PHYSICS, ...MATHS, ...CHEMISTRY, ...MECHANISMS, ...TESTS, ...QUOTES];

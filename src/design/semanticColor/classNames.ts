import { COLOR_ROLES, type ColorRole } from "./roles";

/** The only seven classes the KaTeX trust callback of am-eq-static-katex-7da admits. */
export function roleClassName(role: ColorRole): string {
  return `am-role-${role}`;
}

export const ROLE_CLASS_NAMES: readonly string[] = Object.freeze(COLOR_ROLES.map(roleClassName));

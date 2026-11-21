/**
 * The condition node's connectors are saved on edges as "yes" / "no", but the engine and the
 * simulator emit "true" / "false". Without this alias a published condition never finds its
 * edge and the session ends silently. Treat the two spellings as the same branch.
 */
const ALIASES: Record<string, string> = { true: "yes", false: "no" };

const canonical = (handle: string): string => ALIASES[handle] ?? handle;

export function handleMatches(edgeHandle: string | null | undefined, wanted: string): boolean {
  return edgeHandle != null && canonical(edgeHandle) === canonical(wanted);
}

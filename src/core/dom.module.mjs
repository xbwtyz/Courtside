/** Tiny dependency-injected DOM lookup; retains the original id lookup semantics. */
export function createDomLookup(document){
  return id => document.getElementById(id);
}

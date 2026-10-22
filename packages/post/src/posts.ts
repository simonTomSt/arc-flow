import type { PostDefinition } from "./types";
import f2100k from "../posts/f2100k.post.json";
import grbl from "../posts/grbl.post.json";
import grblM8 from "../posts/grbl-m8.post.json";

export const builtinPosts: PostDefinition[] = [
  f2100k as PostDefinition,
  grbl as PostDefinition,
  grblM8 as PostDefinition,
];

export const isBuiltinPost = (id: string): boolean => builtinPosts.some((p) => p.id === id);

/**
 * Resolve a post id. Caller may supply a user library whose posts take precedence over
 * the built-in list — this is how the L3 editor's "Mój post" overrides a built-in id
 * for the user's own machine profile.
 */
export const getPost = (id: string, userPosts: PostDefinition[] = []): PostDefinition => {
  const p = userPosts.find((x) => x.id === id) ?? builtinPosts.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown post "${id}"`);
  return p;
};

/** Deep clone a post (via JSON) and rebrand it with a new id/name. Used by "Duplikuj". */
export const clonePost = (src: PostDefinition, newId: string, newName: string): PostDefinition => {
  const copy = JSON.parse(JSON.stringify(src)) as PostDefinition;
  copy.id = newId;
  copy.name = newName;
  if (src.base) copy.base = src.base;
  else copy.base = src.name;
  return copy;
};

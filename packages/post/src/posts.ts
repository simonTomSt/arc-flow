import type { PostDefinition } from "./types";
import f2100k from "../posts/f2100k.post.json";
import grbl from "../posts/grbl.post.json";
import grblM8 from "../posts/grbl-m8.post.json";

export const builtinPosts: PostDefinition[] = [
  f2100k as PostDefinition,
  grbl as PostDefinition,
  grblM8 as PostDefinition,
];

export const getPost = (id: string): PostDefinition => {
  const p = builtinPosts.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown post "${id}"`);
  return p;
};

// ../../Repos/my-repos/next-on-pages/packages/next-on-pages/templates/cache/builtInCacheHandler.ts
var SUSPENSE_CACHE_URL = "INTERNAL_SUSPENSE_CACHE_HOSTNAME.local";
var NEXT_CACHE_IMPLICIT_TAG_ID = "_N_T_";
var BuiltInCacheHandler = class {
  constructor(ctx) {
    this.ctx = ctx;
    this.revalidatedTags = new Set(ctx.revalidatedTags);
  }
  tagsManifest;
  tagsManifestKey = "tags-manifest";
  revalidatedTags;
  async retrieve(key) {
    throw new Error(`Method not implemented - ${key}`);
  }
  async update(key, value) {
    throw new Error(`Method not implemented - ${key}, ${value}`);
  }
  async set(key, value, extra = {}) {
    const newEntry = {
      lastModified: Date.now(),
      value
    };
    await this.update(key, JSON.stringify(newEntry));
    switch (newEntry.value?.kind) {
      case "FETCH": {
        const tags = getTagsFromEntry(newEntry) ?? extra.tags ?? [];
        await this.setTags(tags, { cacheKey: key });
        const derivedTags = getDerivedTags(tags);
        const implicitTags = derivedTags.map(
          (tag) => `${NEXT_CACHE_IMPLICIT_TAG_ID}${tag}`
        );
        [...derivedTags, ...implicitTags].forEach(
          (tag) => this.revalidatedTags.delete(tag)
        );
      }
    }
  }
  async get(key, { softTags }) {
    const entry = await this.retrieve(key);
    if (!entry)
      return null;
    let data;
    try {
      data = JSON.parse(entry);
    } catch (e) {
      return null;
    }
    switch (data.value?.kind) {
      case "FETCH": {
        await this.loadTagsManifest();
        const tags = getTagsFromEntry(data);
        const combinedTags = softTags ? [...tags ?? [], ...softTags] : getDerivedTags(tags ?? []);
        const isStale = combinedTags.some((tag) => {
          if (this.revalidatedTags.has(tag))
            return true;
          const tagEntry = this.tagsManifest?.items?.[tag];
          return tagEntry?.revalidatedAt && tagEntry?.revalidatedAt >= (data.lastModified ?? Date.now());
        });
        return isStale ? null : data;
      }
      default: {
        return data;
      }
    }
  }
  async revalidateTag(tag) {
    await this.setTags([tag], { revalidatedAt: Date.now() });
    this.revalidatedTags.add(tag);
  }
  async loadTagsManifest() {
    try {
      const rawManifest = await this.retrieve(this.tagsManifestKey);
      if (rawManifest) {
        this.tagsManifest = JSON.parse(rawManifest);
      }
    } catch (e) {
    }
    this.tagsManifest ??= { version: 1, items: {} };
  }
  async saveTagsManifest() {
    if (this.tagsManifest) {
      const newValue = JSON.stringify(this.tagsManifest);
      await this.update(this.tagsManifestKey, newValue);
    }
  }
  async setTags(tags, { cacheKey, revalidatedAt }) {
    await this.loadTagsManifest();
    const tagsManifest = this.tagsManifest;
    for (const tag of tags) {
      const data = tagsManifest.items[tag] ?? { keys: [] };
      if (cacheKey && !data.keys.includes(cacheKey)) {
        data.keys.push(cacheKey);
      }
      if (revalidatedAt) {
        data.revalidatedAt = revalidatedAt;
      }
      tagsManifest.items[tag] = data;
    }
    await this.saveTagsManifest();
  }
  buildCacheKey(key) {
    return `https://${SUSPENSE_CACHE_URL}/entry/${key}`;
  }
};
function getDerivedTags(tags) {
  const derivedTags = ["/"];
  for (const tag of tags || []) {
    if (tag.startsWith("/")) {
      const pathnameParts = tag.split("/");
      for (let i = 1; i < pathnameParts.length + 1; i++) {
        const curPathname = pathnameParts.slice(0, i).join("/");
        if (curPathname) {
          derivedTags.push(curPathname);
          if (!derivedTags.includes(curPathname)) {
            derivedTags.push(curPathname);
          }
        }
      }
    } else if (!derivedTags.includes(tag)) {
      derivedTags.push(tag);
    }
  }
  return derivedTags;
}
function getTagsFromEntry(entry) {
  return entry.value?.tags ?? entry.value?.data?.tags;
}

// ../../Repos/my-repos/next-on-pages/packages/next-on-pages/templates/cache/KVCacheHandler.ts
var KVCacheHandler = class extends BuiltInCacheHandler {
  constructor(ctx) {
    super(ctx);
  }
  async retrieve(key) {
    const value = await process.env.MY_CUSTOM_SUS_KV.get(
      this.buildCacheKey(key)
    );
    return value ?? null;
  }
  async update(key, value) {
    await process.env.MY_CUSTOM_SUS_KV.put(
      this.buildCacheKey(key),
      value
    );
  }
};

module.exports = KVCacheHandler;
// export {
//   KVCacheHandler as default
// };

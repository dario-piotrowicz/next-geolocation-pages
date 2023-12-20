class Supabase {
  static #supabaseUrl = process.env.SUPABASE_REST_PROJECT_URL;
  static #supabaseKey = process.env.SUPABASE_KEY;

  static set = async (key, value) => {
    await fetch(Supabase.#supabaseUrl, {
      method: "POST",
      headers: {
        apikey: Supabase.#supabaseKey,
        Authorization: `Bearer ${Supabase.#supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        key,
        data: JSON.stringify(value),
      }),
    });
  };

  static get = async (key) => {
    const res = await fetch(`${Supabase.#supabaseUrl}?key=eq.${key}&select=*`, {
      headers: {
        apikey: Supabase.#supabaseKey,
        Authorization: `Bearer ${Supabase.#supabaseKey}`,
        Accept: "application/json",
      },
    });
    const json = await res.json();

    if (json[0]?.data) {
      return JSON.parse(json[0].data);
    } else {
      return undefined;
    }
  };
}

/**
 * https://github.com/vercel/next.js/blob/1286e145/packages/next/src/server/lib/incremental-cache/utils.ts
 */
function getDerivedTags(tags) {
	const derivedTags = ['/'];

	for (const tag of tags || []) {
		if (tag.startsWith('/')) {
			const pathnameParts = tag.split('/');

			// we automatically add the current path segments as tags
			// for revalidatePath handling
			for (let i = 1; i < pathnameParts.length + 1; i++) {
				const curPathname = pathnameParts.slice(0, i).join('/');

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


module.exports = class CacheHandler {
  #tagsManifest = null;
  #revalidatedTags = [];
  static #tagsManifestKey = "__tags-manifest";
  static #defaultTagsManifest = { version: 1, items: {} };

  constructor(options) {
    // NOTE: the ?? [] shouldn't be necessary! this is an inconsistent behavior of
    //       next-on-pages that needs to be amended (next build + next start don't require it)
    this.#revalidatedTags = options.revalidatedTags ?? [];
  }

  async #getTagsManifest() {
    if(!this.#tagsManifest) {
      const tagsManifest = await Supabase.get(CacheHandler.#tagsManifestKey);
      this.#tagsManifest = tagsManifest ?? CacheHandler.#defaultTagsManifest;
    }
    this.#tagsManifest.items ??= [];
    return this.#tagsManifest;
  }

  async #saveTagsManifest(tagsManifest) {
    this.#tagsManifest = tagsManifest;

    await Supabase.set(CacheHandler.#tagsManifestKey, this.#tagsManifest);
  }

  async #setTags(key, tags) {
    const tagsManifest = await this.#getTagsManifest();

    await Supabase.set(CacheHandler.#tagsManifestKey, tagsManifest);

    for (const tag of tags) {
      const data = tagsManifest.items[tag] ?? { keys: [] };
      if (!data.keys.includes(key)) {
        data.keys.push(key);
      }
      tagsManifest.items[tag] = data;
    }

    await this.#saveTagsManifest(tagsManifest);
  }

  async get(key) {
    let data = await Supabase.get(key);

    if(data) {
        const tagsManifest = await this.#getTagsManifest();

        const tags = data.value.tags ?? data.value.data.tags;

        const derivedTags = getDerivedTags(tags ?? []);

        const wasRevalidated = derivedTags.some((tag) => {
            if (this.#revalidatedTags.includes(tag)) {
                return true
            }

            return (
                tagsManifest?.items[tag]?.revalidatedAt &&
                tagsManifest?.items[tag].revalidatedAt >=
                (data?.lastModified || Date.now())
            )
        })

        // When revalidate tag is called we don't return
        // stale data, so it's updated right away
        if (wasRevalidated) {
            data = undefined;
        }
    }

    return data ?? null;
  }

  async set(key, data, { tags }) {
    await Supabase.set(key, {
      value: {
        ...data,
        tags,
      },
      lastModified: Date.now(),
    });

    await this.#setTags(key, tags ?? []);
  }

  async revalidateTag(tag) {
    const tagsManifest = await this.#getTagsManifest();

    const data = tagsManifest.items[tag] || { keys: [] };

    data.revalidatedAt = Date.now();
    tagsManifest.items[tag] = data;

    await this.#saveTagsManifest(tagsManifest);
  }
};

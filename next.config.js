/** @type {import('next').NextConfig} */
module.exports = (phase, { defaultConfig }) => {

  /**
   * @type {import('next').NextConfig}
   */
  const nextConfig = {
    experimental: {
      fetchCacheKeyPrefix: "my-unused-fetch-cache-key-prefix",
      incrementalCacheHandlerPath: getIncrementalCacheHandler(),
    },
  };
  return nextConfig;
};

/**
 * @param {null|'supabase'|'kv'} handler
 */
function getIncrementalCacheHandler(handler) {
  if(!handler) {
    return undefined;
  }

  const cachePath = {
    supabase: 'supabase-rest.js',
    kv: 'kv.js'
  }[handler];

  return require.resolve(`./cache-handlers/${cachePath}`);
}

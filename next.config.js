/** @type {import('next').NextConfig} */
module.exports = (phase, { defaultConfig }) => {
  /**
   * @type {import('next').NextConfig}
   */
  const nextConfig = {
    experimental: {
      fetchCacheKeyPrefix: "my-unused-fetch-cache-key-prefix",
      incrementalCacheHandlerPath: require.resolve(
        "./cache-handlers/supabase-rest.js"
      ),
    },
  };
  return nextConfig;
};

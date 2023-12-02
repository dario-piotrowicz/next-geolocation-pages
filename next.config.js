/** @type {import('next').NextConfig} */
module.exports = {
  experimental: {
    serverActions: true,
    incrementalCacheHandlerPath: require.resolve('./cache-handlers/supabase-rest.js'),
  },
};

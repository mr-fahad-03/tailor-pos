/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // So a production build can be run while `next dev` is live without the two
  // trampling each other's chunks in .next.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // The Express API lives in the sibling workspace and is imported as TypeScript
  // by pages/api, so Next has to compile it rather than treat it as prebuilt JS.
  transpilePackages: ['tailor-pos-server'],
};

module.exports = nextConfig;

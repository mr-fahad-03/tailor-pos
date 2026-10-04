/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The Express API lives in the sibling workspace and is imported as TypeScript
  // by pages/api, so Next has to compile it rather than treat it as prebuilt JS.
  transpilePackages: ['tailor-pos-server'],
};

module.exports = nextConfig;

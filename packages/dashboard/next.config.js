/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@conductor/core', '@conductor/state'],
};

module.exports = nextConfig;

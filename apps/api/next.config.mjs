/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@restaurant/db', '@restaurant/shared-types'],
};

export default nextConfig;

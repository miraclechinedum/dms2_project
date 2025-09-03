/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove the webpack configuration that's causing the error
  // Next.js should handle most dependencies automatically
  webpack: (config) => {
    // Only add fallbacks if absolutely necessary
    config.resolve.fallback = {
      ...config.resolve.fallback,
      // Add any necessary fallbacks here
    };
    return config;
  },
};

module.exports = nextConfig;

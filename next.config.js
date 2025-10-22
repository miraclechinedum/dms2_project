/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,

  eslint: {
    ignoreDuringBuilds: true, 
  },

  typescript: {
    ignoreBuildErrors: true, 
  },

  images: {
    unoptimized: true,
  },

  webpack: (config, { isServer }) => {
    // prevent Next.js from trying to polyfill Node core libs
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
      stream: false,
      buffer: false,
    };

    if (!isServer) {
      // completely exclude Node-only libs from client bundle
      config.externals.push({
        jsonwebtoken: "commonjs jsonwebtoken",
        jws: "commonjs jws",
        jwa: "commonjs jwa",
        bcryptjs: "commonjs bcryptjs",
        "safe-buffer": "commonjs safe-buffer",
      });
    }

    return config;
  },
};

module.exports = nextConfig;

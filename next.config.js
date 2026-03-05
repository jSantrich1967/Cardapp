/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow tesseract.js worker to load
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };
    return config;
  },
};

module.exports = nextConfig;

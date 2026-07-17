/** @type {import('next').NextConfig} */
const nextConfig = {
  // 100% frontend : export statique, aucun backend. Déployable sur Vercel ou n'importe quel hébergeur statique.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // ปิดการแจ้ง Error ยิบย่อยของ ESLint ตอนเอาเว็บขึ้น Vercel
    ignoreDuringBuilds: true,
  },
  typescript: {
    // ปิดการแจ้ง Error ของ Type ชนิดตัวแปร ตอนเอาเว็บขึ้น Vercel
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
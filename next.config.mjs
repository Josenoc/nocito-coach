/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['pdfkit'],
  outputFileTracingIncludes: {
    '/api/cron/check-payments': ['./node_modules/pdfkit/js/standard-fonts/**'],
    '/api/webhooks/mercadopago': ['./node_modules/pdfkit/js/standard-fonts/**'],
  },
};

export default nextConfig;
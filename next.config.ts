import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", "127.0.0.1", "*.e2b.app"],
  async headers() {
    const headers = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    if (process.env.NODE_ENV === "production") {
      headers.push({ key: "Content-Security-Policy", value: [
        "default-src 'self'", "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:",
        "style-src 'self' 'unsafe-inline'", "font-src 'self' data:",
        "img-src 'self' data: blob:", "media-src 'self' blob:",
        "connect-src 'self' blob:", "worker-src 'self' blob:",
        "object-src 'none'", "base-uri 'self'", "form-action 'self'",
      ].join("; ") });
    }
    return [{ source: "/(.*)", headers }];
  },
};

export default nextConfig;

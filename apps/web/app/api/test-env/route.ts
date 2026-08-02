import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    mlProxyTarget: process.env.ML_API_PROXY_TARGET || null,
    nextPublicMlApi: process.env.NEXT_PUBLIC_ML_API || null,
    nextPublicApiUrl: process.env.NEXT_PUBLIC_API_URL || null,
    nodeEnv: process.env.NODE_ENV,
  });
}

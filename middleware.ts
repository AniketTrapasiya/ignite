import { NextRequest, NextResponse } from "next/server";

const publicPaths = [
  "/signin",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-otp",
  "/api/auth/signin",
  "/api/auth/signup",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/verify-otp",
];

const authOnlyPaths = [
  "/signin",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-otp",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("autoflow-token")?.value;

  // If user IS authenticated and tries to visit an auth page, redirect to dashboard
  if (token && authOnlyPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Allow public paths for unauthenticated users
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow root path (it handles its own redirect)
  if (pathname === "/") {
    return NextResponse.next();
  }

  // Protected routes: require auth
  if (!token) {
    // API routes should return JSON 401, not redirect to signin HTML
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const signinUrl = new URL("/signin", request.url);
    signinUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(signinUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

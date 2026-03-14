import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signToken, setAuthCookie, generateOtp } from "@/lib/auth";
import { sendMail, otpEmailTemplate } from "@/lib/email";
import { normalizeEmail } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const emailNormalized = normalizeEmail(email);

    const user = await prisma.user.findUnique({ where: { email: emailNormalized } });
    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (!user.emailVerified) {
      // Invalidate old OTPs and send a fresh one
      await prisma.otp.updateMany({
        where: { userId: user.id, type: "EMAIL_VERIFICATION", used: false },
        data: { used: true },
      });

      const otpCode = generateOtp();
      await prisma.otp.create({
        data: {
          code: otpCode,
          userId: user.id,
          type: "EMAIL_VERIFICATION",
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      });

      await sendMail({
        to: user.email,
        subject: "Verify your email - AutoFlow AI",
        html: otpEmailTemplate(user.name, otpCode),
      });

      return NextResponse.json(
        { error: "Please verify your email before signing in", userId: user.id },
        { status: 403 }
      );
    }

    const token = signToken({ userId: user.id, email: user.email });
    await setAuthCookie(token);

    return NextResponse.json({
      message: "Signed in successfully",
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error("Signin error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

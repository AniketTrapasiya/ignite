import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken, setAuthCookie, generateOtp } from "@/lib/auth";
import { sendMail, otpEmailTemplate } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const { userId, code, type } = await request.json();

    if (!userId || !code || !type) {
      return NextResponse.json(
        { error: "User ID, code, and type are required" },
        { status: 400 }
      );
    }

    const otp = await prisma.otp.findFirst({
      where: {
        userId,
        code,
        type,
        used: false,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!otp) {
      return NextResponse.json(
        { error: "Invalid or expired OTP" },
        { status: 400 }
      );
    }

    // Mark OTP as used
    await prisma.otp.update({
      where: { id: otp.id },
      data: { used: true },
    });

    if (type === "EMAIL_VERIFICATION") {
      // Mark email as verified
      await prisma.user.update({
        where: { id: userId },
        data: { emailVerified: true },
      });

      // Auto sign in after email verification
      const token = signToken({ userId: otp.user.id, email: otp.user.email });
      await setAuthCookie(token);

      return NextResponse.json({
        message: "Email verified successfully",
        user: {
          id: otp.user.id,
          name: otp.user.name,
          email: otp.user.email,
        },
      });
    }

    return NextResponse.json({ message: "OTP verified successfully" });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Resend OTP
export async function PUT(request: NextRequest) {
  try {
    const { userId, type } = await request.json();

    if (!userId || !type) {
      return NextResponse.json(
        { error: "User ID and type are required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Invalidate previous OTPs
    await prisma.otp.updateMany({
      where: { userId, type, used: false },
      data: { used: true },
    });

    const otp = generateOtp();
    await prisma.otp.create({
      data: {
        code: otp,
        userId,
        type,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    await sendMail({
      to: user.email,
      subject: "Your verification code - AutoFlow AI",
      html: otpEmailTemplate(user.name, otp),
    });

    return NextResponse.json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Resend OTP error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

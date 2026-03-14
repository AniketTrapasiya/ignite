import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateOtp } from "@/lib/auth";
import { sendMail, otpEmailTemplate } from "@/lib/email";
import { normalizeEmail } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const emailNormalized = normalizeEmail(email);
    const trimmedName = name.trim();

    const existingUser = await prisma.user.findUnique({
      where: { email: emailNormalized },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Create user and OTP in a transaction
    const { user, otpCode } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name: trimmedName, email: emailNormalized, passwordHash },
      });

      const otpCode = generateOtp();
      await tx.otp.create({
        data: {
          code: otpCode,
          userId: user.id,
          type: "EMAIL_VERIFICATION",
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      });

      return { user, otpCode };
    });

    // Send verification email (outside transaction)
    await sendMail({
      to: emailNormalized,
      subject: "Verify your email - AutoFlow AI",
      html: otpEmailTemplate(trimmedName, otpCode),
    });

    return NextResponse.json(
      {
        message: "Account created. Please verify your email with the OTP sent.",
        userId: user.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

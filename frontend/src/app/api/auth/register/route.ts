import { NextRequest, NextResponse } from "next/server";

// In a real app, this would be stored in a database
const users = new Map();

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    // Basic validation
    if (!name || !email || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check if user already exists
    if (users.has(email)) {
      return NextResponse.json({ error: "User already exists" }, { status: 409 });
    }

    // Create user (in memory for this demo)
    // In a real app, you'd hash the password and store in a database
    const userId = Date.now().toString();
    users.set(email, {
      id: userId,
      name,
      email,
      password, // NEVER store plaintext passwords in production
      createdAt: new Date(),
    });

    return NextResponse.json({
      user: {
        id: userId,
        name,
        email,
      }
    }, { status: 201 });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongodb";

export async function GET() {
  try {
    await connectDB();

    await mongoose.connection.db?.admin().ping();

    return NextResponse.json({
      success: true,
      message: "MongoDB 연결 성공",
      database: mongoose.connection.name,
      readyState: mongoose.connection.readyState,
    });
  } catch (error) {
    console.error("MongoDB 연결 테스트 실패:", error);

    return NextResponse.json(
      {
        success: false,
        message: "MongoDB 연결 실패",
      },
      { status: 500 },
    );
  }
}

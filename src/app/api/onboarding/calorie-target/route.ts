import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getTargetRangeFromProfile } from "@/lib/coach";

/** GET: Kalorien- und Protein-Zielbereich aus Profildaten berechnen (für Onboarding Schritt "Kalorienziel"). */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const goal = searchParams.get("goal") ?? "maintain";
    const weight = Number(searchParams.get("weight"));
    const height = Number(searchParams.get("height"));
    const age = Number(searchParams.get("age"));
    const gender = String(searchParams.get("gender") ?? "m");
    const activityLevel = String(searchParams.get("activity_level") ?? "sitzend");

    if (!weight || !height || !age) {
      return NextResponse.json(
        { error: "goal, weight, height, age erforderlich" },
        { status: 400 }
      );
    }

    const result = getTargetRangeFromProfile({
      weightKg: weight,
      heightCm: height,
      age,
      isFemale: gender === "w",
      activityLevel,
      goal,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[onboarding/calorie-target]", err);
    return NextResponse.json(
      { error: "Berechnung fehlgeschlagen" },
      { status: 500 }
    );
  }
}

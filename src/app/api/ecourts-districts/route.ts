import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Static fallback of popular Indian districts in case courts.json is not found or fails to load
const STATIC_DISTRICTS_FALLBACK: Record<string, Array<{ value: string; name: string }>> = {
  "1": [ // Maharashtra
    { value: "mumbai", name: "Mumbai" }, { value: "pune", name: "Pune" }, { value: "nagpur", name: "Nagpur" }, { value: "thane", name: "Thane" }, { value: "nashik", name: "Nashik" }
  ],
  "2": [ // Andhra Pradesh
    { value: "visakhapatnam", name: "Visakhapatnam" }, { value: "vijayawada", name: "Vijayawada" }, { value: "guntur", name: "Guntur" }, { value: "nellore", name: "Nellore" }
  ],
  "3": [ // Karnataka
    { value: "bengaluru", name: "Bengaluru" }, { value: "mysuru", name: "Mysuru" }, { value: "hubli", name: "Hubballi" }, { value: "mangaluru", name: "Mangaluru" }
  ],
  "4": [ // Kerala
    { value: "kochi", name: "Kochi" }, { value: "trivandrum", name: "Thiruvananthapuram" }, { value: "kozhikode", name: "Kozhikode" }
  ],
  "13": [ // Uttar Pradesh
    { value: "noida", name: "Noida" }, { value: "lucknow", name: "Lucknow" }, { value: "kanpur", name: "Kanpur" }, { value: "ghaziabad", name: "Ghaziabad" }, { value: "agra", name: "Agra" }
  ],
  "26": [ // Delhi
    { value: "delhi", name: "Delhi" }, { value: "new_delhi", name: "New Delhi" }
  ],
  "29": [ // Telangana
    { value: "hyderabad", name: "Hyderabad" }, { value: "warangal", name: "Warangal" }
  ]
};

export async function GET(req: NextRequest) {
  try {
    const stateCode = req.nextUrl.searchParams.get("state_code");

    if (!stateCode) {
      return NextResponse.json(
        { error: "Missing required parameter: state_code" },
        { status: 400 }
      );
    }

    let districts: Array<{ value: string; name: string }> = [];

    // Try reading from client-verify's courts.json database
    try {
      const possiblePaths = [
        path.join(process.cwd(), "../client-verify/src/data/courts.json"),
        "d:/OzcluVerifyNew/client-verify/src/data/courts.json",
        path.join(process.cwd(), "client-verify/src/data/courts.json")
      ];

      let fileContent = "";
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          fileContent = fs.readFileSync(p, "utf-8");
          break;
        }
      }

      if (fileContent) {
        const courts = JSON.parse(fileContent);
        const seen = new Set<string>();
        for (const r of courts) {
          if (r.state_code === stateCode && !seen.has(r.district_code)) {
            seen.add(r.district_code);
            districts.push({ value: r.district_name, name: r.district_name });
          }
        }
        districts.sort((a, b) => a.name.localeCompare(b.name));
      }
    } catch (e) {
      console.warn("[ECOURTS-DISTRICTS] Failed to read courts.json, falling back to static list", e);
    }

    // Fallback to static lists if file read failed or returned empty results
    if (districts.length === 0) {
      districts = STATIC_DISTRICTS_FALLBACK[stateCode] || [
        { value: "other", name: "Other / Major City" }
      ];
    }

    return NextResponse.json({
      success: true,
      state_code: stateCode,
      districts,
    });
  } catch (error: any) {
    console.error("[ECOURTS-DISTRICTS] Error:", error.message);
    return NextResponse.json(
      { error: `Failed to fetch districts: ${error.message}` },
      { status: 500 }
    );
  }
}

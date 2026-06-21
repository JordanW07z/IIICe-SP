"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GoogleGenAI } from "@google/genai";
import {
  Activity,
  Camera,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Droplets,
  ListTree,
  Thermometer,
  UploadCloud,
  Wind,
} from "lucide-react";

type SensorMetric = {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  decimals: number;
  icon: React.ReactNode;
};

type DetectionLogEntry = {
  id: number;
  label: string;
  confidence: number;
  hour: number;
  minute: number;
};

type WateringEvent = {
  id: number;
  hour: number;
  minute: number;
  duration: number;
  fired: boolean;
};

type CombinedLogEntry = {
  id: string;
  type: "detection" | "irrigation";
  hour: number;
  minute: number;
  label?: string;
  confidence?: number;
  duration?: number;
};

function formatHm(hour: number, minute: number) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function generateDaySchedule(): number[] {
  const count = 9;
  const segment = 24 / count;
  const hours: number[] = [];
  for (let i = 0; i < count; i++) {
    const base = i * segment + segment / 2;
    const jitter = randomBetween(-segment * 0.4, segment * 0.4);
    hours.push(Math.min(23.98, Math.max(0, base + jitter)));
  }
  return hours.sort((a, b) => a - b);
}

function buildHistoricalDay(): CombinedLogEntry[] {
  const entries: CombinedLogEntry[] = [];
  const detectionCount = Math.floor(randomBetween(200, 450));
  let matureCount = 0;
  for (let i = 0; i < detectionCount; i++) {
    const label = pickWeightedLabel(matureCount, i);
    if (label === "mature") matureCount += 1;
    const minutesOfDay = Math.floor(randomBetween(0, 1440));
    entries.push({
      id: `d-${i}`,
      type: "detection",
      hour: Math.floor(minutesOfDay / 60),
      minute: minutesOfDay % 60,
      label,
      confidence: randomBetween(0.6, 0.98),
    });
  }
  const irrigationSchedule = generateDaySchedule();
  irrigationSchedule.forEach((hourOfDay, i) => {
    entries.push({
      id: `i-${i}`,
      type: "irrigation",
      hour: Math.floor(hourOfDay),
      minute: Math.round((hourOfDay % 1) * 60),
      duration: randomBetween(14, 28),
    });
  });
  return entries.sort(
    (a, b) => b.hour * 60 + b.minute - (a.hour * 60 + a.minute)
  );
}

type Tab = "monitor" | "telemetry" | "logs";

const LABEL_POOL = [
  { label: "no_sprout", color: "#fbbf24" },
  { label: "small_medium", color: "#818cf8" },
  { label: "mature", color: "#a3e635" },
];

// Maps Gemini's human-readable stage names onto the internal label keys used
// throughout sessionCounts, logEntries, and LABEL_POOL color lookups.
const GEMINI_STAGE_TO_LABEL: Record<string, string> = {
  "No Sprout": "no_sprout",
  "Small-Medium": "small_medium",
  Mature: "mature",
};

type GeminiDetection = {
  stage: string;
};

const GEMINI_PROMPT = `You are inspecting a photo of oyster mushroom growing bags (substrate blocks with a plastic-wrapped opening, also called the "spawn bag cap" or "neck").

STRICT RULE: only classify a bag if its opening/cap (the wrapped neck where mushrooms emerge) is clearly and fully visible in the image. If the opening is blurry, cropped at the frame edge, angled away from the camera, obstructed by another bag, or otherwise not clearly visible, SKIP that bag entirely — do not classify it and do not guess.

For each bag whose opening IS clearly visible, classify it into exactly one of these three stages based on what is growing from it:
- "No Sprout": the opening is clearly visible and shows no mushroom growth at all — no pins, no bumps, nothing emerging.
- "Small-Medium": a mushroom is visibly growing but the cap has not fully unfurled, is still curled/cupped, or is noticeably smaller than a full mature cap.
- "Mature": the mushroom cap is fully unfurled and flattened/fan-shaped, with visible gills on the underside, at or near harvest size.

Count each qualifying bag exactly once. Do not invent bags that are not visibly present, and do not classify any bag whose opening you cannot clearly see. Respond strictly as a JSON array with one object per bag classified, like this: [{"stage": "Mature"}, {"stage": "No Sprout"}]. Do not include any other text, explanation, or markdown formatting.`;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function extractJsonArray(text: string): GeminiDetection[] {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) {
    throw new Error("No JSON array found in Gemini response");
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

const geminiClient = new GoogleGenAI({
  apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? "",
});

// Mature mushrooms should stay rare: cap them under 5% of total detections
const MATURE_MAX_RATIO = 0.05;
const MATURE_PICK_CHANCE = 0.04;

function pickWeightedLabel(matureCount: number, totalCount: number): string {
  const matureRatio = totalCount > 0 ? matureCount / totalCount : 0;
  if (matureRatio < MATURE_MAX_RATIO && Math.random() < MATURE_PICK_CHANCE) {
    return "mature";
  }
  return Math.random() < 0.5 ? "no_sprout" : "small_medium";
}

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "monitor", label: "Monitor", icon: <Camera className="h-5 w-5" /> },
  {
    id: "telemetry",
    label: "Telemetry",
    icon: <Activity className="h-5 w-5" />,
  },
  { id: "logs", label: "Logs", icon: <ListTree className="h-5 w-5" /> },
];

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function MushroomIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 11c0-4.5 4-8 9-8s9 3.5 9 8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <path d="M9 13v5a3 3 0 0 0 6 0v-5" />
      <path d="M9.5 13.5h5" />
    </svg>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("monitor");

  const [logEntries, setLogEntries] = useState<DetectionLogEntry[]>([]);
  const logIdRef = useRef(0);

  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>(
    () => Object.fromEntries(LABEL_POOL.map((def) => [def.label, 0]))
  );

  const [now, setNow] = useState(() => new Date());
  const loggedScheduleHoursRef = useRef<Set<number>>(new Set());
  const [wateringEvents, setWateringEvents] = useState<WateringEvent[]>([]);
  const EVENTS_PER_PAGE = 8;

  const [historicalDays, setHistoricalDays] = useState<CombinedLogEntry[][]>(
    []
  );
  const [logsDayIndex, setLogsDayIndex] = useState(0);
  const [logsPage, setLogsPage] = useState(0);

  const [metrics, setMetrics] = useState<SensorMetric[]>([
    {
      id: "dht22-temp",
      label: "Temp (DHT22)",
      value: 24.6,
      min: 21,
      max: 29,
      unit: "°C",
      decimals: 1,
      icon: <Thermometer className="h-4 w-4" />,
    },
    {
      id: "dht22-humidity",
      label: "Humidity (DHT22)",
      value: 86.2,
      min: 70,
      max: 95,
      unit: "%",
      decimals: 1,
      icon: <Droplets className="h-4 w-4" />,
    },
    {
      id: "scd41-co2",
      label: "CO2 (SCD41)",
      value: 612,
      min: 400,
      max: 900,
      unit: "ppm",
      decimals: 0,
      icon: <Wind className="h-4 w-4" />,
    },
    {
      id: "load",
      label: "Compute Load",
      value: 42,
      min: 18,
      max: 88,
      unit: "%",
      decimals: 0,
      icon: <Cpu className="h-4 w-4" />,
    },
  ]);

  // Gemini-based classification state — uploading a photo runs a real
  // analysis and tallies the resulting stage counts.
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(
    null
  );
  const [isScanning, setIsScanning] = useState(false);
  const [geminiError, setGeminiError] = useState<string | null>(null);
  const [lastResultCounts, setLastResultCounts] = useState<Record<
    string,
    number
  > | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback(async (file: File) => {
    setGeminiError(null);
    setUploadedImageUrl(URL.createObjectURL(file));
    setIsScanning(true);

    try {
      const base64 = await fileToBase64(file);

      const [response] = await Promise.all([
        geminiClient.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              role: "user",
              parts: [
                { text: GEMINI_PROMPT },
                {
                  inlineData: {
                    mimeType: file.type || "image/jpeg",
                    data: base64,
                  },
                },
              ],
            },
          ],
        }),
        // Keep the scan animation visible for at least 1.5s regardless of API speed.
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);

      const text =
        (response as { text?: string }).text ??
        (
          response as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          }
        ).candidates?.[0]?.content?.parts?.[0]?.text ??
        "";
      const detections = extractJsonArray(text);

      const resultCounts: Record<string, number> = Object.fromEntries(
        LABEL_POOL.map((def) => [def.label, 0])
      );
      for (const det of detections) {
        const label = GEMINI_STAGE_TO_LABEL[det.stage] ?? "no_sprout";
        resultCounts[label] = (resultCounts[label] ?? 0) + 1;
      }
      setLastResultCounts(resultCounts);

      // Fold this photo's counts into the running session totals + log.
      const createdAt = new Date();
      setSessionCounts((counts) => {
        const next = { ...counts };
        for (const label of Object.keys(resultCounts)) {
          next[label] = (next[label] ?? 0) + resultCounts[label];
        }
        return next;
      });
      setLogEntries((logs) => {
        const newEntries: DetectionLogEntry[] = detections.map((det) => {
          logIdRef.current += 1;
          return {
            id: logIdRef.current,
            label: GEMINI_STAGE_TO_LABEL[det.stage] ?? "no_sprout",
            confidence: randomBetween(0.82, 0.98),
            hour: createdAt.getHours(),
            minute: createdAt.getMinutes(),
          };
        });
        return [...newEntries, ...logs].slice(0, 30);
      });
    } catch (err) {
      console.error("Gemini classification failed:", err);
      setGeminiError(
        err instanceof Error ? err.message : "Classification failed"
      );
    } finally {
      setIsScanning(false);
    }
  }, []);

  const handleFileInputChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
    e.target.value = "";
  };


  // Synthetic sensor telemetry loop
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics((prev) =>
        prev.map((metric) => {
          const range = metric.max - metric.min;
          const drift = randomBetween(-range * 0.015, range * 0.015);
          let value = metric.value + drift;
          value = Math.min(metric.max, Math.max(metric.min, value));
          return { ...metric, value };
        })
      );
    }, 900);

    return () => clearInterval(interval);
  }, []);

  // Generate today's irrigation schedule client-side (avoids SSR/client
  // hydration mismatch from random values), then tick the clock and log
  // misting events as their scheduled time passes
  useEffect(() => {
    const schedule = generateDaySchedule();

    const currentHour = new Date().getHours() + new Date().getMinutes() / 60;
    const due = schedule.filter((hour) => hour <= currentHour);
    due.forEach((hour) => loggedScheduleHoursRef.current.add(hour));
    setWateringEvents(
      due.map((hour, index) => ({
        id: index,
        hour: Math.floor(hour),
        minute: Math.round((hour % 1) * 60),
        duration: randomBetween(14, 28),
        fired: true,
      }))
    );

    const interval = setInterval(() => {
      const current = new Date();
      setNow(current);
      const currentHour = current.getHours() + current.getMinutes() / 60;
      const due = schedule.find(
        (hour) =>
          hour <= currentHour && !loggedScheduleHoursRef.current.has(hour)
      );
      if (due === undefined) return;
      loggedScheduleHoursRef.current.add(due);
      setWateringEvents((events) => [
        ...events,
        {
          id: events.length,
          hour: Math.floor(due),
          minute: Math.round((due % 1) * 60),
          duration: randomBetween(14, 28),
          fired: true,
        },
      ]);
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  // Generate historical day data client-side to avoid hydration mismatch
  useEffect(() => {
    setHistoricalDays(Array.from({ length: 4 }, () => buildHistoricalDay()));
  }, []);

  const todayCombined = useMemo<CombinedLogEntry[]>(() => {
    const detections: CombinedLogEntry[] = logEntries.map((e) => ({
      id: `d-${e.id}`,
      type: "detection",
      hour: e.hour,
      minute: e.minute,
      label: e.label,
      confidence: e.confidence,
    }));
    const irrigation: CombinedLogEntry[] = wateringEvents.map((e) => ({
      id: `i-${e.id}`,
      type: "irrigation",
      hour: e.hour,
      minute: e.minute,
      duration: e.duration,
    }));
    return [...detections, ...irrigation].sort(
      (a, b) => b.hour * 60 + b.minute - (a.hour * 60 + a.minute)
    );
  }, [logEntries, wateringEvents]);

  const totalLogDays = historicalDays.length + 1;
  const selectedDayEntries =
    logsDayIndex === 0 ? todayCombined : historicalDays[logsDayIndex - 1];

  const logsDetectionCounts =
    logsDayIndex === 0
      ? sessionCounts
      : selectedDayEntries
          .filter((e) => e.type === "detection")
          .reduce<Record<string, number>>((acc, e) => {
            acc[e.label ?? ""] = (acc[e.label ?? ""] ?? 0) + 1;
            return acc;
          }, Object.fromEntries(LABEL_POOL.map((def) => [def.label, 0])));

  const logsMistEvents = selectedDayEntries.filter(
    (e) => e.type === "irrigation"
  );

  const logsDayLabel = (() => {
    if (logsDayIndex === 0) return "Today";
    if (logsDayIndex === 1) return "Yesterday";
    const d = new Date();
    d.setDate(d.getDate() - logsDayIndex);
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  })();

  return (
    <div className="h-dvh w-full bg-emerald-950 text-zinc-100">
      <div className="mx-auto flex h-dvh w-full max-w-md flex-col bg-emerald-950">
        <header className="flex shrink-0 items-center gap-2 border-b border-emerald-900 px-4 py-3">
          <MushroomIcon className="h-5 w-5 text-emerald-400" />
          <h1 className="text-sm font-semibold tracking-wide text-zinc-100">
            SpotShrooms Field Monitor
          </h1>
        </header>

        <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 pb-2">
          {activeTab === "monitor" && (
            <>
              {/* Camera / photo viewer */}
              <section className="relative aspect-square w-full shrink-0 overflow-hidden rounded-xl border border-emerald-900 bg-gradient-to-br from-emerald-900 via-emerald-950 to-black">
                {uploadedImageUrl ? (
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${uploadedImageUrl})` }}
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-500">
                    <Camera className="h-8 w-8" />
                    <p className="text-[11px] font-medium">
                      Upload a mushroom shelf photo to begin
                    </p>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/35" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(34,197,94,0.12),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(56,189,248,0.08),transparent_50%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px]" />

                {/* upload analysis scan sweep */}
                {isScanning && (
                  <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div
                      className="absolute left-0 right-0 h-1 bg-emerald-400 shadow-[0_0_20px_4px_rgba(52,211,153,0.9)]"
                      style={{
                        animation: "spotshrooms-scan 1.5s ease-in-out",
                      }}
                    />
                    <div className="absolute inset-0 bg-emerald-400/5" />
                  </div>
                )}
                <style>{`
                  @keyframes spotshrooms-scan {
                    0%   { top: 0%; opacity: 0; }
                    10%  { opacity: 1; }
                    90%  { opacity: 1; }
                    100% { top: 100%; opacity: 0; }
                  }
                `}</style>

                {/* HUD overlay */}
                <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded bg-black/50 px-2 py-1 backdrop-blur-sm">
                  <Camera className="h-3 w-3 text-zinc-300" />
                </div>

                {/* corner reticles */}
                <div className="pointer-events-none absolute inset-2 border border-emerald-800/30" />

                {/* upload control */}
                <div className="absolute bottom-2 right-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isScanning}
                    className="flex items-center gap-1 rounded bg-black/60 px-2 py-1 text-[10px] font-medium text-zinc-300 backdrop-blur-sm transition-colors hover:text-emerald-300 disabled:opacity-50"
                  >
                    <UploadCloud className="h-3 w-3" />
                    {isScanning ? "Analyzing..." : "Upload photo"}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                </div>
              </section>

              {geminiError && (
                <div className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-[11px] text-red-300">
                  {geminiError}
                </div>
              )}

              {/* Classification results — cumulative across every photo uploaded this session */}
              <section>
                <div className="mb-2 flex items-center gap-2 px-0.5">
                  <Camera className="h-4 w-4 text-emerald-400" />
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Session Totals
                  </h2>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {LABEL_POOL.map((def) => (
                    <div
                      key={def.label}
                      className="rounded-lg border border-emerald-900 bg-emerald-900/20 px-2 py-3 text-center"
                    >
                      <p
                        className="text-2xl font-bold tabular-nums"
                        style={{ color: def.color }}
                      >
                        {sessionCounts[def.label] ?? 0}
                      </p>
                      <p className="mt-1 truncate text-[9px] uppercase tracking-wide text-zinc-500">
                        {def.label.replace("_", " ")}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-zinc-600">
                  {Object.values(sessionCounts).reduce((a, b) => a + b, 0)}{" "}
                  mushrooms classified across all uploads this session
                </p>
              </section>

            </>
          )}

          {activeTab === "telemetry" && (
            <section>
              <div className="mb-2 flex items-center gap-2 px-0.5">
                <Activity className="h-4 w-4 text-sky-400" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Live Sensor Telemetry
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {metrics.map((metric) => (
                  <div
                    key={metric.id}
                    className="rounded-lg border border-emerald-900 bg-emerald-900/20 p-3"
                  >
                    <div className="mb-1.5 flex items-center gap-1.5 text-zinc-500">
                      {metric.icon}
                      <span className="text-[11px] font-medium">
                        {metric.label}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-semibold tabular-nums text-zinc-100">
                        {metric.value.toFixed(metric.decimals)}
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        {metric.unit}
                      </span>
                    </div>
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-emerald-900">
                      <div
                        className="h-full rounded-full bg-sky-400 transition-all duration-700"
                        style={{
                          width: `${
                            ((metric.value - metric.min) /
                              (metric.max - metric.min)) *
                            100
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === "logs" && (
            <section className="flex min-h-0 flex-1 flex-col">
              <div className="mb-2 flex items-center gap-2 px-0.5">
                <ListTree className="h-4 w-4 text-amber-400" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Daily Log
                </h2>
              </div>

              <div className="flex items-center justify-between rounded-t-lg border border-b-0 border-emerald-900 bg-emerald-900/20 px-2 py-2">
                <button
                  type="button"
                  onClick={() => {
                    setLogsDayIndex((d) => Math.min(totalLogDays - 1, d + 1));
                    setLogsPage(0);
                  }}
                  disabled={logsDayIndex === totalLogDays - 1}
                  className="rounded p-1 text-zinc-400 transition-colors disabled:opacity-30 enabled:hover:text-zinc-100"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-[11px] font-medium text-zinc-300">
                  {logsDayLabel}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setLogsDayIndex((d) => Math.max(0, d - 1));
                    setLogsPage(0);
                  }}
                  disabled={logsDayIndex === 0}
                  className="rounded p-1 text-zinc-400 transition-colors disabled:opacity-30 enabled:hover:text-zinc-100"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="rounded-b-lg border border-emerald-900 bg-emerald-900/20 p-3">
                <div className="flex items-center gap-1.5 text-zinc-500">
                  <Camera className="h-4 w-4" />
                  <span className="text-[11px] font-medium">
                    Detection Counts
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {LABEL_POOL.map((def) => (
                    <div
                      key={def.label}
                      className="rounded-md border border-emerald-900 bg-emerald-900/30 px-2 py-1.5 text-center"
                    >
                      <p
                        className="text-base font-semibold tabular-nums"
                        style={{ color: def.color }}
                      >
                        {logsDetectionCounts[def.label] ?? 0}
                      </p>
                      <p className="truncate text-[9px] text-zinc-500">
                        {def.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {(() => {
                const pageCount = Math.max(
                  1,
                  Math.ceil(logsMistEvents.length / EVENTS_PER_PAGE)
                );
                const page = Math.min(logsPage, pageCount - 1);
                const pageItems = logsMistEvents.slice(
                  page * EVENTS_PER_PAGE,
                  page * EVENTS_PER_PAGE + EVENTS_PER_PAGE
                );

                return (
                  <div className="mt-3 overflow-hidden rounded-lg border border-emerald-900 bg-emerald-900/20">
                    <div className="flex items-center justify-between border-b border-emerald-900 px-3 py-2">
                      <div className="flex items-center gap-1.5 text-zinc-500">
                        <Droplets className="h-4 w-4" />
                        <span className="text-[11px] font-medium">
                          Mist Timings
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-500">
                        {logsMistEvents.length} event
                        {logsMistEvents.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <ul className="divide-y divide-emerald-900">
                      {pageItems.length === 0 ? (
                        <li className="p-4 text-center text-[11px] text-zinc-500">
                          No mistings this day
                        </li>
                      ) : (
                        pageItems.map((entry) => (
                          <li
                            key={entry.id}
                            className="flex items-center justify-between px-3 py-2"
                          >
                            <span className="text-[12px] font-medium text-zinc-200">
                              {formatHm(entry.hour, entry.minute)}
                            </span>
                            <span className="rounded-full bg-emerald-900 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                              misted · {(entry.duration ?? 0).toFixed(1)}s
                            </span>
                          </li>
                        ))
                      )}
                    </ul>

                    {pageCount > 1 && (
                      <div className="flex items-center justify-between border-t border-emerald-900 px-3 py-2">
                        <button
                          type="button"
                          onClick={() => setLogsPage((p) => Math.max(0, p - 1))}
                          disabled={page === 0}
                          className="rounded p-1 text-zinc-400 transition-colors disabled:opacity-30 enabled:hover:text-zinc-100"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="text-[10px] text-zinc-500">
                          Page {page + 1} of {pageCount}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setLogsPage((p) => Math.min(pageCount - 1, p + 1))
                          }
                          disabled={page === pageCount - 1}
                          className="rounded p-1 text-zinc-400 transition-colors disabled:opacity-30 enabled:hover:text-zinc-100"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </section>
          )}
        </main>

        <nav className="grid shrink-0 grid-cols-3 border-t border-emerald-900 bg-emerald-950">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors ${
                activeTab === tab.id
                  ? "text-emerald-400"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

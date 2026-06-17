"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Camera,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  Droplets,
  ListTree,
  Radio,
  SprayCan,
  Thermometer,
  TreeDeciduous,
  Wind,
} from "lucide-react";

type BoundingBox = {
  id: number;
  label: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  color: string;
};

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
  const count = Math.floor(randomBetween(9, 13));
  const hours = Array.from({ length: count }, () => randomBetween(0, 24));
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
  const irrigationCount = Math.floor(randomBetween(9, 13));
  for (let i = 0; i < irrigationCount; i++) {
    const minutesOfDay = Math.floor(randomBetween(0, 1440));
    entries.push({
      id: `i-${i}`,
      type: "irrigation",
      hour: Math.floor(minutesOfDay / 60),
      minute: minutesOfDay % 60,
      duration: randomBetween(14, 28),
    });
  }
  return entries.sort(
    (a, b) => b.hour * 60 + b.minute - (a.hour * 60 + a.minute)
  );
}

type Tab = "monitor" | "irrigation" | "logs";

const LABEL_POOL = [
  { label: "no_sprout", color: "#fbbf24" },
  { label: "small_medium", color: "#818cf8" },
  { label: "mature", color: "#a3e635" },
];

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
    id: "irrigation",
    label: "Irrigation",
    icon: <SprayCan className="h-5 w-5" />,
  },
  { id: "logs", label: "Logs", icon: <ListTree className="h-5 w-5" /> },
];

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

// Keep boxes out of the bottom-left corner reserved for the SESSION HUD badge
const HUD_SAFE_BOTTOM = 18;
const HUD_SAFE_LEFT = 45;

function createBox(
  id: number,
  matureCount: number,
  totalCount: number
): BoundingBox {
  const label = pickWeightedLabel(matureCount, totalCount);
  const def = LABEL_POOL.find((d) => d.label === label)!;
  const width = randomBetween(18, 32);
  const height = randomBetween(14, 26);
  const maxY = 100 - height;
  let y = randomBetween(0, maxY);
  let x = randomBetween(0, 100 - width);
  if (y + height > 100 - HUD_SAFE_BOTTOM && x < HUD_SAFE_LEFT) {
    y = randomBetween(0, Math.max(0, 100 - HUD_SAFE_BOTTOM - height));
  }
  return {
    id,
    label: def.label,
    confidence: randomBetween(0.62, 0.98),
    x,
    y,
    width,
    height,
    vx: randomBetween(-0.6, 0.6),
    vy: randomBetween(-0.4, 0.4),
    color: def.color,
  };
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("monitor");

  const [boxes, setBoxes] = useState<BoundingBox[]>([]);
  const [fps, setFps] = useState(29.7);
  const [scanLineOffset, setScanLineOffset] = useState(0);
  const boxIdRef = useRef(0);

  const [mistDuration, setMistDuration] = useState(18.4);
  const [mistHistory, setMistHistory] = useState<number[]>([
    16.2, 17.8, 15.9, 19.1, 18.0, 20.3, 18.7, 17.2, 19.6, 18.4,
  ]);

  const [logEntries, setLogEntries] = useState<DetectionLogEntry[]>([]);
  const logIdRef = useRef(0);
  const lastLoggedBoxIdRef = useRef(0);

  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>(
    () => Object.fromEntries(LABEL_POOL.map((def) => [def.label, 0]))
  );
  const sessionCountsRef = useRef(sessionCounts);
  useEffect(() => {
    sessionCountsRef.current = sessionCounts;
  }, [sessionCounts]);

  const [now, setNow] = useState(() => new Date());
  const [todaySchedule] = useState<number[]>(() => generateDaySchedule());
  const [wateringEvents, setWateringEvents] = useState<WateringEvent[]>(() => {
    const currentHour = new Date().getHours() + new Date().getMinutes() / 60;
    return todaySchedule
      .filter((hour) => hour <= currentHour)
      .map((hour, index) => ({
        id: index,
        hour: Math.floor(hour),
        minute: Math.round((hour % 1) * 60),
        duration: randomBetween(14, 28),
        fired: true,
      }));
  });
  const [eventsPage, setEventsPage] = useState(0);
  const EVENTS_PER_PAGE = 8;

  const [historicalDays] = useState<CombinedLogEntry[][]>(() =>
    Array.from({ length: 4 }, () => buildHistoricalDay())
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

  // Bounding box tracking simulation loop
  useEffect(() => {
    const initial = Array.from({ length: 4 }, () => {
      boxIdRef.current += 1;
      const counts = sessionCountsRef.current;
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      return createBox(boxIdRef.current, counts.mature ?? 0, total);
    });
    setBoxes(initial);

    const moveInterval = setInterval(() => {
      setBoxes((prev) =>
        prev.map((box) => {
          let { x, y, vx, vy } = box;
          x += vx;
          y += vy;

          if (x <= 0 || x + box.width >= 100) vx = -vx;
          if (y <= 0 || y + box.height >= 100) vy = -vy;

          x = Math.min(Math.max(x, 0), 100 - box.width);
          y = Math.min(Math.max(y, 0), 100 - box.height);

          const maxYAtX = x < HUD_SAFE_LEFT ? 100 - HUD_SAFE_BOTTOM - box.height : 100 - box.height;
          if (y > maxYAtX) {
            y = Math.max(0, maxYAtX);
            vy = -Math.abs(vy);
          }

          const confidence = Math.min(
            0.99,
            Math.max(0.55, box.confidence + randomBetween(-0.03, 0.03))
          );

          return { ...box, x, y, vx, vy, confidence };
        })
      );
    }, 120);

    const churnInterval = setInterval(() => {
      setBoxes((prev) => {
        const next = [...prev];
        const targetCount = Math.random() > 0.5 ? 4 : 5;

        if (next.length < targetCount) {
          boxIdRef.current += 1;
          const counts = sessionCountsRef.current;
          const total = Object.values(counts).reduce((a, b) => a + b, 0);
          next.push(createBox(boxIdRef.current, counts.mature ?? 0, total));
        } else if (next.length > 3 && Math.random() > 0.6) {
          next.splice(Math.floor(Math.random() * next.length), 1);
        }
        return next;
      });
      setFps(randomBetween(27, 31));
    }, 2200);

    const scanInterval = setInterval(() => {
      setScanLineOffset((prev) => (prev + 1.5) % 100);
    }, 60);

    return () => {
      clearInterval(moveInterval);
      clearInterval(churnInterval);
      clearInterval(scanInterval);
    };
  }, []);

  // Mirror newly tracked boxes into the detection log
  useEffect(() => {
    const newest = boxes.reduce((max, box) => Math.max(max, box.id), 0);
    if (newest > lastLoggedBoxIdRef.current) {
      const box = boxes.find((b) => b.id === newest);
      if (box) {
        lastLoggedBoxIdRef.current = newest;
        logIdRef.current += 1;
        const createdAt = new Date();
        const entry: DetectionLogEntry = {
          id: logIdRef.current,
          label: box.label,
          confidence: box.confidence,
          hour: createdAt.getHours(),
          minute: createdAt.getMinutes(),
        };
        setLogEntries((logs) => [entry, ...logs].slice(0, 30));
        setSessionCounts((counts) => ({
          ...counts,
          [box.label]: (counts[box.label] ?? 0) + 1,
        }));
      }
    }
  }, [boxes]);

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

  // Random forest mist-duration inference loop (synthetic)
  useEffect(() => {
    const interval = setInterval(() => {
      setMistDuration((prev) => {
        const next = Math.min(35, Math.max(8, prev + randomBetween(-2.5, 2.5)));
        setMistHistory((history) => [...history.slice(-9), next]);
        return next;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Clock tick to advance "now" and log misting events as their time passes
  useEffect(() => {
    const interval = setInterval(() => {
      const current = new Date();
      setNow(current);
      const currentHour = current.getHours() + current.getMinutes() / 60;
      setWateringEvents((events) => {
        const loggedHours = new Set(events.map((e) => e.hour + e.minute / 60));
        const due = todaySchedule.find(
          (hour) => hour <= currentHour && !loggedHours.has(hour)
        );
        if (due === undefined) return events;
        return [
          ...events,
          {
            id: events.length,
            hour: Math.floor(due),
            minute: Math.round((due % 1) * 60),
            duration: randomBetween(14, 28),
            fired: true,
          },
        ];
      });
    }, 15000);

    return () => clearInterval(interval);
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
        <header className="flex shrink-0 items-center justify-between border-b border-emerald-900 px-4 py-3">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-emerald-400" />
            <h1 className="text-sm font-semibold tracking-wide text-zinc-100">
              SpotShrooms Field Monitor
            </h1>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            <span className="text-[11px] font-medium text-emerald-400">
              LIVE
            </span>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 pb-2">
          {activeTab === "monitor" && (
            <>
              {/* Camera feed */}
              <section className="relative aspect-[16/11] w-full shrink-0 overflow-hidden rounded-xl border border-emerald-900 bg-gradient-to-br from-emerald-900 via-emerald-950 to-black">
                {/* faux video texture */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(34,197,94,0.08),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(56,189,248,0.08),transparent_50%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px]" />

                {/* scan line */}
                <div
                  className="pointer-events-none absolute left-0 h-px w-full bg-emerald-400/40 shadow-[0_0_8px_2px_rgba(52,211,153,0.4)]"
                  style={{ top: `${scanLineOffset}%` }}
                />

                {/* bounding boxes */}
                {boxes.map((box) => (
                  <div
                    key={box.id}
                    className="absolute transition-[top,left] duration-100 ease-linear"
                    style={{
                      left: `${box.x}%`,
                      top: `${box.y}%`,
                      width: `${box.width}%`,
                      height: `${box.height}%`,
                    }}
                  >
                    <div
                      className="h-full w-full rounded-sm"
                      style={{ border: `2px solid ${box.color}` }}
                    >
                      <span
                        className="absolute -top-5 left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{
                          backgroundColor: box.color,
                          color: "#0a0a0a",
                        }}
                      >
                        {box.label} {(box.confidence * 100).toFixed(0)}%
                      </span>
                      <span
                        className="absolute -bottom-1 -right-1 h-2 w-2 rounded-full"
                        style={{ backgroundColor: box.color }}
                      />
                    </div>
                  </div>
                ))}

                {/* HUD overlay */}
                <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded bg-black/50 px-2 py-1 backdrop-blur-sm">
                  <Camera className="h-3 w-3 text-zinc-300" />
                  <span className="text-[10px] font-medium text-zinc-300">
                    CAM-01 · YOLOv11-cls
                  </span>
                </div>
                <div className="absolute right-2 top-2 rounded bg-black/50 px-2 py-1 backdrop-blur-sm">
                  <span className="text-[10px] font-medium text-zinc-300">
                    {fps.toFixed(1)} FPS
                  </span>
                </div>
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded bg-black/50 px-2 py-1 backdrop-blur-sm">
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500">
                    Session
                  </span>
                  {LABEL_POOL.map((def) => (
                    <span
                      key={def.label}
                      className="flex items-center gap-1 text-[10px] font-medium text-zinc-300"
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: def.color }}
                      />
                      {sessionCounts[def.label] ?? 0}
                    </span>
                  ))}
                  <span className="ml-1 border-l border-emerald-800 pl-1.5 text-[10px] font-medium text-zinc-300">
                    {Object.values(sessionCounts).reduce((a, b) => a + b, 0)}{" "}
                    total
                  </span>
                </div>

                {/* corner reticles */}
                <div className="pointer-events-none absolute inset-2 border border-emerald-800/30" />
              </section>

              {/* Sensor metrics */}
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
            </>
          )}

          {activeTab === "irrigation" && (
            <section>
              <div className="mb-2 flex items-center gap-2 px-0.5">
                <SprayCan className="h-4 w-4 text-violet-400" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Irrigation Control
                </h2>
              </div>
              <div className="rounded-lg border border-emerald-900 bg-emerald-900/20 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-zinc-500">
                    <TreeDeciduous className="h-4 w-4" />
                    <span className="text-[11px] font-medium">
                      Predicted Mist Duration
                    </span>
                  </div>
                  <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-400">
                    Random Forest
                  </span>
                </div>

                <div className="mt-1.5 flex items-baseline gap-1">
                  <span className="text-2xl font-semibold tabular-nums text-zinc-100">
                    {mistDuration.toFixed(1)}
                  </span>
                  <span className="text-[11px] text-zinc-500">seconds</span>
                </div>

                {(() => {
                  const dataMin = Math.min(...mistHistory);
                  const dataMax = Math.max(...mistHistory);
                  const padding = Math.max((dataMax - dataMin) * 0.25, 1);
                  const chartMin = Math.max(0, dataMin - padding);
                  const chartMax = dataMax + padding;
                  const w = 280;
                  const h = 110;
                  const points = mistHistory.map((value, index) => {
                    const x =
                      mistHistory.length > 1
                        ? (index / (mistHistory.length - 1)) * w
                        : w / 2;
                    const y =
                      h - ((value - chartMin) / (chartMax - chartMin)) * h;
                    return { x, y, value };
                  });
                  const linePoints = points
                    .map((p) => `${p.x},${p.y}`)
                    .join(" ");
                  const areaPoints = `0,${h} ${linePoints} ${w},${h}`;

                  return (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[10px] text-zinc-600">
                        <span>{chartMax.toFixed(1)}s</span>
                        <span>last {mistHistory.length} readings</span>
                      </div>
                      <svg
                        viewBox={`0 0 ${w} ${h}`}
                        className="mt-1 h-28 w-full overflow-visible"
                      >
                        {[0.25, 0.5, 0.75].map((frac) => (
                          <line
                            key={frac}
                            x1={0}
                            x2={w}
                            y1={h * frac}
                            y2={h * frac}
                            stroke="#27272a"
                            strokeWidth="1"
                            strokeDasharray="3 3"
                          />
                        ))}
                        <polygon
                          points={areaPoints}
                          fill="url(#mistGradient)"
                          opacity="0.25"
                        />
                        <polyline
                          fill="none"
                          stroke="#a78bfa"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={linePoints}
                        />
                        {points.map((p, i) => (
                          <circle
                            key={i}
                            cx={p.x}
                            cy={p.y}
                            r={i === points.length - 1 ? 3.5 : 2}
                            fill={
                              i === points.length - 1 ? "#c4b5fd" : "#a78bfa"
                            }
                          />
                        ))}
                        <defs>
                          <linearGradient
                            id="mistGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop offset="0%" stopColor="#a78bfa" />
                            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="flex items-center justify-between text-[10px] text-zinc-600">
                        <span>{chartMin.toFixed(1)}s</span>
                        <span>
                          range {(dataMax - dataMin).toFixed(1)}s
                        </span>
                      </div>
                    </div>
                  );
                })()}
                <p className="mt-3 text-[10px] text-zinc-600">
                  Inferred from temperature, humidity, and CO2 readings
                </p>
              </div>

              {/* Misted today */}
              <div className="mt-3 flex-1 overflow-hidden rounded-lg border border-emerald-900 bg-emerald-900/20 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-zinc-500">
                    <Clock className="h-4 w-4" />
                    <span className="text-[11px] font-medium">
                      Misted Today
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-500">
                    {wateringEvents.length} event
                    {wateringEvents.length === 1 ? "" : "s"}
                  </span>
                </div>

                {(() => {
                  const ordered = [...wateringEvents].reverse();
                  const pageCount = Math.max(
                    1,
                    Math.ceil(ordered.length / EVENTS_PER_PAGE)
                  );
                  const page = Math.min(eventsPage, pageCount - 1);
                  const pageItems = ordered.slice(
                    page * EVENTS_PER_PAGE,
                    page * EVENTS_PER_PAGE + EVENTS_PER_PAGE
                  );

                  return (
                    <>
                      <ul className="mt-2 divide-y divide-emerald-900 border-t border-emerald-900">
                        {pageItems.length === 0 ? (
                          <li className="py-2 text-center text-[11px] text-zinc-500">
                            No mistings yet today
                          </li>
                        ) : (
                          pageItems.map((event) => (
                            <li
                              key={event.id}
                              className="flex items-center justify-between py-1.5"
                            >
                              <span className="text-[12px] font-medium text-zinc-200">
                                {String(event.hour).padStart(2, "0")}:
                                {String(event.minute).padStart(2, "0")}
                              </span>
                              <span className="text-[10px] text-zinc-500">
                                misted · {event.duration.toFixed(1)}s
                              </span>
                            </li>
                          ))
                        )}
                      </ul>

                      {pageCount > 1 && (
                        <div className="mt-2 flex items-center justify-between border-t border-emerald-900 pt-2">
                          <button
                            type="button"
                            onClick={() =>
                              setEventsPage((p) => Math.max(0, p - 1))
                            }
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
                              setEventsPage((p) =>
                                Math.min(pageCount - 1, p + 1)
                              )
                            }
                            disabled={page === pageCount - 1}
                            className="rounded p-1 text-zinc-400 transition-colors disabled:opacity-30 enabled:hover:text-zinc-100"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
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

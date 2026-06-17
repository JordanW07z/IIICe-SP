"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Camera,
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
  time: string;
};

type Tab = "monitor" | "irrigation" | "logs";

const LABEL_POOL = [
  { label: "no_sprout", color: "#fbbf24" },
  { label: "small_medium", color: "#818cf8" },
  { label: "mature", color: "#a3e635" },
];

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

function createBox(id: number): BoundingBox {
  const def = LABEL_POOL[Math.floor(Math.random() * LABEL_POOL.length)];
  const width = randomBetween(18, 32);
  const height = randomBetween(14, 26);
  return {
    id,
    label: def.label,
    confidence: randomBetween(0.62, 0.98),
    x: randomBetween(0, 100 - width),
    y: randomBetween(0, 100 - height),
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
      return createBox(boxIdRef.current);
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
          next.push(createBox(boxIdRef.current));
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
        const entry: DetectionLogEntry = {
          id: logIdRef.current,
          label: box.label,
          confidence: box.confidence,
          time: new Date().toLocaleTimeString(),
        };
        setLogEntries((logs) => [entry, ...logs].slice(0, 30));
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

  return (
    <div className="min-h-screen w-full bg-black text-zinc-100">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-zinc-950">
        <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-emerald-400" />
            <div>
              <h1 className="text-sm font-semibold tracking-wide text-zinc-100">
                SpotShrooms Field Monitor
              </h1>
              <p className="text-[11px] text-zinc-500">
                YOLOv11 live detection · sim mode
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            <span className="text-[11px] font-medium text-emerald-400">
              LIVE
            </span>
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-4 p-4 pb-2">
          {activeTab === "monitor" && (
            <>
              {/* Camera feed */}
              <section className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black">
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
                    CAM-01 · YOLOv11n
                  </span>
                </div>
                <div className="absolute right-2 top-2 rounded bg-black/50 px-2 py-1 backdrop-blur-sm">
                  <span className="text-[10px] font-medium text-zinc-300">
                    {fps.toFixed(1)} FPS
                  </span>
                </div>
                <div className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-1 backdrop-blur-sm">
                  <span className="text-[10px] font-medium text-zinc-300">
                    {boxes.length} object{boxes.length === 1 ? "" : "s"}{" "}
                    tracked
                  </span>
                </div>

                {/* corner reticles */}
                <div className="pointer-events-none absolute inset-2 border border-zinc-700/30" />
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
                      className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3"
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
                      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
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
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
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

                <svg
                  viewBox="0 0 200 48"
                  preserveAspectRatio="none"
                  className="mt-3 h-12 w-full"
                >
                  <polyline
                    fill="none"
                    stroke="#a78bfa"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={mistHistory
                      .map((value, index) => {
                        const x = (index / (mistHistory.length - 1)) * 200;
                        const y = 44 - ((value - 8) / (35 - 8)) * 40;
                        return `${x},${y}`;
                      })
                      .join(" ")}
                  />
                </svg>
                <p className="mt-1 text-[10px] text-zinc-600">
                  Inferred from temperature, humidity, and CO2 readings
                </p>
              </div>
            </section>
          )}

          {activeTab === "logs" && (
            <section>
              <div className="mb-2 flex items-center gap-2 px-0.5">
                <ListTree className="h-4 w-4 text-amber-400" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Detection Log
                </h2>
              </div>
              <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/60">
                {logEntries.length === 0 ? (
                  <p className="p-4 text-center text-[11px] text-zinc-500">
                    Waiting for detections…
                  </p>
                ) : (
                  <ul className="divide-y divide-zinc-800">
                    {logEntries.map((entry) => (
                      <li
                        key={entry.id}
                        className="flex items-center justify-between px-3 py-2.5"
                      >
                        <div>
                          <p className="text-[12px] font-medium text-zinc-200">
                            {entry.label}
                          </p>
                          <p className="text-[10px] text-zinc-500">
                            {entry.time}
                          </p>
                        </div>
                        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                          {(entry.confidence * 100).toFixed(0)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}
        </main>

        <nav className="grid grid-cols-3 border-t border-zinc-800 bg-zinc-950">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
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

        <footer className="border-t border-zinc-800 px-4 py-2 text-center">
          <p className="text-[10px] text-zinc-600">
            Synthetic telemetry · no external data sources
          </p>
        </footer>
      </div>
    </div>
  );
}

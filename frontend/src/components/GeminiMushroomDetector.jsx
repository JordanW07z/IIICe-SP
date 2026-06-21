import { useState, useRef, useCallback } from "react";
import { GoogleGenAI } from "@google/genai";

const STAGE_STYLES = {
  "No Sprout": {
    border: "border-red-500 border-dashed",
    pill: "bg-red-500/90 text-white",
    glow: "",
  },
  "Small-Medium": {
    border: "border-yellow-400",
    pill: "bg-yellow-400/90 text-black",
    glow: "",
  },
  Mature: {
    border: "border-green-400 shadow-[0_0_12px_2px_rgba(74,222,128,0.7)]",
    pill: "bg-green-400/90 text-black",
    glow: "",
  },
};

const PROMPT = `Detect all oyster mushroom clusters in the image. For each cluster, classify the stage ('No Sprout', 'Small-Medium', or 'Mature') and provide its exact bounding box coordinates using the 0-1000 normalized format: [ymin, xmin, ymax, xmax]. Respond strictly in a JSON array format like this: [{"stage": "Mature", "box_2d": [ymin, xmin, ymax, xmax]}]`;

// Converts a Gemini box_2d [ymin, xmin, ymax, xmax] (0-1000 scale) into CSS percentage strings.
function boxToStyle([ymin, xmin, ymax, xmax]) {
  return {
    top: `${ymin / 10}%`,
    left: `${xmin / 10}%`,
    width: `${(xmax - xmin) / 10}%`,
    height: `${(ymax - ymin) / 10}%`,
  };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // reader.result is "data:image/png;base64,XXXX" — strip the prefix.
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function extractJsonArray(text) {
  // Gemini sometimes wraps JSON in ```json fences — strip them before parsing.
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("No JSON array found in Gemini response");
  return JSON.parse(cleaned.slice(start, end + 1));
}

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

export default function GeminiMushroomDetector() {
  const [imageUrl, setImageUrl] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [detections, setDetections] = useState([]);
  const [counters, setCounters] = useState({ noSprout: 0, smallMedium: 0, mature: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const runDetection = useCallback(async (file) => {
    setError(null);
    setDetections([]);
    setImageUrl(URL.createObjectURL(file));
    setIsScanning(true);

    try {
      const base64 = await fileToBase64(file);

      const [response] = await Promise.all([
        ai.models.generateContent({
          model: "gemini-1.5-flash",
          contents: [
            {
              role: "user",
              parts: [
                { text: PROMPT },
                { inlineData: { mimeType: file.type || "image/jpeg", data: base64 } },
              ],
            },
          ],
        }),
        // Keep the scanning animation visible for at least 1.5s regardless of API speed.
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);

      const text = response.text ?? response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const parsed = extractJsonArray(text);

      setDetections(parsed);

      const next = { noSprout: 0, smallMedium: 0, mature: 0 };
      for (const det of parsed) {
        if (det.stage === "No Sprout") next.noSprout += 1;
        else if (det.stage === "Small-Medium") next.smallMedium += 1;
        else if (det.stage === "Mature") next.mature += 1;
      }
      setCounters(next);
    } catch (err) {
      console.error("Gemini detection failed:", err);
      setError(err.message || "Detection failed");
    } finally {
      setIsScanning(false);
    }
  }, []);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) runDetection(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) runDetection(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      <style>{`
        @keyframes scan-sweep {
          0%   { top: 0%; opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .scan-line {
          animation: scan-sweep 1.5s ease-in-out;
        }
      `}</style>

      {/* Camera viewfinder container */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative w-full aspect-[4/3] rounded-xl overflow-hidden border-2 cursor-pointer
          ${isDragging ? "border-green-400" : "border-zinc-700"}
          bg-zinc-900 flex items-center justify-center`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Uploaded mushroom shelf"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="text-center text-zinc-400 px-6">
            <p className="text-sm font-semibold">Click or drag an image here</p>
            <p className="text-xs mt-1 text-zinc-500">Oyster mushroom shelf photo</p>
          </div>
        )}

        {/* Scanning laser overlay */}
        {isScanning && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="scan-line absolute left-0 right-0 h-1 bg-green-400 shadow-[0_0_20px_4px_rgba(74,222,128,0.9)]" />
            <div className="absolute inset-0 bg-green-400/5" />
          </div>
        )}

        {/* Bounding boxes */}
        {!isScanning &&
          detections.map((det, i) => {
            const style = boxToStyle(det.box_2d);
            const theme = STAGE_STYLES[det.stage] || STAGE_STYLES["No Sprout"];
            return (
              <div
                key={i}
                className={`absolute border-2 rounded-sm ${theme.border}`}
                style={style}
              >
                <span
                  className={`absolute -top-6 left-0 text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap ${theme.pill}`}
                >
                  {det.stage}
                </span>
              </div>
            );
          })}

        {/* Status badge */}
        <div className="absolute top-2 left-2 z-10 text-[11px] font-mono px-2 py-1 rounded bg-black/60 text-green-300">
          {isScanning ? "SCANNING..." : detections.length > 0 ? `${detections.length} detected` : "READY"}
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-950/40 border border-red-800 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {/* Telemetry counter dashboard */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-red-800/50 bg-red-950/20 px-4 py-3 text-center">
          <div className="text-2xl font-bold text-red-400">{counters.noSprout}</div>
          <div className="text-[11px] uppercase tracking-wide text-red-300/70 mt-1">No Sprout</div>
        </div>
        <div className="rounded-lg border border-yellow-700/50 bg-yellow-950/20 px-4 py-3 text-center">
          <div className="text-2xl font-bold text-yellow-300">{counters.smallMedium}</div>
          <div className="text-[11px] uppercase tracking-wide text-yellow-200/70 mt-1">Small-Medium</div>
        </div>
        <div className="rounded-lg border border-green-700/50 bg-green-950/20 px-4 py-3 text-center">
          <div className="text-2xl font-bold text-green-400">{counters.mature}</div>
          <div className="text-[11px] uppercase tracking-wide text-green-300/70 mt-1">Mature</div>
        </div>
      </div>
    </div>
  );
}

"""Build spotshrooms_poster.html with embedded graphs."""
import json, os

with open("graph_b64.json") as f:
    g = json.load(f)

fi  = g["feature_importance.png"]
avp = g["actual_vs_predicted.png"]

with open(r"C:\Users\jorda\Downloads\Picture1.png", "rb") as f:
    import base64
    sp_logo = base64.b64encode(f.read()).decode()

with open(r"C:\Users\jorda\Downloads\confusionmatshrooms_cropped.png", "rb") as f:
    confusion_matrix = base64.b64encode(f.read()).decode()

with open(r"C:\Users\jorda\Downloads\spotshrooms_app_screenshot.png", "rb") as f:
    app_screenshot = base64.b64encode(f.read()).decode()

with open(r"C:\Users\jorda\Downloads\spotshrooms_qr.png", "rb") as f:
    app_qr = base64.b64encode(f.read()).decode()

with open(r"C:\Users\jorda\OneDrive\Pictures\Screenshots 1\shroomcirc.png", "rb") as f:
    circuit_diagram = base64.b64encode(f.read()).decode()

with open(r"C:\Users\jorda\Downloads\shroomcad2.jpeg", "rb") as f:
    cad_render = base64.b64encode(f.read()).decode()

poster = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>SpotShrooms — IIICE Poster (A1)</title>
<style>
  @page { size: 594mm 841mm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  :root{
    --green:#1b5e20; --green2:#2e7d32; --accent:#43a047;
    --ink:#15231a; --muted:#5b6b60; --line:#d9e4dc; --bg:#ffffff; --soft:#f1f7f2;
    --dont:#c62828;
  }
  html,body{ background:#7d8b80; }
  .poster{
    width:594mm; height:841mm; background:var(--bg); color:var(--ink);
    margin:0 auto; overflow:hidden;
    font-family:"Segoe UI",system-ui,-apple-system,Roboto,Arial,sans-serif;
    display:flex; flex-direction:column;
  }
  .head{ background:linear-gradient(135deg,var(--green) 0%,var(--green2) 70%,var(--accent) 100%);
    color:#fff; padding:14mm 22mm 10mm; position:relative; flex-shrink:0; }
  .head .kicker{ font-size:8mm; letter-spacing:2mm; text-transform:uppercase; opacity:.85; font-weight:600; }
  .head h1{ font-size:34mm; line-height:.98; font-weight:800; margin:2mm 0 1mm; letter-spacing:-.5mm; }
  .head .tag{ font-size:9.5mm; font-weight:400; opacity:.95; }
  .badges{ position:absolute; top:14mm; right:22mm; display:flex; gap:4mm; }
  .sdg{ width:26mm; height:26mm; border-radius:5mm; display:flex; flex-direction:column;
    align-items:center; justify-content:center; color:#fff; font-weight:800; }
  .sdg small{ font-size:3.8mm; font-weight:700; }
  .sdg b{ font-size:11mm; line-height:1; }
  .sdg9{ background:#e5243b; } .sdg12{ background:#bf8b2e; }
  .subtheme{ position:absolute; bottom:4mm; right:22mm; font-size:6.5mm; font-weight:700;
    background:rgba(255,255,255,.16); padding:2mm 5mm; border-radius:20mm; }
  .body{ flex:1; padding:5mm 22mm 0; display:flex; flex-direction:column; gap:4mm; min-height:0; }
  h2{ font-size:10.5mm; color:var(--green); font-weight:800;
    display:flex; align-items:center; gap:3mm; margin-bottom:2.5mm; flex-shrink:0; }
  h2::before{ content:""; width:4.5mm; height:4.5mm; background:var(--green); border-radius:1mm; display:inline-block; flex-shrink:0; }
  p,li{ font-size:7mm; line-height:1.28; color:var(--ink); }
  .muted{ color:var(--muted); }
  /* PROBLEM */
  .problem{ display:flex; gap:9mm; align-items:stretch; flex-shrink:0; }
  .problem .stat{ flex:0 0 130mm; background:var(--soft); border:1.5mm solid var(--line);
    border-radius:6mm; padding:7mm; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; }
  .problem .stat b{ font-size:15mm; color:var(--dont); font-weight:800; line-height:1; white-space:nowrap; }
  .problem .stat span{ font-size:7mm; color:var(--muted); margin-top:2mm; }
  .problem .txt{ flex:1; display:flex; flex-direction:column; justify-content:center; }
  /* PIPELINE */
  .flow{ display:flex; align-items:stretch; }
  .step{ flex:1; background:#fff; border:1.5mm solid var(--line); border-radius:5mm; padding:4.5mm 3.5mm; text-align:center; }
  .step .ic{ font-size:11mm; line-height:1; }
  .step .t{ font-size:6.5mm; font-weight:800; color:var(--green); margin:1.5mm 0 1mm; }
  .step .d{ font-size:5.5mm; color:var(--muted); line-height:1.2; }
  .arrow{ display:flex; align-items:center; justify-content:center; width:9mm; color:var(--accent); font-size:11mm; font-weight:800; }
  /* AI MODELS — unified grid so green cap aligns with green cap, blue with blue */
  .models-grid{ display:grid; grid-template-columns:1fr 1fr; grid-template-rows:auto auto auto; gap:0 7mm; }
  .model-cap{ color:#fff; font-size:6mm; font-weight:800; padding:2mm 4mm; }
  .cap-vision{ background:#2e7d32; border-radius:5mm 5mm 0 0; }
  .cap-rf{ background:#2e7d32; border-radius:5mm 5mm 0 0; }
  .model-cell{ padding:2mm 4mm; border-left:1.5mm solid var(--line); border-right:1.5mm solid var(--line); }
  .model-cell p{ font-size:5.5mm; line-height:1.15; }
  .model-cell-last{ padding:2mm 4mm; border-left:1.5mm solid var(--line); border-right:1.5mm solid var(--line); border-bottom:1.5mm solid var(--line); border-radius:0 0 5mm 5mm; }
  .tag-row{ display:flex; flex-wrap:wrap; gap:1.5mm; }
  .tag-pill{ background:var(--soft); border:1mm solid var(--line); border-radius:20mm;
    padding:.7mm 3mm; font-size:5mm; font-weight:700; color:var(--green); }
  .tag-pill.blue{ color:#2e7d32; }
  .tag-pill.magenta{ color:#2e7d32; }
  .veto-box{ background:#fff8f8; border:1mm solid #ffcdd2; border-radius:4mm; padding:1.5mm 3mm; }
  .veto-box .vt{ font-size:5mm; font-weight:800; color:var(--dont); margin-bottom:.5mm; }
  .veto-box p{ font-size:5mm; color:#b71c1c; line-height:1.15; }
  /* METRICS + GRAPHS */
  .cards{ display:grid; grid-template-columns:repeat(3,1fr); gap:7mm; }
  .card{ flex:1; border:1.5mm solid var(--line); border-radius:6mm; overflow:hidden; }
  .card .cap2{ color:#fff; font-size:6mm; font-weight:800; padding:2mm 4mm; }
  .card .met{ display:flex; }
  .met .m{ flex:1; padding:2.5mm 3mm; text-align:center; border-right:1mm solid var(--line); }
  .met .m:last-child{ border-right:0; }
  .met .m b{ display:block; font-size:9mm; color:var(--green2); font-weight:800; line-height:1; }
  .met .m b.blue{ color:#2e7d32; }
  .met .m b.magenta{ color:#2e7d32; }
  .met .m span{ font-size:4.5mm; color:var(--muted); text-transform:uppercase; letter-spacing:.3mm; }
  .graphs-row{ display:grid; grid-template-columns:repeat(2,1fr); gap:7mm; margin-top:4mm; }
  .graph-box{ flex:1; border:1.5mm solid var(--line); border-radius:6mm; overflow:hidden; }
  .graph-placeholder{ flex:1; border:2mm dashed var(--line); border-radius:6mm; overflow:hidden;
    display:flex; flex-direction:column; }
  .graph-placeholder .gcap{ color:#fff; font-size:6.8mm; font-weight:800; padding:2.8mm 5mm; background:var(--green2); }
  .graph-placeholder .ph-body{ flex:1; display:flex; flex-direction:column; align-items:center;
    justify-content:center; gap:3mm; padding:8mm; background:var(--soft); }
  .graph-placeholder .ph-icon{ font-size:18mm; opacity:.3; }
  .graph-placeholder .ph-text{ font-size:6.5mm; color:var(--muted); font-weight:700; text-align:center; }
  .graph-placeholder .gdesc{ padding:2.5mm 4.5mm; background:var(--soft); border-top:1mm dashed var(--line); }
  .graph-placeholder .gdesc p{ font-size:5.8mm; color:var(--muted); line-height:1.22; }
  .graph-box .gcap{ color:#fff; font-size:6.8mm; font-weight:800; padding:2.8mm 5mm; background:#2e7d32; text-align:center; }
  .graph-box img{ width:100%; display:block; }
  .graph-box .gdesc{ padding:2.5mm 4.5mm; background:var(--soft); border-top:1mm solid var(--line); }
  .graph-box .gdesc p{ font-size:5.8mm; color:var(--ink); line-height:1.22; text-align:center; }
  .note{ font-size:5.8mm; color:var(--muted); margin-top:2mm; }
  /* SHOWCASE */
  .showcase-row{ display:flex; gap:7mm; margin-top:3mm; }
  .showcase-box{ flex:1; border:2mm dashed var(--line); border-radius:6mm; overflow:hidden;
    display:flex; flex-direction:column; }
  .showcase-box.filled{ border-style:solid; }
  .showcase-cap{ font-size:6.5mm; font-weight:800; padding:2.5mm 5mm; color:#fff; }
  .cap-app{ background:#2e7d32; }
  .cap-cad{ background:#2e7d32; }
  .cap-circuit{ background:#2e7d32; }
  .showcase-body{ flex:1; display:flex; flex-direction:column; align-items:center;
    justify-content:center; gap:2mm; padding:5mm; background:var(--soft); min-height:115mm; }
  .showcase-body img{ width:100%; height:100%; object-fit:contain; display:block; }
  .ph-icon{ font-size:14mm; opacity:.3; }
  .ph-text{ font-size:6mm; color:var(--muted); font-weight:700; text-align:center; }
  /* BOTTOM */
  .bottom-row{ display:flex; gap:7mm; flex-shrink:0; }
  .bottom-row > div{ flex:1; }
  .yield-banner{ background:linear-gradient(135deg,#e8f5e9,#f1f7f2);
    border:2mm solid var(--accent); border-radius:6mm; padding:1.5mm 3mm;
    display:flex; align-items:center; gap:3mm; margin-bottom:2mm; }
  .yield-banner .num{ font-size:11mm; font-weight:800; color:var(--green2); line-height:1; flex-shrink:0; }
  .yield-banner .txt p{ font-size:5mm; line-height:1.2; }
  ul{ margin-left:5mm; } li{ margin-bottom:1.2mm; font-size:5.8mm; }
  .pill{ display:inline-block; background:var(--soft); border:1mm solid var(--line);
    border-radius:20mm; padding:1mm 3mm; font-size:5.2mm; font-weight:700; color:var(--green); margin:0 1.5mm 1.5mm 0; }
  .bottom-row h2{ font-size:8.5mm; margin-bottom:2mm; }
  .bottom-row .muted{ font-size:5.5mm; }
  /* FOOTER */
  .foot{ flex-shrink:0; background:var(--green); color:#fff; padding:6mm 22mm; display:flex;
    justify-content:space-between; align-items:center; }
  .foot .team b{ font-size:8mm; font-weight:800; }
  .foot .team div{ font-size:6.5mm; opacity:.92; margin-top:1.5mm; }
  .foot .who{ font-size:7mm; font-weight:700; text-align:right; opacity:.95; }
</style>
</head>
<body>
<div class="poster">

  <header class="head">
    <div class="kicker"><img src="data:image/png;base64,__SPLOGO__" style="height:12mm;vertical-align:middle;margin-right:8mm;" />Agri-Tech Innovation</div>
    <h1>SpotShrooms</h1>
    <div class="tag">Eyes on every mushroom, anytime, anywhere.</div>
    <div class="badges">
      <div class="sdg sdg9"><small>SDG</small><b>9</b></div>
      <div class="sdg sdg12"><small>SDG</small><b>12</b></div>
    </div>
    <div class="subtheme">Agriculture &amp; Environmental</div>
  </header>

  <main class="body">

    <section class="problem">
      <div class="stat">
        <b>Up to 28%</b>
        <span>yield losses from <strong>inadequate farm management practices</strong> <span style="font-size:4.5mm;color:var(--muted);">(Market Growth Reports, 2024)</span></span>
      </div>
      <div class="txt">
        <h2>The Problem</h2>
        <p>Across Asia, mushroom farms still rely on <strong>manual monitoring</strong> and <strong>fixed watering schedules</strong>. Workers cannot watch every shelf around the clock, and traditional timer-based watering doesn't adapt to actual growth stage or climate &#8212; mature mushrooms get over-watered and rot, while under-watering stunts growth, leaving mushrooms without the optimal conditions to thrive. Our system adds a smart automation layer on top of any existing irrigation setup, with no hardware replacement needed.</p>
      </div>
    </section>

    <section>
      <h2>How It Works</h2>
      <div class="flow">
        <div class="step"><div class="ic">&#128247;</div><div class="t">AI Camera</div><div class="d">Roaming camera scans every shelf</div></div>
        <div class="arrow">&#8250;</div>
        <div class="step"><div class="ic">&#129504;</div><div class="t">YOLOv11 Vision</div><div class="d">Classifies stage &amp; counts mushrooms</div></div>
        <div class="arrow">&#8250;</div>
        <div class="step"><div class="ic">&#127777;&#65039;</div><div class="t">DHT22 + SCD41</div><div class="d">Temp, humidity &amp; CO&#8322; readings</div></div>
        <div class="arrow">&#8250;</div>
        <div class="step"><div class="ic">&#127794;</div><div class="t">Random Forest</div><div class="d">Predicts <b>whether</b> &amp; <b>how long</b> to water</div></div>
        <div class="arrow">&#8250;</div>
        <div class="step"><div class="ic">&#128167;</div><div class="t">Auto Irrigation</div><div class="d">Raspberry Pi triggers valve for exact duration</div></div>
        <div class="arrow">&#8250;</div>
        <div class="step"><div class="ic">&#128202;</div><div class="t">Dashboard</div><div class="d">Live detections, gauges &amp; misting decisions on any device</div></div>
      </div>
    </section>

    <section>
      <h2>Key Features &amp; Novelty</h2>
      <p style="font-size:6.5mm;margin-bottom:3mm;"><b>Uniquely integrates growth-stage detection with ML-predicted misting duration</b> &#8212; replacing one-size-fits-all timers with a crop-aware, sensor-driven irrigation loop deployable on a single Raspberry Pi 5.</p>
      <div class="showcase-row">
        <div class="showcase-box filled">
          <div class="showcase-cap cap-app">Dashboard &#8212; Web App</div>
          <div class="showcase-body" style="padding:2mm;flex-direction:row;gap:4mm;justify-content:space-evenly;">
            <img src="data:image/png;base64,__APPSS__" style="max-width:50%;max-height:111mm;width:auto;height:auto;object-fit:contain;border-radius:3mm;" />
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2mm;margin-left:-6mm;">
              <img src="data:image/png;base64,__QR__" style="width:60mm;height:60mm;" />
              <div style="font-size:7.5mm;font-weight:800;color:#000;text-align:center;">Try it live!</div>
            </div>
          </div>
        </div>
        <div class="showcase-box filled">
          <div class="showcase-cap cap-cad">Physical Prototype &#8212; CAD Render</div>
          <div class="showcase-body" style="padding:3mm;">
            <img src="data:image/jpeg;base64,__CAD__" style="max-width:100%;max-height:111mm;width:auto;height:auto;object-fit:contain;border-radius:3mm;" />
          </div>
        </div>
        <div class="showcase-box filled">
          <div class="showcase-cap cap-circuit">Circuit &#8212; Board Connections</div>
          <div class="showcase-body" style="padding:3mm;">
            <img src="data:image/png;base64,__CIRCUIT__" style="max-width:100%;max-height:111mm;width:auto;height:auto;object-fit:contain;border-radius:3mm;" />
          </div>
        </div>
      </div>
    </section>

    <section>
      <h2>Two Cooperating AI Models</h2>
      <div class="models-grid">
        <!-- Row 1: caps -->
        <div class="model-cap cap-vision">Model 1 &#8212; YOLOv11 Image Classification</div>
        <div class="model-cap cap-rf">Model 2 &#8212; Random Forest Regressor</div>
        <!-- Row 2: description + pills -->
        <div class="model-cell"><p>Trained on <b>real images collected from a Vietnam oyster mushroom farm visit</b>. Classifies three growth classes per shelf scan and counts mushrooms present.</p>
          <div class="tag-row" style="margin-top:2mm;">
            <span class="tag-pill magenta">No Sprout</span>
            <span class="tag-pill magenta">Small / Medium</span>
            <span class="tag-pill magenta">Mature</span>
          </div>
        </div>
        <div class="model-cell"><p>Trained on <b>500 rows of data</b> following oyster mushroom cultivation literature. Takes <b>7 inputs</b> simultaneously and predicts the exact misting duration in seconds.</p>
          <div class="tag-row" style="margin-top:2mm;">
            <span class="tag-pill blue">No Sprout Count</span>
            <span class="tag-pill blue">Small/Medium Count</span>
            <span class="tag-pill blue">Mature Count</span>
            <span class="tag-pill blue">Total Count</span>
            <span class="tag-pill blue">Humidity (rh_pct)</span>
            <span class="tag-pill blue">Temperature (&#176;C)</span>
            <span class="tag-pill blue">CO&#8322; (ppm)</span>
          </div>
        </div>
        <!-- Row 4: bottom -->
        <div class="model-cell-last"><p>Output feeds directly into the Random Forest &#8212; tells the irrigation model <b>what is on the shelf right now</b>.</p></div>
        <div class="model-cell-last">
          <div class="veto-box">
            <div class="vt">Safety Veto Rules (run before model)</div>
            <p>Mature ratio &#8805; 5% &nbsp;|&nbsp; Humidity &#8805; 92% &nbsp;|&nbsp; CO&#8322; &gt; 2000 ppm</p>
            <p style="margin-top:1.5mm;">Any one condition &#8594; <b>irrigation blocked</b> &amp; <b>alert sent to farmer</b></p>
          </div>
        </div>
      </div>
    </section>

    <section>
      <h2>Model Performance &amp; Evaluation</h2>
      <div class="cards" style="grid-template-columns:repeat(2,1fr);">
        <div class="card" style="grid-column:span 1;">
          <div class="cap2" style="background:#2e7d32;">YOLOv11 &#8212; Mushroom Classification</div>
          <div class="met">
            <div class="m"><b class="magenta">87.5%</b><span>Precision</span></div>
            <div class="m"><b class="magenta">77.78%</b><span>Accuracy</span></div>
            <div class="m"><b class="magenta">76.76%</b><span>Recall</span></div>
          </div>
        </div>
        <div class="card" style="grid-column:span 1;">
          <div class="cap2" style="background:#2e7d32;">Random Forest &#8212; Misting Duration</div>
          <div class="met">
            <div class="m"><b class="blue">0.920</b><span>R&#178; Score</span></div>
            <div class="m"><b class="blue">1.77s</b><span>Avg Error (MAE)</span></div>
            <div class="m"><b class="blue">3.07s</b><span>RMSE</span></div>
          </div>
        </div>
      </div>
      <div class="graphs-row">
        <div class="graph-box">
          <div class="gcap" style="background:#2e7d32;">YOLOv11 Confusion Matrix</div>
          <img src="data:image/png;base64,__CM__" />
          <div class="gdesc"><p><b>Mature stage scores 100% precision</b> &#8212; the model never falsely classifies another stage as mature, protecting the safety veto rule. Overall test accuracy: <b>77.78%</b>, macro F1-score: <b>80.36%</b>.</p></div>
        </div>
        <div class="graph-box">
          <div class="gcap">Actual vs Predicted Duration</div>
          <img src="data:image/png;base64,__AVP__" />
          <div class="gdesc"><p><b>R&#178; = 0.920</b> &#8212; points cluster tightly along the perfect prediction line, meaning the model predicts misting duration within <b>1.77 seconds on average</b>.</p></div>
        </div>
      </div>
    </section>

    <section class="bottom-row">
      <div>
        <h2>Projected Impact</h2>
        <div class="yield-banner">
          <div class="num">15&#8211;25%</div>
          <div class="txt"><p><b>Projected yield increase</b> from eliminating overwatering losses and stage-aware misting &#8212; pending real grow room validation.</p></div>
        </div>
        <ul>
          <li>Mature mushrooms <strong>never overwatered</strong> &#8212; protected by veto rule</li>
          <li>Misting optimised per stage, not one-size-fits-all</li>
          <li><strong>SDG 12</strong>: water-efficient, responsible production</li>
          <li><strong>SDG 9</strong>: AI &amp; automation for smallholder farms</li>
        </ul>
      </div>
      <div>
        <h2>Feasible &amp; Ready</h2>
        <span class="pill">Runs on Raspberry Pi 5</span>
        <span class="pill">Retrains on real farm data</span>
        <span class="pill">Add-on &#8212; works with existing system</span>
        <ul style="margin-top:3mm;">
          <li>Adds on to any existing irrigation setup &#8212; no hardware replacement needed. Raspberry Pi reads sensors, runs both AI models, and signals the existing valve.</li>
          <li>Live web dashboard shows real-time detections, climate gauges, and misting decisions accessible from any device.</li>
        </ul>
      </div>
      <div>
        <h2>Future Potential</h2>
        <ul>
          <li><strong>LLM Chatbot</strong> &#8212; on-device Ollama lets farmers ask "Why is it misting?" in plain English</li>
          <li><strong>Multi-language support</strong> &#8212; translations to bridge language barriers across Asia</li>
          <li><strong>Multi-crop scaling</strong> &#8212; pipeline adaptable to other fungi or leafy greens</li>
          <li><strong>CO&#8322; ventilation loop</strong> &#8212; auto-trigger fan when CO&#8322; exceeds threshold</li>
        </ul>
      </div>
    </section>

  </main>

  <footer class="foot">
    <div class="team">
      <b>Team SpotShrooms &#8212; IIICe</b>
      <div>Wui Soon Hiang Jordan (EEE) &#183; Sean Ho Yan Xian (CLS) &#183; Teo Xin Yin (SOC) &#183; Pasu Chua (MAE)</div>
    </div>
    <div class="who">Co-Creating Tomorrow:<br/>Collaborative Innovations for Global Challenges</div>
  </footer>

</div>
</body>
</html>"""

poster = poster.replace("__FI__", fi).replace("__AVP__", avp).replace("__SPLOGO__", sp_logo).replace("__CM__", confusion_matrix).replace("__APPSS__", app_screenshot).replace("__QR__", app_qr).replace("__CIRCUIT__", circuit_diagram).replace("__CAD__", cad_render)

out = os.path.join("..", "spotshrooms_poster.html")
with open(out, "w", encoding="utf-8") as f:
    f.write(poster)

print(f"Done. Size: {os.path.getsize(out) / 1024:.0f} KB")

import { useState, useRef, useCallback, useEffect } from "react";
import JSZip from "jszip";

// ─── Language options ────────────────────────────────────────────────────────
const LANG_OPTIONS = [
  { value: "mar",         label: "मराठी (Marathi)" },
  { value: "mar+hin",     label: "मराठी + हिंदी" },
  { value: "mar+eng",     label: "मराठी + English" },
  { value: "mar+hin+eng", label: "मराठी + हिंदी + English" },
  { value: "hin",         label: "हिंदी (Hindi)" },
  { value: "eng",         label: "English only" },
];

// ─── Tesseract CDN loader ────────────────────────────────────────────────────
async function loadTesseract() {
  if (window.Tesseract) return window.Tesseract;
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    s.onload = () => resolve(window.Tesseract);
    s.onerror = () => reject(new Error("Failed to load Tesseract.js from CDN"));
    document.head.appendChild(s);
  });
}

// ─── ZIP extraction ──────────────────────────────────────────────────────────
async function extractImagesFromZip(zipFile) {
  const zip = await JSZip.loadAsync(zipFile);
  const entries = Object.entries(zip.files).filter(([name, file]) => {
    if (file.dir) return false;
    const ext = name.split(".").pop().toLowerCase();
    return ["jpg", "jpeg", "png", "webp", "gif", "bmp"].includes(ext);
  });
  entries.sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));

  const images = [];
  for (const [name, file] of entries) {
    const blob = await file.async("blob");
    const ext  = name.split(".").pop().toLowerCase();
    const mimeMap = {
      jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
      webp: "image/webp", gif: "image/gif",  bmp: "image/bmp",
    };
    const mime      = mimeMap[ext] || "image/jpeg";
    const typedBlob = new Blob([blob], { type: mime });
    images.push({ name, objectUrl: URL.createObjectURL(typedBlob), mime });
  }
  return images;
}

// ─── Image Preprocessing Pipeline ───────────────────────────────────────────
// 1) Upscale  →  2) Grayscale + Contrast  →  3) Unsharp masking
async function preprocessImage(objectUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const MIN_DIM = 2200;
      const scale   = Math.max(1, Math.min(4, MIN_DIM / Math.max(img.width, img.height)));
      const w = Math.round(img.width  * scale);
      const h = Math.round(img.height * scale);

      // Draw (upscaled)
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, w, h);

      // Grayscale + contrast LUT
      const imageData = ctx.getImageData(0, 0, w, h);
      const d         = imageData.data;
      const contrast  = 1.6, brightness = 8;
      const lut       = new Uint8ClampedArray(256);
      for (let i = 0; i < 256; i++)
        lut[i] = Math.min(255, Math.max(0, Math.round((i - 128) * contrast + 128 + brightness)));

      for (let i = 0; i < d.length; i += 4) {
        const gray    = Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
        const enhanced = lut[gray];
        d[i] = d[i + 1] = d[i + 2] = enhanced;
      }
      ctx.putImageData(imageData, 0, 0);

      // Unsharp masking
      const blurCanvas = document.createElement("canvas");
      blurCanvas.width = w; blurCanvas.height = h;
      const blurCtx = blurCanvas.getContext("2d");
      blurCtx.filter = `blur(${Math.max(1, Math.round(scale * 0.8))}px)`;
      blurCtx.drawImage(canvas, 0, 0);

      const sharpData = ctx.getImageData(0, 0, w, h);
      const blurData  = blurCtx.getImageData(0, 0, w, h);
      const sd = sharpData.data, bd = blurData.data;
      const amount = 1.4;
      for (let i = 0; i < sd.length; i += 4)
        for (let c = 0; c < 3; c++) {
          const diff = sd[i + c] - bd[i + c];
          sd[i + c]  = Math.min(255, Math.max(0, Math.round(sd[i + c] + amount * diff)));
        }
      ctx.putImageData(sharpData, 0, 0);

      canvas.toBlob((blob) => resolve(URL.createObjectURL(blob)), "image/png");
    };
    img.onerror = () => resolve(objectUrl);
    img.src = objectUrl;
  });
}

// ─── OCR runner ──────────────────────────────────────────────────────────────
async function runOCROnImage(objectUrl, lang, onProgress) {
  const Tesseract   = window.Tesseract;
  const processedUrl = await preprocessImage(objectUrl);
  try {
    const result = await Tesseract.recognize(processedUrl, lang, {
      logger: (m) => {
        if (m.status === "recognizing text" && onProgress)
          onProgress(Math.round((m.progress || 0) * 100));
      },
    }, {
      tessedit_pageseg_mode:      "6",
      preserve_interword_spaces:  "1",
      tessedit_do_invert:         "0",
      textord_heavy_nr:           "0",
    });
    const text    = result.data.text?.trim() || "[No text found]";
    const cleaned = text
      .split("\n").map((l) => l.trimEnd()).join("\n")
      .replace(/\n{3,}/g, "\n\n");
    URL.revokeObjectURL(processedUrl);
    return cleaned;
  } catch (e) {
    URL.revokeObjectURL(processedUrl);
    throw e;
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  OCRTool Component
// ════════════════════════════════════════════════════════════════════════════
export default function OCRTool({ onBack }) {
  const [lang,         setLang]         = useState("mar+eng");
  const [isDragging,   setIsDragging]   = useState(false);
  const [status,       setStatus]       = useState("idle");
  const [results,      setResults]      = useState([]);
  const [progress,     setProgress]     = useState({ current: 0, total: 0, imgPct: 0 });
  const [errorMsg,     setErrorMsg]     = useState("");
  const [tesseractReady, setTesseractReady] = useState(false);
  const fileInputRef   = useRef(null);
  const objectUrlsRef  = useRef([]);

  useEffect(() => {
    document.title = "Marathi OCR Tool — Extract Text from Images";
    loadTesseract()
      .then(() => setTesseractReady(true))
      .catch((e) => console.error("Tesseract load error:", e));
    return () => {
      document.title = "Free Marathi OCR Online | ZIP Image to Text | मराठी OCR Tool 2026";
      objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const processFile = useCallback(async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setErrorMsg("Please upload a .zip file containing images.");
      setStatus("error"); return;
    }
    setStatus("loading"); setResults([]); setErrorMsg("");
    setProgress({ current: 0, total: 0, imgPct: 0 });

    try {
      await loadTesseract();
      const images = await extractImagesFromZip(file);
      objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      objectUrlsRef.current = images.map((i) => i.objectUrl);

      if (images.length === 0) {
        setErrorMsg("No images found in ZIP. Supported: JPG, PNG, WebP, BMP, GIF.");
        setStatus("error"); return;
      }
      setProgress({ current: 0, total: images.length, imgPct: 0 });

      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        setProgress((p) => ({ ...p, current: i + 1, imgPct: 0 }));
        setResults((prev) => [...prev, { name: img.name, text: "", status: "processing", pct: 0 }]);
        try {
          const text = await runOCROnImage(img.objectUrl, lang, (pct) => {
            setResults((prev) => prev.map((r) => r.name === img.name ? { ...r, pct } : r));
            setProgress((p) => ({ ...p, imgPct: pct }));
          });
          setResults((prev) => prev.map((r) => r.name === img.name ? { ...r, text, status: "done", pct: 100 } : r));
        } catch (e) {
          setResults((prev) => prev.map((r) => r.name === img.name ? { ...r, text: `[Error: ${e.message}]`, status: "error", pct: 0 } : r));
        }
      }
      setStatus("done");
    } catch (e) {
      setErrorMsg(e.message || "Failed to process ZIP file.");
      setStatus("error");
    }
  }, [lang]);

  const onDragOver  = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const onDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const onDrop      = (e) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    const file = e.dataTransfer?.files?.[0]; if (file) processFile(file);
  };
  const onInputChange = (e) => {
    const file = e.target.files?.[0]; if (file) processFile(file); e.target.value = "";
  };

  const downloadCombined = () => {
    const content = results.map((r) => `===== ${r.name} =====\n\n${r.text}\n`).join("\n\n");
    const blob = new Blob(["\uFEFF" + content], { type: "text/plain;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href = url; a.download = "ocr_output.txt"; a.click();
    URL.revokeObjectURL(url);
  };
  const downloadSeparate = () => {
    results.forEach((r) => {
      const blob = new Blob(["\uFEFF" + r.text], { type: "text/plain;charset=utf-8" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a"); a.href = url;
      a.download = r.name.replace(/\.[^.]+$/, "") + "_ocr.txt"; a.click();
      URL.revokeObjectURL(url);
    });
  };
  const reset = () => {
    objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    objectUrlsRef.current = [];
    setStatus("idle"); setResults([]); setProgress({ current: 0, total: 0, imgPct: 0 }); setErrorMsg("");
  };

  const successCount = results.filter((r) => r.status === "done").length;
  const errorCount   = results.filter((r) => r.status === "error").length;
  const overallPct   = progress.total > 0
    ? Math.round(((progress.current - 1 + progress.imgPct / 100) / progress.total) * 100)
    : 0;

  return (
    <div style={S.page}>
      {/* ── Navbar ── */}
      <nav style={S.nav}>
        <button style={S.backBtn} onClick={onBack}>
          ← Back to Home
        </button>
        <div style={S.navLogo}>
          <span style={S.logoGlyph}>अ</span>
          <span style={S.logoTitle}>Marathi OCR</span>
        </div>
        <div style={S.freeBadge}>✦ FREE</div>
      </nav>

      <main style={S.main}>
        {/* Tesseract loading */}
        {!tesseractReady && (
          <div style={S.loadingBanner}>
            ⏳ Loading OCR engine… first load may take a few seconds
          </div>
        )}

        {/* Language Selector */}
        <div style={S.langBox}>
          <div style={S.langLabel}>🌐 Select OCR Language</div>
          <div style={S.langGrid}>
            {LANG_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                style={{ ...S.langBtn, ...(lang === opt.value ? S.langBtnActive : {}) }}
                onClick={() => setLang(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div style={S.privacyNote}>
            🔒 All OCR processing runs 100% in your browser — no images are uploaded or stored anywhere
          </div>
        </div>

        {/* Upload */}
        {(status === "idle" || status === "error") && (
          <div style={S.uploadBox}>
            <div
              style={{ ...S.dropzone, ...(isDragging ? S.dropActive : {}) }}
              onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
            >
              <div style={S.dropEmoji}>📦</div>
              <div style={S.dropTitle}>Drag &amp; drop your ZIP file here</div>
              <div style={S.dropSub}>ZIP file containing JPG, PNG, WebP, BMP images</div>
              <div style={S.dropSub2}>Each image is enhanced before OCR for better accuracy</div>
            </div>
            <div style={S.orRow}>
              <span style={S.orLine} /><span style={S.orText}>or</span><span style={S.orLine} />
            </div>
            <label>
              <input ref={fileInputRef} type="file" accept=".zip,application/zip" style={{ display: "none" }} onChange={onInputChange} />
              <span style={S.fileBtn}>📂 Browse ZIP File</span>
            </label>
            {status === "error" && <div style={S.errorBox}>⚠️ {errorMsg}</div>}
          </div>
        )}

        {/* Progress */}
        {status === "loading" && (
          <div style={S.progressCard}>
            <div style={S.progressTop}>
              <span style={S.progressLabel}>Processing image {progress.current} of {progress.total}…</span>
              <span style={S.progressPct}>{Math.min(overallPct, 99)}%</span>
            </div>
            <div style={S.bar}><div style={{ ...S.barFill, width: `${Math.min(overallPct, 99)}%` }} /></div>
            <div style={S.progressSub}>
              ✨ Enhanced mode: upscale → grayscale → contrast → sharpen → OCR &nbsp;·&nbsp;
              {LANG_OPTIONS.find((o) => o.value === lang)?.label}
            </div>
            <div style={{ marginTop: 20 }}>
              {results.map((r) => (
                <div key={r.name} style={S.miniCard}>
                  <span>{r.status === "done" ? "✅" : r.status === "error" ? "❌" : "⏳"}</span>
                  <span style={S.miniName}>{r.name}</span>
                  {r.status === "processing" && (
                    <>
                      <div style={S.miniBarWrap}><div style={{ ...S.miniBar, width: `${r.pct}%` }} /></div>
                      <span style={S.miniPct}>{r.pct === 0 ? "Enhancing…" : `${r.pct}%`}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Done */}
        {status === "done" && (
          <div>
            <div style={S.summaryBar}>
              <div style={S.summaryLeft}>
                <span style={S.pill}>✓ {successCount} extracted</span>
                {errorCount > 0 && <span style={{ ...S.pill, ...S.pillRed }}>✗ {errorCount} failed</span>}
              </div>
              <div style={S.summaryRight}>
                <button style={S.btnPrimary} onClick={downloadCombined}>↓ Combined TXT</button>
                <button style={S.btnSec}     onClick={downloadSeparate}>↓ Per-image TXTs</button>
                <button style={S.btnGhost}   onClick={reset}>↺ New Upload</button>
              </div>
            </div>
            {results.map((r) => (
              <div key={r.name} style={S.card}>
                <div style={S.cardHead}>
                  <span>{r.status === "done" ? "✅" : "❌"}</span>
                  <code style={S.cardName}>{r.name}</code>
                </div>
                <div style={S.cardBody}>
                  {r.text.length > 600 ? r.text.slice(0, 600) + "\n…" : r.text}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer style={S.footer}>
        Powered by Tesseract.js (open-source OCR) · Supports मराठी, हिंदी, English ·
        100% free · No data stored · No API key needed
      </footer>
    </div>
  );
}

const S = {
  page: { minHeight: "100vh", background: "#0F0F13", color: "#E8E4DC", fontFamily: "'Inter','Segoe UI','Noto Sans Devanagari',system-ui,sans-serif", display: "flex", flexDirection: "column" },
  nav: { padding: "16px 28px", borderBottom: "1px solid #1E1E28", display: "flex", alignItems: "center", gap: 14, background: "rgba(15,15,19,0.95)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 100 },
  backBtn: { background: "transparent", border: "1px solid #2E2E3A", color: "#A0A0B0", padding: "7px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer", transition: "all .15s" },
  navLogo: { display: "flex", alignItems: "center", gap: 10, flex: 1, justifyContent: "center" },
  logoGlyph: { fontSize: 28, background: "linear-gradient(135deg,#FF6B35,#FF9F1C)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontWeight: 800 },
  logoTitle: { fontSize: 18, fontWeight: 700, color: "#F0EBE0" },
  freeBadge: { background: "linear-gradient(135deg,#4CAF7D,#2D9B6B)", color: "#fff", padding: "5px 12px", borderRadius: 99, fontSize: 11, fontWeight: 800, letterSpacing: "0.5px" },
  main: { flex: 1, padding: "32px 28px", maxWidth: 760, margin: "0 auto", width: "100%", boxSizing: "border-box" },
  loadingBanner: { background: "#1A1A10", border: "1px solid #3A3A10", color: "#C0B060", padding: "10px 16px", borderRadius: 8, fontSize: 13, marginBottom: 20 },
  langBox: { background: "#13131A", border: "1px solid #1E1E28", borderRadius: 14, padding: "18px 20px", marginBottom: 28 },
  langLabel: { fontSize: 13, fontWeight: 600, color: "#A8A0B0", marginBottom: 12 },
  langGrid: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  langBtn: { background: "#0A0A12", border: "1px solid #2E2E3A", color: "#A8A0B0", padding: "8px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "'Inter','Noto Sans Devanagari',sans-serif" },
  langBtnActive: { background: "linear-gradient(135deg,#FF6B35,#FF9F1C)", border: "1px solid transparent", color: "#fff", fontWeight: 700 },
  privacyNote: { fontSize: 12, color: "#4CAF7D", marginTop: 4 },
  uploadBox: { display: "flex", flexDirection: "column", alignItems: "center" },
  dropzone: { width: "100%", boxSizing: "border-box", border: "2px dashed #2E2E3A", borderRadius: 14, padding: "52px 24px", textAlign: "center", background: "#13131A", transition: "all .2s" },
  dropActive: { borderColor: "#FF6B35", background: "#1A1208" },
  dropEmoji: { fontSize: 48, marginBottom: 14 },
  dropTitle: { fontSize: 18, fontWeight: 600, color: "#F0EBE0", marginBottom: 6 },
  dropSub: { fontSize: 13, color: "#5A5868" },
  dropSub2: { fontSize: 12, color: "#3A3848", marginTop: 6 },
  orRow: { display: "flex", alignItems: "center", gap: 12, margin: "20px 0", width: "100%" },
  orLine: { flex: 1, height: 1, background: "#1E1E28", display: "block" },
  orText: { fontSize: 12, color: "#3A3848" },
  fileBtn: { display: "inline-block", background: "linear-gradient(135deg,#FF6B35,#FF9F1C)", color: "#fff", padding: "13px 32px", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer" },
  errorBox: { marginTop: 20, background: "#1E0A0A", border: "1px solid #3A1515", color: "#FF7070", padding: "12px 18px", borderRadius: 10, fontSize: 13, width: "100%", boxSizing: "border-box" },
  progressCard: { background: "#13131A", border: "1px solid #1E1E28", borderRadius: 14, padding: "28px 24px" },
  progressTop: { display: "flex", justifyContent: "space-between", marginBottom: 12 },
  progressLabel: { fontWeight: 600, fontSize: 15, color: "#F0EBE0" },
  progressPct: { fontWeight: 700, fontSize: 15, color: "#FF9F1C" },
  bar: { height: 6, background: "#1E1E28", borderRadius: 99, overflow: "hidden", marginBottom: 10 },
  barFill: { height: "100%", background: "linear-gradient(90deg,#FF6B35,#FF9F1C)", borderRadius: 99, transition: "width .3s ease" },
  progressSub: { fontSize: 12, color: "#5A5868" },
  miniCard: { display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: "1px solid #1A1A22" },
  miniName: { fontSize: 12, color: "#7A7888", fontFamily: "monospace", flex: "0 0 auto", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  miniBarWrap: { flex: 1, height: 4, background: "#1E1E28", borderRadius: 99, overflow: "hidden" },
  miniBar: { height: "100%", background: "linear-gradient(90deg,#FF6B35,#FF9F1C)", borderRadius: 99, transition: "width .2s ease" },
  miniPct: { fontSize: 11, color: "#FF9F1C", fontWeight: 600, minWidth: 68, textAlign: "right" },
  summaryBar: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, background: "#13131A", border: "1px solid #1E1E28", borderRadius: 12, padding: "14px 18px", marginBottom: 16 },
  summaryLeft: { display: "flex", gap: 10 },
  summaryRight: { display: "flex", gap: 8, flexWrap: "wrap" },
  pill: { background: "#0D2A1A", color: "#4CAF7D", padding: "4px 12px", borderRadius: 99, fontSize: 13, fontWeight: 600 },
  pillRed: { background: "#2A0D0D", color: "#FF6B6B" },
  btnPrimary: { background: "linear-gradient(135deg,#FF6B35,#FF9F1C)", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" },
  btnSec: { background: "#1E1E28", color: "#E8E4DC", border: "1px solid #2E2E3A", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  btnGhost: { background: "transparent", color: "#5A5868", border: "1px solid #2E2E3A", padding: "8px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer" },
  card: { background: "#13131A", border: "1px solid #1E1E28", borderRadius: 12, padding: "14px 16px", marginBottom: 12 },
  cardHead: { display: "flex", gap: 10, alignItems: "center", marginBottom: 10 },
  cardName: { fontSize: 12, color: "#7A7888", fontFamily: "monospace" },
  cardBody: { fontSize: 14, lineHeight: 1.9, color: "#D8D4CC", background: "#09090E", padding: "12px 14px", borderRadius: 8, whiteSpace: "pre-wrap", fontFamily: "'Noto Sans Devanagari','Inter',sans-serif", border: "1px solid #18181F" },
  footer: { textAlign: "center", padding: "16px", fontSize: 12, color: "#2E2E3A", borderTop: "1px solid #18181F" },
};

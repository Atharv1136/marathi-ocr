import { useState, useRef, useCallback, useEffect } from "react";
import JSZip from "jszip";
import { QRModal } from "./LandingPage";

// ─── Language options ────────────────────────────────────────────────────────
const LANG_OPTIONS = [
  { value: "mar",         label: "मराठी (Marathi)" },
  { value: "mar+hin",     label: "मराठी + हिंदी" },
  { value: "mar+eng",     label: "मराठी + English" },
  { value: "mar+hin+eng", label: "मराठी + हिंदी + English" },
  { value: "hin",         label: "हिंदी (Hindi)" },
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

// ─── PDF.js loader & page extractor ──────────────────────────────────────────
async function loadPdfJS() {
  if (window.pdfjsLib) return window.pdfjsLib;
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js";
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";
      resolve(window.pdfjsLib);
    };
    s.onerror = () => reject(new Error("Failed to load PDF.js engine"));
    document.head.appendChild(s);
  });
}

async function extractImagesFromPdf(pdfFile) {
  const pdfjsLib = await loadPdfJS();
  const arrayBuffer = await pdfFile.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const images = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    // Render page to canvas at 2.2x scale for higher resolution text recognition
    const viewport = page.getViewport({ scale: 2.2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport }).promise;
    
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const objectUrl = URL.createObjectURL(blob);
    images.push({
      name: `${pdfFile.name.replace(/\.[^.]+$/, "")}_page_${i}.png`,
      objectUrl,
      mime: "image/png",
    });
  }
  return images;
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
  const [showCoffeeModal, setShowCoffeeModal] = useState(false);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const fileInputRef   = useRef(null);
  const objectUrlsRef  = useRef([]);
  const isCancelledRef = useRef(false);

  const stopProcessing = () => {
    isCancelledRef.current = true;
  };

  useEffect(() => {
    if (status === "done") {
      setShowCoffeeModal(true);
      setSelectedResultIndex(0);
    }
  }, [status]);

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
    const nameLower = file.name.toLowerCase();
    const isZip   = nameLower.endsWith(".zip");
    const isPdf   = nameLower.endsWith(".pdf");
    const isImage = ["jpg", "jpeg", "png", "webp", "gif", "bmp"].some(ext => nameLower.endsWith("." + ext));

    if (!isZip && !isPdf && !isImage) {
      setErrorMsg("Please upload a ZIP archive, PDF document, or standard image file.");
      setStatus("error"); return;
    }

    setStatus("loading"); setResults([]); setErrorMsg("");
    setProgress({ current: 0, total: 0, imgPct: 0 });
    isCancelledRef.current = false;

    try {
      await loadTesseract();
      let images = [];

      if (isZip) {
        images = await extractImagesFromZip(file);
      } else if (isPdf) {
        images = await extractImagesFromPdf(file);
      } else if (isImage) {
        images = [{ name: file.name, objectUrl: URL.createObjectURL(file), mime: file.type }];
      }

      objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      objectUrlsRef.current = images.map((i) => i.objectUrl);

      if (images.length === 0) {
        setErrorMsg("No images or pages found to process.");
        setStatus("error"); return;
      }
      setProgress({ current: 0, total: images.length, imgPct: 0 });

      for (let i = 0; i < images.length; i++) {
        if (isCancelledRef.current) {
          break;
        }
        const img = images[i];
        setProgress((p) => ({ ...p, current: i + 1, imgPct: 0 }));
        setResults((prev) => [...prev, { name: img.name, text: "", status: "processing", pct: 0 }]);
        try {
          const text = await runOCROnImage(img.objectUrl, lang, (pct) => {
            setResults((prev) => prev.map((r) => r.name === img.name ? { ...r, pct } : r));
            setProgress((p) => ({ ...p, imgPct: pct }));
          });
          
          if (isCancelledRef.current) {
            break;
          }
          
          setResults((prev) => prev.map((r) => r.name === img.name ? { ...r, text, status: "done", pct: 100 } : r));
        } catch (e) {
          setResults((prev) => prev.map((r) => r.name === img.name ? { ...r, text: `[Error: ${e.message}]`, status: "error", pct: 0 } : r));
        }
      }

      if (isCancelledRef.current) {
        setResults((prev) => prev.filter((r) => r.status === "done" || r.status === "error"));
      }

      setStatus("done");
    } catch (e) {
      setErrorMsg(e.message || "Failed to process the uploaded file.");
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
              <div style={S.dropTitle}>Drag &amp; drop your ZIP, PDF, or image file here</div>
              <div style={S.dropSub}>Supports ZIP archives, PDF documents, or standard images (JPG, PNG, WebP, BMP, GIF)</div>
              <div style={S.dropSub2}>Each image is enhanced before OCR for maximum accuracy</div>
            </div>
            <div style={S.orRow}>
              <span style={S.orLine} /><span style={S.orText}>or</span><span style={S.orLine} />
            </div>
            <label>
              <input ref={fileInputRef} type="file" accept=".zip,application/zip,.pdf,application/pdf,image/*" style={{ display: "none" }} onChange={onInputChange} />
              <span style={S.fileBtn}>📂 Select File</span>
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
            <div style={S.bar}>
              <div style={{ ...S.barFill, width: `${Math.min(overallPct, 99)}%` }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <span style={S.progressSub}>
                ✨ Enhanced mode: upscale → grayscale → contrast → sharpen → OCR &nbsp;·&nbsp;
                {LANG_OPTIONS.find((o) => o.value === lang)?.label}
              </span>
              <button style={S.stopBtn} onClick={stopProcessing}>🛑 Stop Processing</button>
            </div>
            
            {/* Progress Card Grid (8 per row on desktop) */}
            <div style={S.progressGrid}>
              {results.map((r) => (
                <div
                  key={r.name}
                  style={{
                    ...S.miniCardGrid,
                    ...(r.status === "processing" ? S.miniCardProcessing : r.status === "done" ? S.miniCardDone : {})
                  }}
                >
                  <div style={S.miniCardIcon}>
                    {r.status === "done" ? "✅" : r.status === "error" ? "❌" : "⏳"}
                  </div>
                  <div style={S.miniCardName} title={r.name}>{r.name}</div>
                  {r.status === "processing" && (
                    <div style={S.miniCardPct}>
                      {r.pct === 0 ? "Enhancing…" : `${r.pct}%`}
                    </div>
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

            {/* Results Grid (8 per row on desktop) */}
            <div style={S.resultsGrid}>
              {results.map((r, idx) => (
                <button
                  key={r.name}
                  style={{
                    ...S.resultCard,
                    ...(selectedResultIndex === idx ? S.resultCardActive : {}),
                    ...(r.status === "error" ? S.resultCardError : {})
                  }}
                  onClick={() => setSelectedResultIndex(idx)}
                >
                  <div style={S.rcIcon}>
                    {r.status === "done" ? "📄" : "❌"}
                  </div>
                  <div style={S.rcName} title={r.name}>{r.name}</div>
                  <div style={S.rcStatus}>
                    {r.status === "done" ? "Success" : "Failed"}
                  </div>
                </button>
              ))}
            </div>

            {/* Interactive Selected Result Text Preview & Editor */}
            {results.length > 0 && results[selectedResultIndex] && (
              <div style={S.previewBox}>
                <div style={S.previewHeader}>
                  <div style={S.previewTitle}>
                    <span style={{ marginRight: 8 }}>📄</span>
                    <code>{results[selectedResultIndex].name}</code>
                  </div>
                  <div style={S.previewActions}>
                    <button
                      style={S.previewBtn}
                      onClick={() => {
                        const txt = results[selectedResultIndex].text;
                        navigator.clipboard.writeText(txt);
                        alert("Copied to clipboard!");
                      }}
                    >
                      📋 Copy Text
                    </button>
                    <button
                      style={S.previewBtn}
                      onClick={() => {
                        const r = results[selectedResultIndex];
                        const blob = new Blob(["\uFEFF" + r.text], { type: "text/plain;charset=utf-8" });
                        const url  = URL.createObjectURL(blob);
                        const a    = document.createElement("a"); a.href = url;
                        a.download = r.name.replace(/\.[^.]+$/, "") + "_ocr.txt"; a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      ↓ Download TXT
                    </button>
                  </div>
                </div>
                <textarea
                  style={S.previewTextarea}
                  value={results[selectedResultIndex].text}
                  onChange={(e) => {
                    const newText = e.target.value;
                    setResults((prev) =>
                      prev.map((r, idx) =>
                        idx === selectedResultIndex ? { ...r, text: newText } : r
                      )
                    );
                  }}
                  placeholder="No text extracted"
                />
              </div>
            )}
          </div>
        )}
      </main>

      <footer style={S.footer}>
        Powered by Tesseract.js (open-source OCR) · Supports मराठी, हिंदी, English ·
        100% free · No data stored · No API key needed
      </footer>

      {/* ─── Buy Me a Coffee Popup ─── */}
      {showCoffeeModal && <QRModal onClose={() => setShowCoffeeModal(false)} />}
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
  main: { flex: 1, padding: "32px 28px", maxWidth: 920, margin: "0 auto", width: "100%", boxSizing: "border-box" },
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
  
  // Progress/Status Styling
  progressCard: { background: "#13131A", border: "1px solid #1E1E28", borderRadius: 14, padding: "28px 24px" },
  progressTop: { display: "flex", justifyContent: "space-between", marginBottom: 12 },
  progressLabel: { fontWeight: 600, fontSize: 15, color: "#F0EBE0" },
  progressPct: { fontWeight: 700, fontSize: 15, color: "#FF9F1C" },
  bar: { height: 6, background: "#1E1E28", borderRadius: 99, overflow: "hidden", marginBottom: 10 },
  barFill: { height: "100%", background: "linear-gradient(90deg,#FF6B35,#FF9F1C)", borderRadius: 99, transition: "width .3s ease" },
  progressSub: { fontSize: 12, color: "#5A5868" },
  
  // Progress Grid (8 per row on desktop)
  progressGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))", gap: 8, marginTop: 20, maxHeight: 300, overflowY: "auto", paddingRight: 4 },
  miniCardGrid: { background: "rgba(255, 255, 255, 0.02)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: "1px solid rgba(255, 255, 255, 0.07)", borderRadius: 10, padding: "12px 8px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", minHeight: 90, transition: "all 0.2s" },
  miniCardProcessing: { borderColor: "rgba(255, 159, 28, 0.4)", background: "rgba(255, 159, 28, 0.06)" },
  miniCardDone: { borderColor: "rgba(76, 175, 125, 0.4)", background: "rgba(76, 175, 125, 0.06)" },
  miniCardIcon: { fontSize: 20, marginBottom: 6 },
  miniCardName: { fontSize: 11, color: "#A8A0B0", width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" },
  miniCardPct: { fontSize: 10, color: "#FF9F1C", fontWeight: "bold", marginTop: 4 },

  // Stop Button
  stopBtn: { background: "rgba(255, 107, 107, 0.12)", border: "1px solid rgba(255, 107, 107, 0.25)", color: "#FF7070", padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.15s" },

  // Summary Bar
  summaryBar: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, background: "#13131A", border: "1px solid #1E1E28", borderRadius: 12, padding: "14px 18px", marginBottom: 16 },
  summaryLeft: { display: "flex", gap: 10 },
  summaryRight: { display: "flex", gap: 8, flexWrap: "wrap" },
  pill: { background: "#0D2A1A", color: "#4CAF7D", padding: "4px 12px", borderRadius: 99, fontSize: 13, fontWeight: 600 },
  pillRed: { background: "#2A0D0D", color: "#FF6B6B" },
  btnPrimary: { background: "linear-gradient(135deg,#FF6B35,#FF9F1C)", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" },
  btnSec: { background: "#1E1E28", color: "#E8E4DC", border: "1px solid #2E2E3A", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  btnGhost: { background: "transparent", color: "#5A5868", border: "1px solid #2E2E3A", padding: "8px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer" },

  // Results Grid (8 per row on desktop)
  resultsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))", gap: 8, marginBottom: 20, maxHeight: 220, overflowY: "auto", paddingRight: 4 },
  resultCard: { background: "rgba(255, 255, 255, 0.02)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: "1px solid rgba(255, 255, 255, 0.07)", borderRadius: 10, padding: "12px 8px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all .15s", width: "100%", color: "#E8E4DC", borderStyle: "solid" },
  resultCardActive: { borderColor: "rgba(255, 159, 28, 0.5)", background: "rgba(255, 159, 28, 0.08)" },
  resultCardError: { borderColor: "rgba(255, 107, 107, 0.4)", background: "rgba(255, 107, 107, 0.04)" },
  rcIcon: { fontSize: 20, marginBottom: 6 },
  rcName: { fontSize: 11, color: "#A8A0B0", width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" },
  rcStatus: { fontSize: 9, color: "#6B6D80", marginTop: 4, textTransform: "uppercase", fontWeight: 700 },

  // Interactive Preview Textarea Panel
  previewBox: { background: "#13131A", border: "1px solid #1E1E28", borderRadius: 12, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12, marginTop: 16 },
  previewHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, borderBottom: "1px solid #1E1E28", paddingBottom: 12 },
  previewTitle: { fontSize: 13, color: "#A8A0B0" },
  previewActions: { display: "flex", gap: 8 },
  previewBtn: { background: "#1E1E28", border: "1px solid #2E2E3A", color: "#E8E4DC", padding: "6px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 4, transition: "all .15s" },
  previewTextarea: { width: "100%", height: 320, background: "#09090E", border: "1px solid #18181F", borderRadius: 8, padding: "14px 16px", color: "#D8D4CC", fontSize: 14, lineHeight: 1.8, fontFamily: "'Noto Sans Devanagari','Inter',sans-serif", resize: "vertical", outline: "none" },

  footer: { textAlign: "center", padding: "16px", fontSize: 12, color: "#2E2E3A", borderTop: "1px solid #18181F" },
};

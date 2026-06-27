// netlify/functions/vision-ocr.js
// Proxies Google Cloud Vision API (DOCUMENT_TEXT_DETECTION) for handwriting OCR.
// Uses Node's built-in https module — works on Node 14/16/18.
// API key stored as GOOGLE_VISION_API_KEY env variable in Netlify dashboard.

const https = require("https");

function httpsPost(url, bodyObj) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(bodyObj);
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: "GOOGLE_VISION_API_KEY is not set in Netlify environment variables." }),
    };
  }

  let imageBase64;
  try {
    ({ imageBase64 } = JSON.parse(event.body));
    if (!imageBase64) throw new Error("Missing imageBase64");
  } catch (e) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid request body: " + e.message }) };
  }

  try {
    const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
    const payload = {
      requests: [
        {
          image: { content: imageBase64 },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
        },
      ],
    };

    const { status, body } = await httpsPost(url, payload);
    const data = JSON.parse(body);

    if (status !== 200) {
      const errMsg = data?.error?.message || body;
      return {
        statusCode: status,
        headers: CORS,
        body: JSON.stringify({ error: `Vision API error (${status}): ${errMsg}` }),
      };
    }

    const text = data.responses?.[0]?.fullTextAnnotation?.text?.trim() || "";

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: "Function error: " + (e.message || String(e)) }),
    };
  }
};

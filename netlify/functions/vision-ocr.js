// netlify/functions/vision-ocr.js
// Proxies Google Cloud Vision API (DOCUMENT_TEXT_DETECTION) for handwriting OCR.
// The API key is stored as the GOOGLE_VISION_API_KEY env variable in Netlify dashboard.

exports.handler = async (event) => {
  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // Handle preflight
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
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid request body." }) };
  }

  try {
    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: imageBase64 },
              features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            },
          ],
        }),
      }
    );

    if (!visionRes.ok) {
      const errBody = await visionRes.text();
      return {
        statusCode: visionRes.status,
        headers: CORS,
        body: JSON.stringify({ error: `Vision API error: ${errBody}` }),
      };
    }

    const data = await visionRes.json();
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
      body: JSON.stringify({ error: e.message || "Vision API call failed." }),
    };
  }
};

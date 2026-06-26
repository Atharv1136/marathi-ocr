exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, x-api-key",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { base64, mime, apiKey } = JSON.parse(event.body);

    if (!apiKey || !base64 || !mime) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing required fields: apiKey, base64, mime" }) };
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mime, data: base64 } },
            {
              type: "text",
              text: `You are an OCR engine. Extract ALL text from this image exactly as it appears.
- Preserve line breaks and paragraph structure.
- If the text is in Marathi (Devanagari script), output it in Marathi exactly.
- If there is a mix of English and Marathi, preserve both languages.
- Do NOT translate, summarize, or add any commentary.
- If no text is found, output only: [No text found]
- Output ONLY the extracted text, nothing else.`
            }
          ]
        }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: data?.error?.message || "Anthropic API error" }),
      };
    }

    const text = data.content?.find(b => b.type === "text")?.text?.trim() || "[No text found]";
    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};

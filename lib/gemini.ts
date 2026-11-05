const MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"];

async function callModel(
  model: string,
  prompt: string,
  apiKey: string,
  temperature: number
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        responseMimeType: "application/json",
      },
    }),
  });
}

export async function callGemini(
  prompt: string,
  temperature = 0.2
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  let lastErr = "";
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await callModel(model, prompt, apiKey, temperature);
      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
        lastErr = "empty response";
        continue;
      }
      if (res.status === 503 || res.status === 429) {
        lastErr = `${model} ${res.status}`;
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        continue;
      }
      const body = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${body}`);
    }
  }
  throw new Error(`Gemini unavailable after retries: ${lastErr}`);
}

export async function callGeminiJson<T>(
  prompt: string,
  temperature = 0.2
): Promise<T> {
  const text = await callGemini(prompt, temperature);
  try {
    return JSON.parse(text) as T;
  } catch {
    const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error("Gemini did not return valid JSON");
  }
}

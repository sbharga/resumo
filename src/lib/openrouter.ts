import { GoogleGenAI } from '@google/genai'

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GOOGLE_AI_KEY as string })
const DEFAULT_MODEL = 'gemini-3-flash-preview'

function stripFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
}

export async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  model = DEFAULT_MODEL
): Promise<string> {
  const response = await ai.models.generateContent({
    model,
    contents: userPrompt,
    config: { systemInstruction: systemPrompt },
  })
  const content = response.text ?? ''
  if (!content) throw new Error('No content returned from AI')
  return stripFences(content)
}

export async function callGeminiWithPDF(
  systemPrompt: string,
  file: File,
  model = DEFAULT_MODEL
): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const base64 = btoa(
    new Uint8Array(arrayBuffer).reduce((str, byte) => str + String.fromCharCode(byte), '')
  )

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { inlineData: { mimeType: 'application/pdf', data: base64 } },
          { text: 'Parse this resume PDF and return the JSON.' },
        ],
      },
    ],
    config: { systemInstruction: systemPrompt },
  })

  const content = response.text ?? ''
  if (!content) throw new Error('No content returned from AI')
  return stripFences(content)
}

// Keep old name as alias so JobDetailPage doesn't need changes
export const callOpenRouter = callGemini

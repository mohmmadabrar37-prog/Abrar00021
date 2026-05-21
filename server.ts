import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Set generous payload limit for base64 image data (e.g., high-res camera photos)
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ limit: "25mb", extended: true }));

  // API route to edit or generate photos via Gemini
  app.post("/api/edit-photo", async (req: express.Request, res: express.Response) => {
    try {
      const { prompt, base64Image, mimeType, model = "gemini-2.5-flash-image", aspectRatio = "1:1" } = req.body;

      if (!process.env.GEMINI_API_KEY) {
        return res.status(400).json({
          success: false,
          error: "GEMINI_API_KEY is missing. Please make sure your Gemini API key is configured in 'Settings > Secrets' panel of AI Studio.",
          needsApiKey: true
        });
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      if (!prompt) {
        return res.status(400).json({ success: false, error: "Prompt is required." });
      }

      const parts: any[] = [];

      // If an existing image was uploaded/selected, add it to the parts
      if (base64Image) {
        let cleanBase64 = base64Image;
        let cleanMimeType = mimeType || "image/png";

        if (base64Image.startsWith("http")) {
          // If it is a template URL, fetch it server-side to bypass client CORS limits
          console.log(`[URL Fetch] Downloading external template: ${base64Image}`);
          const imageFetchResponse = await fetch(base64Image);
          if (!imageFetchResponse.ok) {
            throw new Error(`Failed to download template image from ${base64Image}`);
          }
          const arrayBuffer = await imageFetchResponse.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          cleanBase64 = buffer.toString("base64");
          cleanMimeType = imageFetchResponse.headers.get("content-type") || "image/png";
        } else {
          // Extract raw base64 data if it is prefixed with metadata
          const dataPrefixMatch = base64Image.match(/^data:([^;]+);base64,(.*)$/);
          if (dataPrefixMatch) {
            cleanMimeType = dataPrefixMatch[1];
            cleanBase64 = dataPrefixMatch[2];
          }
        }

        parts.push({
          inlineData: {
            data: cleanBase64,
            mimeType: cleanMimeType
          }
        });
      }

      // Add the natural language instructions
      parts.push({
        text: prompt
      });

      console.log(`[Gemini Edit Request] Model: ${model}, Prompt: "${prompt}", Has original image: ${!!base64Image}, Aspect ratio: ${aspectRatio}`);

      // Call the generative image model using the official @google/genai SDK
      const response = await ai.models.generateContent({
        model: model,
        contents: {
          parts: parts
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio
          }
        }
      });

      let resultingImageBase64 = null;
      let textResponse = "";

      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            resultingImageBase64 = part.inlineData.data;
          } else if (part.text) {
            textResponse += part.text + "\n";
          }
        }
      }

      console.log(`[Gemini Response Received] Success! Output image: ${!!resultingImageBase64}, Text feedback length: ${textResponse.length}`);

      let imageUrl = null;
      if (resultingImageBase64) {
        imageUrl = `data:image/png;base64,${resultingImageBase64}`;
      }

      return res.json({
        success: true,
        imageUrl,
        text: textResponse.trim()
      });

    } catch (error: any) {
      console.error("[Backend Error] calling Gemini API:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "An unexpected error occurred while communicating with Gemini."
      });
    }
  });

  // Serve static files / mount Vite dev middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: express.Request, res: express.Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server successfully started and listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

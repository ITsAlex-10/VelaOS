import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import { GoogleGenAI } from "@google/genai";
import { handleIncomingMessage } from "./src/lib/whatsapp";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Google Maps Grounding Prospecting Endpoint
  app.post("/api/prospecting/search", async (req, res) => {
    const { query, location, latLng } = req.body;

    if (!query && !location) {
      return res.status(400).json({ error: "Indique um nicho/setor ou localização para prospeção." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const openrouterKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey && !openrouterKey) {
      return res.status(500).json({ 
        error: "Configuração de IA em falta: Configure a chave GEMINI_API_KEY (para usar o Gemini grátis oficial com Google Maps real) ou a chave OPENROUTER_API_KEY (para usar modelos grátis de OpenRouter como o Google Gemma) no seu ficheiro .env." 
      });
    }

    try {
      const userTarget = `${query || "Empresas e serviços"} em ${location || "Portugal"}`;
      const prompt = `Age como um consultor comercial sénior da agência digital e estúdio de branding VELA.
Realiza uma varredura intensiva e exaustiva no Google Maps procurando o maior número possível de empresas e negócios locais reais para: "${userTarget}".

Objetivo Comercial: Prospeção B2B em massa para captação de leads para serviços digitais VELA (criação de websites premium, plataformas de agendamento online, rebranding e SEO local).

Diretrizes Estritas:
1. Explora a fundo a base de dados e retorna o MÁXIMO de empresas e estabelecimentos reais (idealmente entre 15 a 30 locais verificados distintos por toda a zona, cobrindo diferentes bairros, freguesias e avenidas).
2. Não incluas nem transcrevas comentários ou reviews de clientes nos resultados (apenas os dados objetivos de cada estabelecimento).
3. Para CADA empresa encontrada, formata com a seguinte estrutura padronizada exata:

### [Nome Oficial da Empresa]
- **Setor / Categoria**: [ex: Restaurante / Clínica Dentária / Gabinete de Arquitetura]
- **Morada**: [Morada completa]
- **Telefone**: [Contacto telefónico ou "Não listado"]
- **Website**: [URL do site ou "Sem website oficial"]
- **Avaliação**: [Classificação ⭐ X.X com Y avaliações]
- **Diagnóstico Comercial VELA**: [1-2 frases sobre o potencial de venda: ex: Sem site responsivo, forte volume de clientes mas imagem digital desatualizada, excelente oportunidade para proposta VELA]

4. No final, apresenta um breve parágrafo com "Resumo Estratégico da Região" para a equipa comercial da VELA.`;

      // 1. Handshake OpenRouter if present
      if (openrouterKey) {
        const modelName = process.env.OPENROUTER_MODEL || "google/gemma-3-4b-it:free";
        console.log(`[PROSPECTING] Executing via OpenRouter: model="${modelName}"`);
        try {
          const openrouterRes = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            {
              model: modelName,
              messages: [
                { role: "user", content: prompt }
              ]
            },
            {
              headers: {
                "Authorization": `Bearer ${openrouterKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": process.env.APP_URL ? `https://${process.env.APP_URL}` : "http://localhost:3000",
                "X-Title": "VELA OS"
              }
            }
          );

          const text = openrouterRes.data?.choices?.[0]?.message?.content || "";
          return res.json({
            text,
            groundingChunks: [],
            searchQueries: []
          });
        } catch (orError: any) {
          console.error("[PROSPECTING OPENROUTER ERROR]", orError?.response?.data || orError?.message);
          const status = orError?.response?.status || 500;
          if (status === 404) {
            return res.status(404).json({
              error: `Erro 404 (Modelo Não Encontrado): O modelo "${modelName}" já não existe ou foi descontinuado pelo OpenRouter. Por favor, aceda às Variáveis de Ambiente no painel da Hostinger, altere o valor da variável "OPENROUTER_MODEL" para um modelo gratuito ativo (ex: "google/gemma-3-4b-it:free" ou "google/gemma-4-31b-it:free") e clique em Guardar e Reimplementar.`
            });
          }
          const openrouterErrMsg = orError?.response?.data?.error?.message || orError?.message || "Erro desconhecido ao chamar o OpenRouter.";
          return res.status(status).json({
            error: `Erro na API do OpenRouter (${status}): ${openrouterErrMsg}`
          });
        }
      }

      // 2. Fallback to official Gemini with Google Maps Grounding
      const ai = new GoogleGenAI({
        apiKey: apiKey!,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const config: any = {
        tools: [{ googleMaps: {} }],
      };

      if (latLng && typeof latLng.latitude === "number" && typeof latLng.longitude === "number") {
        config.toolConfig = {
          retrievalConfig: {
            latLng: {
              latitude: latLng.latitude,
              longitude: latLng.longitude,
            },
          },
        };
      }

      console.log(`[PROSPECTING] Searching Google Maps for: "${userTarget}" (latLng: ${JSON.stringify(latLng || null)})`);

      // Try primary model based on system guidelines (gemini-3.8-flash for Google Maps Grounding)
      const modelsToTry = ["gemini-3.8-flash", "gemini-flash-latest"];
      let response: any = null;
      let lastError: any = null;

      for (const modelName of modelsToTry) {
        try {
          console.log(`[PROSPECTING] Attempting model: ${modelName}`);
          response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config,
          });
          if (response) break;
        } catch (err: any) {
          lastError = err;
          const errString = String(err?.message || err);
          const isRateLimit = errString.includes("429") || 
                              errString.includes("RESOURCE_EXHAUSTED") || 
                              err?.status === 429 || 
                              err?.code === 429;

          console.warn(`[PROSPECTING] Error with ${modelName}:`, errString);

          if (isRateLimit) {
            // Wait 1.5s before next attempt/model
            await new Promise((resolve) => setTimeout(resolve, 1500));
            continue;
          } else {
            // Non-rate-limit error (e.g., config error), don't keep cycling models
            break;
          }
        }
      }

      if (!response && lastError) {
        throw lastError;
      }

      const rawGroundingChunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const webSearchQueries = response?.candidates?.[0]?.groundingMetadata?.webSearchQueries || [];

      // Filter to keep only business places and eliminate review snippets entirely
      const groundingChunks = rawGroundingChunks
        .filter((chunk: any) => chunk?.maps && chunk.maps.title && !chunk.maps.title.toLowerCase().startsWith('review'))
        .map((chunk: any) => ({
          maps: {
            title: chunk.maps.title,
            uri: chunk.maps.uri
          }
        }));

      console.log(`[PROSPECTING] Successfully retrieved ${groundingChunks.length} official places from Google Maps.`);

      res.json({
        text: response?.text || "",
        groundingChunks,
        searchQueries: webSearchQueries,
      });
    } catch (error: any) {
      console.error("[PROSPECTING ERROR]", error);
      const errMsg = String(error?.message || error);
      const isQuotaExceeded = errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || error?.status === 429;

      res.status(isQuotaExceeded ? 429 : 500).json({
        error: isQuotaExceeded
          ? "Limite de quota da Google API atingido (Erro 429: RESOURCE_EXHAUSTED). Aguarde 1 minuto ou utilize uma chave com faturação ativada no painel de Segredos."
          : (error.message || "Erro ao consultar o Google Maps."),
        isQuotaExceeded,
        details: error.toString(),
      });
    }
  });

  // Proxy route for Google Workspace APIs
  app.post("/api/workspace/proxy", async (req, res) => {
    const { url, method, data, token } = req.body;

    if (!url || !token) {
      return res.status(400).json({ error: "Missing URL or token" });
    }

    try {
      console.log(`[WORKSPACE PROXY] ${method || 'GET'} -> ${url}`);
      const response = await axios({
        url,
        method: method || 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        data: data || undefined,
        timeout: 15000 // 15s timeout to prevent infinite hangs
      });
      console.log(`[WORKSPACE PROXY] SUCCESS: ${url}`);
      res.json(response.data);
    } catch (error: any) {
      const errorData = error.response?.data;
      const status = error.response?.status || (error.code === 'ECONNABORTED' ? 408 : 500);
      const message = error.code === 'ECONNABORTED' ? 'Request timed out' : error.message;
      
      // Quiet logging for known Chat API configuration errors or expired sessions (401) to avoid telemetry noise
      if (status === 404 && url.includes('chat.googleapis.com')) {
        console.warn(`[WORKSPACE PROXY] Chat API Not Configured (404) at ${url}`);
      } else if (status === 401) {
        console.warn(`[WORKSPACE PROXY] Session Expired (401) at ${url}`);
      } else {
        console.error(`[WORKSPACE PROXY] ERROR ${status}: ${url}`, JSON.stringify(errorData || message));
      }
      
      res.status(status).json(errorData || { error: message });
    }
  });

  // Dedicated proxy route for Google Drive multipart raw file uploads
  app.post("/api/workspace/upload", express.raw({ type: "application/octet-stream", limit: "15mb" }), async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    const { name, parentId, mimeType } = req.query;

    if (!token || !name || !parentId) {
      return res.status(400).json({ error: "Missing authorization token, file name, or parent ID" });
    }

    try {
      console.log(`[DRIVE UPLOAD] Uploading "${name}" (${mimeType}) to parent ${parentId}`);
      const boundary = "VELA_UPLOAD_BOUNDARY";
      
      const metadata = JSON.stringify({
        name: String(name),
        parents: [String(parentId)],
        mimeType: mimeType ? String(mimeType) : "application/octet-stream"
      });

      // Construct Google Drive multipart/related body with the base64-encoded raw file data
      const bodyBuffer = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
        Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType || "application/octet-stream"}\r\nContent-Transfer-Encoding: base64\r\n\r\n`),
        req.body, // The base64 raw string sent in the body
        Buffer.from(`\r\n--${boundary}--`)
      ]);

      const uploadResponse = await axios.post(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        bodyBuffer,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": `multipart/related; boundary=${boundary}`
          },
          maxContentLength: 20 * 1024 * 1024,
          maxBodyLength: 20 * 1024 * 1024
        }
      );

      console.log(`[DRIVE UPLOAD] SUCCESS: Created file ${uploadResponse.data.id}`);
      res.json(uploadResponse.data);
    } catch (error: any) {
      const errorData = error.response?.data;
      console.error("[DRIVE UPLOAD ERROR]", JSON.stringify(errorData || error.message));
      res.status(error.response?.status || 500).json(errorData || { error: error.message });
    }
  });

  // Webhook receiver for Evolution API or similar WhatsApp gateways
  app.post("/api/whatsapp/webhook", async (req, res) => {
    try {
      console.log("[WHATSAPP WEBHOOK] Received request body:", JSON.stringify(req.body));
      
      const result = await handleIncomingMessage(req.body);
      
      if (result.success) {
        return res.json({ 
          status: "success", 
          message: "Message processed successfully", 
          messageId: result.messageId,
          clientId: result.clientId
        });
      } else {
        return res.status(200).json({ 
          status: "skipped", 
          message: "Webhook processed but did not match any active CRM client phone number." 
        });
      }
    } catch (e: any) {
      console.error("[WHATSAPP WEBHOOK ERROR]", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

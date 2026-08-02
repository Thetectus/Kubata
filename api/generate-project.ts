// Função serverless (Vercel) — gera uma estrutura de divisões a partir de
// uma descrição em texto livre, usando a API da Anthropic com uma tool
// forçada para obter sempre JSON estruturado (não uma imagem, não texto
// livre) que o editor 2D do Kubata já sabe desenhar.
import type { VercelRequest, VercelResponse } from "@vercel/node";

const LAYOUT_TOOL = {
  name: "generate_layout",
  description: "Gera a lista de divisões (compartimentos) de um projecto de construção a partir de uma descrição.",
  input_schema: {
    type: "object" as const,
    properties: {
      divisions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "Nome da divisão, ex: 'Sala', 'Quarto 1'" },
            widthM: { type: "number", description: "Largura em metros (2 a 12)" },
            heightM: { type: "number", description: "Profundidade em metros (2 a 12)" },
            wallHeightM: { type: "number", description: "Pé-direito em metros, tipicamente 2.6 a 3.2" },
            openings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["porta", "janela"] },
                  side: { type: "string", enum: ["top", "right", "bottom", "left"] },
                  offsetM: { type: "number" },
                  widthM: { type: "number" },
                },
                required: ["type", "side", "offsetM", "widthM"],
              },
            },
          },
          required: ["label", "widthM", "heightM", "wallHeightM"],
        },
      },
    },
    required: ["divisions"],
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY não configurada no servidor" });
    return;
  }

  const description = typeof req.body?.description === "string" ? req.body.description.slice(0, 2000) : "";
  if (!description.trim()) {
    res.status(400).json({ error: "Falta 'description' no pedido" });
    return;
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system:
          "És um assistente que converte uma descrição em português de um projecto de construção " +
          "(casa, apartamento, remodelação) numa lista estruturada de divisões com dimensões plausíveis " +
          "em metros, para popular um editor visual. Não expliques nada em texto — usa sempre a tool. " +
          "Dimensões devem ser realistas para construção residencial em Angola.",
        tools: [LAYOUT_TOOL],
        tool_choice: { type: "tool", name: "generate_layout" },
        messages: [{ role: "user", content: description }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      res.status(502).json({ error: `Anthropic API error: ${response.status} ${text.slice(0, 300)}` });
      return;
    }

    const data = await response.json();
    const toolUse = data.content?.find((c: { type: string }) => c.type === "tool_use");
    if (!toolUse) {
      res.status(502).json({ error: "Resposta sem estrutura esperada" });
      return;
    }

    res.status(200).json({ divisions: toolUse.input.divisions ?? [] });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Erro desconhecido" });
  }
}

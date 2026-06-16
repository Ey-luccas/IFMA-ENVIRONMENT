// ============================================================
// IFMA-ENVIRONMENT - Servidor para análise ambiental de objetos
// Projeto escolar usando Express + OpenAI
// ============================================================

import express from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Carrega as variáveis de ambiente do arquivo .env
dotenv.config();

// Cria o servidor Express
const app = express();
const PORT = 3000;

// Configura o Multer para receber o upload da imagem
// A imagem será salva na memória (não no disco)
const upload = multer({
  storage: multer.memoryStorage(),
  // Limite de 10MB para a imagem
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Verifica se a chave da API OpenAI foi configurada
const apiKey = process.env.OPENAI_API_KEY;
const apiKeyConfigurada = apiKey && apiKey !== 'sua_chave_aqui';

// Configura o cliente da OpenAI com a chave da API
const openai = apiKeyConfigurada ? new OpenAI({ apiKey }) : null;

// Pega o caminho da pasta public para servir os arquivos estáticos
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use(express.static(join(__dirname, 'public')));

// ============================================================
// Rota de status: verifica se o servidor e a API estão OK
// ============================================================
app.get('/status', (req, res) => {
  res.json({
    servidor: 'online',
    api_key_configurada: apiKeyConfigurada,
  });
});

// ============================================================
// Rota principal: recebe a imagem, analisa com IA e retorna JSON
// ============================================================
app.post('/analisar', upload.single('imagem'), async (req, res) => {
  try {
    // Verifica se a chave da API foi configurada
    if (!apiKeyConfigurada) {
      return res.status(401).json({
        erro: 'Chave da API OpenAI não configurada. Edite o arquivo .env e coloque sua chave.',
      });
    }

    // Verifica se uma imagem foi enviada
    if (!req.file) {
      return res.status(400).json({ erro: 'Nenhuma imagem enviada.' });
    }

    // Converte a imagem para base64
    const imagemBase64 = req.file.buffer.toString('base64');
    const tipoImagem = req.file.mimetype;

    // Monta o prompt para a IA (em português do Brasil, estilo escolar)
    const prompt = `
Analise a imagem enviada.

Você faz parte de um projeto escolar chamado IFMA-ENVIRONMENT.

Responda em português do Brasil, de forma simples e educativa.

Identifique:
- qual é o objeto da imagem;
- qual é o material principal provável;
- quanto tempo ele pode demorar para se decompor no ambiente;
- quais problemas ele pode causar ao meio ambiente;
- como ele deve ser descartado corretamente.

Se não tiver certeza sobre o objeto, informe que a confiança é baixa.
`;

    // Envia a imagem para a API da OpenAI (modelo GPT-4o que aceita imagens)
    const resposta = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${tipoImagem};base64,${imagemBase64}`,
              },
            },
          ],
        },
      ],
      // Pede para a IA responder em formato JSON
      response_format: { type: 'json_object' },
      max_tokens: 1000,
    });

    // Pega o texto da resposta da IA
    const textoResposta = resposta.choices[0].message.content;

    // Converte o texto para JSON
    const dados = JSON.parse(textoResposta);

    // Retorna os dados para o frontend
    res.json({
      sucesso: true,
      dados: dados,
    });
  } catch (erro) {
    console.error('Erro ao analisar imagem:', erro);

    // Verifica se o erro é de autenticação da OpenAI
    if (erro.status === 401) {
      return res.status(401).json({
        erro: 'Chave da API OpenAI inválida. Verifique sua chave no arquivo .env.',
      });
    }

    // Verifica se o erro é de limite da API
    if (erro.status === 429) {
      return res.status(429).json({
        erro: 'Limite de requisições da API excedido. Tente novamente em alguns instantes.',
      });
    }

    // Erro genérico
    res.status(500).json({
      erro: 'Erro ao analisar a imagem. Verifique sua conexão e tente novamente.',
    });
  }
});

// ============================================================
// Inicia o servidor
// ============================================================
app.listen(PORT, () => {
  console.log('============================================');
  console.log('  🌿 IFMA-ENVIRONMENT');
  console.log('  Servidor rodando em: http://localhost:' + PORT);
  console.log('  API OpenAI: ' + (apiKeyConfigurada ? '✅ Configurada' : '❌ Não configurada'));
  console.log('============================================');
});

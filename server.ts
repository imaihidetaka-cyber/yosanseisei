import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

console.log("[SERVER] Script starting...");

async function startServer() {
  console.log("[SERVER] startServer() called");
  const app = express();
  const PORT = 3000;

  // 1. ヘルスチェック（最優先）
  app.get("/api/health", (req, res) => {
    console.log("[SERVER] Health check hit");
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // 2. ログ
  app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    next();
  });

  // 3. パース
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // 4. APIエンドポイント
  app.post("/api/analyze", async (req, res) => {
    console.log("[SERVER] /api/analyze hit");
    try {
      const { base64Data, manualHints } = req.body;

      if (!base64Data) {
        return res.status(400).json({ error: "PDFデータが送信されていません。" });
      }

      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        console.error("GEMINI_API_KEY is missing");
        return res.status(500).json({ error: "サーバー側でAPIキーが設定されていません。" });
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const analysisPrompt = `
        添付した確定申告書（PDF）を精密に読み取り、経営分析レポートを作成してください。

        【あなたの役割】
        中小企業・個人事業主専門の経営アドバイザーとして分析します。
        このアドバイスは「確芯経営」というブランドに基づいています。
        税務上の解釈ではなく、経営判断に使うための分析を行ってください。

        【確芯経営の分析フレームワーク】
        支出を以下の3つに分類して分析します：
        1. ①変動費：売上原価、外注費など売上に連動する費用。
        2. ②未来投資費：研修費、接待交際費、広告宣伝費、減価償却費など、将来の売上を作るための費用。
        3. ③経営基盤費：地代家賃、水道光熱費、租税公課など、事業維持に必要な固定費。

        【未来投資費の基準】
        ・粗利（売上 - 変動費）に対する「未来投資費」の割合を算出してください。
        ・目標基準：15%
        ・15%より高い場合：使い過ぎの可能性を指摘。
        ・15%より低い場合：将来への投資不足（守りに入りすぎ）の可能性を指摘。

        【分析の重要ルール】
        1. 日本の「青色申告決算書」または「収支内訳書」のフォーマットを前提に数値を抽出してください。
        2. 特に以下の項目を重点的に探してください：
           - 売上金額 (1)
           - 売上原価 (仕入金額など)
           - 経費（租税公課、荷造運賃、水道光熱費、旅費交通費、通信費、広告宣伝費、接待交際費、損害保険料、修繕費、消耗品費、福利厚生費、給料賃金、外注工賃、利子割引料、地代家賃、減価償却費など）
           - 所得金額 (43)
        3. 抽出した数値で「売上 - 変動費 = 粗利」「粗利 - 未来投資費 - 経営基盤費 = 利益」の整合性をチェックしてください。
        4. ユーザーからの補足情報がある場合は、それを最優先の正解データとして扱ってください。

        【ユーザーからの補足情報】
        ${manualHints || 'なし'}

        【読み取れなかった項目があれば】
        「〇〇が読み取れませんでした。わかれば入力してください」と冒頭に明記してください。

        【出力形式】
        Markdown形式で、以下の構成で出力してください。見出しには適切な絵文字を付けてください。
        **重要：表（Table）は使用せず、箇条書きのリスト形式で出力してください。また、視認性を高めるため、各セクションの間には必ず空行（2つの改行）を入れてください。**

        1. ## 📊 売上・粗利・利益の構造サマリー
           ・売上、変動費、粗利（売上-変動費）、利益の具体的な数値
           ・粗利に対する「未来投資費」の割合（%）
           ・15%基準に照らした投資バランスの評価（投資過多か、投資不足か）

        2. ## 🔍 確芯経営による経費分析
           ・**①変動費**: 主な科目と合計額
           ・**②未来投資費**: 研修、広告、交際費等の合計と、将来への投資状況
           ・**③経営基盤費**: 固定費の合計と、削減の余地
           ・経営上のアドバイス

        3. ## 💡 改善が見込める経費トップ3
           ・1位：[科目名]（金額）- 理由と見直しの方向性
           ・2位：[科目名]（金額）- 理由と見直しの方向性
           ・3位：[科目名]（金額）- 理由と見直しの方向性

        4. ## 🚩 経営上の課題サマリー（3行以内）
           ・数字から読み取れる"今最も注目すべきポイント"

        5. ## ✉️ 来期に向けた一言メッセージ
           ・この数字の持ち主に、今すぐ伝えたいことを1つだけ
      `;

      console.log("Calling Gemini API for analysis...");
      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { text: analysisPrompt },
            {
              inlineData: {
                mimeType: "application/pdf",
                data: base64Data,
              },
            },
          ],
        },
      });

      if (!result.text) {
        console.error("Gemini returned empty text");
        throw new Error("解析結果が得られませんでした。");
      }

      console.log("Analysis successful");
      res.json({ text: result.text });

    } catch (error: any) {
      console.error("Analysis error details:", error);
      res.status(500).json({ 
        error: error.message || "解析中にエラーが発生しました。",
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  app.post("/api/budget", async (req, res) => {
    console.log("[SERVER] /api/budget hit");
    try {
      const { analysisResult, busyMonths, selectedRequests, freeTextRequest } = req.body;

      if (!analysisResult) {
        return res.status(400).json({ error: "分析結果が送信されていません。" });
      }

      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "サーバー側でAPIキーが設定されていません。" });
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const budgetPrompt = `
        前述の分析結果をもとに、来期1年間の予算管理計画を作成してください。

        【分析結果】
        ${analysisResult}

        【追加情報】
        ・売上が多い月・少ない月：${busyMonths || '特になし'}
        ・来期に変えたいこと（要望）：
          - 選択された項目：${selectedRequests.join('、') || '特になし'}
          - 自由記述：${freeTextRequest || '特なし'}

        【出力形式】
        Markdown形式で、以下の構成で出力してください。見出しには適切な絵文字を付けてください。
        **重要：表（Table）は使用せず、箇条書きのリスト形式で出力してください。また、視認性を高めるため、各セクションの間には必ず空行（2つの改行）を入れてください。**

        1. ## 📈 月別売上目標の設計
           ・今年の実績をベースに、月ごとの目安金額と根拠

        2. ## 💰 経費予算の配分（確芯経営モデル）
           ・①変動費：売上目標に対する目安
           ・②未来投資費：具体的に何にいくら使うべきか（粗利の15%目安）
           ・③経営基盤費：削減目標と維持すべき項目

        3. ## 🚀 来期の重点アクションプラン
           ・要望（${selectedRequests.join('、')}）を叶えるための具体的な3ステップ

        4. ## 💡 経営者へのアドバイス
           ・この計画を達成するために、明日から意識すべきこと
      `;

      console.log("Calling Gemini API for budget planning...");
      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts: [{ text: budgetPrompt }] },
      });

      if (!result.text) {
        throw new Error("予算計画が得られませんでした。");
      }

      console.log("Budget planning successful");
      res.json({ text: result.text });

    } catch (error: any) {
      console.error("Budget error details:", error);
      res.status(500).json({ 
        error: error.message || "予算計画の作成中にエラーが発生しました。",
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // グローバルエラーハンドラー
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Global error handler caught:", err);
    res.status(err.status || 500).json({
      error: err.message || "予期せぬサーバーエラーが発生しました。",
    });
  });

  // --- Vite 開発サーバーの設定 ---
  if (process.env.NODE_ENV !== "production") {
    console.log("[SERVER] Starting Vite in middleware mode...");
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("[SERVER] Vite middleware mounted.");
    } catch (viteError) {
      console.error("[SERVER] Failed to start Vite:", viteError);
    }
  } else {
    console.log("[SERVER] Serving static files from dist...");
    app.use(express.static("dist"));
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] Server is listening on http://0.0.0.0:${PORT}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[SERVER] Port ${PORT} is already in use.`);
    } else {
      console.error("[SERVER] Server error:", err);
    }
  });
}

startServer().catch(err => {
  console.error("[SERVER] Fatal error during startup:", err);
});

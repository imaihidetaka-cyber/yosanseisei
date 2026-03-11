/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { 
  FileText, 
  Upload, 
  TrendingUp, 
  PieChart, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight, 
  Download,
  Loader2,
  BarChart3,
  Calendar,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';

// --- Constants & Types ---

const MODEL_NAME = "gemini-3-flash-preview";

interface AnalysisResult {
  step1: string;
  step2?: string;
}

// --- Components ---

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'upload' | 'analysis' | 'budget'>('upload');
  
  // New: Manual hints to improve accuracy
  const [manualHints, setManualHints] = useState('');
  
  // Optional inputs for Step 2
  const [busyMonths, setBusyMonths] = useState('');
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
  const [freeTextRequest, setFreeTextRequest] = useState('');

  const commonRequests = [
    "利益率を改善したい",
    "未来投資費を15%に近づけたい",
    "固定費を削減したい",
    "売上を1.2倍にしたい",
    "集客を強化したい"
  ];

  const toggleRequest = (req: string) => {
    setSelectedRequests(prev => 
      prev.includes(req) ? prev.filter(r => r !== req) : [...prev, req]
    );
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== 'application/pdf') {
        setError('PDFファイルを選択してください。');
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const runAnalysis = async () => {
    if (!file) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const base64Data = await readFileAsBase64(file);

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          base64Data,
          manualHints,
        }),
      });

      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error("Non-JSON response (Analysis):", text);
        if (response.status === 504 || response.status === 502) {
          throw new Error("サーバーがタイムアウトしました。ファイルサイズを小さくするか、しばらく待ってから再度お試しください。");
        }
        throw new Error(`サーバーエラー (${response.status}): ${text.substring(0, 100)}...`);
      }

      if (!response.ok) {
        throw new Error(data.error || "解析中にエラーが発生しました。");
      }

      setResult({ step1: data.text || "分析結果を取得できませんでした。" });
      setStep('analysis');
    } catch (err: any) {
      console.error("Analysis Error:", err);
      setError(err.message || '分析中にエラーが発生しました。ファイルが読み取り可能か確認してください。');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const runBudgetPlanning = async () => {
    if (!result?.step1) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch("/api/budget", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          analysisResult: result.step1,
          busyMonths,
          selectedRequests,
          freeTextRequest,
        }),
      });

      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error("Non-JSON response (Budget):", text);
        if (response.status === 504 || response.status === 502) {
          throw new Error("サーバーがタイムアウトしました。しばらく待ってから再度お試しください。");
        }
        throw new Error(`サーバーエラー (${response.status}): ${text.substring(0, 100)}...`);
      }

      if (!response.ok) {
        throw new Error(data.error || "予算計画の作成中にエラーが発生しました。");
      }

      setResult(prev => ({ ...prev!, step2: data.text || "予算計画を取得できませんでした。" }));
      setStep('budget');
    } catch (err: any) {
      console.error("Budget Error:", err);
      setError(err.message || '予算計画の作成中にエラーが発生しました。');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setStep('upload');
    setError(null);
    setBusyMonths('');
    setSelectedRequests([]);
    setFreeTextRequest('');
    setManualHints('');
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans selection:bg-[#5A5A40] selection:text-white">
      {/* Header */}
      <header className="border-b border-[#141414]/10 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={reset}>
            <div className="bg-[#5A5A40] p-1.5 rounded-lg">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-lg tracking-tight">確定申告書 経営分析アドバイザー</h1>
          </div>
          {step !== 'upload' && (
            <button 
              onClick={reset}
              className="text-sm font-medium text-[#5A5A40] hover:underline underline-offset-4"
            >
              最初からやり直す
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="text-center space-y-4">
                <h2 className="text-4xl font-serif italic text-[#141414]">
                  あなたの数字を、<br />
                  <span className="text-[#5A5A40]">成長の羅針盤</span>に変える。
                </h2>
                <p className="text-[#141414]/60 max-w-lg mx-auto">
                  確定申告書のPDFをアップロードするだけで、AIがあなたのビジネスを多角的に分析し、次の一手を提案します。
                </p>
              </div>

              <div 
                className={`
                  relative border-2 border-dashed rounded-3xl p-12 transition-all duration-300
                  ${file ? 'border-[#5A5A40] bg-[#5A5A40]/5' : 'border-[#141414]/20 bg-white hover:border-[#5A5A40]/50'}
                `}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const droppedFile = e.dataTransfer.files[0];
                  if (droppedFile?.type === 'application/pdf') {
                    setFile(droppedFile);
                    setError(null);
                  } else {
                    setError('PDFファイルを選択してください。');
                  }
                }}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf"
                  className="hidden"
                />
                
                <div className="flex flex-col items-center gap-6">
                  <div className={`p-6 rounded-full ${file ? 'bg-[#5A5A40] text-white' : 'bg-[#F5F5F0] text-[#5A5A40]'}`}>
                    {file ? <FileText className="w-12 h-12" /> : <Upload className="w-12 h-12" />}
                  </div>
                  
                  <div className="text-center space-y-2">
                    {file ? (
                      <>
                        <p className="font-semibold text-lg">{file.name}</p>
                        <p className="text-sm text-[#141414]/60">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold text-lg">確定申告書のPDFをドロップ</p>
                        <p className="text-sm text-[#141414]/60">または、クリックしてファイルを選択</p>
                      </>
                    )}
                  </div>

                  {!file && (
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="px-8 py-3 bg-[#141414] text-white rounded-full font-medium hover:bg-[#141414]/90 transition-colors"
                    >
                      ファイルを選択
                    </button>
                  )}
                </div>
              </div>

              {file && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-white rounded-2xl p-6 border border-[#141414]/5 space-y-4"
                >
                  <div className="flex items-center gap-2 text-[#5A5A40]">
                    <AlertCircle className="w-5 h-5" />
                    <h3 className="font-bold">分析精度を高めるための補足（任意）</h3>
                  </div>
                  <p className="text-sm text-[#141414]/60">
                    AIが読み取りにくい箇所（売上金額や特定の経費など）があれば、こちらに入力してください。
                  </p>
                  <textarea 
                    value={manualHints}
                    onChange={(e) => setManualHints(e.target.value)}
                    placeholder="例：売上は1,200万円です。地代家賃は240万円です。"
                    className="w-full px-4 py-3 bg-[#F5F5F0] border border-[#141414]/5 rounded-xl focus:ring-2 focus:ring-[#5A5A40] outline-none transition-all h-24 resize-none text-sm"
                  />
                </motion.div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl border border-red-100">
                  <AlertCircle className="w-5 h-5" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              {file && (
                <div className="flex justify-center">
                  <button 
                    onClick={runAnalysis}
                    disabled={isAnalyzing}
                    className="group relative px-12 py-4 bg-[#5A5A40] text-white rounded-full font-bold text-lg overflow-hidden transition-all hover:shadow-xl hover:shadow-[#5A5A40]/20 disabled:opacity-50"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          分析中...
                        </>
                      ) : (
                        <>
                          経営分析を開始する
                          <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </span>
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12">
                {[
                  { icon: BarChart3, title: "収益構造の可視化", desc: "売上・経費・利益のバランスを客観的に評価します。" },
                  { icon: PieChart, title: "経費の最適化", desc: "削減可能なコストを特定し、利益率向上を支援します。" },
                  { icon: Calendar, title: "来期の予算計画", desc: "過去の実績に基づいた現実的な目標設定を行います。" }
                ].map((item, i) => (
                  <div key={i} className="p-6 bg-white rounded-2xl border border-[#141414]/5 space-y-3">
                    <div className="bg-[#F5F5F0] w-10 h-10 rounded-lg flex items-center justify-center text-[#5A5A40]">
                      <item.icon className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold">{item.title}</h3>
                    <p className="text-sm text-[#141414]/60 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 2: Analysis Report */}
          {step === 'analysis' && result && (
            <motion.div
              key="analysis"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#5A5A40]">Step 01</span>
                  <h2 className="text-3xl font-serif italic">経営分析レポート</h2>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => window.print()}
                    className="p-2 bg-white border border-[#141414]/10 rounded-lg hover:bg-[#F5F5F0] transition-colors"
                    title="印刷"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-[#141414]/5 shadow-sm overflow-hidden">
                <div className="p-8 md:p-12 prose prose-slate max-w-none prose-headings:font-serif prose-headings:italic prose-headings:text-[#141414] prose-p:text-[#141414]/80 prose-li:text-[#141414]/80">
                  <Markdown>{result.step1}</Markdown>
                </div>
              </div>

              <div className="bg-[#5A5A40]/5 rounded-3xl p-8 md:p-12 space-y-8 border border-[#5A5A40]/10">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Zap className="w-6 h-6 text-[#5A5A40]" />
                    <h3 className="text-xl font-bold">次は、来期の予算を立てましょう</h3>
                  </div>
                  <p className="text-[#141414]/70">
                    この分析結果をもとに、具体的な売上目標と経費管理の計画を作成します。
                    より精度の高い計画にするため、以下の情報を教えてください（任意）。
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-8">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#141414]/60 uppercase tracking-wider">
                      1. 売上が多い月・少ない月を教えてください
                    </label>
                    <input 
                      type="text" 
                      value={busyMonths}
                      onChange={(e) => setBusyMonths(e.target.value)}
                      placeholder="例：3月と12月が繁忙期、8月が閑散期"
                      className="w-full px-4 py-4 bg-white border border-[#141414]/10 rounded-2xl focus:ring-2 focus:ring-[#5A5A40] focus:border-transparent outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-sm font-bold text-[#141414]/60 uppercase tracking-wider">
                        2. 来期の要望を選択してください（複数選択可）
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {commonRequests.map(req => {
                          const isSelected = selectedRequests.includes(req);
                          return (
                            <button
                              key={req}
                              onClick={() => toggleRequest(req)}
                              className={`
                                flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left text-sm
                                ${isSelected 
                                  ? 'bg-[#5A5A40] border-[#5A5A40] text-white shadow-md' 
                                  : 'bg-white border-[#141414]/10 text-[#141414] hover:border-[#5A5A40]/50'}
                              `}
                            >
                              <div className={`
                                w-5 h-5 rounded-md border flex items-center justify-center transition-colors
                                ${isSelected ? 'bg-white/20 border-white' : 'bg-[#F5F5F0] border-[#141414]/10'}
                              `}>
                                {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                              </div>
                              {req}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-bold text-[#141414]/60 uppercase tracking-wider">
                        3. その他、具体的な要望があれば自由に入力してください
                      </label>
                      <textarea 
                        value={freeTextRequest}
                        onChange={(e) => setFreeTextRequest(e.target.value)}
                        placeholder="例：新規事業の立ち上げに伴う広告費の増額や、特定の経費削減目標など"
                        className="w-full px-4 py-4 bg-white border border-[#141414]/10 rounded-2xl focus:ring-2 focus:ring-[#5A5A40] focus:border-transparent outline-none transition-all h-32 resize-none text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-center pt-4">
                  <button 
                    onClick={runBudgetPlanning}
                    disabled={isAnalyzing}
                    className="group px-10 py-4 bg-[#141414] text-white rounded-full font-bold flex items-center gap-2 hover:bg-[#141414]/90 transition-all"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        計画作成中...
                      </>
                    ) : (
                      <>
                        予算管理計画を作成する
                        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 3: Budget Plan */}
          {step === 'budget' && result?.step2 && (
            <motion.div
              key="budget"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#5A5A40]">Step 02</span>
                  <h2 className="text-3xl font-serif italic">予算管理計画書</h2>
                </div>
                <button 
                  onClick={() => window.print()}
                  className="p-2 bg-white border border-[#141414]/10 rounded-lg hover:bg-[#F5F5F0] transition-colors"
                >
                  <Download className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-white rounded-3xl border border-[#141414]/5 shadow-sm overflow-hidden">
                <div className="p-8 md:p-12 prose prose-slate max-w-none prose-headings:font-serif prose-headings:italic prose-headings:text-[#141414] prose-p:text-[#141414]/80 prose-li:text-[#141414]/80">
                  <Markdown>{result.step2}</Markdown>
                </div>
              </div>

              <div className="bg-[#141414] text-white rounded-3xl p-12 text-center space-y-6">
                <div className="bg-white/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-[#00FF00]" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-serif italic">分析と計画が完了しました</h3>
                  <p className="text-white/60">
                    この計画を保存（印刷またはスクリーンショット）し、<br />
                    毎月の振り返りに活用してください。
                  </p>
                </div>
                <button 
                  onClick={reset}
                  className="px-8 py-3 bg-white text-[#141414] rounded-full font-bold hover:bg-white/90 transition-colors"
                >
                  トップに戻る
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-6 py-12 border-t border-[#141414]/5 text-center">
        <p className="text-sm text-[#141414]/40">
          © 2026 確定申告書 経営分析アドバイザー | Powered by Gemini AI
        </p>
      </footer>

      {/* Global Loading Overlay */}
      <AnimatePresence>
        {isAnalyzing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[100] flex flex-col items-center justify-center gap-6"
          >
            <div className="relative">
              <div className="w-24 h-24 border-4 border-[#5A5A40]/20 rounded-full animate-pulse"></div>
              <Loader2 className="w-12 h-12 text-[#5A5A40] animate-spin absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-xl font-serif italic text-[#141414]">AIが数字を読み解いています...</p>
              <p className="text-sm text-[#141414]/60">これには1分ほどかかる場合があります。</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

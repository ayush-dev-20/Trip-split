import { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTrips } from '@/hooks/useTrips';
import { aiService } from '@/services/aiService';
import ReactMarkdown from 'react-markdown';
import {
  Sparkles, Camera, MessageCircle, MapPinned, Send, Receipt, Brain,
  Loader2, FileText, Printer, CheckCircle2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

export default function AIAssistantPage() {
  const { data: tripsData } = useTrips();
  const trips = tripsData?.trips ?? [];

  const [selectedTrip, setSelectedTrip] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');

  // Trip Planner
  const [plannerForm, setPlannerForm] = useState({ destination: '', days: '7', budget: '1000', currency: 'USD', travelers: '2' });
  const [plannerStreaming, setPlannerStreaming] = useState(false);
  const [plannerText, setPlannerText] = useState('');
  const plannerRef = useRef<HTMLDivElement>(null);

  const downloadPlanAsText = useCallback(() => {
    const blob = new Blob([plannerText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${plannerForm.destination.replace(/\s+/g, '-') || 'trip'}-itinerary.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [plannerText, plannerForm.destination]);

  const downloadPlanAsPdf = useCallback(() => {
    const content = plannerRef.current?.innerHTML ?? '';
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html><head>
<title>${plannerForm.destination || 'Trip'} — Itinerary</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;max-width:800px;margin:40px auto;padding:0 24px;line-height:1.7;color:#111}
  h1{font-size:1.6rem;font-weight:700;margin:0 0 1rem}
  h2{font-size:1.2rem;font-weight:600;margin:2rem 0 0.5rem;border-bottom:1px solid #e5e7eb;padding-bottom:0.4rem}
  h3{font-size:1rem;font-weight:600;margin:1.5rem 0 0.4rem}
  h4{font-size:.95rem;font-weight:600;margin:1.25rem 0 0.3rem}
  ul,ol{padding-left:1.5rem;margin:0 0 1rem}
  li{margin:0.3rem 0}
  p{margin:0 0 0.75rem}
  strong{font-weight:600}
  hr{border:none;border-top:1px solid #e5e7eb;margin:1.5rem 0}
  blockquote{border-left:3px solid #6366f1;padding-left:1rem;color:#555;margin:1rem 0}
  table{width:100%;border-collapse:collapse;margin:1rem 0}
  th{text-align:left;padding:8px 12px;font-weight:600;border-bottom:2px solid #e5e7eb}
  td{padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#444}
  @media print{body{margin:20px}}
</style>
</head><body>
<h1>${plannerForm.destination || 'Trip'} — Travel Itinerary</h1>
${content}
</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }, [plannerRef, plannerForm.destination]);

  const handleGeneratePlan = async () => {
    if (!plannerForm.destination) return;
    setPlannerStreaming(true);
    setPlannerText('');
    try {
      await aiService.tripPlannerStream(
        {
          destination: plannerForm.destination,
          days: Number(plannerForm.days),
          budget: Number(plannerForm.budget),
          currency: plannerForm.currency,
          travelers: Number(plannerForm.travelers),
        },
        (chunk) => setPlannerText((prev) => prev + chunk)
      );
    } catch {
      setPlannerText('Failed to generate itinerary. Please try again.');
    } finally {
      setPlannerStreaming(false);
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatMutation = useMutation({
    mutationFn: (message: string) => aiService.chatbot(selectedTrip, message),
    onSuccess: (reply) => {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatMutation.isPending]);

  const scanMutation = useMutation({
    mutationFn: (file: File) => aiService.scanReceipt(file),
  });

  const handleChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedTrip) return;
    setChatMessages((prev) => [...prev, { role: 'user', content: chatInput }]);
    chatMutation.mutate(chatInput);
    setChatInput('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gradient-to-br from-primary/15 to-info/15 text-primary shrink-0">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-[1.75rem] font-bold tracking-tight">AI Assistant</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Smart help for managing trip expenses
          </p>
        </div>
      </div>

      <Tabs defaultValue="chat">
        <TabsList className="w-full">
          <TabsTrigger value="chat" className="flex-1">
            <MessageCircle className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">AI Chat</span>
          </TabsTrigger>
          <TabsTrigger value="scan" className="flex-1">
            <Camera className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Receipt Scanner</span>
          </TabsTrigger>
          <TabsTrigger value="planner" className="flex-1">
            <MapPinned className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Trip Planner</span>
          </TabsTrigger>
        </TabsList>

        {/* AI Chatbot */}
        <TabsContent value="chat">
          <Card className="flex flex-col h-[60vh] sm:h-[500px]">
            {/* Trip selector */}
            <div className="p-4 border-b">
              <Select value={selectedTrip} onValueChange={setSelectedTrip}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a trip for context" />
                </SelectTrigger>
                <SelectContent>
                  {trips.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Brain className="h-12 w-12 mb-3" />
                  <p className="text-sm">Ask me anything about your trip expenses!</p>
                  <p className="text-xs mt-1">"How much did we spend on food?" · "Who owes the most?"</p>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'user' ? (
                    <div className="max-w-[80%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm bg-primary text-primary-foreground">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-3 text-sm bg-muted">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                          em: ({ children }) => <em className="italic">{children}</em>,
                          ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2 first:mt-0 last:mb-0">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2 first:mt-0 last:mb-0">{children}</ol>,
                          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                          h1: ({ children }) => <h1 className="text-base font-bold mb-1">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-sm font-bold mb-1">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-sm font-semibold mb-1">{children}</h3>,
                          code: ({ children }) => (
                            <code className="bg-background/50 rounded px-1.5 py-0.5 text-xs font-mono">{children}</code>
                          ),
                          hr: () => <hr className="my-2 border-border" />,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </motion.div>
              ))}
              {chatMutation.isPending && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2.5 text-sm text-muted-foreground flex items-center gap-2">
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                    Thinking...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleChat} className="p-4 border-t flex gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={selectedTrip ? 'Ask about your expenses...' : 'Select a trip first'}
                disabled={!selectedTrip}
                className="flex-1"
              />
              <Button type="submit" disabled={chatMutation.isPending || !selectedTrip || !chatInput.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </Card>
        </TabsContent>

        {/* Receipt Scanner */}
        <TabsContent value="scan">
          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="text-center">
                <div className="border-2 border-dashed border-border rounded-2xl p-12">
                  <Camera className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground mb-3">Upload a receipt image to auto-extract expense data</p>
                  <Button asChild className="cursor-pointer">
                    <label>
                      <Receipt className="h-4 w-4 mr-2" /> Upload Receipt
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && scanMutation.mutate(e.target.files[0])}
                      />
                    </label>
                  </Button>
                </div>
              </div>

              {scanMutation.isPending && (
                <div className="text-center py-4">
                  <div className="animate-pulse text-sm text-muted-foreground">Analyzing receipt...</div>
                </div>
              )}

              {scanMutation.data && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-green-50 dark:bg-green-900/20 rounded-xl p-5 space-y-3">
                  <h3 className="font-semibold text-green-700 dark:text-green-400">Receipt Data Extracted</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Title:</span> <strong>{scanMutation.data.title}</strong></div>
                    <div><span className="text-muted-foreground">Amount:</span> <strong>{scanMutation.data.currency} {scanMutation.data.amount}</strong></div>
                    <div><span className="text-muted-foreground">Category:</span> <strong>{scanMutation.data.category}</strong></div>
                    <div><span className="text-muted-foreground">Date:</span> <strong>{scanMutation.data.date}</strong></div>
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trip Planner */}
        <TabsContent value="planner">
          <Card>
            <CardContent className="p-6 space-y-5">
              <p className="text-sm text-muted-foreground">
                Get a detailed day-by-day itinerary powered by AI
              </p>

              {/* Form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Destination *</Label>
                  <Input
                    value={plannerForm.destination}
                    onChange={(e) => setPlannerForm((p) => ({ ...p, destination: e.target.value }))}
                    placeholder="e.g. Tokyo, Japan"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Days</Label>
                  <Input type="number" value={plannerForm.days} onChange={(e) => setPlannerForm((p) => ({ ...p, days: e.target.value }))} min="1" className="mt-1.5" />
                </div>
                <div>
                  <Label>Budget</Label>
                  <Input type="number" value={plannerForm.budget} onChange={(e) => setPlannerForm((p) => ({ ...p, budget: e.target.value }))} min="0" className="mt-1.5" />
                </div>
                <div>
                  <Label>Currency</Label>
                  <Select value={plannerForm.currency} onValueChange={(v) => setPlannerForm((p) => ({ ...p, currency: v }))}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD', 'AED', 'THB', 'MYR', 'IDR', 'PHP', 'VND', 'KRW', 'CHF', 'SEK', 'NZD', 'ZAR', 'BRL', 'MXN'].map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Travelers</Label>
                  <Input type="number" value={plannerForm.travelers} onChange={(e) => setPlannerForm((p) => ({ ...p, travelers: e.target.value }))} min="1" className="mt-1.5" />
                </div>
              </div>

              <Button
                onClick={handleGeneratePlan}
                disabled={plannerStreaming || !plannerForm.destination}
                className="w-full"
              >
                {plannerStreaming
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating Itinerary…</>
                  : <><Sparkles className="h-4 w-4" /> Generate Trip Itinerary</>
                }
              </Button>

              {/* Loading banner — before first token arrives */}
              {plannerStreaming && !plannerText && (
                <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Creating your itinerary</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Analysing destination, budget &amp; travel preferences…</p>
                  </div>
                </div>
              )}

              {/* Itinerary output */}
              {plannerText && (
                <div className="space-y-3">

                  {/* Streaming status banner */}
                  {plannerStreaming ? (
                    <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-2.5 text-sm">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                      <span className="text-muted-foreground">Writing itinerary…</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        <span>Itinerary ready</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={downloadPlanAsText}>
                          <FileText className="h-3.5 w-3.5" /> Text
                        </Button>
                        <Button variant="outline" size="sm" onClick={downloadPlanAsPdf}>
                          <Printer className="h-3.5 w-3.5" /> PDF
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Content card */}
                  <Card>
                    <CardContent className="p-6">
                      <div ref={plannerRef}>
                        <ReactMarkdown
                          components={{
                            h1: ({ children }) => <h1 className="text-xl font-bold mt-1 mb-3 text-foreground leading-snug">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-base font-semibold mt-5 mb-2 pb-1 border-b border-border text-foreground">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-sm font-semibold mt-4 mb-1.5 text-foreground">{children}</h3>,
                            h4: ({ children }) => <h4 className="text-sm font-medium mt-3 mb-1 text-foreground">{children}</h4>,
                            p: ({ children }) => <p className="text-sm leading-relaxed mb-2.5 text-foreground/90">{children}</p>,
                            strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                            em: ({ children }) => <em className="italic text-foreground/80">{children}</em>,
                            ul: ({ children }) => <ul className="text-sm mb-3 ml-4 space-y-1 list-disc">{children}</ul>,
                            ol: ({ children }) => <ol className="text-sm mb-3 ml-4 space-y-1 list-decimal">{children}</ol>,
                            li: ({ children }) => <li className="leading-relaxed text-foreground/90">{children}</li>,
                            hr: () => <hr className="my-4 border-border" />,
                            code: ({ children }) => <code className="bg-muted rounded px-1.5 py-0.5 text-xs font-mono">{children}</code>,
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-2 border-primary/50 pl-3 italic text-muted-foreground my-3">{children}</blockquote>
                            ),
                            table: ({ children }) => (
                              <div className="overflow-x-auto my-3">
                                <table className="w-full text-sm border-collapse">{children}</table>
                              </div>
                            ),
                            thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
                            th: ({ children }) => <th className="text-left px-3 py-2 font-semibold text-foreground border-b border-border">{children}</th>,
                            td: ({ children }) => <td className="px-3 py-2 border-b border-border text-foreground/80">{children}</td>,
                          }}
                        >
                          {plannerText}
                        </ReactMarkdown>
                      </div>
                      {/* Streaming cursor */}
                      {plannerStreaming && (
                        <span className="inline-block w-2 h-4 bg-primary/70 animate-pulse rounded-sm ml-0.5 align-middle" />
                      )}
                    </CardContent>
                  </Card>

                  {/* Download row below content — repeated for easy access after scrolling */}
                  {!plannerStreaming && (
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={downloadPlanAsPdf}>
                        <Printer className="h-3.5 w-3.5" /> Download PDF
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

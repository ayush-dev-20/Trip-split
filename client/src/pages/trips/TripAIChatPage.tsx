import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useParams, Link } from 'react-router';
import { aiService } from '@/services/aiService';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, MessageCircle, Send, Brain } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

export default function TripAIChatPage() {
  const { tripId } = useParams<{ tripId: string }>();

  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatMutation = useMutation({
    mutationFn: (message: string) => aiService.chatbot(tripId!, message),
    onSuccess: (reply) => {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatMutation.isPending]);

  const handleChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setChatMessages((prev) => [...prev, { role: 'user', content: chatInput }]);
    chatMutation.mutate(chatInput);
    setChatInput('');
  };

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" className="h-8 px-2 -ml-1 text-muted-foreground hover:text-foreground" asChild>
          <Link to={`/trips/${tripId}`}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Trip
          </Link>
        </Button>
        <div className="flex items-start gap-3 mt-2">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gradient-to-br from-primary/15 to-info/15 text-primary shrink-0">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-[1.75rem] font-bold tracking-tight">AI Chat</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Ask about this trip's expenses
            </p>
          </div>
        </div>
      </div>

      <Card className="flex flex-col h-[60vh] sm:h-[500px]">
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
            placeholder="Ask about your expenses..."
            className="flex-1"
          />
          <Button type="submit" disabled={chatMutation.isPending || !chatInput.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </Card>
    </div>
  );
}

import { useState } from 'react';
import { useCompleteOnboarding } from '@/hooks/useAuth';
import { Plane, DollarSign, Users, Sparkles, ArrowRight, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'AUD', 'CAD', 'CHF', 'SGD', 'THB'];

const steps = [
  { title: 'Welcome!', description: 'Let\'s set up your account in 3 quick steps.' },
  { title: 'Default Currency', description: 'Choose your primary currency for expense tracking.' },
  { title: 'You\'re All Set!', description: 'Start creating trips and splitting expenses.' },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [currency, setCurrency] = useState('USD');
  const completeOnboarding = useCompleteOnboarding();

  const handleFinish = () => {
    completeOnboarding.mutate();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <Progress value={((step + 1) / steps.length) * 100} className="mb-8 h-1.5" />

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <Card>
              <CardContent className="p-8">
                {step === 0 && (
                  <div className="text-center space-y-6">
                    <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 text-primary mx-auto">
                      <Plane className="h-8 w-8" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">{steps[0].title}</h2>
                      <p className="text-muted-foreground mt-2">{steps[0].description}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4">
                      {[
                        { icon: DollarSign, label: 'Track Expenses', desc: 'Multi-currency' },
                        { icon: Users, label: 'Split Bills', desc: '4 split types' },
                        { icon: Sparkles, label: 'AI Insights', desc: 'Smart analysis' },
                      ].map(({ icon: Icon, label, desc }) => (
                        <div key={label} className="text-center p-3 rounded-xl bg-muted">
                          <Icon className="h-6 w-6 text-primary mx-auto mb-2" />
                          <p className="text-xs font-medium">{label}</p>
                          <p className="text-xs text-muted-foreground">{desc}</p>
                        </div>
                      ))}
                    </div>

                    <Button onClick={() => setStep(1)} className="w-full">
                      Get Started <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <h2 className="text-2xl font-bold">{steps[1].title}</h2>
                      <p className="text-muted-foreground mt-2">{steps[1].description}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {CURRENCIES.map((c) => (
                        <Button
                          key={c}
                          variant="outline"
                          onClick={() => setCurrency(c)}
                          className={cn(
                            'justify-center gap-2',
                            currency === c && 'border-primary bg-primary/10 text-primary'
                          )}
                        >
                          {currency === c && <Check className="h-4 w-4" />}
                          {c}
                        </Button>
                      ))}
                    </div>

                    <Button onClick={() => setStep(2)} className="w-full">
                      Continue <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                )}

                {step === 2 && (
                  <div className="text-center space-y-6">
                    <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-green-100 dark:bg-green-900/30 text-green-600 mx-auto">
                      <Check className="h-8 w-8" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">{steps[2].title}</h2>
                      <p className="text-muted-foreground mt-2">{steps[2].description}</p>
                    </div>

                    <Button
                      onClick={handleFinish}
                      disabled={completeOnboarding.isPending}
                      className="w-full"
                    >
                      {completeOnboarding.isPending ? 'Setting up...' : 'Go to Dashboard'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

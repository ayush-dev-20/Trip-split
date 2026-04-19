import { useState } from 'react';
import { Link } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { useRegister } from '@/hooks/useAuth';
import { Eye, EyeOff, Mail, Lock, User, Check, X, ArrowRight, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useThemeStore } from '@/stores/themeStore';
import logoDark from '@/assets/logo/tripsplit-dark-64.svg';
import logoLight from '@/assets/logo/tripsplit-light-96.svg';

const passwordRules = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter (A–Z)', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter (a–z)', test: (p: string) => /[a-z]/.test(p) },
  { label: 'One number (0–9)', test: (p: string) => /[0-9]/.test(p) },
];

function getStrength(password: string) {
  const passed = passwordRules.filter((r) => r.test(password)).length;
  if (passed === 0) return { score: 0, label: '', color: '' };
  if (passed === 1) return { score: 1, label: 'Weak', color: 'bg-destructive' };
  if (passed === 2) return { score: 2, label: 'Fair', color: 'bg-orange-500' };
  if (passed === 3) return { score: 3, label: 'Good', color: 'bg-yellow-500' };
  return { score: 4, label: 'Strong', color: 'bg-green-500' };
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 28 } },
};

export default function RegisterPage() {
  const register = useRegister();
  const { resolvedTheme } = useThemeStore();
  const isDark = resolvedTheme() === 'dark';
  const iconSrc = isDark ? logoDark : logoLight;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [validationError, setValidationError] = useState('');

  const allRulesPassed = passwordRules.every((r) => r.test(password));
  const strength = getStrength(password);
  const passwordsMatch = confirmPassword === password;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!allRulesPassed) {
      setPasswordTouched(true);
      setValidationError('Password does not meet all requirements.');
      return;
    }
    if (!passwordsMatch) {
      setValidationError('Passwords do not match.');
      return;
    }

    register.mutate({ name, email, password });
  };

  return (
    <motion.div
      className="space-y-7"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* Mobile logo */}
      <motion.div variants={itemVariants} className="flex items-center gap-2.5 lg:hidden">
        <img src={iconSrc} alt="TripSplit" className="h-9 w-9" />
        <span className="text-xl font-bold tracking-tight">TripSplit</span>
      </motion.div>

      {/* Header */}
      <motion.div variants={itemVariants} className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground">Start tracking and splitting trip expenses with your group</p>
      </motion.div>

      {/* Error alert */}
      <AnimatePresence>
        {(register.isError || validationError) && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          >
            <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
              <X className="h-4 w-4" />
              <AlertDescription>
                {validationError || (register.error as Error)?.message || 'Registration failed'}
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Full Name */}
        <motion.div variants={itemVariants} className="space-y-1.5">
          <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
          <div className="relative group">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="pl-10 h-11 transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30"
              placeholder="John Doe"
              required
            />
          </div>
        </motion.div>

        {/* Email */}
        <motion.div variants={itemVariants} className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium">Email</Label>
          <div className="relative group">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-11 transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30"
              placeholder="you@example.com"
              required
            />
          </div>
        </motion.div>

        {/* Password */}
        <motion.div variants={itemVariants} className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-medium">Password</Label>
          <div className="relative group">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPasswordTouched(true); }}
              className="pl-10 pr-11 h-11 transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30"
              placeholder="Min. 8 characters"
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>

          {/* Strength bar */}
          <AnimatePresence>
            {passwordTouched && password.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <div className="flex gap-1 flex-1">
                    {[1, 2, 3, 4].map((i) => (
                      <motion.div
                        key={i}
                        className={cn(
                          'h-1 flex-1 rounded-full transition-colors duration-300',
                          i <= strength.score ? strength.color : 'bg-muted'
                        )}
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ delay: i * 0.05 }}
                      />
                    ))}
                  </div>
                  <span className={cn(
                    'text-xs font-medium ml-3 min-w-[40px] text-right transition-colors',
                    strength.score === 4 ? 'text-green-500' :
                    strength.score === 3 ? 'text-yellow-500' :
                    strength.score === 2 ? 'text-orange-500' : 'text-destructive'
                  )}>
                    {strength.label}
                  </span>
                </div>

                <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {passwordRules.map((rule) => {
                    const passed = rule.test(password);
                    return (
                      <li key={rule.label} className={cn(
                        'flex items-center gap-1.5 text-xs transition-colors',
                        passed ? 'text-green-600 dark:text-green-500' : 'text-muted-foreground'
                      )}>
                        <div className={cn(
                          'h-3.5 w-3.5 rounded-full flex items-center justify-center shrink-0 transition-colors',
                          passed ? 'bg-green-500/15' : 'bg-muted'
                        )}>
                          {passed
                            ? <Check className="h-2.5 w-2.5 text-green-600 dark:text-green-500" />
                            : <X className="h-2.5 w-2.5 text-muted-foreground" />}
                        </div>
                        {rule.label}
                      </li>
                    );
                  })}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>

          {!passwordTouched && (
            <p className="text-xs text-muted-foreground">
              Must be 8+ characters with uppercase, lowercase, and a number.
            </p>
          )}
        </motion.div>

        {/* Confirm Password */}
        <motion.div variants={itemVariants} className="space-y-1.5">
          <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</Label>
          <div className="relative group">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setConfirmTouched(true); }}
              className={cn(
                'pl-10 pr-11 h-11 transition-shadow focus-visible:ring-2 focus-visible:ring-primary/30',
                confirmTouched && confirmPassword.length > 0 && (
                  passwordsMatch ? 'border-green-500 focus-visible:ring-green-500/30' : 'border-destructive focus-visible:ring-destructive/30'
                )
              )}
              placeholder="Re-enter password"
              required
            />
            <AnimatePresence>
              {confirmTouched && confirmPassword.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {passwordsMatch
                    ? <Check className="h-4 w-4 text-green-500" />
                    : <X className="h-4 w-4 text-destructive" />}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <AnimatePresence>
            {confirmTouched && confirmPassword.length > 0 && !passwordsMatch && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="text-xs text-destructive"
              >
                Passwords do not match
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Submit */}
        <motion.div variants={itemVariants} className="pt-1">
          <Button
            type="submit"
            disabled={register.isPending}
            className="w-full h-11 font-medium gap-2 group"
          >
            {register.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              <>
                Create Account
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </Button>
        </motion.div>
      </form>

      <motion.p variants={itemVariants} className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-primary hover:underline underline-offset-4">
          Sign in
        </Link>
      </motion.p>
    </motion.div>
  );
}

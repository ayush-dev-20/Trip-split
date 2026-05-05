import { SignUp } from '@clerk/clerk-react';
import { useThemeStore } from '@/stores/themeStore';
import logoDark from '@/assets/logo/tripsplit-dark-64.svg';
import logoLight from '@/assets/logo/tripsplit-light-96.svg';

const DARK_VARS = {
  colorBackground: 'hsl(222.2, 84%, 4.9%)',
  colorInputBackground: 'hsl(217.2, 32.6%, 17.5%)',
  colorText: 'hsl(210, 40%, 98%)',
  colorTextSecondary: 'hsl(215, 20.2%, 65.1%)',
  colorInputText: 'hsl(210, 40%, 98%)',
  colorPrimary: 'hsl(217.2, 91.2%, 59.8%)',
  colorDanger: 'hsl(0, 72%, 51%)',
  colorNeutral: 'hsl(215, 20.2%, 65.1%)',
  borderRadius: '0.625rem',
  fontFamily: 'inherit',
} as const;

const LIGHT_VARS = {
  colorBackground: 'hsl(0, 0%, 98%)',
  colorInputBackground: 'hsl(0, 0%, 100%)',
  colorText: 'hsl(222.2, 84%, 4.9%)',
  colorTextSecondary: 'hsl(215.4, 16.3%, 46.9%)',
  colorInputText: 'hsl(222.2, 84%, 4.9%)',
  colorPrimary: 'hsl(221.2, 83.2%, 53.3%)',
  colorDanger: 'hsl(0, 84.2%, 60.2%)',
  colorNeutral: 'hsl(215.4, 16.3%, 46.9%)',
  borderRadius: '0.625rem',
  fontFamily: 'inherit',
} as const;

const SHARED_ELEMENTS = {
  rootBox: 'w-full',
  card: '!shadow-none !border-0 !bg-transparent !p-0 w-full',
  cardBox: '!shadow-none !border-0 !bg-transparent w-full',
  headerTitle: 'hidden',
  headerSubtitle: 'hidden',
  footer: '!bg-transparent !border-0',
  footerPages: '!bg-transparent',
  footerPagesLink: '!text-primary hover:underline text-sm font-medium',
  socialButtonsBlockButton:
    'border border-border bg-background hover:bg-muted text-foreground !rounded-md h-10 transition-colors',
  socialButtonsBlockButtonText: 'font-medium text-sm',
  socialButtonsBlockButtonArrow: 'hidden',
  dividerRow: 'my-4',
  dividerText: 'text-muted-foreground text-xs',
  dividerLine: 'bg-border',
  formFieldLabel: 'text-sm font-medium text-foreground',
  formFieldInput:
    'border border-input bg-background text-foreground !rounded-md h-10 px-3 text-sm ' +
    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring',
  formFieldInputShowPasswordButton: 'text-muted-foreground',
  formButtonPrimary:
    'bg-primary text-primary-foreground hover:bg-primary/90 !rounded-md h-10 text-sm font-medium w-full',
  identityPreviewText: 'text-foreground text-sm',
  identityPreviewEditButton: 'text-primary text-sm',
  alertText: 'text-destructive text-sm',
  formFieldErrorText: 'text-destructive text-xs',
  phoneInputBox: 'border border-input !rounded-md overflow-hidden',
} as const;

export default function RegisterPage() {
  const { resolvedTheme } = useThemeStore();
  const isDark = resolvedTheme() === 'dark';
  const iconSrc = isDark ? logoDark : logoLight;

  return (
    <div className="space-y-8">
      {/* Mobile logo */}
      <div className="flex items-center gap-2.5 lg:hidden">
        <img src={iconSrc} alt="TripSplit" className="h-9 w-9" />
        <span className="text-xl font-bold tracking-tight">TripSplit</span>
      </div>

      <div className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-bold">Create your account</h1>
        <p className="text-sm text-muted-foreground">
          Start splitting expenses with your travel crew
        </p>
      </div>

      <SignUp
        routing="hash"
        signInUrl="/login"
        forceRedirectUrl="/onboarding"
        appearance={{
          variables: isDark ? DARK_VARS : LIGHT_VARS,
          elements: SHARED_ELEMENTS,
        }}
      />
    </div>
  );
}

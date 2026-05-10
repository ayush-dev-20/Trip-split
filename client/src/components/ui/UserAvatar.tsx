import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/format';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  name?: string | null;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap: Record<NonNullable<UserAvatarProps['size']>, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-11 w-11 text-base',
};

/** Generates a deterministic background color from a name string. */
function bgFromName(name?: string | null): string {
  if (!name) return 'bg-muted text-muted-foreground';
  const hash = Array.from(name).reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const palettes = [
    'bg-primary/15 text-primary',
    'bg-info/15 text-info',
    'bg-success/15 text-success',
    'bg-warning/15 text-warning',
    'bg-chart-2/20 text-chart-2',
    'bg-chart-5/20 text-chart-5',
  ];
  return palettes[hash % palettes.length];
}

export default function UserAvatar({ name, src, size = 'md', className }: UserAvatarProps) {
  return (
    <Avatar className={cn(sizeMap[size], className)}>
      {src && <AvatarImage src={src} alt={name ?? ''} />}
      <AvatarFallback className={cn('font-semibold', bgFromName(name))}>
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

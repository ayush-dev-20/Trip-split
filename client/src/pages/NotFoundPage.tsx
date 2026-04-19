import { Link } from 'react-router';
import { Home, MapPinOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center">
        <div className="flex items-center justify-center h-20 w-20 rounded-2xl bg-muted text-muted-foreground mx-auto mb-6">
          <MapPinOff className="h-10 w-10" />
        </div>
        <h1 className="text-6xl font-bold">404</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Looks like this page went on a trip and never came back.
        </p>
        <Button asChild className="mt-6">
          <Link to="/dashboard"><Home className="h-4 w-4 mr-2" /> Back to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

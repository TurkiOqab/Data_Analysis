import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function App() {
  return (
    <div className="min-h-screen bg-bg p-8">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>shadcn check</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-ink-soft text-sm">If this card has the right border and the button is light blue, primitives are wired correctly.</p>
          <Button>Looks right</Button>
        </CardContent>
      </Card>
    </div>
  );
}

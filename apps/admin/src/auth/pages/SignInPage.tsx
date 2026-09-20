import { SignInButton } from '@clerk/react';
import { Button } from '@/core/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/core/ui/card';

export const SignInPage = () => (
  <main className="mx-auto mt-16 max-w-md px-5">
    <Card>
      <CardHeader>
        <CardTitle>Admin sign in</CardTitle>
        <CardDescription>
          Sign in with a Clerk user that has{' '}
          <code className="rounded-md bg-muted px-1 py-0.5 font-mono text-[0.8em]">
            {`{ "role": "admin" }`}
          </code>{' '}
          in public metadata.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignInButton mode="modal">
          <Button type="button">Sign in</Button>
        </SignInButton>
      </CardContent>
    </Card>
  </main>
);

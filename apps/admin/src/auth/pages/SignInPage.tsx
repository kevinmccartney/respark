import { SignInButton } from '@clerk/react';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@respark/ui/lib';

export const SignInPage = () => (
  <main className="mx-auto mt-16 max-w-md px-5">
    <Card>
      <CardHeader>
        <CardTitle>Admin sign in</CardTitle>
        <CardDescription>You know if you're supposed to be here.</CardDescription>
      </CardHeader>
      <CardContent>
        <SignInButton mode="modal">
          <Button type="button">Sign in</Button>
        </SignInButton>
      </CardContent>
    </Card>
  </main>
);

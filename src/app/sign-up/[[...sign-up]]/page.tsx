import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <SignUp
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "bg-zinc-900 border border-white/10 shadow-lg",
              headerTitle: "text-white",
              headerSubtitle: "text-white/70",
              socialButtonsBlockButton:
                "bg-zinc-800 border-white/10 text-white hover:bg-zinc-700",
              formButtonPrimary:
                "bg-white text-zinc-950 hover:bg-white/90",
              formFieldLabel: "text-white/80",
              formFieldInput:
                "bg-zinc-800 border-white/10 text-white focus:border-white/30",
              footerActionLink: "text-white hover:text-white/80",
              identityPreviewText: "text-white",
              identityPreviewEditButton: "text-white/70 hover:text-white",
            },
          }}
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          afterSignUpUrl="/onboarding"
        />
      </div>
    </main>
  );
}

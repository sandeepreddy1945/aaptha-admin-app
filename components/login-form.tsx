"use client"

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from "firebase/auth"
import { useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/components/auth-provider"
import { useRemoteConfig } from "@/components/remote-config-provider"
import { getFirebaseAuth } from "@/lib/firebase"

function getErrorMessage(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : ""

  if (
    code === "auth/invalid-credential" ||
    code === "auth/invalid-login-credentials" ||
    code === "auth/user-not-found" ||
    code === "auth/wrong-password"
  ) {
    return "The email or password is incorrect."
  }

  if (code === "auth/too-many-requests") {
    return "Too many attempts. Please wait and try again."
  }

  if (code === "auth/popup-closed-by-user") {
    return "Google sign-in was cancelled."
  }

  return error instanceof Error
    ? error.message
    : "Sign-in failed. Please try again."
}

export function LoginForm(props: React.ComponentProps<"div">) {
  const { authError } = useAuth()
  const { organizationFullName, organizationDescription } = useRemoteConfig()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [isRegistering, setIsRegistering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleEmailLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setError(null)
    setNotice(null)

    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email, password)
    } catch (signInError) {
      setError(getErrorMessage(signInError))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleEmailRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setError(null)
    setNotice(null)

    try {
      const credential = await createUserWithEmailAndPassword(
        getFirebaseAuth(),
        email,
        password,
      )
      await updateProfile(credential.user, { displayName: displayName.trim() })
      const idToken = await credential.user.getIdToken(true)
      const sessionResponse = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      })
      if (!sessionResponse.ok) {
        throw new Error("Unable to establish a secure session for this request.")
      }

      const requestResponse = await fetch("/api/auth/registration-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ensure" }),
      })
      if (!requestResponse.ok) {
        throw new Error("Unable to submit your access request.")
      }
      setNotice("Your access request was sent for administrator approval.")
    } catch (registrationError) {
      setError(getErrorMessage(registrationError))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleGoogleLogin() {
    setIsLoading(true)
    setError(null)
    setNotice(null)

    try {
      await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider())
    } catch (signInError) {
      setError(getErrorMessage(signInError))
    } finally {
      setIsLoading(false)
    }
  }

  async function handlePasswordReset() {
    setError(null)
    setNotice(null)

    if (!email.trim()) {
      setError("Enter your email address first to reset your password.")
      return
    }

    try {
      await sendPasswordResetEmail(getFirebaseAuth(), email.trim())
      setNotice("If an account exists for this email, a reset link was sent.")
    } catch (resetError) {
      setError(getErrorMessage(resetError))
    }
  }

  return (
    <div className="flex flex-col gap-6" {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form
            className="p-6 md:p-8"
            onSubmit={isRegistering ? handleEmailRegistration : handleEmailLogin}
          >
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">
                  {isRegistering ? "Request access" : "Welcome back"}
                </h1>
                <p className="text-balance text-muted-foreground">
                  {isRegistering
                    ? `Create an account for ${organizationFullName}`
                    : "Sign in to your account"}
                </p>
                {organizationDescription && (
                  <p className="text-balance text-sm text-muted-foreground">
                    {organizationDescription}
                  </p>
                )}
              </div>
              {isRegistering && (
                <Field>
                  <FieldLabel htmlFor="display-name">Full name</FieldLabel>
                  <Input
                    autoComplete="name"
                    id="display-name"
                    onChange={(event) => setDisplayName(event.target.value)}
                    required
                    value={displayName}
                  />
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  autoComplete="email"
                  id="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="m@example.com"
                  required
                  type="email"
                  value={email}
                />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <button
                    className="ml-auto text-sm underline-offset-2 hover:underline"
                    onClick={handlePasswordReset}
                    type="button"
                  >
                    Forgot your password?
                  </button>
                </div>
                <Input
                  autoComplete={isRegistering ? "new-password" : "current-password"}
                  id="password"
                  minLength={isRegistering ? 6 : undefined}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </Field>
              {(authError || error) && (
                <p className="text-sm text-destructive" role="alert">
                  {error ?? authError}
                </p>
              )}
              {notice && (
                <p className="text-sm text-muted-foreground" role="status">
                  {notice}
                </p>
              )}
              <Field>
                <Button disabled={isLoading} type="submit">
                  {isLoading
                    ? isRegistering
                      ? "Creating account…"
                      : "Signing in…"
                    : isRegistering
                      ? "Create account and request access"
                      : "Login"}
                </Button>
              </Field>
              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                Or continue with
              </FieldSeparator>
              <Field className="grid grid-cols-2 gap-4">
                <Button
                  aria-label="Login with Google"
                  disabled={isLoading}
                  onClick={handleGoogleLogin}
                  type="button"
                  variant="outline"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <path
                      d="M21.35 12.23c0-.71-.06-1.39-.18-2.05H12v3.87h5.24a4.48 4.48 0 0 1-1.94 2.94v2.51h3.14c1.84-1.69 2.91-4.18 2.91-7.27Z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 21.6c2.63 0 4.84-.87 6.45-2.36l-3.14-2.51c-.87.58-1.98.93-3.31.93-2.54 0-4.69-1.71-5.46-4.01H3.3v2.59A9.75 9.75 0 0 0 12 21.6Z"
                      fill="#34A853"
                    />
                    <path
                      d="M6.54 13.65a5.86 5.86 0 0 1 0-3.3V7.76H3.3a9.74 9.74 0 0 0 0 8.48l3.24-2.59Z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 6.34c1.43 0 2.71.49 3.72 1.46l2.79-2.79A9.34 9.34 0 0 0 12 1.6a9.75 9.75 0 0 0-8.7 5.37l3.24 2.59c.77-2.3 2.92-3.22 5.46-3.22Z"
                      fill="#EA4335"
                    />
                  </svg>
                  Google
                </Button>
                <Button disabled type="button" variant="outline">
                  <span aria-hidden="true" className="font-semibold">
                    f
                  </span>
                  Facebook (coming soon)
                </Button>
              </Field>
              <FieldDescription className="text-center">
                {isRegistering ? "Already have an account?" : "Need an account?"}{" "}
                <button
                  className="underline underline-offset-4 hover:text-foreground"
                  onClick={() => {
                    setIsRegistering((current) => !current)
                    setError(null)
                    setNotice(null)
                  }}
                  type="button"
                >
                  {isRegistering ? "Sign in" : "Create one to request access"}
                </button>
              </FieldDescription>
            </FieldGroup>
          </form>
          <div className="relative hidden bg-muted md:block">
            <img
              src="/placeholder.svg"
              alt=""
              className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
            />
          </div>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  )
}

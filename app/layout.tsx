import { Geist_Mono, Inter } from "next/font/google"

import "./globals.css"
import { FirebaseUIRootProvider } from "@/components/firebase-ui-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/components/auth-provider"
import { RemoteConfigProvider } from "@/components/remote-config-provider"
import { ChatbotLauncher } from "@/features/chatbot/components/chatbot-launcher"
import { cn } from "@/lib/utils"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        inter.variable
      )}
    >
      <body>
        <ThemeProvider>
          <RemoteConfigProvider>
            <AuthProvider>
              <FirebaseUIRootProvider>
                {children}
                <ChatbotLauncher />
              </FirebaseUIRootProvider>
            </AuthProvider>
          </RemoteConfigProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

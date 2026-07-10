"use client"

import { useTranslations } from "next-intl"
import { Github } from "lucide-react"
import { Button } from "@/components/ui/Button"

function getGitHubAuthUrl(): string {
  const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || ""
  const redirectUri = process.env.NEXT_PUBLIC_GITHUB_REDIRECT_URI || ""
  return `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`
}

export function GitHubLoginButton() {
  const t = useTranslations("auth")
  const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID

  if (!clientId) return null

  const handleClick = () => {
    window.location.href = getGitHubAuthUrl()
  }

  return (
    <Button variant="secondary" className="w-full gap-2" onClick={handleClick}>
      <Github className="size-4" />
      {t("githubLogin")}
    </Button>
  )
}

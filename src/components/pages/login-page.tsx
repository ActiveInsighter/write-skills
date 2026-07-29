import { type FormEvent, useState } from "react"
import {
  ArrowRight,
  Cloud,
  FileText,
  LoaderCircle,
  LockKeyhole,
  Sparkles,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { useEditorStore } from "@/stores/editor-store"

export function LoginPage() {
  const login = useEditorStore((state) => state.login)
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!password || submitting) return

    setError("")
    setSubmitting(true)
    try {
      await login(password)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登录失败，请重试。")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-shell">
      <section className="login-story" aria-labelledby="login-product-title">
        <div className="login-brand">
          <span className="login-brand__mark" aria-hidden="true">
            <FileText />
          </span>
          <span>Write Skills</span>
        </div>

        <div className="login-story__content">
          <div className="login-eyebrow">
            <Sparkles aria-hidden="true" />
            Focused editorial workspace
          </div>
          <h1 id="login-product-title">
            把想法留在画布上，
            <br />
            把复杂度留在系统里。
          </h1>
          <p>
            一套克制、快速的网页写作工作台。富文本、版本快照与自动保存围绕同一篇文档自然协作。
          </p>

          <ul className="login-features" aria-label="产品能力">
            <li>
              <Cloud />
              <span>
                <strong>Cloudflare D1 自动保存</strong>
                <small>带修订冲突保护，不静默覆盖远端内容</small>
              </span>
            </li>
            <li>
              <LockKeyhole />
              <span>
                <strong>轻量私有访问</strong>
                <small>可选部署密码与 HttpOnly 会话 Cookie</small>
              </span>
            </li>
          </ul>
        </div>

        <p className="login-story__foot">Vite · React · Tiptap · Cloudflare</p>
      </section>

      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-card">
          <div className="login-card__icon" aria-hidden="true">
            <LockKeyhole />
          </div>
          <div>
            <p className="login-card__kicker">Private workspace</p>
            <h2 id="login-title">欢迎回来</h2>
            <p className="login-card__description">
              输入部署时设置的访问密码，继续进入你的写作空间。
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <FieldGroup>
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="access-password">访问密码</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <LockKeyhole />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="access-password"
                    type="password"
                    autoComplete="current-password"
                    autoFocus
                    value={password}
                    aria-invalid={Boolean(error)}
                    placeholder="请输入访问密码"
                    onChange={(event) => {
                      setPassword(event.target.value)
                      if (error) setError("")
                    }}
                  />
                </InputGroup>
              </Field>
            </FieldGroup>

            {error && (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={!password || submitting}
            >
              {submitting ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <ArrowRight />
              )}
              {submitting ? "正在验证…" : "进入工作区"}
            </Button>
          </form>

          <p className="login-card__security">
            凭据不会写入浏览器存储；验证成功后仅使用安全会话 Cookie。
          </p>
        </div>
      </section>
    </main>
  )
}

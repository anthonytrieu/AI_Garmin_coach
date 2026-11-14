import CoachLogReview from "@/components/coach-log-review"
import type { LogReview } from "@/lib/coach-logging"
import { applyFood, estimateMeal, foodPhoto, createLogReview, loadLogReview, persistLogReview } from "@/lib/coach-logging"
import { useTracking } from "@/components/tracking-provider"
import { useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import { Link, useLocation } from "react-router-dom"
import { api, type ConversationSummary } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ChatMessage {
  role: "user" | "assistant"
  text: string
  tools: string[]
  streaming?: boolean
}

interface SseEvent {
  type: "text" | "tool" | "done" | "error"
  text?: string
  label?: string
  message?: string
  session_id?: string
}

const SUGGESTIONS = [
  "I biked 40 minutes",
  "I ate a Jr Chicken from McDonalds. Add that to today’s meals.",
  "How should I balance lifting and recovery this week?",
  "How can I progress my lifts without rushing the weight?",
  "How is this week tracking against my training plan?",
  "What should I focus on this weekend?",
]

async function* readSse(resp: Response): AsyncGenerator<SseEvent> {
  const reader = resp.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split("\n\n")
    buffer = parts.pop() ?? ""
    for (const part of parts) {
      const line = part.trim()
      if (line.startsWith("data: ")) yield JSON.parse(line.slice(6)) as SseEvent
    }
  }
}

export default function Coach() {
  const tracking = useTracking()
  const [review, setReview] = useState<LogReview | null>(loadLogReview)
  const [loggingError, setLoggingError] = useState('')
  function updateReview(value: LogReview | null) {
    try { persistLogReview(value); setReview(value); setLoggingError(''); return true }
    catch { setLoggingError('Device storage is unavailable. Enable storage before logging through Coach, or use the meal/ride forms.'); return false }
  }
  const location = useLocation()
  const prefill = (location.state as { prefill?: string } | null)?.prefill
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [photo, setPhoto] = useState<string | undefined>()
  const [photoBusy, setPhotoBusy] = useState(false)
  const [input, setInput] = useState(prefill ?? "")
  const [busy, setBusy] = useState(false)
  const sessionRef = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    api
      .conversations()
      .then((list) => {
        setConversations(list)
        // A prefilled question (e.g. from the fuel page) starts a fresh chat.
        if (list.length > 0 && !prefill) void openConversation(list[0].id)
      })
      .catch(() => {}) // history is best-effort; chat works without it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function openConversation(id: string) {
    try {
      const convo = await api.conversation(id)
      sessionRef.current = id
      setActiveId(id)
      setMessages(convo.messages.map((m) => ({ role: m.role, text: m.text, tools: m.tools })))
    } catch {
      /* stale id — leave current view */
    }
  }

  function newChat() {
    sessionRef.current = null
    setActiveId(null)
    setMessages([])
  }

  async function removeConversation() {
    const id = sessionRef.current
    if (!id) return
    try {
      await api.deleteConversation(id)
    } catch {
      /* already gone */
    }
    setConversations((c) => c.filter((x) => x.id !== id))
    newChat()
  }

  async function send(text: string) {
    const question = text.trim() || (photo ? 'Estimate the food and portions in this photo' : '')
    if (!question || busy || review) return
    let next = createLogReview(question, tracking.rows('meal'))
    if (photo && !next) next = createLogReview('I ate the food in this photo', tracking.rows('meal'))
    if (next) {
      if (next.kind === 'meal' && (!next.calories || photo)) {
        setBusy(true); setLoggingError('')
        try {
          const food = await estimateMeal(question, photo)
          next = applyFood({ ...next, amount: '1' }, food)
        } catch (error) {
          updateReview(next)
          setLoggingError(error instanceof Error ? error.message : 'Meal estimate unavailable. Retry from the review.')
          setBusy(false); return
        } finally { setBusy(false) }
      }
      if (updateReview(next)) { setInput(''); setPhoto(undefined) }
      return
    }
    setBusy(true)
    setInput("")
    setMessages((m) => [
      ...m,
      { role: "user", text: question, tools: [] },
      { role: "assistant", text: "", tools: [], streaming: true },
    ])

    const update = (fn: (last: ChatMessage) => ChatMessage) =>
      setMessages((m) => [...m.slice(0, -1), fn(m[m.length - 1])])

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, session_id: sessionRef.current }),
      })
      if (!resp.ok || !resp.body) throw new Error(`Chat request failed (${resp.status})`)
      for await (const event of readSse(resp)) {
        if (event.type === "text" && event.text) {
          update((last) => ({ ...last, text: last.text + event.text }))
        } else if (event.type === "tool" && event.label) {
          update((last) =>
            last.tools.at(-1) === event.label ? last : { ...last, tools: [...last.tools, event.label!] },
          )
        } else if (event.type === "done") {
          if (event.session_id) {
            sessionRef.current = event.session_id
            setActiveId(event.session_id)
          }
          update((last) => ({ ...last, streaming: false }))
        } else if (event.type === "error") {
          update((last) => ({
            ...last,
            streaming: false,
            text: `${last.text}${last.text ? "\n\n" : ""}⚠ ${event.message ?? "Something went wrong."}`,
          }))
        }
      }
    } catch (e) {
      update((last) => ({
        ...last,
        streaming: false,
        text: last.text || `⚠ ${e instanceof Error ? e.message : "Chat failed."}`,
      }))
    } finally {
      setBusy(false)
      update((last) => ({ ...last, streaming: false }))
      api.conversations().then(setConversations).catch(() => {})
    }
  }

  const active = conversations.find((c) => c.id === activeId)

  return (
    <div className="mx-auto flex h-[calc(100dvh-180px)] min-h-[400px] max-w-3xl flex-col p-4 sm:h-[calc(100dvh-48px)] sm:p-6">
      <div className="mb-2">
        <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-xl font-semibold tracking-tight">Coach</h1><Link className="track-button" to="/import">Import notes & weigh-ins</Link></div>
        <p className="text-sm text-muted-foreground">
          AI coach with read-only access to your Garmin data. Advice, not medicine.
        </p>
      </div>

      {(conversations.length > 0 || activeId) && (
        <div className="mb-2 flex items-center gap-2">
          <Select
            value={activeId ?? ""}
            onValueChange={(v) => {
              if (v) void openConversation(v)
            }}
          >
            <SelectTrigger className="h-8 flex-1 min-w-0 text-xs [&_span]:truncate">
              <SelectValue>{active ? active.title : "Past conversations…"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {conversations.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={newChat} disabled={busy || !!review}>
            New chat
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void removeConversation()}
            disabled={busy || !activeId}
          >
            Delete
          </Button>
        </div>
      )}

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4 pr-1">
        {messages.length === 0 && (
          <div className="mt-10 flex flex-col items-center gap-2">
            <p className="mb-2 text-sm text-muted-foreground">Try asking:</p>
            {SUGGESTIONS.map((s) => (
              <Button key={s} variant="outline" size="sm" className="h-auto min-h-11 max-w-full whitespace-normal text-center" onClick={() => send(s)}>
                {s}
              </Button>
            ))}
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">
                {m.text}
              </div>
            </div>
          ) : (
            <div key={i} className="flex flex-col gap-1.5">
              {m.tools.map((t, j) => (
                <div key={j} className="flex items-center gap-2 pl-1 text-xs text-muted-foreground">
                  <span className="inline-block size-1.5 rounded-full bg-[var(--viz-load)]" />
                  {t}…
                </div>
              ))}
              {(m.text || m.streaming) && (
                <div className="max-w-[95%] rounded-2xl rounded-bl-sm border bg-card px-4 py-3">
                  <article className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{m.text}</ReactMarkdown>
                  </article>
                  {m.streaming && (
                    <span className="mt-1 inline-block size-2 animate-pulse rounded-full bg-muted-foreground" />
                  )}
                </div>
              )}
            </div>
          ),
        )}
      </div>

      {loggingError && <p role="alert">{loggingError}</p>}
      {review && <CoachLogReview key={review.id} review={review} onChange={updateReview} onClose={() => updateReview(null)} />}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <label className="track-button">{photoBusy ? 'Preparing photo…' : 'Attach food photo'}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || !!review || photoBusy} onChange={async event => {
          const file = event.target.files?.[0]; event.target.value = ''; if (!file) return
          setPhotoBusy(true); setLoggingError('')
          try { setPhoto(await foodPhoto(file)) } catch (error) { setLoggingError(error instanceof Error ? error.message : 'Unable to read photo.') }
          finally { setPhotoBusy(false) }
        }} /></label>
        <span>Food photos are sent to Groq for an estimate when you press Send.</span>
        {photo && <><img src={photo} alt="Food photo ready to estimate" className="h-16 w-16 rounded object-cover" /><button onClick={() => setPhoto(undefined)}>Remove photo</button></>}
      </div>
      <form
        className="flex gap-2 border-t pt-4 pb-4"
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          aria-label="Message your coach"
          placeholder="Ask your coach, or log a meal or ride…"
          disabled={busy || !!review}
        />
        <Button type="submit" disabled={busy || !!review || photoBusy || (!input.trim() && !photo)}>
          {busy ? "Thinking…" : "Send"}
        </Button>
      </form>
    </div>
  )
}

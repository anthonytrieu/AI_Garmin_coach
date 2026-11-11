import { Link } from "react-router-dom"
import CoachLogReview from "@/components/coach-log-review"
import { createLogReview, loadLogReview, persistLogReview } from "@/lib/coach-logging"
import type { LogReview } from "@/lib/coach-logging"
import { useTracking } from "@/components/tracking-provider"
import { useState } from "react"
import ReactMarkdown from "react-markdown"
import { exampleReplies } from "@/lib/demo"
import { Button } from "@/components/ui/button"
export default function DemoCoach() {
  const [selected, setSelected] = useState(0)
  const tracking = useTracking()
  const [review, setReview] = useState<LogReview | null>(loadLogReview)
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  function updateReview(value: LogReview | null) { try { persistLogReview(value); setReview(value); setError(''); return true } catch { setError('Device storage unavailable.'); return false } }
  function log(text: string) { const next = createLogReview(text, tracking.rows('meal')); if (next) { updateReview(next); setInput('') } else setError('Try “I ate a Jr Chicken” or “I biked 40 minutes”. Live AI is available in the personal app.') }
  return <div className="mx-auto max-w-3xl space-y-6 p-6">
    <h1 className="text-xl font-semibold">Coach examples</h1>
    <Link className="track-button" to="/import">Preview history import</Link>
    <div className="flex flex-wrap gap-2"><Button disabled={!!review} onClick={() => log('I biked 40 minutes')}>I biked 40 minutes</Button><Button disabled={!!review} onClick={() => log('I ate a Jr Chicken from McDonalds')}>Log a sample meal</Button></div>
    <form className="flex gap-2" onSubmit={event => { event.preventDefault(); log(input) }}><input className="min-w-0 flex-1 rounded-lg border bg-background p-3 text-base" aria-label="Message your coach" placeholder="Try logging a meal or ride…" value={input} disabled={!!review} onChange={event => setInput(event.target.value)} /><Button type="submit" disabled={!!review || !input.trim()}>Send</Button></form>
    {error && <p role="alert">{error}</p>}
    {review && <CoachLogReview review={review} onChange={updateReview} onClose={() => updateReview(null)} />}
    <p className="text-sm text-muted-foreground">Demo log entries stay in this browser. Nutrition searches and live AI are available in the personal app.</p>
    <p className="text-sm text-muted-foreground">Explore how the coach explains training data. These are authored examples using synthetic data; live AI is available only in the private app.</p>
    <div className="flex flex-wrap gap-2">{exampleReplies.map((reply, i) => <Button key={reply.question} variant={selected === i ? "default" : "outline"} className="h-auto whitespace-normal text-left" onClick={() => setSelected(i)}>{reply.question}</Button>)}</div>
    <article className="prose prose-sm dark:prose-invert rounded-xl border bg-card p-5"><ReactMarkdown>{exampleReplies[selected].answer}</ReactMarkdown></article>
  </div>
}

import { Link } from "react-router-dom"
import RideConfirmation from "@/components/ride-confirmation"
import { parseBikeNote } from "@/lib/tracking"
import { useState } from "react"
import ReactMarkdown from "react-markdown"
import { exampleReplies } from "@/lib/demo"
import { Button } from "@/components/ui/button"
export default function DemoCoach() {
  const [selected, setSelected] = useState(0)
  const [ride, setRide] = useState(false)
  return <div className="mx-auto max-w-3xl space-y-6 p-6">
    <h1 className="text-xl font-semibold">Coach examples</h1>
    <Link className="track-button" to="/import">Preview history import</Link>
    <Button onClick={() => setRide(true)}>I biked 40 minutes</Button>
    {ride && <RideConfirmation initial={parseBikeNote("I biked 40 minutes")!} onClose={() => setRide(false)} />}
    <p className="text-sm text-muted-foreground">Explore how the coach explains training data. These are authored examples using synthetic data; live AI is available only in the private app.</p>
    <div className="flex flex-wrap gap-2">{exampleReplies.map((reply, i) => <Button key={reply.question} variant={selected === i ? "default" : "outline"} className="h-auto whitespace-normal text-left" onClick={() => setSelected(i)}>{reply.question}</Button>)}</div>
    <article className="prose prose-sm dark:prose-invert rounded-xl border bg-card p-5"><ReactMarkdown>{exampleReplies[selected].answer}</ReactMarkdown></article>
  </div>
}

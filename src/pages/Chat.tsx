import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Navbar } from "@/components/Navbar"
import Icon from "@/components/ui/icon"

const CHAT_URL = "https://functions.poehali.dev/435b76c7-99c2-4e6d-8f14-9143e3b635bd"

const TEAM = ["Егор Просто", "Данил Екимов", "Данька Апрельский"]

function VerifiedBadge() {
  return (
    <svg className="w-4 h-4 text-blue-500 flex-shrink-0" viewBox="0 0 24 24" fill="none">
      <path d="M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" fill="#3b82f6"/>
      <path d="M9 12.5l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

interface Message {
  id: number
  sender_name: string
  message: string
  created_at: string
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [name, setName] = useState("")
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [banned, setBanned] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchMessages = async () => {
    const res = await fetch(CHAT_URL)
    const data = await res.json()
    setMessages(data.messages || [])
  }

  useEffect(() => {
    fetchMessages()
    const interval = setInterval(fetchMessages, 4000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !text.trim()) return
    setSending(true)
    const res = await fetch(CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender_name: name, message: text }),
    })
    const data = await res.json()
    if (data.error === "banned") {
      setBanned(true)
      setSending(false)
      return
    }
    setText("")
    await fetchMessages()
    setSending(false)
  }

  const isTeam = (n: string) => TEAM.includes(n)

  const getInitial = (n: string) => n[0].toUpperCase()

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <div className="flex-1 container mx-auto max-w-3xl px-4 py-8 flex flex-col">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-1">Общение</h1>
          <p className="text-muted-foreground text-sm">Пишите нам — команда всегда на связи</p>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {TEAM.map((member) => (
              <div key={member} className="flex items-center gap-1.5 bg-muted/50 rounded-full px-3 py-1">
                <div className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">
                  {member[0]}
                </div>
                <span className="text-sm font-medium">{member}</span>
                <VerifiedBadge />
              </div>
            ))}
          </div>
        </div>

        <Card className="flex-1 border-none shadow-xl flex flex-col">
          <CardContent className="flex flex-col flex-1 p-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[400px] max-h-[500px]">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 py-16">
                  <Icon name="MessageCircle" size={40} />
                  <p>Пока сообщений нет. Напишите первым!</p>
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${isTeam(msg.sender_name) ? "" : "flex-row-reverse"}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${isTeam(msg.sender_name) ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {getInitial(msg.sender_name)}
                  </div>
                  <div className={`max-w-[75%] ${isTeam(msg.sender_name) ? "" : "items-end"} flex flex-col gap-1`}>
                    <div className={`flex items-center gap-1 ${isTeam(msg.sender_name) ? "" : "flex-row-reverse"}`}>
                      <span className="text-xs font-semibold">{msg.sender_name}</span>
                      {isTeam(msg.sender_name) && <VerifiedBadge />}
                    </div>
                    <div className={`rounded-2xl px-4 py-2 text-sm leading-relaxed ${isTeam(msg.sender_name) ? "bg-muted rounded-tl-sm" : "bg-primary text-primary-foreground rounded-tr-sm"}`}>
                      {msg.message}
                    </div>
                    <span className="text-xs text-muted-foreground">{formatTime(msg.created_at)}</span>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="border-t p-4">
              {banned ? (
                <div className="flex items-center gap-3 bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3">
                  <Icon name="Ban" size={20} className="text-destructive flex-shrink-0" />
                  <p className="text-sm text-destructive font-medium">Вы заблокированы за использование нецензурной лексики.</p>
                </div>
              ) : (
                <form onSubmit={handleSend} className="flex flex-col gap-2">
                  <Input
                    placeholder="Ваше имя"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="text-sm"
                    maxLength={100}
                  />
                  <div className="flex gap-2">
                    <Input
                      placeholder="Напишите сообщение..."
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      className="text-sm"
                      maxLength={2000}
                    />
                    <Button type="submit" disabled={sending || !name.trim() || !text.trim()} size="icon">
                      <Icon name="Send" size={16} />
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
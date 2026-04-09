import { useRef, useState, useCallback } from "react"

const SIGNAL_URL = "https://functions.poehali.dev/9238d241-b194-4ebe-b1b6-be644685418d"

const ICE_SERVERS = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] }

export type CallStatus = "idle" | "calling" | "incoming" | "active"

export function useWebRTC(myName: string) {
  const [status, setStatus] = useState<CallStatus>("idle")
  const [remoteUser, setRemoteUser] = useState("")
  const [isMuted, setIsMuted] = useState(false)

  const pc = useRef<RTCPeerConnection | null>(null)
  const localStream = useRef<MediaStream | null>(null)
  const remoteAudio = useRef<HTMLAudioElement | null>(null)
  const roomId = useRef("")
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastSignalId = useRef(0)

  const sendSignal = async (type: string, payload: object) => {
    await fetch(SIGNAL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room_id: roomId.current, sender: myName, type, payload }),
    })
  }

  const cleanup = useCallback(async () => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (pc.current) { pc.current.close(); pc.current = null }
    if (localStream.current) { localStream.current.getTracks().forEach(t => t.stop()); localStream.current = null }
    if (remoteAudio.current) { remoteAudio.current.srcObject = null }
    if (roomId.current) {
      await fetch(SIGNAL_URL, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ room_id: roomId.current }) })
    }
    lastSignalId.current = 0
    setStatus("idle")
    setRemoteUser("")
  }, [])

  const setupPC = useCallback((stream: MediaStream) => {
    const peerConn = new RTCPeerConnection(ICE_SERVERS)
    pc.current = peerConn
    stream.getTracks().forEach(t => peerConn.addTrack(t, stream))

    peerConn.ontrack = (e) => {
      if (!remoteAudio.current) {
        remoteAudio.current = new Audio()
        remoteAudio.current.autoplay = true
      }
      remoteAudio.current.srcObject = e.streams[0]
    }

    peerConn.onicecandidate = (e) => {
      if (e.candidate) sendSignal("ice", { candidate: e.candidate })
    }

    peerConn.onconnectionstatechange = () => {
      if (peerConn.connectionState === "disconnected" || peerConn.connectionState === "failed") {
        cleanup()
      }
    }

    return peerConn
  }, [myName, cleanup])

  const pollSignals = useCallback((isCaller: boolean) => {
    pollRef.current = setInterval(async () => {
      const res = await fetch(`${SIGNAL_URL}?room_id=${encodeURIComponent(roomId.current)}&after=${lastSignalId.current}`)
      const data = await res.json()
      for (const sig of data.signals || []) {
        if (sig.sender === myName) { lastSignalId.current = sig.id; continue }
        lastSignalId.current = sig.id

        if (sig.type === "offer" && !isCaller) {
          setRemoteUser(sig.sender)
          setStatus("incoming")
          sessionStorage.setItem("pending_offer_" + roomId.current, JSON.stringify(sig.payload))
        }
        if (sig.type === "answer" && isCaller && pc.current) {
          await pc.current.setRemoteDescription(new RTCSessionDescription(sig.payload))
          setStatus("active")
        }
        if (sig.type === "ice" && pc.current?.remoteDescription) {
          await pc.current.addIceCandidate(new RTCIceCandidate(sig.payload.candidate))
        }
        if (sig.type === "hangup") {
          cleanup()
        }
      }
    }, 1500)
  }, [myName, cleanup])

  const startCall = useCallback(async (targetRoom: string, targetName: string) => {
    roomId.current = targetRoom
    setRemoteUser(targetName)
    setStatus("calling")
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    localStream.current = stream
    const peerConn = setupPC(stream)
    const offer = await peerConn.createOffer()
    await peerConn.setLocalDescription(offer)
    await sendSignal("offer", offer)
    pollSignals(true)
  }, [setupPC, pollSignals])

  const acceptCall = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    localStream.current = stream
    const peerConn = setupPC(stream)
    const offerJson = sessionStorage.getItem("pending_offer_" + roomId.current)
    if (!offerJson) return
    const offer = JSON.parse(offerJson)
    await peerConn.setRemoteDescription(new RTCSessionDescription(offer))
    const answer = await peerConn.createAnswer()
    await peerConn.setLocalDescription(answer)
    await sendSignal("answer", answer)
    setStatus("active")
    pollSignals(false)
  }, [setupPC, pollSignals])

  const hangup = useCallback(async () => {
    await sendSignal("hangup", {})
    cleanup()
  }, [cleanup])

  const toggleMute = useCallback(() => {
    localStream.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
    setIsMuted(m => !m)
  }, [])

  const listenForCalls = useCallback((room: string) => {
    roomId.current = room
    lastSignalId.current = 0
    pollSignals(false)
  }, [pollSignals])

  return { status, remoteUser, isMuted, startCall, acceptCall, hangup, toggleMute, listenForCalls, cleanup }
}

'use client';

import { use, useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Peer, { MediaConnection, DataConnection } from 'peerjs';
import { Shield, Users, MessageSquare, Send, Mic, MicOff, Video, VideoOff, Settings, LogOut, Copy, Check, Lock } from 'lucide-react';
import Link from 'next/link';

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
}

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode') as 'host' | 'viewer' | null;

  const [peer, setPeer] = useState<Peer | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [connections, setConnections] = useState<DataConnection[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [status, setStatus] = useState<string>('Initializing...');
  const [copied, setCopied] = useState(false);
  
  // Only used for viewers connecting to host
  const hostConnectionRef = useRef<DataConnection | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const broadcastMessage = (msg: ChatMessage, extraConnections: DataConnection[] = [], excludePeerId?: string) => {
    // Determine active connections
    setConnections(prevConns => {
      const allConns = [...prevConns, ...extraConnections];
      const uniqueConns = allConns.filter((v, i, a) => a.findIndex(v2 => (v2.peer === v.peer)) === i);
      uniqueConns.forEach(conn => {
        if (conn.peer !== excludePeerId && conn.open) {
          conn.send({ type: 'chat', message: msg });
        }
      });
      return uniqueConns;
    });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!mode || !roomId) return;

    let newPeer: Peer;
    let localStream: MediaStream | null = null;
    const roomPeerId = `cypher-stream-${roomId}`;

    const init = async () => {
      if (mode === 'host') {
        setStatus('Requesting media permissions...');
        try {
          localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          setStream(localStream);
          if (videoRef.current) {
            videoRef.current.srcObject = localStream;
            videoRef.current.muted = true; // Mute local playback
          }
          setStatus('Starting secure host node...');
          
          newPeer = new Peer(roomPeerId, {
            debug: 2,
          });

          newPeer.on('open', (id) => {
            setStatus('Live. Waiting for viewers...');
          });

          newPeer.on('connection', (conn) => {
            // New viewer joined
            conn.on('open', () => {
              setConnections((prev) => [...prev, conn]);
              setViewerCount((prev) => prev + 1);
              
              // Broadcast viewer joined message
              const joinMsg: ChatMessage = { id: crypto.randomUUID(), sender: 'System', text: 'A viewer joined the stream.', timestamp: Date.now() };
              setMessages((prev) => [...prev, joinMsg]);
              broadcastMessage(joinMsg, [conn]);
            });

            conn.on('data', (data: any) => {
              if (data.type === 'chat') {
                const msg = data.message as ChatMessage;
                setMessages((prev) => [...prev, msg]);
                // Relay to other viewers
                broadcastMessage(msg, [], conn.peer);
              }
            });

            conn.on('close', () => {
              setConnections((prev) => prev.filter((c) => c.peer !== conn.peer));
              setViewerCount((prev) => prev - 1);
              const leaveMsg: ChatMessage = { id: crypto.randomUUID(), sender: 'System', text: 'A viewer left the stream.', timestamp: Date.now() };
              setMessages((prev) => [...prev, leaveMsg]);
              broadcastMessage(leaveMsg, []);
            });

            // Call the viewer automatically with our stream
            if (localStream) {
              newPeer.call(conn.peer, localStream);
            }
          });

          newPeer.on('error', (err) => {
            console.error('PeerJS error:', err);
            if (err.type === 'unavailable-id') {
              setStatus('Error: Room ID already in use. Please create a new room.');
            } else {
              setStatus(`Error: ${err.message}`);
            }
          });

        } catch (err) {
          console.error("Media error:", err);
          setStatus('Error: Could not access camera/microphone.');
        }
      } else {
        // Viewer Mode
        setStatus('Initializing secure connection...');
        newPeer = new Peer({ debug: 2 });
        
        newPeer.on('open', (id) => {
          setStatus('Connecting to host...');
          const conn = newPeer.connect(roomPeerId);
          hostConnectionRef.current = conn;
          
          conn.on('open', () => {
            setStatus('Connected to room.');
          });
          
          conn.on('data', (data: any) => {
            if (data.type === 'chat') {
              setMessages((prev) => [...prev, data.message]);
            }
          });
          
          conn.on('close', () => {
            setStatus('Host disconnected.');
            setStream(null);
          });
        });

        newPeer.on('call', (call) => {
          setStatus('Receiving encrypted stream...');
          call.answer(); // Answer without stream
          call.on('stream', (remoteStream) => {
            setStatus('Live');
            setStream(remoteStream);
            if (videoRef.current) {
              videoRef.current.srcObject = remoteStream;
            }
          });
        });

        newPeer.on('error', (err) => {
          console.error('PeerJS error:', err);
          if (err.type === 'peer-unavailable') {
            setStatus('Error: Host not found. Ensure the room code is correct and the host is live.');
          } else {
            setStatus(`Error: ${err.message}`);
          }
        });
      }

      setPeer(newPeer);
    };

    init();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (newPeer) {
        newPeer.destroy();
      }
    };
  }, [roomId, mode]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      sender: mode === 'host' ? 'Host' : `Viewer ${peer?.id.substring(0, 4)}`,
      text: chatInput.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, msg]);
    
    if (mode === 'host') {
      broadcastMessage(msg);
    } else {
      if (hostConnectionRef.current && hostConnectionRef.current.open) {
        hostConnectionRef.current.send({ type: 'chat', message: msg });
      }
    }
    
    setChatInput('');
  };

  const toggleMic = () => {
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMicMuted(!isMicMuted);
    }
  };

  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoMuted(!isVideoMuted);
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!mode || !roomId) return null;

  return (
    <div className="flex flex-col h-screen bg-neutral-950 text-white font-sans overflow-hidden selection:bg-emerald-500/30">
      {/* Navbar */}
      <header className="flex items-center justify-between px-4 py-3 bg-neutral-900/80 border-b border-neutral-800 backdrop-blur-md shrink-0">
        <div className="flex items-center space-x-2">
          <Shield className="w-5 h-5 text-emerald-500" />
          <span className="font-semibold tracking-tight hidden sm:inline-block">CypherStream</span>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-neutral-800/50 px-3 py-1.5 rounded-lg border border-neutral-700/50">
            <span className="text-xs text-neutral-400 font-medium">Room</span>
            <span className="text-sm font-bold tracking-wider">{roomId}</span>
            <button onClick={copyRoomCode} className="ml-2 text-neutral-400 hover:text-emerald-400 transition-colors" title="Copy Room Code">
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="relative flex h-2.5 w-2.5">
              {(status === 'Live' || status === 'Live. Waiting for viewers...') ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-neutral-500"></span>
              )}
            </span>
            <span className="text-xs font-medium text-neutral-300 hidden sm:inline-block">
              {status}
            </span>
          </div>
          
          <Link href="/" className="flex items-center justify-center p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors" title="Leave Room">
            <LogOut className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 flex flex-col lg:flex-row min-h-0">
        
        {/* Video Area */}
        <section className="flex-1 relative flex flex-col bg-black overflow-hidden border-r border-neutral-800">
          <div className="flex-1 relative w-full h-full flex items-center justify-center">
            {stream ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className={`w-full h-full object-contain ${mode === 'host' ? 'scale-x-[-1]' : ''}`}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-neutral-600 space-y-4">
                <VideoOff className="w-16 h-16 opacity-20" />
                <p className="font-medium text-lg">{status}</p>
              </div>
            )}
            
            {/* Overlay stats */}
            {mode === 'host' && (
              <div className="absolute top-4 right-4 bg-neutral-900/80 backdrop-blur border border-neutral-800 rounded-lg px-3 py-1.5 flex items-center space-x-2 text-sm font-medium z-10">
                <Users className="w-4 h-4 text-cyan-400" />
                <span>{viewerCount} Viewers</span>
              </div>
            )}
            
            <div className="absolute top-4 left-4 bg-neutral-900/80 backdrop-blur border border-neutral-800 rounded-lg px-3 py-1.5 flex items-center space-x-2 text-sm font-medium z-10">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 text-xs">E2EE</span>
            </div>
          </div>

          {/* Controls Overlay (Host only for media controls) */}
          {mode === 'host' && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center space-x-4 bg-neutral-900/90 backdrop-blur-md border border-neutral-800 p-2 rounded-2xl shadow-2xl z-20">
              <button 
                onClick={toggleMic}
                className={`p-3 rounded-xl transition-all ${isMicMuted ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-neutral-800 hover:bg-neutral-700 text-white'}`}
                title={isMicMuted ? "Unmute" : "Mute"}
              >
                {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <button 
                onClick={toggleVideo}
                className={`p-3 rounded-xl transition-all ${isVideoMuted ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-neutral-800 hover:bg-neutral-700 text-white'}`}
                title={isVideoMuted ? "Start Video" : "Stop Video"}
              >
                {isVideoMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </button>
            </div>
          )}
        </section>

        {/* Chat Sidebar */}
        <section className="w-full lg:w-96 flex flex-col bg-neutral-950 flex-shrink-0 h-[40vh] lg:h-auto border-t lg:border-t-0 border-neutral-800">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-900/30">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-neutral-400" />
              <h3 className="font-medium text-sm">Secure Chat</h3>
            </div>
            <Settings className="w-4 h-4 text-neutral-500 cursor-not-allowed" />
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-neutral-600 text-sm">
                No messages yet. Say hello!
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.sender === 'System' ? 'items-center text-center' : 'items-start'}`}>
                  {msg.sender === 'System' ? (
                    <span className="text-xs text-neutral-500 bg-neutral-900 px-2 py-1 rounded-full mt-2">
                      {msg.text}
                    </span>
                  ) : (
                    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 max-w-[90%]">
                      <div className="flex items-center space-x-2 mb-1 text-xs">
                        <span className={`font-semibold ${msg.sender === 'Host' ? 'text-emerald-400' : 'text-cyan-400'}`}>
                          {msg.sender}
                        </span>
                        <span className="text-neutral-600 font-mono">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-200 break-words">{msg.text}</p>
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-neutral-800 bg-neutral-950">
            <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type a secure message..."
                className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-all placeholder-neutral-500"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white p-2 rounded-lg transition-colors focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </section>

      </main>
    </div>
  );
}

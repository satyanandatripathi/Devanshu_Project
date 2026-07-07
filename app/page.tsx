import Link from 'next/link';
import { Shield, Video, Users, Lock } from 'lucide-react';
import { redirect } from 'next/navigation';

export default function Home() {
  async function createRoom() {
    'use server';
    // Generate a random 6-character room code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    redirect(`/room/${code}?mode=host`);
  }

  async function joinRoom(formData: FormData) {
    'use server';
    const code = formData.get('code')?.toString().toUpperCase().trim();
    if (code) {
      redirect(`/room/${code}?mode=viewer`);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 flex flex-col font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="border-b border-neutral-800/50 bg-neutral-950/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="w-6 h-6 text-emerald-500" />
            <span className="font-semibold text-lg tracking-tight">CypherStream</span>
          </div>
          <nav className="flex items-center space-x-6 text-sm font-medium text-neutral-400">
            <span className="hover:text-emerald-400 transition-colors cursor-pointer">Features</span>
            <span className="hover:text-emerald-400 transition-colors cursor-pointer">Privacy</span>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col">
        <section className="flex-1 flex items-center justify-center relative overflow-hidden px-4 py-20">
          <div className="absolute inset-0 z-0 pointer-events-none">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-900/20 via-neutral-950/80 to-neutral-950"></div>
          </div>
          
          <div className="relative z-10 max-w-4xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center space-x-2 bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-xs font-medium border border-emerald-500/20 mb-4">
              <Lock className="w-3 h-3" />
              <span>100% End-to-End Encrypted over WebRTC</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-white">
              Secure Live Streaming <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500">
                For Private Groups
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-neutral-400 max-w-2xl mx-auto leading-relaxed">
              Host and join private, encrypted live streams. Built for privacy-focused creators and communities who value freedom of speech. No central servers record your stream.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-8">
              {/* Host Card */}
              <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 w-full max-w-sm backdrop-blur-sm text-left shadow-xl">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-4">
                  <Video className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Host a Stream</h3>
                <p className="text-sm text-neutral-400 mb-6">Create a secure room and broadcast to your audience.</p>
                <form action={createRoom} className="space-y-3">
                  <button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 px-4 rounded-lg transition-colors focus:ring-2 focus:ring-emerald-500 focus:outline-none" type="submit">
                    Create Secure Room
                  </button>
                </form>
              </div>

              {/* Join Card */}
              <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 w-full max-w-sm backdrop-blur-sm text-left shadow-xl">
                <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-cyan-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Join a Stream</h3>
                <p className="text-sm text-neutral-400 mb-6">Enter a room code to join an encrypted broadcast.</p>
                <form action={joinRoom} className="space-y-3 flex flex-col">
                  <input 
                    type="text" 
                    name="code" 
                    placeholder="Enter Room Code" 
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus:outline-none uppercase"
                    required
                    maxLength={6}
                  />
                  <button className="w-full bg-neutral-800 hover:bg-neutral-700 text-white font-medium py-2 px-4 rounded-lg transition-colors focus:ring-2 focus:ring-cyan-500 focus:outline-none" type="submit">
                    Join Room
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

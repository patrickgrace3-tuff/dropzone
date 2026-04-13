import { useEffect, useRef, useState } from 'react';
import { getSocket } from '../../services/socket.js';
import toast from 'react-hot-toast';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export default function Broadcaster({ showId, isLive }) {
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const peersRef  = useRef({});
  const [camOn, setCamOn] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [error, setError] = useState(null);
  const [peers, setPeers] = useState(0);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      setCamOn(true);
      setError(null);
      getSocket().emit('webrtc:broadcaster-ready', { showId });
      toast.success('📷 Camera started!');
    } catch {
      setError('Camera access denied. Click the camera icon in your browser address bar to allow access.');
      toast.error('Camera access denied');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamOn(false);
    Object.values(peersRef.current).forEach(pc => pc.close());
    peersRef.current = {};
    setPeers(0);
    getSocket().emit('webrtc:stream-ended', { showId });
  };

  const toggleMic = () => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setMicOn(track.enabled); }
  };

  const createPeerConnection = async (viewerSocketId) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peersRef.current[viewerSocketId] = pc;
    streamRef.current?.getTracks().forEach(track => pc.addTrack(track, streamRef.current));
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) getSocket().emit('webrtc:ice-candidate', { targetSocketId: viewerSocketId, candidate });
    };
    pc.onconnectionstatechange = () => {
      if (['disconnected','failed','closed'].includes(pc.connectionState)) {
        pc.close();
        delete peersRef.current[viewerSocketId];
        setPeers(Object.keys(peersRef.current).length);
      }
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    getSocket().emit('webrtc:offer', { targetSocketId: viewerSocketId, offer });
    setPeers(Object.keys(peersRef.current).length);
  };

  useEffect(() => {
    const socket = getSocket();
    socket.on('webrtc:new-viewer', async ({ viewerSocketId }) => {
      if (!streamRef.current) return;
      await createPeerConnection(viewerSocketId);
    });
    socket.on('webrtc:answer', async ({ viewerSocketId, answer }) => {
      const pc = peersRef.current[viewerSocketId];
      if (pc && pc.signalingState !== 'stable') {
        try { await pc.setRemoteDescription(new RTCSessionDescription(answer)); } catch {}
      }
    });
    socket.on('webrtc:ice-candidate', async ({ fromSocketId, candidate }) => {
      const pc = peersRef.current[fromSocketId];
      if (pc && candidate) {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
      }
    });
    return () => {
      socket.off('webrtc:new-viewer');
      socket.off('webrtc:answer');
      socket.off('webrtc:ice-candidate');
      stopCamera();
    };
  }, [showId]);

  return (
    // Outer wrapper — stacks video on top, controls bar below
    <div className="w-full h-full flex flex-col bg-brand2 rounded-2xl overflow-hidden">

      {/* Video area — fills available space */}
      <div className="flex-1 relative min-h-0">
        <video ref={videoRef} autoPlay muted playsInline
          className="w-full h-full object-cover"
          style={{ display: camOn ? 'block' : 'none' }} />

        {/* No-cam placeholder */}
        {!camOn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40 text-center px-4">
            <div className="text-4xl mb-2">📷</div>
            <p className="text-sm font-semibold text-white/60">Camera off</p>
            <p className="text-xs mt-1 opacity-60">Use the controls below to start your camera</p>
            {error && (
              <p className="text-xs text-red-400 mt-3 bg-red-900/30 rounded-xl p-2 max-w-xs">{error}</p>
            )}
          </div>
        )}

        {/* Live badge — top left of video, won't overlap controls */}
        {camOn && isLive && (
          <div className="absolute top-2 left-2 badge-live z-10">
            <span className="live-dot" /> LIVE
          </div>
        )}
        {camOn && (
          <div className="absolute top-2 right-2 bg-black/60 text-white text-xs font-mono px-2 py-1 rounded-full z-10">
            👁 {peers}
          </div>
        )}
      </div>

      {/* Camera controls — always at bottom, always clickable */}
      <div className="flex-shrink-0 flex items-center justify-center gap-3 px-4 py-2 bg-black/50 z-20">
        {!camOn ? (
          <button
            onClick={startCamera}
            className="flex items-center gap-2 bg-brand hover:bg-dz-600 text-white font-bold px-6 py-2 rounded-full text-sm transition-all">
            📷 Start Camera
          </button>
        ) : (
          <>
            <button onClick={toggleMic}
              title={micOn ? 'Mute mic' : 'Unmute mic'}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-base transition-all
                ${micOn ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}>
              {micOn ? '🎙' : '🔇'}
            </button>
            <span className="text-white/50 text-xs font-mono">
              {peers} viewer{peers !== 1 ? 's' : ''} live
            </span>
            <button onClick={stopCamera}
              title="Stop camera"
              className="w-9 h-9 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center text-sm transition-all">
              ⏹
            </button>
          </>
        )}
      </div>
    </div>
  );
}

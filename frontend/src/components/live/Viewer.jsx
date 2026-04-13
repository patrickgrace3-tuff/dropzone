import { useEffect, useRef, useState } from 'react';
import { getSocket } from '../../services/socket.js';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export default function Viewer({ showId, isLive }) {
  const videoRef = useRef(null);
  const pcRef    = useRef(null);
  const [state, setState] = useState('waiting');
  const [muted, setMuted] = useState(false);

  const cleanup = () => {
    pcRef.current?.close();
    pcRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const buildPeerConnection = async (broadcasterSocketId) => {
    cleanup();
    setState('connecting');

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    pc.ontrack = ({ streams }) => {
      if (videoRef.current && streams[0]) {
        videoRef.current.srcObject = streams[0];
        setState('live');
      }
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        getSocket().emit('webrtc:ice-candidate', {
          targetSocketId: broadcasterSocketId,
          candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed'].includes(pc.connectionState)) {
        setState('waiting');
        cleanup();
      }
    };
  };

  useEffect(() => {
    const socket = getSocket();

    // Broadcaster just started their camera — build a connection and announce we're here
    socket.on('webrtc:broadcaster-ready', async ({ broadcasterSocketId }) => {
      await buildPeerConnection(broadcasterSocketId);
      // Tell broadcaster to send us an offer
      socket.emit('webrtc:viewer-ready', { showId });
    });

    // Broadcaster sent us their SDP offer
    socket.on('webrtc:offer', async ({ broadcasterSocketId, offer }) => {
      let pc = pcRef.current;
      // If we don't have a peer connection yet, build one now
      if (!pc) {
        await buildPeerConnection(broadcasterSocketId);
        pc = pcRef.current;
      }
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc:answer', { targetSocketId: broadcasterSocketId, answer });
      } catch (err) {
        console.warn('WebRTC offer error:', err);
      }
    });

    // ICE candidate from broadcaster
    socket.on('webrtc:ice-candidate', async ({ fromSocketId, candidate }) => {
      if (pcRef.current && candidate) {
        try { await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
      }
    });

    // Broadcaster ended stream
    socket.on('webrtc:stream-ended', () => {
      cleanup();
      setState('ended');
    });

    // On join, tell broadcaster we're here so they send an offer immediately
    // This handles the case where broadcaster is already live when viewer joins
    if (isLive) {
      socket.emit('webrtc:viewer-ready', { showId });
    }

    return () => {
      socket.off('webrtc:broadcaster-ready');
      socket.off('webrtc:offer');
      socket.off('webrtc:ice-candidate');
      socket.off('webrtc:stream-ended');
      cleanup();
    };
  }, [showId, isLive]);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setMuted(videoRef.current.muted);
    }
  };

  return (
    <div className="relative w-full bg-brand2 rounded-2xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
      <video ref={videoRef} autoPlay playsInline
        className="w-full h-full object-cover"
        style={{ display: state === 'live' ? 'block' : 'none' }} />

      {state === 'waiting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40 text-center px-4">
          <div className="text-5xl mb-3 animate-pulse">📡</div>
          <p className="text-sm font-semibold text-white/60">
            {isLive ? 'Waiting for broadcaster camera...' : 'Show not started yet'}
          </p>
          <p className="text-xs mt-1 opacity-60">
            {isLive ? 'The seller needs to click Start Camera in their studio' : 'Come back when the show goes live'}
          </p>
        </div>
      )}

      {state === 'connecting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40">
          <div className="text-4xl mb-3 animate-pulse">📶</div>
          <p className="text-sm">Connecting to stream...</p>
        </div>
      )}

      {state === 'ended' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40">
          <div className="text-5xl mb-3">📴</div>
          <p className="text-sm font-semibold">Stream ended</p>
        </div>
      )}

      {state === 'live' && (
        <>
          <div className="absolute top-3 left-3 badge-live"><span className="live-dot" /> LIVE</div>
          <button onClick={toggleMute}
            className="absolute bottom-3 right-3 w-9 h-9 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center text-sm transition-all"
            title={muted ? 'Unmute' : 'Mute'}>
            {muted ? '🔇' : '🔊'}
          </button>
        </>
      )}
    </div>
  );
}

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { showsAPI } from '../services/api.js';
import { getSocket, joinShow, leaveShow, sendChat } from '../services/socket.js';
import { useAuthStore } from '../context/authStore.js';
import toast from 'react-hot-toast';
import Viewer from '../components/live/Viewer.jsx';

export default function LiveShowPage() {
  const { id }   = useParams();
  const { user } = useAuthStore();

  const [show, setShow]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [messages, setMessages]     = useState([]);
  const [chatInput, setChatInput]   = useState('');
  const [viewers, setViewers]       = useState(0);
  const [currentItem, setCurrentItem] = useState(null);
  const [currentBid, setCurrentBid] = useState(0);
  const [bidInput, setBidInput]     = useState(0);
  const [countdown, setCountdown]   = useState(0);
  const [bidding, setBidding]       = useState(false);

  const chatRef  = useRef(null);
  const timerRef = useRef(null);
  const cdRef    = useRef(0);

  const scrollChat = () => setTimeout(() => { chatRef.current?.scrollTo(0, chatRef.current.scrollHeight); }, 50);

  const startCountdown = (seconds) => {
    clearInterval(timerRef.current);
    cdRef.current = seconds;
    setCountdown(seconds);
    timerRef.current = setInterval(() => {
      cdRef.current -= 1;
      setCountdown(cdRef.current);
      if (cdRef.current <= 0) clearInterval(timerRef.current);
    }, 1000);
  };

  const activateItem = (item) => {
    if (!item) return;
    setCurrentItem(item);
    const bid = Math.round((item.currentBid || item.startingBid || 0) * 100) / 100;
    setCurrentBid(bid);
    setBidInput(bid + 1);
    startCountdown(item.bidDuration || 120);
    setMessages(p => [...p, {
      isSystem: true,
      message: `🔨 Now bidding: ${item.listing?.title} — starting at $${item.startingBid}`,
      ts: Date.now(),
    }]);
    scrollChat();
  };

  useEffect(() => {
    // Load show data
    showsAPI.get(id)
      .then(({ show: s }) => {
        setShow(s);
        setViewers(s.viewerCount || 0);
        const active = s.inventory?.find(i => i.status === 'active');
        if (active) activateItem(active);
        setMessages([{ isSystem: true, message: `Welcome to ${s.title}! 🎉`, ts: Date.now() }]);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Join show room — socket.js now ensures connection before emitting
    joinShow(id);
    const socket = getSocket();

    const onChat = (msg) => {
      setMessages(p => [...p.slice(-99), msg]);
      scrollChat();
    };

    const onBidNew = ({ amount, bidder }) => {
      const rounded = Math.round(amount * 100) / 100;
      setCurrentBid(rounded);
      setBidInput(rounded + 1);
      setMessages(p => [...p.slice(-99), {
        username: bidder?.username,
        bid: rounded,
        ts: Date.now(),
      }]);
      scrollChat();
    };

    const onViewers   = ({ count }) => setViewers(count);
    const onNextItem  = ({ item }) => activateItem(item);
    const onItemSold  = ({ finalPrice, nextItem }) => {
      toast.success(`🔨 SOLD for $${finalPrice?.toLocaleString()}!`);
      clearInterval(timerRef.current);
      if (nextItem) activateItem(nextItem);
      else { setCurrentItem(null); setCountdown(0); }
    };
    const onShowEnded = () => {
      toast('📺 Show has ended. Thanks for watching!');
      clearInterval(timerRef.current);
      setCurrentItem(null);
      setCountdown(0);
    };

    socket.on('show:chat',      onChat);
    socket.on('show:bid:new',   onBidNew);
    socket.on('show:viewers',   onViewers);
    socket.on('show:next-item', onNextItem);
    socket.on('show:item:sold', onItemSold);
    socket.on('show:ended',     onShowEnded);

    return () => {
      leaveShow(id);
      clearInterval(timerRef.current);
      socket.off('show:chat',      onChat);
      socket.off('show:bid:new',   onBidNew);
      socket.off('show:viewers',   onViewers);
      socket.off('show:next-item', onNextItem);
      socket.off('show:item:sold', onItemSold);
      socket.off('show:ended',     onShowEnded);
    };
  }, [id]);

  const handleChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    if (!user) { toast.error('Sign in to chat'); return; }
    sendChat(id, chatInput.trim());
    setChatInput('');
  };

  const handleBid = () => {
    if (!user)         { toast.error('Sign in to place a bid'); return; }
    if (!currentItem)  { toast.error('No active item to bid on'); return; }
    if (countdown <= 0){ toast.error('Bidding time has ended'); return; }

    const amount = parseFloat(bidInput);
    if (!amount || amount <= currentBid) {
      toast.error(`Bid must be more than $${currentBid}`);
      return;
    }

    setBidding(true);
    const listingId = currentItem.listing?.id || currentItem.listing;
    const socket = getSocket();

    // Place bid via socket
    socket.emit('show:bid', { showId: id, listingId, amount });

    // Listen for confirmation or error
    const onError = ({ message }) => {
      toast.error(message || 'Bid failed');
      setBidding(false);
      socket.off('error', onError);
    };
    socket.once('error', onError);

    // Optimistically update after short delay
    setTimeout(() => {
      setBidding(false);
      socket.off('error', onError);
    }, 1500);
  };

  const cdColor = countdown > 30 ? 'text-white' : countdown > 10 ? 'text-amber-400' : 'text-live animate-pulse';
  const isLive  = show?.status === 'live';

  if (loading) return (
    <div className="max-w-6xl mx-auto px-4 py-8 text-gray-400 flex items-center gap-2">
      <div className="w-4 h-4 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      Loading show...
    </div>
  );

  if (!show) return (
    <div className="max-w-6xl mx-auto px-4 py-8 text-center text-gray-400">
      <div className="text-4xl mb-2">😕</div>
      <p className="font-semibold">Show not found</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT: stream + bidding */}
        <div className="lg:col-span-2 space-y-4">

          {/* Video */}
          <Viewer showId={id} isLive={isLive} />

          {/* Show title */}
          <div>
            <h1 className="text-xl font-extrabold">{show.title}</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              by {show.seller?.displayName || show.seller?.username}
              {!isLive && (
                <span className="ml-2 text-xs font-bold px-2 py-0.5 bg-gray-100 rounded-full capitalize">
                  {show.status}
                </span>
              )}
            </p>
          </div>

          {/* Bidding card */}
          {currentItem && isLive ? (
            <div className="card p-5 border-2 border-brand/20">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Now Bidding</div>
                  <div className="font-extrabold text-xl leading-tight">{currentItem.listing?.title}</div>
                  <div className="text-xs text-gray-400 mt-1">Starting bid: ${(currentItem.startingBid || 0).toLocaleString()}</div>
                </div>
                {/* Countdown */}
                <div className="text-right flex-shrink-0">
                  <div className="text-xs text-gray-400 mb-1">Time left</div>
                  <div className={`text-4xl font-extrabold leading-none font-mono ${cdColor}`}>
                    {countdown > 0
                      ? `${Math.floor(countdown/60)}:${String(countdown%60).padStart(2,'0')}`
                      : <span className="text-live text-2xl">TIME'S UP</span>}
                  </div>
                </div>
              </div>

              {/* Current bid */}
              <div className="bg-gray-50 rounded-xl p-4 mb-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Current bid</div>
                  <div className="text-4xl font-extrabold text-brand">${currentBid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400 mb-0.5">Min bid</div>
                  <div className="text-lg font-bold">${(currentBid + 1).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
              </div>

              {/* Bid input */}
              <div className="flex gap-2 mb-3">
                <input
                  type="number"
                  value={bidInput}
                  onChange={e => setBidInput(parseFloat(e.target.value) || 0)}
                  className="input flex-1 font-mono text-lg font-bold"
                  min={currentBid + 0.01}
                  step="1"
                  disabled={countdown <= 0}
                />
                <button
                  onClick={handleBid}
                  disabled={bidding || countdown <= 0 || !user}
                  className="btn-primary px-8 text-base disabled:opacity-50 min-w-[120px]">
                  {!user ? 'Sign in' : bidding ? '...' : countdown <= 0 ? 'Ended' : 'Bid Now'}
                </button>
              </div>

              {/* Quick bid buttons */}
              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 25, 50].map(inc => (
                  <button key={inc}
                    onClick={() => setBidInput(Math.round((currentBid + inc) * 100) / 100)}
                    disabled={countdown <= 0}
                    className="py-2 text-sm font-bold rounded-xl border border-gray-200 hover:border-brand hover:text-brand transition-all disabled:opacity-40">
                    +${inc}
                  </button>
                ))}
              </div>

              {!user && (
                <p className="text-center text-sm text-gray-400 mt-3">
                  <a href="/login" className="text-brand font-semibold underline">Sign in</a> to place bids
                </p>
              )}
            </div>
          ) : isLive ? (
            <div className="card p-6 text-center text-gray-400">
              <div className="text-3xl mb-2">⏳</div>
              <p className="font-semibold">Waiting for next item...</p>
            </div>
          ) : (
            <div className="card p-6 text-center text-gray-400">
              <div className="text-3xl mb-2">{show.status === 'scheduled' ? '📅' : '📼'}</div>
              <p className="font-semibold">
                {show.status === 'scheduled' ? 'Show hasn\'t started yet' : 'This show has ended'}
              </p>
            </div>
          )}

          {/* Inventory */}
          <div className="card p-4">
            <h3 className="font-bold mb-3 text-sm">Show Items ({show.inventory?.length || 0})</h3>
            <div className="space-y-2">
              {show.inventory?.length === 0 && <p className="text-sm text-gray-400">No items listed</p>}
              {show.inventory?.map((item, i) => (
                <div key={i} className={`flex items-center gap-3 p-2.5 rounded-xl text-sm transition-all
                  ${item.status === 'active' ? 'bg-brand/5 border border-brand/20' : 'bg-gray-50'}`}>
                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold flex-shrink-0">{i+1}</div>
                  <div className="flex-1 font-semibold truncate">{item.listing?.title || `Item ${i+1}`}</div>
                  <div className="text-xs font-mono text-gray-400">${(item.startingBid || 0).toLocaleString()}</div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0
                    ${item.status === 'active'  ? 'bg-brand text-white'
                    : item.status === 'sold'    ? 'bg-green-100 text-green-700'
                    : item.status === 'skipped' ? 'bg-gray-100 text-gray-400'
                    : 'bg-gray-100 text-gray-400'}`}>
                    {item.status === 'active'  ? '● LIVE'
                    : item.status === 'sold'   ? `SOLD $${(item.soldPrice || 0).toLocaleString()}`
                    : item.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Chat */}
        <div className="card flex flex-col" style={{ height: '620px' }}>
          <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
            <h3 className="font-bold">Live Chat</h3>
            <span className="text-xs text-gray-400 font-mono">{viewers} watching</span>
          </div>

          <div ref={chatRef} className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
            {messages.map((msg, i) => (
              <div key={i} className="text-sm leading-relaxed">
                {msg.isSystem ? (
                  <span className="text-gray-400 italic text-xs">{msg.message}</span>
                ) : msg.bid !== undefined ? (
                  <span>
                    <span className="font-bold text-brand2">{msg.username}</span>
                    <span className="text-green-600 font-bold font-mono"> bid ${msg.bid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </span>
                ) : (
                  <span>
                    <span className="font-bold text-brand2">{msg.username}: </span>
                    <span className="text-gray-600">{msg.message}</span>
                  </span>
                )}
              </div>
            ))}
          </div>

          <form onSubmit={handleChat} className="p-3 border-t border-gray-100 flex gap-2 flex-shrink-0">
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder={user ? 'Say something...' : 'Sign in to chat'}
              disabled={!user}
              className="input flex-1 text-sm"
            />
            <button type="submit" disabled={!user}
              className="btn-primary py-2 px-4 text-sm disabled:opacity-50">
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

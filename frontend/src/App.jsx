import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Plus, Check, Clock, Music2, AlertCircle } from "lucide-react";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const API_URL = import.meta.env.VITE_API_URL;
const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes
const STORAGE_KEY = "queue_last_add_ts";

// ---------------------------------------------------------------------------
// Hook: useDebounce
// Delays updating the returned value until `delay` ms have passed without
// the input value changing.
// ---------------------------------------------------------------------------
function useDebounce(value, delay = 500) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

// ---------------------------------------------------------------------------
// Hook: useCooldown
// Reads the last-add timestamp from localStorage, exposes whether the user
// is still in cooldown, and ticks down a live mm:ss remaining value.
// ---------------------------------------------------------------------------
function useCooldown() {
  const [lastAddTs, setLastAddTs] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? parseInt(stored, 10) : null;
  });
  const [remainingMs, setRemainingMs] = useState(0);

  useEffect(() => {
    if (!lastAddTs) {
      setRemainingMs(0);
      return;
    }

    const tick = () => {
      const elapsed = Date.now() - lastAddTs;
      const left = COOLDOWN_MS - elapsed;
      setRemainingMs(left > 0 ? left : 0);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lastAddTs]);

  const startCooldown = useCallback(() => {
    const now = Date.now();
    localStorage.setItem(STORAGE_KEY, String(now));
    setLastAddTs(now);
  }, []);

  const isActive = remainingMs > 0;
  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);

  return {
    isActive,
    minutes,
    seconds,
    startCooldown,
  };
}

// ---------------------------------------------------------------------------
// Subcomponent: TrackResultItem
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Subcomponent: TrackResultItem
// ---------------------------------------------------------------------------
function TrackResultItem({ track, onAdd, status }) {
  const isAdding = status === "adding";
  const isAdded = status === "added";

  return (
    <li className="flex items-center gap-3 py-3">
      <img
        src={track.image} // <-- Changed from albumArt to image
        alt={`${track.name} album art`}
        className="h-12 w-12 flex-shrink-0 rounded object-cover bg-neutral-800"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-neutral-100">
          {track.name} {/* <-- Changed from title to name */}
        </p>
        <p className="truncate text-sm text-neutral-400">{track.artist}</p>
      </div>
      <button
        type="button"
        onClick={() => onAdd(track)}
        disabled={isAdding || isAdded}
        aria-label={isAdded ? "Added to queue" : `Add ${track.name} to queue`}
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-colors
          ${isAdded
            ? "bg-green-500 text-black"
            : "bg-neutral-800 text-neutral-100 hover:bg-neutral-700 active:bg-neutral-600"
          }
          disabled:opacity-70`}
      >
        {isAdding ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-500 border-t-transparent" />
        ) : isAdded ? (
          <Check size={18} strokeWidth={2.5} />
        ) : (
          <Plus size={18} strokeWidth={2.5} />
        )}
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Subcomponent: SkeletonRow
// ---------------------------------------------------------------------------
function SkeletonRow() {
  return (
    <li className="flex items-center gap-3 py-3">
      <div className="h-12 w-12 flex-shrink-0 animate-pulse rounded bg-neutral-800" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-2/3 animate-pulse rounded bg-neutral-800" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-neutral-800" />
      </div>
      <div className="h-9 w-9 flex-shrink-0 animate-pulse rounded-full bg-neutral-800" />
    </li>
  );
}

// ---------------------------------------------------------------------------
// Subcomponent: CooldownScreen
// ---------------------------------------------------------------------------
function CooldownScreen({ minutes, seconds }) {
  const pad = (n) => String(n).padStart(2, "0");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
        <Check size={32} className="text-green-500" strokeWidth={2.5} />
      </div>
      <h1 className="text-xl font-semibold text-neutral-50">
        You&apos;re in the queue!
      </h1>
      <p className="max-w-xs text-sm text-neutral-400">
        Your track was added. You can request another song once the timer
        below runs out.
      </p>
      <div className="mt-2 flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-3">
        <Clock size={18} className="text-green-500" />
        <span className="font-mono text-2xl tabular-nums text-neutral-50">
          {pad(minutes)}:{pad(seconds)}
        </span>
      </div>
      <p className="text-xs text-neutral-500">minutes remaining</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------
export default function App() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 500);

  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  // Per-track add status: { [trackId]: "adding" | "added" | "error" }
  const [addStatus, setAddStatus] = useState({});
  const [addError, setAddError] = useState(null);

  const { isActive: cooldownActive, minutes, seconds, startCooldown } =
    useCooldown();

  const requestIdRef = useRef(0);

  // Run the search whenever the debounced query changes.
  useEffect(() => {
    const trimmed = debouncedQuery.trim();

    if (!trimmed) {
      setResults([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    const currentRequestId = ++requestIdRef.current;
    setIsSearching(true);
    setSearchError(null);

    fetch(`${API_URL}/search?q=${encodeURIComponent(trimmed)}`, {
      headers: {
        'ngrok-skip-browser-warning': 'true'
      }
    })
      .then((res) => {
        if (!res.ok) throw new Error("Seafrch request failed");
        return res.json();
      })
      .then((data) => {
        // Ignore stale responses from out-of-order requests.
        if (currentRequestId !== requestIdRef.current) return;
        setResults(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (currentRequestId !== requestIdRef.current) return;
        setSearchError("Couldn't load results. Try searching again.");
        setResults([]);
      })
      .finally(() => {
        if (currentRequestId !== requestIdRef.current) return;
        setIsSearching(false);
      });
  }, [debouncedQuery]);

  const handleAdd = useCallback(
    async (track) => {
      setAddError(null);
      setAddStatus((prev) => ({ ...prev, [track.id]: "adding" }));

      try {
        const res = await fetch(`${API_URL}/add`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": 'true'
          },
          body: JSON.stringify({ uri: track.uri }),
        });

        if (!res.ok) throw new Error("Add request failed");

        setAddStatus((prev) => ({ ...prev, [track.id]: "added" }));
        startCooldown();
      } catch (err) {
        setAddStatus((prev) => ({ ...prev, [track.id]: "error" }));
        setAddError("Couldn't add that track. Please try again.");
      }
    },
    [startCooldown]
  );

  const showEmptyState =
    !isSearching && !searchError && debouncedQuery.trim() && results.length === 0;
  const showIdleState = !debouncedQuery.trim() && !isSearching;

  return (
    <div className="flex min-h-screen flex-col bg-neutral-950 text-neutral-50">
      <header className="sticky top-0 z-10 border-b border-neutral-900 bg-neutral-950/95 px-4 pb-3 pt-5 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <Music2 size={22} className="text-green-500" />
          <h1 className="text-lg font-semibold">Request a Song</h1>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4">
        {cooldownActive ? (
          <CooldownScreen minutes={minutes} seconds={seconds} />
        ) : (
          <>
            <div className="sticky top-[68px] z-10 -mx-4 bg-neutral-950 px-4 pb-3 pt-4">
              <div className="relative">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
                />
                <input
                  type="text"
                  inputMode="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search for a song or artist"
                  className="w-full rounded-full bg-neutral-900 py-3 pl-10 pr-4 text-sm text-neutral-50 placeholder-neutral-500 outline-none ring-1 ring-transparent focus:ring-green-500"
                />
              </div>

              {addError && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  <span>{addError}</span>
                </div>
              )}
            </div>

            <div className="flex-1 pb-6">
              {isSearching && (
                <ul className="divide-y divide-neutral-900">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <SkeletonRow key={i} />
                  ))}
                </ul>
              )}

              {!isSearching && searchError && (
                <div className="mt-8 flex flex-col items-center gap-2 text-center">
                  <AlertCircle size={24} className="text-red-400" />
                  <p className="text-sm text-neutral-400">{searchError}</p>
                </div>
              )}

              {!isSearching && !searchError && results.length > 0 && (
                <ul className="divide-y divide-neutral-900">
                  {results.map((track) => (
                    <TrackResultItem
                      key={track.id}
                      track={track}
                      onAdd={handleAdd}
                      status={addStatus[track.id]}
                    />
                  ))}
                </ul>
              )}

              {showEmptyState && (
                <div className="mt-8 flex flex-col items-center gap-2 text-center">
                  <Search size={24} className="text-neutral-600" />
                  <p className="text-sm text-neutral-400">
                    No songs found for &quot;{debouncedQuery.trim()}&quot;
                  </p>
                </div>
              )}

              {showIdleState && (
                <div className="mt-8 flex flex-col items-center gap-2 text-center">
                  <Music2 size={24} className="text-neutral-600" />
                  <p className="text-sm text-neutral-500">
                    Search for a song to add it to the queue
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

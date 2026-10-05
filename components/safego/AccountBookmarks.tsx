"use client";

import { useState } from "react";
import type { AccountProfile, Bookmark } from "@/lib/account/types";
import type { SafeGoLocation } from "@/lib/safego/types";
import { PlaceInput, type PickedPlace } from "./PlaceInput";

const MAX_BOOKMARKS = 30;

/** The request body for a location: the picked place's details when the text still matches the pick. */
function locationBody(location: string, picked: PickedPlace | null) {
  return picked && picked.label === location.trim()
    ? { location, coordinates: picked.coordinates, detail: picked.detail, matchedLocationId: picked.matchedLocationId }
    : { location };
}

/** An account's bookmarked places: add one, open it, rename it, move it, or delete it. */
export function AccountBookmarks({
  account,
  request,
  onAccount,
  onOpen,
  suggestedLocation = "",
  locations = [],
}: {
  account: AccountProfile;
  request: (path: string, init?: RequestInit) => Promise<AccountProfile>;
  onAccount: (account: AccountProfile) => void;
  /** Show this bookmark on the map or in the planner. */
  onOpen?: (bookmark: Bookmark) => void;
  /** The place on screen now, offered as the location for a new bookmark. */
  suggestedLocation?: string;
  /** SafeGo's own locations, offered first in the location suggestions. */
  locations?: SafeGoLocation[];
}) {
  const bookmarks = account.bookmarks ?? [];
  const [name, setName] = useState("");
  const [location, setLocation] = useState(suggestedLocation);
  const [picked, setPicked] = useState<PickedPlace | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string; location: string; picked: PickedPlace | null } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function run(action: () => Promise<AccountProfile>, done: string) {
    setWorking(true);
    setError("");
    setMessage("");
    try {
      onAccount(await action());
      setMessage(done);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "SafeGo could not update your bookmarks.");
      return false;
    } finally {
      setWorking(false);
    }
  }

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const saved = await run(() => request("/api/account/bookmarks", { method: "POST", body: JSON.stringify({ name, ...locationBody(location, picked) }) }), "Bookmark added.");
    if (saved) {
      setName("");
      setLocation("");
      setPicked(null);
    }
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const saved = await run(() => request(`/api/account/bookmarks/${editing.id}`, {
      method: "PUT",
      body: JSON.stringify({ name: editing.name, ...locationBody(editing.location, editing.picked) }),
    }), "Bookmark updated.");
    if (saved) setEditing(null);
  }

  async function remove(id: string) {
    await run(() => request(`/api/account/bookmarks/${id}`, { method: "DELETE" }), "Bookmark deleted.");
    setConfirmingDelete(null);
  }

  const smallButton = "min-h-9 rounded-lg border border-hairline px-3 text-xs font-bold text-ink hover:bg-surface disabled:opacity-60";

  return (
    <section className="mt-6 border-t border-hairline pt-5" aria-labelledby="account-bookmarks-title">
      <h3 id="account-bookmarks-title" className="text-base font-bold text-ink">Bookmarks</h3>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">Save places you check often and give each one your own name.</p>

      {bookmarks.length === 0 ? (
        <p className="mt-3 rounded-lg bg-surface px-3 py-2.5 text-sm text-ink-soft">No bookmarks yet. Add your first one below.</p>
      ) : (
        <ul className="mt-3 divide-y divide-hairline border-y border-hairline">
          {bookmarks.map((bookmark) => (
            <li key={bookmark.id} className="py-3">
              {editing?.id === bookmark.id ? (
                <form className="account-form" onSubmit={saveEdit}>
                  <label htmlFor={`bookmark-name-${bookmark.id}`}>Name</label>
                  <input id={`bookmark-name-${bookmark.id}`} value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} required maxLength={60} autoFocus />
                  <label htmlFor={`bookmark-location-${bookmark.id}`}>Location</label>
                  <PlaceInput id={`bookmark-location-${bookmark.id}`} value={editing.location} onChange={(value, place) => setEditing({ ...editing, location: value, picked: place })} locations={locations} required />
                  <div className="mt-1 flex gap-2">
                    <button type="submit" className="min-h-9 rounded-lg bg-brand px-4 text-xs font-bold text-white hover:bg-brand-hover disabled:opacity-60" disabled={working}>{working ? "Saving…" : "Save changes"}</button>
                    <button type="button" className={smallButton} onClick={() => setEditing(null)} disabled={working}>Cancel</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="min-w-0">
                    <strong className="block truncate text-sm text-ink">{bookmark.name}</strong>
                    {bookmark.place.label !== bookmark.name && <span className="block truncate text-xs text-ink-soft">{bookmark.place.label}</span>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {confirmingDelete === bookmark.id ? (
                      <>
                        <span className="self-center text-xs font-semibold text-ink">Delete “{bookmark.name}”?</span>
                        <button type="button" className="min-h-9 rounded-lg bg-crit px-3 text-xs font-bold text-white disabled:opacity-60" onClick={() => void remove(bookmark.id)} disabled={working}>{working ? "Deleting…" : "Yes, delete"}</button>
                        <button type="button" className={smallButton} onClick={() => setConfirmingDelete(null)} disabled={working}>Keep it</button>
                      </>
                    ) : (
                      <>
                        {onOpen && <button type="button" className="min-h-9 rounded-lg bg-brand px-3 text-xs font-bold text-white hover:bg-brand-hover" onClick={() => onOpen(bookmark)}>Open</button>}
                        <button type="button" className={smallButton} aria-label={`Edit ${bookmark.name}`} onClick={() => { setEditing({ id: bookmark.id, name: bookmark.name, location: bookmark.place.label, picked: null }); setConfirmingDelete(null); setMessage(""); setError(""); }}>Edit</button>
                        <button type="button" className={`${smallButton} text-crit`} aria-label={`Delete ${bookmark.name}`} onClick={() => { setConfirmingDelete(bookmark.id); setEditing(null); }}>Delete</button>
                      </>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {bookmarks.length >= MAX_BOOKMARKS ? (
        <p className="mt-3 text-xs text-ink-soft">You have reached the limit of {MAX_BOOKMARKS} bookmarks. Delete one to add another.</p>
      ) : (
        <form className="account-form mt-4" onSubmit={add}>
          <label htmlFor="bookmark-new-location">Location to bookmark</label>
          <PlaceInput id="bookmark-new-location" value={location} onChange={(value, place) => { setLocation(value); setPicked(place); }} locations={locations} required placeholder="Start typing an address, area, or landmark" />
          <label htmlFor="bookmark-new-name">Name (optional)</label>
          <input id="bookmark-new-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder="e.g. Gym, Lola’s house" />
          <button type="submit" className="submit-btn mt-1" disabled={working}>{working && !editing && !confirmingDelete ? "Adding…" : "Add bookmark"}</button>
        </form>
      )}
      {message && <div className="account-message mt-3" role="status">{message}</div>}
      {error && <div className="account-message error mt-3" role="alert">{error}</div>}
    </section>
  );
}

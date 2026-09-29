---
type: wayfinder:grilling
status: closed
assignee: opencode
blocked_by: []
---

# Define the first complete local-music journey

## Question

What is the smallest end-to-end journey that makes the macOS app useful for someone with an existing local music collection: from selecting folders through finding tracks, curating a playlist, organizing the library, and previewing the result? Which steps are essential for the first release, and which can wait?

## Resolution

The first complete journey is:

1. Choose a folder of existing local audio files and let the app index it.
2. Find tracks by search and filters, by navigating folders, or by browsing artists and albums.
3. Create a named playlist; add, remove, and reorder tracks.
4. Play, pause, and seek within a selected full track while choosing what belongs in the playlist. Continuous playlist playback is not required by this journey.
5. Add library-wide tags or notes to a track and optional notes about that track's role in this playlist.
6. Correct a track's displayed metadata, such as title, artist, album, or genre, so it is findable. Whether this changes the audio file's embedded tags is a separate decision.
7. Leave and return later to the saved playlist, its order, and its notes to keep refining it.

The immediate payoff is a durable, editable playlist, not export to another app. File moves, renames, duplicate resolution, streaming import, and DJ handoff are not required in this first journey. Their place in the broader MVP or later releases remains to be decided by the relevant tickets.

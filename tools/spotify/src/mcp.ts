import { z } from "zod"

import {
  type SpotifyCreatePlaylistInput,
  type SpotifyGetMeInput,
  type SpotifyListMyPlaylistsInput,
  type SpotifySearchTracksInput,
  type SpotifyToolsConfig,
  executeSpotifyCreatePlaylist,
  executeSpotifyGetMe,
  executeSpotifyListMyPlaylists,
  executeSpotifySearchTracks,
  spotifyCreatePlaylistInputSchema,
  spotifyGetMeInputSchema,
  spotifyListMyPlaylistsInputSchema,
  spotifySearchTracksInputSchema,
} from "./index"

export type McpToolDefinition<TInput> = {
  name: string
  description: string
  inputSchema: z.ZodType<TInput>
  execute: (input: TInput) => Promise<unknown>
}

export function createSpotifyMcpTools(config: SpotifyToolsConfig = {}) {
  const tools: Record<string, McpToolDefinition<any>> = {
    spotify_get_me: {
      name: "spotify_get_me",
      description: "Fetch the current Spotify account profile for the authenticated user.",
      inputSchema: spotifyGetMeInputSchema,
      execute: (input: SpotifyGetMeInput) => executeSpotifyGetMe(input, config),
    },
    spotify_search_tracks: {
      name: "spotify_search_tracks",
      description: "Search Spotify tracks by query string and return compact track metadata.",
      inputSchema: spotifySearchTracksInputSchema,
      execute: (input: SpotifySearchTracksInput) => executeSpotifySearchTracks(input, config),
    },
    spotify_list_my_playlists: {
      name: "spotify_list_my_playlists",
      description: "List Spotify playlists for the authenticated user account.",
      inputSchema: spotifyListMyPlaylistsInputSchema,
      execute: (input: SpotifyListMyPlaylistsInput) => executeSpotifyListMyPlaylists(input, config),
    },
    spotify_create_playlist: {
      name: "spotify_create_playlist",
      description:
        "Create a Spotify playlist for the authenticated user. Requires explicit confirm=true guardrail.",
      inputSchema: spotifyCreatePlaylistInputSchema,
      execute: (input: SpotifyCreatePlaylistInput) => executeSpotifyCreatePlaylist(input, config),
    },
  }

  return tools
}

export type SpotifyMcpToolset = ReturnType<typeof createSpotifyMcpTools>

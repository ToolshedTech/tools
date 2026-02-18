import { tool } from "ai"
import { z } from "zod"

const spotifyToolsConfigSchema = z.object({
  accessToken: z.string().optional(),
  tokenEnvVar: z.string().default("SPOTIFY_ACCESS_TOKEN"),
  apiBaseUrl: z.string().url().default("https://api.spotify.com/v1"),
  defaultUserId: z.string().optional(),
})

export type SpotifyToolsConfig = z.input<typeof spotifyToolsConfigSchema>

export const spotifyGetMeInputSchema = z.object({})

export const spotifySearchTracksInputSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(50).default(10),
  offset: z.number().int().min(0).default(0),
  market: z.string().length(2).optional(),
})

export const spotifyListMyPlaylistsInputSchema = z.object({
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
})

export const spotifyCreatePlaylistInputSchema = z
  .object({
    userId: z.string().min(1).optional(),
    name: z.string().min(1).max(100),
    description: z.string().max(300).optional(),
    public: z.boolean().default(false),
    collaborative: z.boolean().default(false),
    confirm: z.literal(true),
  })
  .refine((value) => !(value.public && value.collaborative), {
    message: "Spotify collaborative playlists must be non-public.",
    path: ["collaborative"],
  })

export type SpotifyGetMeInput = z.infer<typeof spotifyGetMeInputSchema>
export type SpotifySearchTracksInput = z.infer<typeof spotifySearchTracksInputSchema>
export type SpotifyListMyPlaylistsInput = z.infer<typeof spotifyListMyPlaylistsInputSchema>
export type SpotifyCreatePlaylistInput = z.infer<typeof spotifyCreatePlaylistInputSchema>

const spotifyGetMeDescription = "Fetch the current Spotify account profile for the authenticated user."
const spotifySearchTracksDescription =
  "Search Spotify tracks by query string and return compact track metadata."
const spotifyListMyPlaylistsDescription =
  "List Spotify playlists for the authenticated user account."
const spotifyCreatePlaylistDescription =
  "Create a Spotify playlist for the authenticated user. Requires explicit confirm=true guardrail."

function resolveAccessToken(runtime: z.output<typeof spotifyToolsConfigSchema>) {
  const explicit = runtime.accessToken?.trim()
  const fromEnv = process.env[runtime.tokenEnvVar]?.trim()
  const token = explicit || fromEnv || undefined

  if (!token) {
    throw new Error(
      `Missing Spotify access token. Pass accessToken in config or set ${runtime.tokenEnvVar}.`
    )
  }

  return token
}

async function requestSpotify(args: {
  runtime: z.output<typeof spotifyToolsConfigSchema>
  token: string
  method: "GET" | "POST"
  path: string
  body?: unknown
}) {
  const response = await fetch(`${args.runtime.apiBaseUrl}${args.path}`, {
    method: args.method,
    headers: {
      authorization: `Bearer ${args.token}`,
      accept: "application/json",
      ...(args.body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: args.body === undefined ? undefined : JSON.stringify(args.body),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Spotify API request failed (${response.status}): ${detail.slice(0, 400)}`)
  }

  return response.json()
}

function searchTracksParams(input: SpotifySearchTracksInput) {
  const params = new URLSearchParams()
  params.set("q", input.query)
  params.set("type", "track")
  params.set("limit", String(input.limit))
  params.set("offset", String(input.offset))

  if (input.market) {
    params.set("market", input.market.toUpperCase())
  }

  return params
}

function listPlaylistsParams(input: SpotifyListMyPlaylistsInput) {
  const params = new URLSearchParams()
  params.set("limit", String(input.limit))
  params.set("offset", String(input.offset))
  return params
}

async function resolveUserId(runtime: z.output<typeof spotifyToolsConfigSchema>, token: string) {
  if (runtime.defaultUserId) {
    return runtime.defaultUserId
  }

  const me = await requestSpotify({
    runtime,
    token,
    method: "GET",
    path: "/me",
  })

  if (!me?.id) {
    throw new Error("Failed to resolve authenticated Spotify user id from /me endpoint.")
  }

  return String(me.id)
}

async function runSpotifyGetMe(
  _input: SpotifyGetMeInput,
  runtime: z.output<typeof spotifyToolsConfigSchema>
) {
  const token = resolveAccessToken(runtime)
  const payload = await requestSpotify({
    runtime,
    token,
    method: "GET",
    path: "/me",
  })

  return {
    id: String(payload.id ?? ""),
    displayName: payload.display_name ? String(payload.display_name) : null,
    email: payload.email ? String(payload.email) : null,
    country: payload.country ? String(payload.country) : null,
    product: payload.product ? String(payload.product) : null,
    followers: Number(payload.followers?.total ?? 0),
    uri: payload.uri ? String(payload.uri) : null,
  }
}

async function runSpotifySearchTracks(
  input: SpotifySearchTracksInput,
  runtime: z.output<typeof spotifyToolsConfigSchema>
) {
  const token = resolveAccessToken(runtime)
  const params = searchTracksParams(input)
  const payload = await requestSpotify({
    runtime,
    token,
    method: "GET",
    path: `/search?${params.toString()}`,
  })

  const items = Array.isArray(payload.tracks?.items) ? payload.tracks.items : []

  return {
    total: Number(payload.tracks?.total ?? items.length),
    limit: Number(payload.tracks?.limit ?? input.limit),
    offset: Number(payload.tracks?.offset ?? input.offset),
    tracks: items.map((track: any) => ({
      id: String(track.id ?? ""),
      name: String(track.name ?? ""),
      artists: Array.isArray(track.artists)
        ? track.artists
            .map((artist: any) => (artist?.name ? String(artist.name) : null))
            .filter((artist): artist is string => Boolean(artist))
        : [],
      album: track.album?.name ? String(track.album.name) : null,
      durationMs: Number(track.duration_ms ?? 0),
      popularity: Number(track.popularity ?? 0),
      uri: String(track.uri ?? ""),
      externalUrl: track.external_urls?.spotify ? String(track.external_urls.spotify) : null,
    })),
  }
}

async function runSpotifyListMyPlaylists(
  input: SpotifyListMyPlaylistsInput,
  runtime: z.output<typeof spotifyToolsConfigSchema>
) {
  const token = resolveAccessToken(runtime)
  const params = listPlaylistsParams(input)
  const payload = await requestSpotify({
    runtime,
    token,
    method: "GET",
    path: `/me/playlists?${params.toString()}`,
  })

  const items = Array.isArray(payload.items) ? payload.items : []
  return {
    total: Number(payload.total ?? items.length),
    limit: Number(payload.limit ?? input.limit),
    offset: Number(payload.offset ?? input.offset),
    playlists: items.map((playlist: any) => ({
      id: String(playlist.id ?? ""),
      name: String(playlist.name ?? ""),
      description: playlist.description ? String(playlist.description) : null,
      public: playlist.public === null ? null : Boolean(playlist.public),
      collaborative: Boolean(playlist.collaborative),
      ownerId: playlist.owner?.id ? String(playlist.owner.id) : null,
      tracksTotal: Number(playlist.tracks?.total ?? 0),
      snapshotId: playlist.snapshot_id ? String(playlist.snapshot_id) : null,
      externalUrl: playlist.external_urls?.spotify ? String(playlist.external_urls.spotify) : null,
    })),
  }
}

async function runSpotifyCreatePlaylist(
  input: SpotifyCreatePlaylistInput,
  runtime: z.output<typeof spotifyToolsConfigSchema>
) {
  const token = resolveAccessToken(runtime)
  const userId = input.userId ?? (await resolveUserId(runtime, token))
  const payload = await requestSpotify({
    runtime,
    token,
    method: "POST",
    path: `/users/${encodeURIComponent(userId)}/playlists`,
    body: {
      name: input.name,
      description: input.description,
      public: input.public,
      collaborative: input.collaborative,
    },
  })

  return {
    id: String(payload.id ?? ""),
    name: String(payload.name ?? ""),
    public: payload.public === null ? null : Boolean(payload.public),
    collaborative: Boolean(payload.collaborative),
    description: payload.description ? String(payload.description) : null,
    snapshotId: payload.snapshot_id ? String(payload.snapshot_id) : null,
    externalUrl: payload.external_urls?.spotify ? String(payload.external_urls.spotify) : null,
    ownerId: payload.owner?.id ? String(payload.owner.id) : null,
  }
}

export async function executeSpotifyGetMe(
  input: SpotifyGetMeInput,
  config: SpotifyToolsConfig = {}
) {
  const runtime = spotifyToolsConfigSchema.parse(config)
  return runSpotifyGetMe(input, runtime)
}

export async function executeSpotifySearchTracks(
  input: SpotifySearchTracksInput,
  config: SpotifyToolsConfig = {}
) {
  const runtime = spotifyToolsConfigSchema.parse(config)
  return runSpotifySearchTracks(input, runtime)
}

export async function executeSpotifyListMyPlaylists(
  input: SpotifyListMyPlaylistsInput,
  config: SpotifyToolsConfig = {}
) {
  const runtime = spotifyToolsConfigSchema.parse(config)
  return runSpotifyListMyPlaylists(input, runtime)
}

export async function executeSpotifyCreatePlaylist(
  input: SpotifyCreatePlaylistInput,
  config: SpotifyToolsConfig = {}
) {
  const runtime = spotifyToolsConfigSchema.parse(config)
  return runSpotifyCreatePlaylist(input, runtime)
}

export function createSpotifyGetMeTool(config: SpotifyToolsConfig = {}) {
  const runtime = spotifyToolsConfigSchema.parse(config)
  return tool({
    description: spotifyGetMeDescription,
    inputSchema: spotifyGetMeInputSchema,
    execute: async (input) => runSpotifyGetMe(input, runtime),
  })
}

export function createSpotifySearchTracksTool(config: SpotifyToolsConfig = {}) {
  const runtime = spotifyToolsConfigSchema.parse(config)
  return tool({
    description: spotifySearchTracksDescription,
    inputSchema: spotifySearchTracksInputSchema,
    execute: async (input) => runSpotifySearchTracks(input, runtime),
  })
}

export function createSpotifyListMyPlaylistsTool(config: SpotifyToolsConfig = {}) {
  const runtime = spotifyToolsConfigSchema.parse(config)
  return tool({
    description: spotifyListMyPlaylistsDescription,
    inputSchema: spotifyListMyPlaylistsInputSchema,
    execute: async (input) => runSpotifyListMyPlaylists(input, runtime),
  })
}

export function createSpotifyCreatePlaylistTool(config: SpotifyToolsConfig = {}) {
  const runtime = spotifyToolsConfigSchema.parse(config)
  return tool({
    description: spotifyCreatePlaylistDescription,
    inputSchema: spotifyCreatePlaylistInputSchema,
    execute: async (input) => runSpotifyCreatePlaylist(input, runtime),
  })
}

export function createSpotifyTools(config: SpotifyToolsConfig = {}) {
  return {
    spotify_get_me: createSpotifyGetMeTool(config),
    spotify_search_tracks: createSpotifySearchTracksTool(config),
    spotify_list_my_playlists: createSpotifyListMyPlaylistsTool(config),
    spotify_create_playlist: createSpotifyCreatePlaylistTool(config),
  }
}

export type SpotifyToolset = ReturnType<typeof createSpotifyTools>

export const spotify = createSpotifyTools()

export default spotify

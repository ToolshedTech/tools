# @toolshed/tools/spotify

AI SDK 6 provider bundle for Spotify.

## Exports

- `createSpotifyTools(config?)`
- `createSpotifyGetMeTool(config?)`
- `createSpotifySearchTracksTool(config?)`
- `createSpotifyListMyPlaylistsTool(config?)`
- `createSpotifyCreatePlaylistTool(config?)`
- `createSpotifyMcpTools(config?)` (optional MCP adapters)

## Usage

```ts
import { generateText } from "ai"
import spotify from "@toolshed/tools/spotify"

await generateText({
  model: "moonshotai/kimi-k2.5",
  tools: {
    ...spotify,
  },
  prompt: "Create a chill coding playlist",
})
```

## Write safety

`spotify_create_playlist` requires `confirm: true`.

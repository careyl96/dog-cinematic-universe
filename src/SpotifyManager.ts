import axios from 'axios'
import dotenv from 'dotenv'

dotenv.config()

export class SpotifyManager {
  private clientId: string
  private clientSecret: string
  private token: string | null = null
  private tokenExpiresAt: number = 0

  constructor() {
    this.clientId = process.env.SPOTIFY_CLIENT_ID || ''
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET || ''

    if (!this.clientId || !this.clientSecret) {
      throw new Error('Missing Spotify client ID or secret in environment variables.')
    }
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now()

    if (this.token && now < this.tokenExpiresAt) {
      return this.token
    }

    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({ grant_type: 'client_credentials' }),
      {
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    )

    this.token = response.data.access_token
    this.tokenExpiresAt = now + response.data.expires_in * 1000

    return this.token
  }

  private extractTrackId(trackUrl: string): string | null {
    const regex = /^https:\/\/open\.spotify\.com\/track\/([a-zA-Z0-9]+)(\?.*)?$/
    const match = trackUrl.match(regex)
    return match ? match[1] : null
  }
  private extractPlaylistId(url: string): string | null {
    const regex = /^(https:\/\/open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)|spotify:playlist:([a-zA-Z0-9]+))(\?.*)?$/
    const match = url.match(regex)
    return match ? match[2] || match[3] : null
  }

  public async getTrackNameAndAuthor(trackUrl: string): Promise<string> {
    // Extract the track ID from the URL
    const trackId = this.extractTrackId(trackUrl)
    if (!trackId) {
      throw new Error('Invalid Spotify track URL.')
    }

    // Get the access token for authorization
    const token = await this.getAccessToken()
    const headers = { Authorization: `Bearer ${token}` }

    // Fetch track details from the Spotify API
    const response = await axios.get(`https://api.spotify.com/v1/tracks/${trackId}`, { headers })
    const track = response.data

    // Extract name and artists from the track data
    const name = track.name
    const artists = track.artists.map((artist: any) => artist.name).join(', ')

    // Return the formatted string
    return `${name} - ${artists}`
  }

  public async getPlaylistTracks(playlistUrl: string, limit: number = 100): Promise<string[]> {
    const playlistId = this.extractPlaylistId(playlistUrl)
    if (!playlistId) {
      throw new Error('Invalid Spotify playlist URL.')
    }

    const token = await this.getAccessToken()
    const headers = { Authorization: `Bearer ${token}` }

    let tracks: string[] = []
    let nextUrl: string | null = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=${limit}`

    while (nextUrl) {
      const response = await axios.get(nextUrl, { headers })
      const data = response.data

      const pageTracks = data.items.map((item: any) => {
        const track = item.track
        const name = track.name
        const artists = track.artists.map((a: any) => a.name).join(', ')
        return `${name} - ${artists}`
      })

      tracks = tracks.concat(pageTracks)
      nextUrl = data.next
    }

    return tracks.slice(0, limit)
  }
}

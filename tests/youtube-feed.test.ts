import { test } from 'node:test'
import assert from 'node:assert/strict'
import { channelIdDeHtml, clasificarYouTube, parseFeed, urlFeed } from '../app/lib/youtube-feed.ts'

test('clasificarYouTube: video, canal, handle, lista y basura', () => {
  assert.deepEqual(clasificarYouTube('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3'), { kind: 'video', videoId: 'dQw4w9WgXcQ' })
  assert.deepEqual(clasificarYouTube('https://youtu.be/dQw4w9WgXcQ?si=x'), { kind: 'video', videoId: 'dQw4w9WgXcQ' })
  assert.deepEqual(clasificarYouTube('https://m.youtube.com/shorts/dQw4w9WgXcQ'), { kind: 'video', videoId: 'dQw4w9WgXcQ' })
  assert.deepEqual(clasificarYouTube('https://www.youtube.com/channel/UCX6OQ3DkcsbYNE6H8uQQuVA'), { kind: 'channel', channelId: 'UCX6OQ3DkcsbYNE6H8uQQuVA' })
  assert.deepEqual(clasificarYouTube('https://www.youtube.com/@MrBeast/videos'), { kind: 'handle', url: 'https://www.youtube.com/@MrBeast' })
  assert.deepEqual(clasificarYouTube('https://youtube.com/c/algo'), { kind: 'handle', url: 'https://www.youtube.com/c/algo' })
  assert.deepEqual(clasificarYouTube('https://www.youtube.com/playlist?list=PLabcdefghijklmn'), { kind: 'playlist', playlistId: 'PLabcdefghijklmn' })
  assert.equal(clasificarYouTube('https://evil.com/watch?v=dQw4w9WgXcQ'), null)
  assert.equal(clasificarYouTube('https://www.youtube.com.evil.com/@x'), null)
  assert.equal(clasificarYouTube('javascript:alert(1)'), null)
  assert.equal(clasificarYouTube('no es link'), null)
  assert.equal(clasificarYouTube('https://www.youtube.com/watch?v=corto'), null)
})

test('channelIdDeHtml y urlFeed', () => {
  assert.equal(channelIdDeHtml('..."externalId":"UCX6OQ3DkcsbYNE6H8uQQuVA","x"'), 'UCX6OQ3DkcsbYNE6H8uQQuVA')
  assert.equal(channelIdDeHtml('<html></html>'), null)
  assert.equal(urlFeed({ channelId: 'UCX6OQ3DkcsbYNE6H8uQQuVA' }), 'https://www.youtube.com/feeds/videos.xml?channel_id=UCX6OQ3DkcsbYNE6H8uQQuVA')
  assert.equal(urlFeed({ playlistId: 'PLx' }), 'https://www.youtube.com/feeds/videos.xml?playlist_id=PLx')
})

test('parseFeed: ids, título con entidades y orden del más nuevo al más viejo', () => {
  const xml = `<feed><entry><id>yt:video:aaaaaaaaaaa</id><yt:videoId>aaaaaaaaaaa</yt:videoId><title>Viejo &amp; bueno</title><published>2026-11-01T10:00:00+00:00</published></entry>
  <entry><yt:videoId>bbbbbbbbbbb</yt:videoId><title>Nuevo</title><published>2026-11-10T10:00:00+00:00</published></entry>
  <entry><title>sin id</title></entry></feed>`
  const v = parseFeed(xml)
  assert.deepEqual(v.map((x) => x.id), ['bbbbbbbbbbb', 'aaaaaaaaaaa'])
  assert.equal(v[1].title, 'Viejo & bueno')
})

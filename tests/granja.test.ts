import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildPlan, folderNames, genericAccounts, hooksCost, parseAccountLine, parseAccountsText, planSignature,
  splitParts, validateHooks, MAX_HOOK_WORDS,
} from '../app/lib/granja.ts'
import { buildHooksPrompt, generateHooks } from '../app/lib/granja-ganchos.ts'

test('parseAccountsText: @handle, URLs, handle,red; infiere red y deduplica', () => {
  const text = [
    '@Maria.Ventas',
    'maria.ventas',                                  // repetida (misma red por defecto)
    'https://www.tiktok.com/@pepe_01?lang=es',
    'https://instagram.com/tienda.lima/',
    'www.facebook.com/profile.php?id=10009',
    'https://m.youtube.com/@CanalTop/videos',
    'youtube.com/c/OtroCanal',
    'carla,ig',
    'fb;carla',
    'carla\tinstagram',                              // repetida de carla,ig
    '# comentario',
    '',
    'esto no es una cuenta válida!!',
    'https://www.instagram.com/p/ABC123/',           // post, no perfil
  ].join('\n')
  const r = parseAccountsText(text, 'tiktok')
  assert.deepEqual(r.accounts, [
    { handle: 'maria.ventas', network: 'tiktok' },
    { handle: 'pepe_01', network: 'tiktok' },
    { handle: 'tienda.lima', network: 'instagram' },
    { handle: '10009', network: 'facebook' },
    { handle: 'canaltop', network: 'youtube' },
    { handle: 'otrocanal', network: 'youtube' },
    { handle: 'carla', network: 'instagram' },
    { handle: 'carla', network: 'facebook' },
  ])
  assert.equal(r.duplicates, 2)
  assert.equal(r.invalid.length, 2)
})

test('parseAccountLine: red por defecto y rechazos', () => {
  assert.deepEqual(parseAccountLine('@x.y', 'instagram'), { handle: 'x.y', network: 'instagram' })
  assert.equal(parseAccountLine('@', 'tiktok'), null)
  assert.equal(parseAccountLine('a,b,c', 'tiktok'), null)
  assert.equal(parseAccountLine('hola,twitter', 'tiktok'), null)
  assert.equal(parseAccountLine('x'.repeat(61), 'tiktok'), null)
})

test('parseAccountsText: respeta el máximo', () => {
  const text = Array.from({ length: 30 }, (_, i) => `@c${i}`).join('\n')
  assert.equal(parseAccountsText(text, 'tiktok', 10).accounts.length, 10)
})

test('genericAccounts y folderNames', () => {
  assert.deepEqual(genericAccounts(3).map((a) => a.handle), ['cuenta-001', 'cuenta-002', 'cuenta-003'])
  assert.deepEqual(
    folderNames([{ handle: 'a', network: 'tiktok' }, { handle: 'a', network: 'instagram' }, { handle: 'b', network: 'tiktok' }]),
    ['@a-tiktok', '@a-instagram', '@b'],
  )
})

test('hooksCost: 1 crédito cada 20 ganchos, mínimo 1', () => {
  assert.equal(hooksCost(0), 0)
  assert.equal(hooksCost(1), 1)
  assert.equal(hooksCost(20), 1)
  assert.equal(hooksCost(21), 2)
  assert.equal(hooksCost(120), 6)
})

test('buildPlan: cada salida con perfil/zoom/velocidad propios y sin repetidos', () => {
  const plan = buildPlan(1000, 3, 5)
  assert.equal(plan.length, 3000)
  assert.equal(new Set(plan.map((p) => p.profileIndex)).size, 3000)
  assert.ok(plan.every((p) => p.profileIndex >= 1), 'nunca el perfil 0 (original)')
  assert.equal(new Set(plan.map(planSignature)).size, 3000, 'firmas únicas')
  assert.equal(new Set(plan.map((p) => JSON.stringify(p.profile))).size, 3000, 'perfiles de color únicos')
  for (const p of plan) {
    assert.ok(p.zoom >= 1 && p.zoom <= 1.06, `zoom ${p.zoom}`)
    assert.ok(p.speed >= 0.97 && p.speed <= 1.03, `speed ${p.speed}`)
    assert.ok(p.base >= 0 && p.base < 5)
  }
  // Varía de verdad: usa varios zoom, varias velocidades, rota todas las bases.
  assert.ok(new Set(plan.map((p) => p.zoom)).size >= 6)
  assert.ok(new Set(plan.map((p) => p.speed)).size >= 6)
  assert.equal(new Set(plan.map((p) => p.base)).size, 5)
  // Videos de una misma cuenta: distinta combinación zoom+velocidad.
  const small = buildPlan(3, 2, 1)
  assert.deepEqual(small.map((p) => [p.account, p.n]), [[0, 1], [0, 2], [1, 1], [1, 2], [2, 1], [2, 2]])
  for (let a = 0; a < 3; a++) {
    const [x, y] = small.filter((p) => p.account === a)
    assert.notDeepEqual([x.zoom, x.speed], [y.zoom, y.speed])
  }
})

test('splitParts: partes de hasta 40 sin partir cuentas', () => {
  const parts = splitParts(buildPlan(50, 3, 2), 40)
  assert.equal(parts.flat().length, 150)
  for (const part of parts) {
    assert.ok(part.length <= 40)
    const accs = new Set(part.map((p) => p.account))
    for (const a of accs) assert.equal(part.filter((p) => p.account === a).length, 3)
  }
  assert.equal(splitParts(buildPlan(10, 1, 1), 40).length, 1)
})

const slots = [{ id: 's0' }, { id: 's1' }, { id: 's2' }, { id: 's3' }, { id: 's4' }, { id: 's5' }]
const cap = 'Mira esto hasta el final #granja #iphone #tiktok'

test('validateHooks: acepta lo válido y rechaza largos, repetidos, sin hashtags y promesas', () => {
  const raw = {
    videos: [
      { id: 's0', gancho: '«Nadie te cuenta esto de las granjas»', caption: cap },
      { id: 's1', gancho: 'Nadie te cuenta esto de las granjas!', caption: cap }, // repetido (sin tildes/signos)
      { id: 's2', gancho: 'uno dos tres cuatro cinco seis siete ocho nueve', caption: cap }, // 9 palabras
      { id: 's3', gancho: 'Gana $500 al día con esto', caption: cap }, // promesa de dinero
      { id: 's4', gancho: 'Así se ve de noche', caption: 'Sin hashtags aquí #uno' },
      { id: 'zz', gancho: 'Id que no se pidió', caption: cap },
      { id: 's5', gancho: 'Cuarenta celulares, una sola persona', caption: 'Mira #a #b #c #d #e' },
      'basura',
    ],
  }
  const v = validateHooks(raw, slots, ['otro gancho viejo'])
  assert.deepEqual(Object.keys(v.items).sort(), ['s0', 's5'])
  assert.equal(v.items.s0.hook, 'Nadie te cuenta esto de las granjas')
  assert.deepEqual(v.missing, ['s1', 's2', 's3', 's4'])
})

test('validateHooks: respeta ganchos ya usados y JSON inválido', () => {
  const v = validateHooks({ videos: [{ id: 's0', gancho: 'Ya usado', caption: cap }] }, [{ id: 's0' }], ['ya usado'])
  assert.deepEqual(v.missing, ['s0'])
  assert.deepEqual(validateHooks(null, [{ id: 's0' }]).missing, ['s0'])
  assert.deepEqual(validateHooks({ videos: 'x' }, [{ id: 's0' }]).missing, ['s0'])
  assert.ok(MAX_HOOK_WORDS === 8)
})

test('generateHooks: parte en llamadas, reintenta los que faltan y no repite', async () => {
  const many = Array.from({ length: 70 }, (_, i) => ({ id: `s${i}`, handle: `c${i}`, network: 'tiktok' as const }))
  const prompts: string[] = []
  let calls = 0
  const fake = async (prompt: string) => {
    calls++
    prompts.push(prompt)
    const ids = [...prompt.matchAll(/id "(s\d+)"/g)].map((m) => m[1])
    // 1ª ronda: deja vacío el último id de cada llamada y repite un gancho; 2ª: completa.
    return {
      videos: ids.map((id, k) => ({
        id,
        gancho: calls <= 2 && k === ids.length - 1 ? 'Gancho repetido uno' : calls <= 2 && k === 0 ? 'Gancho repetido uno' : `Gancho número ${id} ronda ${calls}`,
        caption: cap,
      })),
    }
  }
  const r = await generateHooks(many, { tema: 'granjas', idioma: 'es', tono: 'curioso' }, [], fake)
  assert.equal(calls, 3, '2 llamadas (60 + 10) + 1 reintento')
  assert.deepEqual(r.missing, [])
  assert.equal(Object.keys(r.items).length, 70)
  const hooks = Object.values(r.items).map((h) => h.hook.toLowerCase())
  assert.equal(new Set(hooks).size, 70)
  assert.match(prompts[2], /NO repitas/)
  assert.match(buildHooksPrompt(many.slice(0, 1), { tema: 't', idioma: 'en', tono: 'divertido' }, []), /Idioma: inglés/)
})

test('generateHooks: si Claude falla siempre, lanza', async () => {
  await assert.rejects(
    generateHooks([{ id: 's0', handle: 'a', network: 'tiktok' }], { tema: 't', idioma: 'es', tono: 'x' }, [], async () => { throw new Error('caído') }),
    /caído/,
  )
})

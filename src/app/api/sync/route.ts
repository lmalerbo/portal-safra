export const dynamic = 'force-static'

export async function POST() {
  return new Response('Not available in static build', { status: 404 })
}

export const dynamic = 'force-static'

export async function GET() {
  return new Response('Not available in static build', { status: 404 })
}

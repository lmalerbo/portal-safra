import { ImageResponse } from 'next/og'

export const size = { width: 64, height: 64 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#15803d',
          borderRadius: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: 30,
          fontWeight: 700,
          fontFamily: 'Arial, sans-serif',
        }}
      >
        PS
      </div>
    ),
    { ...size }
  )
}

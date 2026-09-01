import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'EV& WARP',
    short_name: 'WARP',
    description: '영업 파이프라인 관리 시스템',
    start_url: '/m/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0B1D3A',
    theme_color: '#0B1D3A',
    icons: [],
  }
}

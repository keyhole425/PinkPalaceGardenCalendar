import type { MetadataRoute } from 'next';

/** So figgy can live on the home screen and open without browser chrome. */
export default function manifest(): MetadataRoute.Manifest {
	return {
		name: 'figgy',
		short_name: 'figgy',
		description: 'The Pink Palace garden calendar',
		start_url: '/now',
		display: 'standalone',
		background_color: '#ffffff',
		theme_color: '#fec6d3',
		icons: [
			{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
			{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
			{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
		],
	};
}

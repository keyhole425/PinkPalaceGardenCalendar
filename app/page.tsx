import { redirect } from 'next/navigation';

// Phase 2 puts the "what's due now" dashboard here. Until then the year grid
// is the only thing worth showing.
export default function Home() {
	redirect('/grid');
}

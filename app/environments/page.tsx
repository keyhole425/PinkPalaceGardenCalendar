import { redirect } from 'next/navigation';

/**
 * Places moved into The garden.
 *
 * This page and /beds listed the same `environment` rows in two different
 * shapes, and neither showed the whole picture - the orchard had no view at
 * all. There is one place-shaped section now.
 */
export default function EnvironmentsPage() {
	redirect('/garden');
}

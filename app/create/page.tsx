// app/create/page.tsx — Form de crear listing.
import { redirect } from 'next/navigation';
import { tryGetUser } from '@/lib/auth';
import { ListingForm } from '@/components/listings/ListingForm';

export default async function CreateListingPage() {
  const me = await tryGetUser();
  if (!me) redirect('/');

  return (
    <main className="max-w-xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Publicar artículo</h1>
      <ListingForm />
    </main>
  );
}

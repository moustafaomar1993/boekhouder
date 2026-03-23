import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="text-center mb-10">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-3">Boekhouder</h1>
        <p className="text-lg text-gray-600 max-w-md mx-auto">
          Uw professionele boekhoudplatform
        </p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        <Link
          href="/login"
          className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-colors text-lg"
        >
          Inloggen
        </Link>

        <Link
          href="/register"
          className="block w-full text-center bg-white hover:bg-gray-50 text-gray-900 font-semibold py-3.5 px-6 rounded-xl border border-gray-200 transition-colors text-lg"
        >
          Registreren
        </Link>

        <div className="pt-2">
          <Link
            href="/advisory"
            className="block w-full text-center bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-6 rounded-xl transition-colors"
          >
            Ik wil een kennismakingsgesprek
          </Link>
        </div>
      </div>

      <p className="mt-10 text-sm text-gray-400">
        Veilig en betrouwbaar boekhouden
      </p>
    </div>
  );
}

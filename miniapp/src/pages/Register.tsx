export default function Register({ onRegistered }: { onRegistered: () => void }) {
  return (
    <div className="flex items-center justify-center min-h-screen px-6">
      <div className="text-center">
        <h1 className="text-xl font-bold mb-2">สมัครใช้งาน</h1>
        <button onClick={onRegistered} className="bg-blue-500 text-white px-4 py-2 rounded-lg">
          สมัคร
        </button>
      </div>
    </div>
  )
}
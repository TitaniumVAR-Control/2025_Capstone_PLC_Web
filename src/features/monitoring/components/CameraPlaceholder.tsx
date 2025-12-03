/**
 * 카메라 영역 플레이스홀더
 * 추후 실시간 카메라 스트림으로 대체 예정
 */
export function CameraPlaceholder() {
  return (
    <div className="bg-gray-800 rounded-lg shadow-md p-4 h-64 flex flex-col items-center justify-center">
      <div className="text-gray-400 text-center">
        <svg
          className="w-16 h-16 mx-auto mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
        <p className="text-lg font-medium">실시간 카메라 영역</p>
        <p className="text-sm text-gray-500 mt-1">추후 구현 예정</p>
      </div>
    </div>
  );
}

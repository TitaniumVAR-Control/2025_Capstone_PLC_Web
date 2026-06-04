# VAR 공정 PLC 모니터링 웹 대시보드

티타늄 주조용 **VAR(Vacuum Arc Remelting, 진공 아크 재용해)** 장비의 PLC 데이터를
실시간으로 모니터링하고, 공정 이력 조회·리포트 출력·PLC 진단까지 지원하는 웹 대시보드입니다.

> 본 저장소는 PLC 제어 백엔드 및 AI 분석 모델과 연동되는 시스템의 **프론트엔드**입니다.

## 주요 기능

- **실시간 모니터링** — 전류·진공도·하강속도 등 공정 변수를 실시간 차트로 시각화하고 PLC 이벤트 로그를 표시
- **공정 이력 조회** — 과거 용해 작업 목록과 상세 데이터 조회
- **공정 리포트** — 작업별 그래프 리포트 및 공정 정보 리포트 출력
- **PLC 진단/시뮬레이션** — PLC 연결 상태 점검 및 시뮬레이션 시퀀스 테스트
- **다크/라이트 테마** 전환 지원

## 기술 스택

- **React 19** + **TypeScript**
- **Vite** — 빌드 도구
- **Tailwind CSS v4** — 스타일링
- **Recharts** — 차트 라이브러리

## 프로젝트 구조

```
src/
├─ features/
│  ├─ monitoring/   # 실시간 모니터링 대시보드(UnifiedDashboard)
│  ├─ history/      # 공정 이력 조회
│  ├─ report/       # 공정 리포트 출력
│  └─ plc-diag/     # PLC 진단/시뮬레이션
├─ lib/             # CSV 파서, 상수 등 공통 유틸
└─ App.tsx
```

> 아키텍처는 [Bulletproof React](https://github.com/alan2207/bulletproof-react)의 feature 기반 구조를 참고했습니다.

## 실행 방법

```bash
npm install
npm run dev     # 개발 서버
npm run build   # 프로덕션 빌드
```

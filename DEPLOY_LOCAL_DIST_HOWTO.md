# Local build → GitHub Pages (dist) 배포 방식

이 프로젝트는 GitHub Actions에서 npm 네트워크/레지스트리 이슈가 자주 나서,
가장 안정적인 방식은 **로컬에서 build(dist 생성) → dist를 GitHub에 푸시**하는 방식입니다.

## 1) 로컬에서 빌드
```bash
npm install
npm run build
```
- `dist/` 폴더가 생성됩니다.

## 2) dist 포함해서 커밋/푸시
```bash
git add dist
git commit -m "Update dist build"
git push
```

## 3) GitHub Pages 설정
Repo → Settings → Pages
- Source: Deploy from a branch
- Branch: main
- Folder: /dist

## 4) 업데이트 루틴
코드 수정 후엔 항상:
```bash
npm run build
git add dist
git commit -m "Update dist"
git push
```

## (중요) base 경로
Repo Pages 경로가 `/Regime-Lookout/` 이므로 vite `base`는:
- `base: "/Regime-Lookout/"` 로 유지해야 합니다.

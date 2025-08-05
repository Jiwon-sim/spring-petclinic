# Spring PetClinic 배포 가이드

## 🚀 배포 순서

### 1. GitHub Repository Secrets 설정
GitHub Repository → Settings → Secrets and variables → Actions에서 추가:
```
HARBOR_USERNAME: Harbor 사용자명
HARBOR_PASSWORD: Harbor 비밀번호
```

### 2. Harbor 프로젝트 생성
- Harbor UI (`https://harbor.bluesunnywings.com`)에 접속
- `library` 프로젝트가 없다면 생성

### 3. 코드 푸시 (CI 트리거)
```bash
git add .
git commit -m "Add CI/CD configuration"
git push origin main
```

### 4. ArgoCD Application 등록
```bash
kubectl apply -f k8s/petclinic-argocd-app.yaml
```

### 5. 배포 상태 확인
```bash
# ArgoCD 앱 상태 확인
kubectl get application petclinic -n argo-cd

# 네임스페이스 확인
kubectl get ns petclinic

# Pod 상태 확인
kubectl get pods -n petclinic

# 서비스 확인
kubectl get svc -n petclinic

# Ingress 확인
kubectl get ingress -n petclinic
```

### 6. 접속 확인
- **도메인**: `https://petclinic.bluesunnywings.com`
- **DNS 설정 필요**: 도메인이 EKS LoadBalancer IP를 가리키도록 설정

## 🔧 트러블슈팅

### Harbor 이미지 Pull 실패 시
```bash
# Harbor 로그인 확인
docker login harbor.bluesunnywings.com

# 이미지 확인
docker pull harbor.bluesunnywings.com/library/spring-petclinic:latest
```

### ArgoCD 동기화 실패 시
```bash
# ArgoCD 앱 상세 정보
kubectl describe application petclinic -n argo-cd

# 수동 동기화
kubectl patch application petclinic -n argo-cd --type merge -p '{"operation":{"sync":{}}}'
```

## 📋 완료 체크리스트
- [ ] GitHub Secrets 설정
- [ ] Harbor 프로젝트 생성
- [ ] 코드 푸시 완료
- [ ] CI 파이프라인 성공
- [ ] Harbor에 이미지 업로드 확인
- [ ] ArgoCD Application 등록
- [ ] Pod 정상 실행 확인
- [ ] 도메인 접속 확인
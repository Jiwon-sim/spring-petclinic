# Spring PetClinic 트러블슈팅

## ImagePullBackOff 에러 해결

### 🚨 문제 상황
```
NAME                         READY   STATUS             RESTARTS   AGE
petclinic-6cd4749c9d-kmfck   0/1     ImagePullBackOff   0          11m
```

### 🔍 원인 분석

#### 1. 에러 메시지 확인
```bash
kubectl describe pod -n petclinic <pod-name>
```

**발견된 에러**:
```
Failed to pull image "harbor.bluesunnywings.com/library/petclinic:v1.0.0": 
rpc error: code = NotFound desc = failed to resolve reference: not found
```

#### 2. 이미지 이름 불일치 문제

**CI/CD에서 빌드하는 이미지**:
```yaml
# .github/workflows/ci-push.yaml
env:
  IMAGE_NAME: spring-petclinic  # ← 실제 이미지명
```
**결과**: `harbor.bluesunnywings.com/library/spring-petclinic:v1.0.0`

**K8s에서 찾으려는 이미지**:
```yaml
# k8s/petclinic.yml
image: harbor.bluesunnywings.com/library/petclinic:v1.0.0  # ← 잘못된 이미지명
```

### ✅ 해결 방법

#### 방법 1: K8s 매니페스트 수정 (권장)
```yaml
# k8s/petclinic.yml
containers:
  - name: workload
    image: harbor.bluesunnywings.com/library/spring-petclinic:v1.0.0  # ← 수정
```

#### 방법 2: CI/CD 파이프라인 수정
```yaml
# .github/workflows/ci-push.yaml
env:
  IMAGE_NAME: petclinic  # ← K8s와 맞춤
```

### 🔧 검증 단계

#### 1. Harbor에서 이미지 확인
```bash
docker images | grep petclinic
```

#### 2. 매니페스트 적용
```bash
kubectl apply -f k8s/petclinic.yml
```

#### 3. 파드 상태 확인
```bash
kubectl get pods -n petclinic
kubectl describe pod -n petclinic <pod-name>
```

### 📝 GitOps 고려사항

**태그 전략**:
- `latest`: 항상 최신 이미지 (개발환경)
- `v1.0.0`: 고정 버전 (운영환경, ArgoCD 자동감지)
- `${{ github.sha }}`: 커밋별 고유 태그

**ArgoCD 자동 재배포**:
```yaml
# 동일한 태그로 새 이미지 푸시 시 ArgoCD가 감지하여 자동 재배포
image: harbor.bluesunnywings.com/library/spring-petclinic:v1.0.0
```

### 🚀 최종 설정

**CI/CD 파이프라인**:
```yaml
env:
  IMAGE_NAME: spring-petclinic
  IMAGE_TAG: v1.0.0
```

**K8s 매니페스트**:
```yaml
image: harbor.bluesunnywings.com/library/spring-petclinic:v1.0.0
```

### 💡 예방 방법

1. **이미지명 일관성 유지**: CI/CD와 K8s 매니페스트에서 동일한 이미지명 사용
2. **태그 전략 수립**: 환경별 태그 규칙 정의
3. **Harbor 이미지 확인**: 배포 전 실제 이미지 존재 여부 검증
4. **ArgoCD 동기화**: GitOps 워크플로우에서 이미지 태그 일치 확인

---
**핵심**: 이미지명 불일치로 인한 ImagePullBackOff 에러
